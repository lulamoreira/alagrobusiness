
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS destaque_ate timestamptz NULL,
  ADD COLUMN IF NOT EXISTS destaque_origem text NULL;

DO $$ BEGIN
  ALTER TABLE public.anuncios
    ADD CONSTRAINT anuncios_destaque_origem_check
    CHECK (destaque_origem IS NULL OR destaque_origem IN ('admin','pago'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS anuncios_destaque_ate_idx
  ON public.anuncios (destaque_ate)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.admin_destacar_anuncio(p_anuncio_id uuid, p_dias int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_dias IS NULL OR p_dias < 1 THEN
    RAISE EXCEPTION 'dias_invalido' USING ERRCODE = '22023';
  END IF;
  UPDATE public.anuncios
     SET destaque_ate = now() + (p_dias || ' days')::interval,
         destaque_origem = 'admin',
         updated_at = now()
   WHERE id = p_anuncio_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'anuncio_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_remover_destaque(p_anuncio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.anuncios
     SET destaque_ate = NULL,
         destaque_origem = NULL,
         updated_at = now()
   WHERE id = p_anuncio_id AND deleted_at IS NULL;
END; $$;

REVOKE ALL ON FUNCTION public.admin_destacar_anuncio(uuid, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_remover_destaque(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_destacar_anuncio(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remover_destaque(uuid) TO authenticated;
