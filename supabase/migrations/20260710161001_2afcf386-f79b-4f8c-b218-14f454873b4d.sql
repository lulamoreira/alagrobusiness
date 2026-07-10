
ALTER TABLE public.categorias_catalogo
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'produto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categorias_catalogo_tipo_check'
  ) THEN
    ALTER TABLE public.categorias_catalogo
      ADD CONSTRAINT categorias_catalogo_tipo_check
      CHECK (tipo IN ('produto','servico','ambos'));
  END IF;
END $$;

UPDATE public.categorias_catalogo
   SET tipo = 'servico'
 WHERE parent_id IS NULL
   AND deleted_at IS NULL
   AND (nome->>'pt') IN (
     'Consultoria e Assistência Técnica','Transporte e Logística','Armazenagem e Beneficiamento',
     'Mecanização e Operações','Serviços Aéreos e Drones','Serviços Veterinários',
     'Crédito, Seguro e Finanças','Certificação e Análises','Tecnologia e Software',
     'Marketing e Vendas','Irrigação e Recursos Hídricos','Manutenção e Reparos',
     'Serviços Ambientais','Mão de Obra e Treinamento','Construção Rural'
   );

CREATE OR REPLACE FUNCTION public.admin_catalogo_upsert(
  p_id uuid,
  p_parent_id uuid,
  p_nome jsonb,
  p_ordem integer,
  p_ativo boolean,
  p_icone text,
  p_tipo text DEFAULT 'produto'
)
 RETURNS public.categorias_catalogo
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.categorias_catalogo;
  _tipo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_nome IS NULL OR NOT (p_nome ? 'pt') OR length(coalesce(p_nome->>'pt','')) = 0 THEN
    RAISE EXCEPTION 'nome_pt_obrigatorio' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NOT NULL AND p_parent_id = p_id THEN
    RAISE EXCEPTION 'ciclo_invalido' USING ERRCODE = '22023';
  END IF;

  _tipo := COALESCE(NULLIF(p_tipo, ''), 'produto');
  IF _tipo NOT IN ('produto','servico','ambos') THEN
    RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, icone, tipo)
    VALUES (p_parent_id, p_nome, COALESCE(p_ordem, 0), COALESCE(p_ativo, true), p_icone, _tipo)
    RETURNING * INTO _row;
  ELSE
    UPDATE public.categorias_catalogo
       SET parent_id = p_parent_id,
           nome = p_nome,
           ordem = COALESCE(p_ordem, ordem),
           ativo = COALESCE(p_ativo, ativo),
           icone = p_icone,
           tipo = _tipo,
           updated_at = now()
     WHERE id = p_id AND deleted_at IS NULL
    RETURNING * INTO _row;
    IF _row.id IS NULL THEN
      RAISE EXCEPTION 'nao_encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN _row;
END; $function$;
