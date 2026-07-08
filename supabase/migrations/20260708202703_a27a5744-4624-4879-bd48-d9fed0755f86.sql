
-- 1) Colunas novas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.convites_cortesia
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS login text;

CREATE INDEX IF NOT EXISTS convites_cortesia_is_demo_idx
  ON public.convites_cortesia (is_demo) WHERE deleted_at IS NULL;

-- 2) Guarda para impedir usuário comum alterar is_demo em profiles
CREATE OR REPLACE FUNCTION public.guard_profile_is_demo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'is_demo_imutavel' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_profile_is_demo ON public.profiles;
CREATE TRIGGER trg_guard_profile_is_demo
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_is_demo();

-- 3) handle_new_user: se convite é demo, NÃO aplicar já — deixar pendente para primeiro login
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

  SELECT * INTO _convite FROM public.convites_cortesia
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pendente'
      AND deleted_at IS NULL
      AND (expira_em IS NULL OR expira_em > now())
    ORDER BY created_at DESC LIMIT 1;

  IF _convite.id IS NOT NULL THEN
    IF _convite.is_demo = true THEN
      -- Demo: aguardar primeiro login (ativar_acesso_demo_se_pendente)
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
  ELSIF NOT _is_demo_meta THEN
    SELECT id INTO _plano_pro_id FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL LIMIT 1;
    IF _plano_pro_id IS NOT NULL THEN
      INSERT INTO public.assinaturas (usuario_id, plano_id, status, inicio, trial_ate)
      VALUES (NEW.id, _plano_pro_id, 'trial', now(), now() + interval '14 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

-- 4) Ativa acesso demo pendente no primeiro login
CREATE OR REPLACE FUNCTION public.ativar_acesso_demo_se_pendente()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _convite public.convites_cortesia;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'nao_autenticado');
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sem_email');
  END IF;

  SELECT * INTO _convite FROM public.convites_cortesia
    WHERE lower(email) = lower(_email)
      AND is_demo = true
      AND status = 'pendente'
      AND iniciado_em IS NULL
      AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

  IF _convite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sem_pendente');
  END IF;

  PERFORM public._aplicar_cortesia_horas(_uid, _convite.plano_codigo, COALESCE(_convite.duracao_horas, 48));
  UPDATE public.convites_cortesia
     SET status = 'usado',
         usado_em = now(),
         usado_por = _uid,
         iniciado_em = now(),
         updated_at = now()
   WHERE id = _convite.id;

  RETURN jsonb_build_object('ok', true, 'plano', _convite.plano_codigo, 'horas', _convite.duracao_horas);
END; $$;

GRANT EXECUTE ON FUNCTION public.ativar_acesso_demo_se_pendente() TO authenticated;

-- 5) Editar demo (label + plano)
CREATE OR REPLACE FUNCTION public.admin_demo_editar(p_convite_id uuid, p_label text, p_plano text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _c public.convites_cortesia;
  _novo_plano_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _c FROM public.convites_cortesia
    WHERE id = p_convite_id AND deleted_at IS NULL AND is_demo = true;
  IF _c.id IS NULL THEN
    RAISE EXCEPTION 'nao_encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF p_plano IS NOT NULL AND p_plano <> '' THEN
    SELECT id INTO _novo_plano_id FROM public.planos
      WHERE codigo = p_plano AND ativo = true AND deleted_at IS NULL;
    IF _novo_plano_id IS NULL THEN
      RAISE EXCEPTION 'plano_invalido' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.convites_cortesia
     SET label = COALESCE(NULLIF(p_label, ''), label),
         plano_codigo = COALESCE(NULLIF(p_plano, ''), plano_codigo),
         updated_at = now()
   WHERE id = _c.id;

  IF _c.status = 'usado' AND _c.usado_por IS NOT NULL AND _novo_plano_id IS NOT NULL THEN
    UPDATE public.assinaturas
       SET plano_id = _novo_plano_id, updated_at = now()
     WHERE usuario_id = _c.usado_por AND deleted_at IS NULL;
  END IF;
END; $$;

-- 6) Reativar demo (nova janela pendente)
CREATE OR REPLACE FUNCTION public.admin_demo_reativar(p_convite_id uuid, p_horas int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.convites_cortesia;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _c FROM public.convites_cortesia
    WHERE id = p_convite_id AND deleted_at IS NULL AND is_demo = true;
  IF _c.id IS NULL THEN
    RAISE EXCEPTION 'nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF _c.usado_por IS NOT NULL THEN
    UPDATE public.assinaturas
       SET status = 'cancelada', fim = now(), updated_at = now()
     WHERE usuario_id = _c.usado_por AND deleted_at IS NULL;
  END IF;

  UPDATE public.convites_cortesia
     SET status = 'pendente',
         usado_em = NULL,
         usado_por = NULL,
         iniciado_em = NULL,
         duracao_horas = GREATEST(1, COALESCE(p_horas, duracao_horas, 48)),
         expira_em = now() + interval '90 days',
         updated_at = now()
   WHERE id = _c.id;
END; $$;

-- 7) Revogar demo (encerra agora, mantém conta)
CREATE OR REPLACE FUNCTION public.admin_demo_revogar(p_convite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.convites_cortesia;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _c FROM public.convites_cortesia
    WHERE id = p_convite_id AND deleted_at IS NULL AND is_demo = true;
  IF _c.id IS NULL THEN
    RAISE EXCEPTION 'nao_encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF _c.usado_por IS NOT NULL THEN
    UPDATE public.assinaturas
       SET status = 'cancelada', fim = now(), updated_at = now()
     WHERE usuario_id = _c.usado_por AND deleted_at IS NULL;
  END IF;
  UPDATE public.convites_cortesia
     SET status = 'cancelado', updated_at = now()
   WHERE id = _c.id;
END; $$;

-- 8) Listagem ampliada
DROP FUNCTION IF EXISTS public.admin_list_acessos_temporarios();
CREATE OR REPLACE FUNCTION public.admin_list_acessos_temporarios()
RETURNS TABLE(
  convite_id uuid,
  email text,
  login text,
  label text,
  plano_codigo text,
  duracao_horas integer,
  criado_em timestamptz,
  expira_em timestamptz,
  status_convite text,
  is_demo boolean,
  iniciado_em timestamptz,
  usuario_id uuid,
  usado_em timestamptz,
  assinatura_fim timestamptz,
  assinatura_status text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.email, c.login, c.label,
         c.plano_codigo, c.duracao_horas,
         c.created_at, c.expira_em, c.status::text,
         c.is_demo, c.iniciado_em,
         c.usado_por, c.usado_em,
         a.fim, a.status::text
    FROM public.convites_cortesia c
    LEFT JOIN public.assinaturas a
      ON a.usuario_id = c.usado_por AND a.deleted_at IS NULL
   WHERE c.deleted_at IS NULL
     AND c.duracao_horas IS NOT NULL
   ORDER BY c.created_at DESC
   LIMIT 500;
END; $$;
