
-- Enum
DO $$ BEGIN
  CREATE TYPE public.convite_status AS ENUM ('pendente','usado','cancelado','expirado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.convites_cortesia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  plano_codigo text NOT NULL DEFAULT 'pro',
  dias integer,
  status public.convite_status NOT NULL DEFAULT 'pendente',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  usado_em timestamptz,
  usado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites_cortesia TO authenticated;
GRANT ALL ON public.convites_cortesia TO service_role;

ALTER TABLE public.convites_cortesia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "convites_admin_select" ON public.convites_cortesia;
CREATE POLICY "convites_admin_select" ON public.convites_cortesia
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "convites_admin_insert" ON public.convites_cortesia;
CREATE POLICY "convites_admin_insert" ON public.convites_cortesia
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "convites_admin_update" ON public.convites_cortesia;
CREATE POLICY "convites_admin_update" ON public.convites_cortesia
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "convites_admin_delete" ON public.convites_cortesia;
CREATE POLICY "convites_admin_delete" ON public.convites_cortesia
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Unique active pending invite per email
CREATE UNIQUE INDEX IF NOT EXISTS convites_cortesia_email_pendente_uidx
  ON public.convites_cortesia (lower(email))
  WHERE status = 'pendente' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS convites_cortesia_email_idx
  ON public.convites_cortesia (lower(email));

DROP TRIGGER IF EXISTS trg_convites_cortesia_updated_at ON public.convites_cortesia;
CREATE TRIGGER trg_convites_cortesia_updated_at
  BEFORE UPDATE ON public.convites_cortesia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: apply cortesia to a user (mirrors admin_grant_plan)
CREATE OR REPLACE FUNCTION public._aplicar_cortesia(
  p_usuario uuid, p_plano_codigo text, p_dias integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _plano_id uuid; _fim timestamptz;
BEGIN
  SELECT id INTO _plano_id FROM public.planos
    WHERE codigo = p_plano_codigo AND deleted_at IS NULL AND ativo = true;
  IF _plano_id IS NULL THEN
    RAISE EXCEPTION 'plano_invalido' USING ERRCODE = '22023';
  END IF;

  _fim := CASE WHEN p_dias IS NULL THEN NULL ELSE now() + (p_dias || ' days')::interval END;

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
END;
$$;

-- RPC: create invite (admin only)
CREATE OR REPLACE FUNCTION public.admin_criar_convite(
  p_email text,
  p_plano text DEFAULT 'pro',
  p_dias integer DEFAULT NULL
) RETURNS public.convites_cortesia
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  -- Try to reuse pending invite for this email
  SELECT * INTO _row FROM public.convites_cortesia
    WHERE lower(email) = _email
      AND status = 'pendente'
      AND deleted_at IS NULL
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.convites_cortesia
       SET plano_codigo = p_plano,
           dias = p_dias,
           expira_em = now() + interval '30 days',
           criado_por = _uid,
           updated_at = now()
     WHERE id = _row.id
    RETURNING * INTO _row;
  ELSE
    INSERT INTO public.convites_cortesia (email, plano_codigo, dias, criado_por)
    VALUES (_email, p_plano, p_dias, _uid)
    RETURNING * INTO _row;
  END IF;

  -- If a user already exists with this email, grant cortesia immediately
  SELECT id INTO _existing_user FROM auth.users WHERE lower(email) = _email LIMIT 1;
  IF _existing_user IS NOT NULL THEN
    PERFORM public._aplicar_cortesia(_existing_user, p_plano, p_dias);
    UPDATE public.convites_cortesia
       SET status = 'usado', usado_em = now(), usado_por = _existing_user, updated_at = now()
     WHERE id = _row.id
    RETURNING * INTO _row;
  END IF;

  RETURN _row;
END;
$$;

-- RPC: cancel invite
CREATE OR REPLACE FUNCTION public.admin_cancelar_convite(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.convites_cortesia
     SET status = 'cancelado', updated_at = now()
   WHERE id = p_id AND status = 'pendente' AND deleted_at IS NULL;
END;
$$;

-- RPC: list invites
CREATE OR REPLACE FUNCTION public.admin_listar_convites()
RETURNS SETOF public.convites_cortesia
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public.convites_cortesia
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 200;
END;
$$;

-- Update handle_new_user to auto-claim invites
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
  _plano_pro_id uuid;
  _convite public.convites_cortesia;
BEGIN
  _raw_tipo := NULLIF(NEW.raw_user_meta_data->>'tipo_perfil','');
  _has_signup_tipo := _raw_tipo IS NOT NULL AND _raw_tipo IN ('comprador','vendedor','lojista','marca');

  IF _has_signup_tipo THEN
    _tipo := _raw_tipo::public.tipo_perfil;
  ELSE
    _tipo := 'comprador';
  END IF;

  _lgpd_ok := COALESCE((NEW.raw_user_meta_data->>'lgpd_aceito')::boolean, false);
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

  -- Cortesia via convite por e-mail (prioridade sobre trial)
  SELECT * INTO _convite FROM public.convites_cortesia
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pendente'
      AND deleted_at IS NULL
      AND (expira_em IS NULL OR expira_em > now())
    ORDER BY created_at DESC
    LIMIT 1;

  IF _convite.id IS NOT NULL THEN
    PERFORM public._aplicar_cortesia(NEW.id, _convite.plano_codigo, _convite.dias);
    UPDATE public.convites_cortesia
       SET status = 'usado', usado_em = now(), usado_por = NEW.id, updated_at = now()
     WHERE id = _convite.id;
  ELSE
    -- Trial Pro de 14 dias padrão
    SELECT id INTO _plano_pro_id FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL LIMIT 1;
    IF _plano_pro_id IS NOT NULL THEN
      INSERT INTO public.assinaturas (usuario_id, plano_id, status, inicio, trial_ate)
      VALUES (NEW.id, _plano_pro_id, 'trial', now(), now() + interval '14 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END; $function$;
