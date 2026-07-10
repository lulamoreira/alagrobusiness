
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS em_startups boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_anuncios_em_startups
  ON public.anuncios (em_startups)
  WHERE em_startups = true;

CREATE OR REPLACE FUNCTION public.guard_anuncio_em_startups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tipo public.tipo_perfil;
BEGIN
  IF COALESCE(NEW.em_startups, false) = true THEN
    SELECT tipo_perfil INTO _tipo
      FROM public.profiles
     WHERE id = NEW.vendedor_id
       AND deleted_at IS NULL;
    IF _tipo IS NULL OR _tipo NOT IN ('admin','startup_pme') THEN
      NEW.em_startups := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_anuncio_em_startups ON public.anuncios;
CREATE TRIGGER trg_guard_anuncio_em_startups
  BEFORE INSERT OR UPDATE ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.guard_anuncio_em_startups();
