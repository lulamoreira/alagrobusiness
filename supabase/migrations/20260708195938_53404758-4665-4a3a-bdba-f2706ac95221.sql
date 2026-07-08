-- 1) Catálogo hierárquico de categorias
CREATE TABLE public.categorias_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.categorias_catalogo(id) ON DELETE CASCADE,
  nome jsonb NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  icone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT categorias_catalogo_nome_pt CHECK (nome ? 'pt' AND length(nome->>'pt') > 0)
);

CREATE INDEX categorias_catalogo_parent_idx
  ON public.categorias_catalogo(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX categorias_catalogo_ativo_idx
  ON public.categorias_catalogo(ativo) WHERE deleted_at IS NULL;

GRANT SELECT ON public.categorias_catalogo TO authenticated;
GRANT ALL ON public.categorias_catalogo TO service_role;

ALTER TABLE public.categorias_catalogo ENABLE ROW LEVEL SECURITY;

-- Leitura para todo usuário autenticado (sem anon)
CREATE POLICY "catalogo_select_authenticated"
  ON public.categorias_catalogo FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Escrita bloqueada por RLS: só passa via RPCs SECURITY DEFINER
CREATE POLICY "catalogo_admin_write"
  ON public.categorias_catalogo FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_categorias_catalogo_updated_at
  BEFORE UPDATE ON public.categorias_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Coluna aditiva em anuncios (mantém enum "categoria" atual)
ALTER TABLE public.anuncios
  ADD COLUMN catalogo_item_id uuid REFERENCES public.categorias_catalogo(id) ON DELETE SET NULL;

CREATE INDEX anuncios_catalogo_item_idx
  ON public.anuncios(catalogo_item_id) WHERE deleted_at IS NULL;

-- 3) RPCs admin (SECURITY DEFINER + checagem is_admin)

CREATE OR REPLACE FUNCTION public.admin_catalogo_upsert(
  p_id uuid,
  p_parent_id uuid,
  p_nome jsonb,
  p_ordem int,
  p_ativo boolean,
  p_icone text
) RETURNS public.categorias_catalogo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.categorias_catalogo;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_nome IS NULL OR NOT (p_nome ? 'pt') OR length(coalesce(p_nome->>'pt','')) = 0 THEN
    RAISE EXCEPTION 'nome_pt_obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- Impede ciclo: um nó não pode ser pai de si mesmo
  IF p_id IS NOT NULL AND p_parent_id = p_id THEN
    RAISE EXCEPTION 'ciclo_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, icone)
    VALUES (p_parent_id, p_nome, COALESCE(p_ordem, 0), COALESCE(p_ativo, true), p_icone)
    RETURNING * INTO _row;
  ELSE
    UPDATE public.categorias_catalogo
       SET parent_id = p_parent_id,
           nome = p_nome,
           ordem = COALESCE(p_ordem, ordem),
           ativo = COALESCE(p_ativo, ativo),
           icone = p_icone,
           updated_at = now()
     WHERE id = p_id AND deleted_at IS NULL
    RETURNING * INTO _row;
    IF _row.id IS NULL THEN
      RAISE EXCEPTION 'nao_encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_catalogo_delete(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  -- Soft-delete recursivo (nó e descendentes)
  WITH RECURSIVE subtree AS (
    SELECT id FROM public.categorias_catalogo WHERE id = p_id AND deleted_at IS NULL
    UNION ALL
    SELECT c.id FROM public.categorias_catalogo c
      JOIN subtree s ON c.parent_id = s.id
     WHERE c.deleted_at IS NULL
  )
  UPDATE public.categorias_catalogo
     SET deleted_at = now(), ativo = false, updated_at = now()
   WHERE id IN (SELECT id FROM subtree);
END; $$;

-- Helper: retorna todos os IDs da subárvore (inclusive raiz), leitura livre para authenticated.
CREATE OR REPLACE FUNCTION public.catalogo_subtree_ids(p_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subtree AS (
    SELECT c.id FROM public.categorias_catalogo c
      WHERE c.id = p_id AND c.deleted_at IS NULL
    UNION ALL
    SELECT c.id FROM public.categorias_catalogo c
      JOIN subtree s ON c.parent_id = s.id
     WHERE c.deleted_at IS NULL
  )
  SELECT id FROM subtree;
$$;

-- 4) Seed inicial (árvore de exemplo)
DO $seed$
DECLARE
  _graos uuid; _aves uuid; _frutas uuid;
BEGIN
  INSERT INTO public.categorias_catalogo (parent_id, nome, ordem)
  VALUES (NULL, '{"pt":"Grãos","en":"Grains","es":"Granos"}'::jsonb, 1)
  RETURNING id INTO _graos;

  INSERT INTO public.categorias_catalogo (parent_id, nome, ordem)
  VALUES (NULL, '{"pt":"Aves","en":"Poultry","es":"Aves"}'::jsonb, 2)
  RETURNING id INTO _aves;

  INSERT INTO public.categorias_catalogo (parent_id, nome, ordem)
  VALUES (NULL, '{"pt":"Frutas","en":"Fruits","es":"Frutas"}'::jsonb, 3)
  RETURNING id INTO _frutas;

  INSERT INTO public.categorias_catalogo (parent_id, nome, ordem) VALUES
    (_graos, '{"pt":"Soja","en":"Soy","es":"Soja"}'::jsonb, 1),
    (_graos, '{"pt":"Milho","en":"Corn","es":"Maíz"}'::jsonb, 2),
    (_aves, '{"pt":"Frango","en":"Chicken","es":"Pollo"}'::jsonb, 1),
    (_aves, '{"pt":"Galinha","en":"Hen","es":"Gallina"}'::jsonb, 2),
    (_aves, '{"pt":"Peru","en":"Turkey","es":"Pavo"}'::jsonb, 3),
    (_frutas, '{"pt":"Laranja","en":"Orange","es":"Naranja"}'::jsonb, 1),
    (_frutas, '{"pt":"Banana","en":"Banana","es":"Plátano"}'::jsonb, 2);
END $seed$;
