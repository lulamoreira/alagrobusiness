
-- 1) Coluna segmento
ALTER TABLE public.categorias_catalogo
  ADD COLUMN IF NOT EXISTS segmento text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categorias_catalogo_segmento_check'
  ) THEN
    ALTER TABLE public.categorias_catalogo
      ADD CONSTRAINT categorias_catalogo_segmento_check
      CHECK (segmento IS NULL OR segmento IN ('agro','industrial'));
  END IF;
END $$;

-- 2) Marca industriais (15 topos)
UPDATE public.categorias_catalogo
   SET segmento = 'industrial', updated_at = now()
 WHERE parent_id IS NULL
   AND deleted_at IS NULL
   AND (nome->>'pt') IN (
     'Alimentos Processados','Bebidas','Óleos e Gorduras','Carnes e Frigoríficos',
     'Produtos de Limpeza','Higiene e Cosméticos','Embalagens','Têxteis e Vestuário',
     'Couro e Calçados','Papel e Celulose','Madeira e Móveis','Produtos Químicos Industriais',
     'Construção e Materiais','Máquinas e Equipamentos Industriais','Energia e Combustíveis'
   );

-- 3) Marca demais produtos como agro
UPDATE public.categorias_catalogo
   SET segmento = 'agro', updated_at = now()
 WHERE parent_id IS NULL
   AND tipo = 'produto'
   AND segmento IS NULL
   AND deleted_at IS NULL;

-- 4) Recria admin_catalogo_upsert com p_segmento (sem overload duplicado)
DROP FUNCTION IF EXISTS public.admin_catalogo_upsert(uuid, uuid, jsonb, integer, boolean, text, text);
DROP FUNCTION IF EXISTS public.admin_catalogo_upsert(uuid, uuid, jsonb, integer, boolean, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_catalogo_upsert(
  p_id uuid,
  p_parent_id uuid,
  p_nome jsonb,
  p_ordem integer,
  p_ativo boolean,
  p_icone text,
  p_tipo text DEFAULT 'produto',
  p_segmento text DEFAULT NULL
)
RETURNS public.categorias_catalogo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.categorias_catalogo;
  _tipo text;
  _seg text;
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

  _seg := NULLIF(p_segmento, '');
  IF _seg IS NOT NULL AND _seg NOT IN ('agro','industrial') THEN
    RAISE EXCEPTION 'segmento_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, icone, tipo, segmento)
    VALUES (p_parent_id, p_nome, COALESCE(p_ordem, 0), COALESCE(p_ativo, true), p_icone, _tipo, _seg)
    RETURNING * INTO _row;
  ELSE
    UPDATE public.categorias_catalogo
       SET parent_id = p_parent_id,
           nome = p_nome,
           ordem = COALESCE(p_ordem, ordem),
           ativo = COALESCE(p_ativo, ativo),
           icone = p_icone,
           tipo = _tipo,
           segmento = _seg,
           updated_at = now()
     WHERE id = p_id AND deleted_at IS NULL
    RETURNING * INTO _row;
    IF _row.id IS NULL THEN
      RAISE EXCEPTION 'nao_encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN _row;
END; $function$;
