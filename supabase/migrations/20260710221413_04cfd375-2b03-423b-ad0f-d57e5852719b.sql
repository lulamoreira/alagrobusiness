CREATE OR REPLACE FUNCTION public.guard_anuncio_destaque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.destaque_ate IS DISTINCT FROM OLD.destaque_ate
      OR NEW.destaque_origem IS DISTINCT FROM OLD.destaque_origem) THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'destaque_somente_admin' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_anuncio_destaque ON public.anuncios;
CREATE TRIGGER trg_guard_anuncio_destaque
  BEFORE UPDATE ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.guard_anuncio_destaque();