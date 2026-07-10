
-- 1) Colunas de status/sugestão
ALTER TABLE public.categorias_catalogo
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS sugerido_por uuid NULL,
  ADD COLUMN IF NOT EXISTS sugerido_em timestamptz NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema='public' AND constraint_name='categorias_catalogo_status_chk'
  ) THEN
    ALTER TABLE public.categorias_catalogo
      ADD CONSTRAINT categorias_catalogo_status_chk
      CHECK (status IN ('aprovado','pendente','rejeitado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS categorias_catalogo_status_idx
  ON public.categorias_catalogo (status) WHERE deleted_at IS NULL;

-- 2) Seed idempotente "Outros" (produto e serviço)
INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, icone, tipo, status)
SELECT NULL, '{"pt":"Outros","en":"Others","es":"Otros"}'::jsonb, 9999, true, NULL, 'produto', 'aprovado'
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_catalogo
  WHERE parent_id IS NULL AND tipo='produto' AND nome->>'pt'='Outros' AND deleted_at IS NULL
);

INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, icone, tipo, status)
SELECT NULL, '{"pt":"Outros","en":"Others","es":"Otros"}'::jsonb, 9999, true, NULL, 'servico', 'aprovado'
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_catalogo
  WHERE parent_id IS NULL AND tipo='servico' AND nome->>'pt'='Outros' AND deleted_at IS NULL
);

-- 3) RPC: sugerir_categoria (authenticated)
CREATE OR REPLACE FUNCTION public.sugerir_categoria(
  p_parent_id uuid,
  p_nome jsonb,
  p_tipo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tipo text;
  v_parent_tipo text;
  v_id uuid;
  v_pt text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501';
  END IF;

  v_pt := NULLIF(trim(p_nome->>'pt'), '');
  IF v_pt IS NULL THEN
    RAISE EXCEPTION 'nome.pt is required' USING ERRCODE='22023';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT tipo INTO v_parent_tipo
      FROM public.categorias_catalogo
     WHERE id = p_parent_id AND ativo = true AND status = 'aprovado' AND deleted_at IS NULL;
    IF v_parent_tipo IS NULL THEN
      RAISE EXCEPTION 'parent not found or not approved' USING ERRCODE='22023';
    END IF;
    v_tipo := v_parent_tipo;
  ELSE
    IF p_tipo NOT IN ('produto','servico') THEN
      RAISE EXCEPTION 'invalid tipo' USING ERRCODE='22023';
    END IF;
    v_tipo := p_tipo;
  END IF;

  -- Dedup: mesma sugestão pendente do mesmo usuário
  SELECT id INTO v_id
    FROM public.categorias_catalogo
   WHERE sugerido_por = v_uid
     AND status = 'pendente'
     AND (parent_id IS NOT DISTINCT FROM p_parent_id)
     AND lower(nome->>'pt') = lower(v_pt)
     AND deleted_at IS NULL
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, tipo, status, sugerido_por, sugerido_em)
  VALUES (p_parent_id, p_nome, 9998, false, v_tipo, 'pendente', v_uid, now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sugerir_categoria(uuid, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sugerir_categoria(uuid, jsonb, text) TO authenticated;

-- 4) admin_list_categorias_pendentes
CREATE OR REPLACE FUNCTION public.admin_list_categorias_pendentes()
RETURNS TABLE (
  id uuid,
  nome jsonb,
  tipo text,
  parent_id uuid,
  parent_nome jsonb,
  sugerido_por uuid,
  sugerido_por_nome text,
  sugerido_por_email text,
  sugerido_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.nome, c.tipo, c.parent_id, p.nome,
           c.sugerido_por, pr.nome_completo, pr.email, c.sugerido_em
      FROM public.categorias_catalogo c
      LEFT JOIN public.categorias_catalogo p ON p.id = c.parent_id
      LEFT JOIN public.profiles pr ON pr.id = c.sugerido_por
     WHERE c.status = 'pendente' AND c.deleted_at IS NULL
     ORDER BY c.sugerido_em DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_categorias_pendentes() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_categorias_pendentes() TO authenticated;

-- 5) admin_categoria_aprovar
CREATE OR REPLACE FUNCTION public.admin_categoria_aprovar(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.categorias_catalogo%ROWTYPE;
  v_nome text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_row FROM public.categorias_catalogo WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING ERRCODE='22023';
  END IF;

  UPDATE public.categorias_catalogo
     SET status = 'aprovado', ativo = true, updated_at = now()
   WHERE id = p_id;

  v_nome := COALESCE(v_row.nome->>'pt', v_row.nome->>'en', v_row.nome->>'es', '');

  IF v_row.sugerido_por IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link, lida)
    VALUES (
      v_row.sugerido_por,
      'categoria_aprovada',
      v_nome,
      v_nome,
      '/vender',
      false
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_categoria_aprovar(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_categoria_aprovar(uuid) TO authenticated;

-- 6) admin_categoria_rejeitar
CREATE OR REPLACE FUNCTION public.admin_categoria_rejeitar(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.categorias_catalogo%ROWTYPE;
  v_nome text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_row FROM public.categorias_catalogo WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING ERRCODE='22023';
  END IF;

  UPDATE public.categorias_catalogo
     SET status = 'rejeitado', ativo = false, updated_at = now()
   WHERE id = p_id;

  v_nome := COALESCE(v_row.nome->>'pt', v_row.nome->>'en', v_row.nome->>'es', '');

  IF v_row.sugerido_por IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link, lida)
    VALUES (
      v_row.sugerido_por,
      'categoria_rejeitada',
      v_nome,
      v_nome,
      NULL,
      false
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_categoria_rejeitar(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_categoria_rejeitar(uuid) TO authenticated;
