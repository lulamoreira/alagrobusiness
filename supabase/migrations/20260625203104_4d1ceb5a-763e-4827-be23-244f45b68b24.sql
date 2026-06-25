
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS perfil_completo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _raw_tipo TEXT;
  _tipo public.tipo_perfil;
  _has_signup_tipo BOOLEAN;
  _status public.status_perfil;
  _idioma public.idioma_app;
  _moeda public.moeda_app;
  _tipo_dolar public.tipo_dolar;
  _nome TEXT;
  _telefone TEXT;
  _pais TEXT;
  _estado TEXT;
  _cidade TEXT;
  _avatar TEXT;
  _cats TEXT[];
  _temas TEXT[];
  _lgpd_ok BOOLEAN;
  _perfil_completo BOOLEAN;
BEGIN
  _raw_tipo := NULLIF(NEW.raw_user_meta_data->>'tipo_perfil','');
  _has_signup_tipo := _raw_tipo IS NOT NULL AND _raw_tipo IN ('comprador','vendedor','lojista','marca');

  -- SANITIZAÇÃO: admin ou inválido => comprador (mas não considerado escolha válida do usuário)
  IF _has_signup_tipo THEN
    _tipo := _raw_tipo::public.tipo_perfil;
  ELSE
    _tipo := 'comprador';
  END IF;

  _lgpd_ok := COALESCE((NEW.raw_user_meta_data->>'lgpd_aceito')::boolean, false);

  -- Perfil completo apenas se o usuário escolheu tipo válido E aceitou LGPD (fluxo de cadastro por e-mail)
  _perfil_completo := _has_signup_tipo AND _lgpd_ok;

  IF NOT _perfil_completo THEN
    _status := 'aguardando_aprovacao';
  ELSIF _tipo IN ('comprador','vendedor') THEN
    _status := 'ativo';
  ELSE
    _status := 'aguardando_aprovacao';
  END IF;

  _idioma := COALESCE(NULLIF(NEW.raw_user_meta_data->>'idioma',''),'pt-BR')::public.idioma_app;
  _moeda := COALESCE(NULLIF(NEW.raw_user_meta_data->>'moeda',''),'BRL')::public.moeda_app;
  _tipo_dolar := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_dolar',''),'comercial')::public.tipo_dolar;

  -- Nome: cadastro normal usa nome_completo; Google usa full_name/name
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

  BEGIN
    _cats := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'categorias_interesse'));
  EXCEPTION WHEN OTHERS THEN _cats := '{}'::text[]; END;

  BEGIN
    _temas := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'temas_noticias'));
  EXCEPTION WHEN OTHERS THEN _temas := '{}'::text[]; END;

  INSERT INTO public.profiles (
    id, nome_completo, email, telefone, pais, estado, cidade, avatar_url,
    tipo_perfil, categorias_interesse, idioma_preferido, moeda_preferida,
    tipo_dolar_preferido, status, perfil_completo,
    termos_aceitos_em, termos_versao
  ) VALUES (
    NEW.id, _nome, NEW.email, _telefone, _pais, _estado, _cidade, _avatar,
    _tipo,
    (SELECT COALESCE(array_agg(c::public.categoria_agro),'{}') FROM unnest(_cats) c WHERE c IN ('fruta','grao','legumes','vegetal')),
    _idioma, _moeda, _tipo_dolar, _status, _perfil_completo,
    CASE WHEN _lgpd_ok THEN now() ELSE NULL END,
    NEW.raw_user_meta_data->>'termos_versao'
  );

  INSERT INTO public.preferencias (usuario_id, idioma, moeda, tipo_dolar, temas_noticias)
  VALUES (NEW.id, _idioma, _moeda, _tipo_dolar, _temas);

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Marcar perfis existentes que já têm LGPD aceito como completos
UPDATE public.profiles SET perfil_completo = true WHERE termos_aceitos_em IS NOT NULL AND perfil_completo = false;
