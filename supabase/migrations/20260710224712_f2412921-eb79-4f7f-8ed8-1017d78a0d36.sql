
CREATE OR REPLACE FUNCTION public.guard_anuncio_em_startups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tipo public.tipo_perfil;
  _pertence_startups boolean;
BEGIN
  -- Preserva regra existente: só admin/startup_pme podem marcar em_startups=true
  IF COALESCE(NEW.em_startups, false) = true THEN
    SELECT tipo_perfil INTO _tipo
      FROM public.profiles
     WHERE id = NEW.vendedor_id
       AND deleted_at IS NULL;
    IF _tipo IS NULL OR _tipo NOT IN ('admin','startup_pme') THEN
      NEW.em_startups := false;
    END IF;
  END IF;

  -- Determina se o anúncio pertence ao módulo Startups
  SELECT (COALESCE(NEW.em_startups, false) = true)
         OR EXISTS (
           SELECT 1 FROM public.profiles
            WHERE id = NEW.vendedor_id
              AND deleted_at IS NULL
              AND tipo_perfil = 'startup_pme'
         )
    INTO _pertence_startups;

  -- Anúncios do módulo Startups são sempre serviços
  IF _pertence_startups THEN
    NEW.tipo_oferta := 'servico';
  END IF;

  RETURN NEW;
END;
$function$;
