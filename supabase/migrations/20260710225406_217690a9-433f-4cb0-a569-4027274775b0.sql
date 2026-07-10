CREATE OR REPLACE FUNCTION public.guard_anuncio_em_startups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tipo public.tipo_perfil;
BEGIN
  SELECT tipo_perfil INTO _tipo
    FROM public.profiles
   WHERE id = NEW.vendedor_id AND deleted_at IS NULL;

  IF COALESCE(NEW.em_startups, false) = true THEN
    IF _tipo IS NULL OR _tipo NOT IN ('admin','startup_pme') THEN
      NEW.em_startups := false;
    END IF;
  END IF;

  IF COALESCE(NEW.em_startups, false) = true OR _tipo = 'startup_pme' THEN
    NEW.tipo_oferta := 'servico';
  END IF;

  RETURN NEW;
END;
$$;