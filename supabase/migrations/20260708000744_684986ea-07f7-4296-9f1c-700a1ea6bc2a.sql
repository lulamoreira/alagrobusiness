-- 1) Nova coluna: duração em horas (modo "temporário")
ALTER TABLE public.convites_cortesia
  ADD COLUMN IF NOT EXISTS duracao_horas int;

COMMENT ON COLUMN public.convites_cortesia.duracao_horas IS
  'Quando não nulo, o convite é um acesso temporário: a janela de acesso Pro (em horas) começa a contar somente no primeiro acesso (consumo do convite).';

-- 2) Helper: aplica cortesia por horas (fim = now() + horas)
CREATE OR REPLACE FUNCTION public._aplicar_cortesia_horas(
  p_usuario uuid, p_plano_codigo text, p_horas int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _plano_id uuid; _fim timestamptz;
BEGIN
  SELECT id INTO _plano_id FROM public.planos
    WHERE codigo = p_plano_codigo AND deleted_at IS NULL AND ativo = true;
  IF _plano_id IS NULL THEN
    RAISE EXCEPTION 'plano_invalido' USING ERRCODE = '22023';
  END IF;
  _fim := CASE WHEN p_horas IS NULL THEN NULL
               ELSE now() + make_interval(hours => p_horas) END;

  IF EXISTS (SELECT 1 FROM public.assinaturas WHERE usuario_id = p_usuario AND deleted_at IS NULL) THEN
    UPDATE public.assinaturas
       SET plano_id = _plano_id, status = 'ativa', inicio = now(), fim = _fim,
           trial_ate = NULL, origem = 'admin_cortesia',
           stripe_customer_id = NULL, stripe_subscription_id = NULL, updated_at = now()
     WHERE usuario_id = p_usuario AND deleted_at IS NULL;
  ELSE
    INSERT INTO public.assinaturas (usuario_id, plano_id, status, inicio, fim, origem)
    VALUES (p_usuario, _plano_id, 'ativa', now(), _fim, 'admin_cortesia');
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public._aplicar_cortesia_horas(uuid, text, int) FROM PUBLIC;

-- 3) handle_new_user: se convite tem duracao_horas, aplicar por horas
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
BEGIN
  _raw_tipo := NULLIF(NEW.raw_user_meta_data->>'tipo_perfil','');
  _has_signup_tipo := _raw_tipo IS NOT NULL AND _raw_tipo IN ('comprador','vendedor','lojista','marca');
  IF _has_signup_tipo THEN _tipo := _raw_tipo::public.tipo_perfil; ELSE _tipo := 'comprador'; END IF;

  _lgpd_ok := COALESCE((NEW.raw_user_meta_data->>'lgpd_aceito')::boolean, false);
  _perfil_completo := _has_signup_tipo AND _lgpd_ok;

  IF NOT _perfil_completo THEN _status := 'aguardando_aprovacao';
  ELSIF _tipo IN ('comprador','vendedor') THEN _status := 'ativo';
  ELSE _status := 'aguardando_aprovacao'; END IF;

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

  BEGIN _cats := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'categorias_interesse'));
  EXCEPTION WHEN OTHERS THEN _cats := '{}'::text[]; END;
  BEGIN _temas := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'temas_noticias'));
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

  SELECT * INTO _convite FROM public.convites_cortesia
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pendente'
      AND deleted_at IS NULL
      AND (expira_em IS NULL OR expira_em > now())
    ORDER BY created_at DESC LIMIT 1;

  IF _convite.id IS NOT NULL THEN
    IF _convite.duracao_horas IS NOT NULL THEN
      PERFORM public._aplicar_cortesia_horas(NEW.id, _convite.plano_codigo, _convite.duracao_horas);
    ELSE
      PERFORM public._aplicar_cortesia(NEW.id, _convite.plano_codigo, _convite.dias);
    END IF;
    UPDATE public.convites_cortesia
       SET status = 'usado', usado_em = now(), usado_por = NEW.id, updated_at = now()
     WHERE id = _convite.id;
  ELSE
    SELECT id INTO _plano_pro_id FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL LIMIT 1;
    IF _plano_pro_id IS NOT NULL THEN
      INSERT INTO public.assinaturas (usuario_id, plano_id, status, inicio, trial_ate)
      VALUES (NEW.id, _plano_pro_id, 'trial', now(), now() + interval '14 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

-- 4) admin_criar_convite: aceita p_horas (modo temporário)
CREATE OR REPLACE FUNCTION public.admin_criar_convite(
  p_email text,
  p_plano text DEFAULT 'pro',
  p_dias int DEFAULT NULL,
  p_horas int DEFAULT NULL
) RETURNS convites_cortesia
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(trim(coalesce(p_email,'')));
  _existing_user uuid;
  _row public.convites_cortesia;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF _email = '' OR _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'email_invalido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.planos WHERE codigo = p_plano AND deleted_at IS NULL AND ativo = true) THEN
    RAISE EXCEPTION 'plano_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _row FROM public.convites_cortesia
    WHERE lower(email) = _email
      AND status = 'pendente'
      AND deleted_at IS NULL
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.convites_cortesia
       SET plano_codigo = p_plano,
           dias = p_dias,
           duracao_horas = p_horas,
           expira_em = now() + interval '30 days',
           criado_por = _uid,
           updated_at = now()
     WHERE id = _row.id
    RETURNING * INTO _row;
  ELSE
    INSERT INTO public.convites_cortesia (email, plano_codigo, dias, duracao_horas, criado_por)
    VALUES (_email, p_plano, p_dias, p_horas, _uid)
    RETURNING * INTO _row;
  END IF;

  SELECT id INTO _existing_user FROM auth.users WHERE lower(email) = _email LIMIT 1;
  IF _existing_user IS NOT NULL THEN
    IF p_horas IS NOT NULL THEN
      PERFORM public._aplicar_cortesia_horas(_existing_user, p_plano, p_horas);
    ELSE
      PERFORM public._aplicar_cortesia(_existing_user, p_plano, p_dias);
    END IF;
    UPDATE public.convites_cortesia
       SET status = 'usado', usado_em = now(), usado_por = _existing_user, updated_at = now()
     WHERE id = _row.id
    RETURNING * INTO _row;
  END IF;

  RETURN _row;
END; $$;

-- 5) Listagem de acessos temporários (pendentes + ativos + expirados)
CREATE OR REPLACE FUNCTION public.admin_list_acessos_temporarios()
RETURNS TABLE(
  convite_id uuid,
  email text,
  plano_codigo text,
  duracao_horas int,
  criado_em timestamptz,
  expira_em timestamptz,
  status_convite text,
  usuario_id uuid,
  usado_em timestamptz,
  assinatura_fim timestamptz,
  assinatura_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.email, c.plano_codigo, c.duracao_horas,
         c.created_at, c.expira_em, c.status::text,
         c.usado_por, c.usado_em,
         a.fim, a.status::text
    FROM public.convites_cortesia c
    LEFT JOIN public.assinaturas a
      ON a.usuario_id = c.usado_por AND a.deleted_at IS NULL
   WHERE c.deleted_at IS NULL
     AND c.duracao_horas IS NOT NULL
   ORDER BY c.created_at DESC
   LIMIT 200;
END; $$;

-- 6) Ajuste +/- horas (pendente: dias que serão aplicados; ativo: fim da assinatura)
CREATE OR REPLACE FUNCTION public.admin_temporario_ajustar_horas(
  p_convite_id uuid, p_delta_horas int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c public.convites_cortesia;
  _novas_horas int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _c FROM public.convites_cortesia
    WHERE id = p_convite_id AND deleted_at IS NULL;
  IF _c.id IS NULL THEN
    RAISE EXCEPTION 'convite_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF _c.duracao_horas IS NULL THEN
    RAISE EXCEPTION 'convite_nao_e_temporario' USING ERRCODE = '22023';
  END IF;

  IF _c.status = 'pendente' THEN
    _novas_horas := GREATEST(1, COALESCE(_c.duracao_horas, 0) + p_delta_horas);
    UPDATE public.convites_cortesia
       SET duracao_horas = _novas_horas, updated_at = now()
     WHERE id = _c.id;
  ELSIF _c.status = 'usado' AND _c.usado_por IS NOT NULL THEN
    UPDATE public.assinaturas
       SET fim = GREATEST(now() + interval '1 minute',
                          COALESCE(fim, now()) + make_interval(hours => p_delta_horas)),
           status = 'ativa',
           updated_at = now()
     WHERE usuario_id = _c.usado_por AND deleted_at IS NULL;
  END IF;
END; $$;