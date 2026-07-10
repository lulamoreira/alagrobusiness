-- 1) New profile type value (idempotent)
ALTER TYPE public.tipo_perfil ADD VALUE IF NOT EXISTS 'startup_pme';

-- 2) New offer type enum
DO $$ BEGIN
  CREATE TYPE public.tipo_oferta AS ENUM ('produto','servico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Add columns to anuncios (nullable service fields; tipo_oferta defaults to 'produto')
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS tipo_oferta public.tipo_oferta NOT NULL DEFAULT 'produto',
  ADD COLUMN IF NOT EXISTS servico_modelo_cobranca text,
  ADD COLUMN IF NOT EXISTS servico_area_atuacao text,
  ADD COLUMN IF NOT EXISTS servico_prazo text;

-- Validate service billing model
ALTER TABLE public.anuncios
  DROP CONSTRAINT IF EXISTS anuncios_servico_modelo_cobranca_check;
ALTER TABLE public.anuncios
  ADD CONSTRAINT anuncios_servico_modelo_cobranca_check
  CHECK (servico_modelo_cobranca IS NULL
         OR servico_modelo_cobranca IN ('hora','projeto','mensal'));

-- Helpful index for the new tab
CREATE INDEX IF NOT EXISTS anuncios_tipo_oferta_created_idx
  ON public.anuncios (tipo_oferta, created_at DESC)
  WHERE deleted_at IS NULL;

-- 4) Update handle_new_user whitelist to include startup_pme (keeps everything else)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _raw_tipo TEXT;
  _tipo public.tipo_perfil;
  _has_signup_tipo BOOLEAN;
  _status public.status_perfil;
  _idioma public.idioma_app;
  _moeda public.moeda_app;
  _tipo_dolar public.tipo_dolar;
  _nome TEXT; _telefone TEXT; _pais TEXT; _estado TEXT; _cidade TEXT; _avatar TEXT;
  _cats TEXT[]; _temas TEXT[];
  _lgpd_ok BOOLEAN; _perfil_completo BOOLEAN;
  _plano_pro_id uuid;
  _convite public.convites_cortesia;
  _is_demo_meta boolean;
BEGIN
  _raw_tipo := NULLIF(NEW.raw_user_meta_data->>'tipo_perfil','');
  -- Whitelist inclui startup_pme; NUNCA aceita 'admin' via signup.
  _has_signup_tipo := _raw_tipo IS NOT NULL
    AND _raw_tipo IN ('comprador','vendedor','lojista','marca','startup_pme');
  IF _has_signup_tipo THEN _tipo := _raw_tipo::public.tipo_perfil; ELSE _tipo := 'comprador'; END IF;

  _lgpd_ok := COALESCE((NEW.raw_user_meta_data->>'lgpd_aceito')::boolean, false);
  _perfil_completo := _has_signup_tipo AND _lgpd_ok;

  IF NOT _perfil_completo THEN _status := 'aguardando_aprovacao';
  ELSIF _tipo IN ('comprador','vendedor') THEN _status := 'ativo';
  ELSE _status := 'aguardando_aprovacao'; -- lojista, marca, startup_pme
  END IF;

  _idioma := COALESCE(NULLIF(NEW.raw_user_meta_data->>'idioma',''),'pt-BR')::public.idioma_app;
  _moeda := COALESCE(NULLIF(NEW.raw_user_meta_data->>'moeda',''),'BRL')::public.moeda_app;
  _tipo_dolar := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_dolar',''),'comercial')::public.tipo_dolar;

  _nome := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'nome_completo',''),
    NULLIF(NEW.raw_user_meta_data->>'full_name',''),
    NULLIF(NEW.raw_user_meta_data->>'name',''),
    split_part(NEW.email,'@',1)
  );
  _telefone := NEW.raw_user_meta_data->>'telefone';
  _pais := COALESCE(NULLIF(NEW.raw_user_meta_data->>'pais',''),'Brasil');
  _estado := NEW.raw_user_meta_data->>'estado';
  _cidade := NEW.raw_user_meta_data->>'cidade';
  _avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url',''),
    NULLIF(NEW.raw_user_meta_data->>'picture','')
  );
  _is_demo_meta := COALESCE((NEW.raw_user_meta_data->>'is_demo')::boolean, false);

  BEGIN _cats := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'categorias_interesse'));
  EXCEPTION WHEN OTHERS THEN _cats := '{}'::text[]; END;
  BEGIN _temas := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'temas_noticias'));
  EXCEPTION WHEN OTHERS THEN _temas := '{}'::text[]; END;

  INSERT INTO public.profiles (
    id, nome_completo, email, telefone, pais, estado, cidade, avatar_url,
    tipo_perfil, categorias_interesse, idioma_preferido, moeda_preferida,
    tipo_dolar_preferido, status, perfil_completo,
    termos_aceitos_em, termos_versao, is_demo
  ) VALUES (
    NEW.id, _nome, NEW.email, _telefone, _pais, _estado, _cidade, _avatar,
    _tipo,
    (SELECT COALESCE(array_agg(c::public.categoria_agro),'{}') FROM unnest(_cats) c WHERE c IN ('fruta','grao','legumes','vegetal')),
    _idioma, _moeda, _tipo_dolar, _status, _perfil_completo,
    CASE WHEN _lgpd_ok THEN now() ELSE NULL END,
    NEW.raw_user_meta_data->>'termos_versao',
    _is_demo_meta
  );

  INSERT INTO public.preferencias (usuario_id, idioma, moeda, tipo_dolar, temas_noticias)
  VALUES (NEW.id, _idioma, _moeda, _tipo_dolar, _temas);

  -- Cortesia por convite pendente (mantém comportamento existente)
  IF NEW.email IS NOT NULL THEN
    SELECT * INTO _convite FROM public.convites_cortesia
      WHERE lower(email) = lower(NEW.email)
        AND status = 'pendente'
        AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1;
    IF _convite.id IS NOT NULL THEN
      IF _convite.is_demo IS TRUE THEN
        -- demo: só ativa no primeiro login efetivo (via ativar_acesso_demo_se_pendente)
        NULL;
      ELSIF _convite.duracao_horas IS NOT NULL THEN
        PERFORM public._aplicar_cortesia_horas(NEW.id, _convite.plano_codigo, _convite.duracao_horas);
        UPDATE public.convites_cortesia
           SET status = 'usado', usado_em = now(), usado_por = NEW.id, updated_at = now()
         WHERE id = _convite.id;
      ELSE
        PERFORM public._aplicar_cortesia(NEW.id, _convite.plano_codigo, _convite.dias);
        UPDATE public.convites_cortesia
           SET status = 'usado', usado_em = now(), usado_por = NEW.id, updated_at = now()
         WHERE id = _convite.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;