
DO $cons$
DECLARE
  _leite uuid;
  _lat uuid;
  _maq uuid;
  _qui uuid;
BEGIN
  -- A) Laticínios
  SELECT id INTO _leite FROM public.categorias_catalogo
    WHERE parent_id IS NULL AND deleted_at IS NULL AND (nome->>'pt') = 'Leite e Derivados' LIMIT 1;
  SELECT id INTO _lat FROM public.categorias_catalogo
    WHERE parent_id IS NULL AND deleted_at IS NULL AND (nome->>'pt') = 'Laticínios Industrializados' LIMIT 1;

  IF _leite IS NOT NULL AND _lat IS NOT NULL THEN
    UPDATE public.categorias_catalogo
       SET parent_id = _leite, updated_at = now()
     WHERE parent_id = _lat
       AND deleted_at IS NULL
       AND (nome->>'pt') IN ('Leite em Pó','Leite Condensado','Creme de Leite')
       AND parent_id IS DISTINCT FROM _leite;

    UPDATE public.categorias_catalogo
       SET ativo = false, updated_at = now()
     WHERE parent_id = _lat
       AND deleted_at IS NULL
       AND (nome->>'pt') IN ('Manteiga Industrial','Queijo Processado')
       AND ativo = true;

    UPDATE public.categorias_catalogo
       SET ativo = false, updated_at = now()
     WHERE id = _lat AND ativo = true;
  END IF;

  -- B) Máquinas
  SELECT id INTO _maq FROM public.categorias_catalogo
    WHERE parent_id IS NULL AND deleted_at IS NULL AND (nome->>'pt') = 'Máquinas e Implementos' LIMIT 1;
  IF _maq IS NOT NULL THEN
    UPDATE public.categorias_catalogo
       SET nome = jsonb_build_object(
         'pt','Máquinas e Implementos Agrícolas',
         'en','Agricultural Machinery & Implements',
         'es','Maquinaria e Implementos Agrícolas'
       ), updated_at = now()
     WHERE id = _maq;
  END IF;

  -- C) Químicos
  SELECT id INTO _qui FROM public.categorias_catalogo
    WHERE parent_id IS NULL AND deleted_at IS NULL AND (nome->>'pt') = 'Químicos e Fertilizantes Industriais' LIMIT 1;
  IF _qui IS NOT NULL THEN
    UPDATE public.categorias_catalogo
       SET nome = jsonb_build_object(
         'pt','Produtos Químicos Industriais',
         'en','Industrial Chemicals',
         'es','Productos Químicos Industriales'
       ), updated_at = now()
     WHERE id = _qui;

    UPDATE public.categorias_catalogo
       SET ativo = false, updated_at = now()
     WHERE parent_id = _qui
       AND deleted_at IS NULL
       AND (nome->>'pt') IN ('Fertilizantes Industriais','Adubos')
       AND ativo = true;
  END IF;
END $cons$;
