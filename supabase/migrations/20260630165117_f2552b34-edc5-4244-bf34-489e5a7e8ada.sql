
-- =========================
-- ENUM assinatura_status
-- =========================
DO $$ BEGIN
  CREATE TYPE public.assinatura_status AS ENUM ('trial','ativa','cancelada','expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- TABELA planos
-- =========================
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao jsonb NOT NULL DEFAULT '{}'::jsonb,
  preco_mensal numeric NOT NULL DEFAULT 0,
  preco_anual numeric NOT NULL DEFAULT 0,
  moeda public.moeda_app NOT NULL DEFAULT 'BRL',
  limites jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_price_id_mensal text,
  stripe_price_id_anual text,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT ON public.planos TO authenticated;
GRANT ALL ON public.planos TO service_role;

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_select_authenticated"
  ON public.planos FOR SELECT
  TO authenticated
  USING (ativo = true AND deleted_at IS NULL);

CREATE POLICY "planos_admin_all"
  ON public.planos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- TABELA assinaturas
-- =========================
CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  status public.assinatura_status NOT NULL DEFAULT 'trial',
  periodo text CHECK (periodo IN ('mensal','anual')),
  trial_ate timestamptz,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX idx_assinaturas_usuario_unico
  ON public.assinaturas (usuario_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_assinaturas_status ON public.assinaturas (usuario_id, status) WHERE deleted_at IS NULL;

-- GRANTS: usuário comum só lê (RLS filtra para a própria); writes só service_role/admin.
GRANT SELECT ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assinaturas_select_own_or_admin"
  ON public.assinaturas FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

-- Apenas admin pode escrever; service_role bypassa RLS por padrão.
CREATE POLICY "assinaturas_admin_write"
  ON public.assinaturas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SEED planos
-- =========================
INSERT INTO public.planos (codigo, nome, descricao, preco_mensal, preco_anual, moeda, limites, ordem)
VALUES
  ('free',
   '{"pt-BR":"Gratuito","en":"Free","es":"Gratis"}'::jsonb,
   '{"pt-BR":"Plano inicial para começar","en":"Starter plan","es":"Plan inicial"}'::jsonb,
   0, 0, 'BRL',
   '{"max_anuncios": 2, "max_alertas": 1, "painel_completo": false, "cursos": "preview", "clube": false}'::jsonb,
   1),
  ('pro',
   '{"pt-BR":"Pro","en":"Pro","es":"Pro"}'::jsonb,
   '{"pt-BR":"Recursos ilimitados e clube","en":"Unlimited features and club","es":"Funciones ilimitadas y club"}'::jsonb,
   79.90, 799.00, 'BRL',
   '{"max_anuncios": null, "max_alertas": null, "painel_completo": true, "cursos": "full", "clube": true}'::jsonb,
   2);

-- =========================
-- handle_new_user — adicionar criação de trial Pro 14 dias
-- =========================
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

  -- Trial Pro de 14 dias (criado por DEFINER — usuário não tem permissão direta)
  SELECT id INTO _plano_pro_id FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL LIMIT 1;
  IF _plano_pro_id IS NOT NULL THEN
    INSERT INTO public.assinaturas (usuario_id, plano_id, status, inicio, trial_ate)
    VALUES (NEW.id, _plano_pro_id, 'trial', now(), now() + interval '14 days')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

-- Backfill: usuários existentes sem assinatura ganham trial de 14 dias a partir de agora.
INSERT INTO public.assinaturas (usuario_id, plano_id, status, inicio, trial_ate)
SELECT u.id,
       (SELECT id FROM public.planos WHERE codigo = 'pro'),
       'trial', now(), now() + interval '14 days'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.assinaturas a
  WHERE a.usuario_id = u.id AND a.deleted_at IS NULL
);

-- =========================
-- FUNÇÃO current_plan_limites
-- =========================
CREATE OR REPLACE FUNCTION public.current_plan_limites(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a record;
  _limites jsonb;
BEGIN
  SELECT a.status, a.trial_ate, a.fim, a.plano_id
    INTO _a
  FROM public.assinaturas a
  WHERE a.usuario_id = uid AND a.deleted_at IS NULL
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF _a.status = 'trial' AND _a.trial_ate IS NOT NULL AND _a.trial_ate > now() THEN
      SELECT limites INTO _limites FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL;
      RETURN _limites;
    ELSIF _a.status = 'ativa' AND (_a.fim IS NULL OR _a.fim > now()) THEN
      SELECT limites INTO _limites FROM public.planos WHERE id = _a.plano_id;
      RETURN _limites;
    END IF;
  END IF;

  SELECT limites INTO _limites FROM public.planos WHERE codigo = 'free' AND deleted_at IS NULL;
  RETURN _limites;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_plan_limites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_plan_limites(uuid) TO authenticated, service_role;

-- =========================
-- PAYWALL: anuncios
-- =========================
CREATE OR REPLACE FUNCTION public.enforce_plan_anuncios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max int;
  _count int;
  _lim jsonb;
BEGIN
  _lim := public.current_plan_limites(NEW.vendedor_id);
  IF _lim ? 'max_anuncios' AND (_lim->>'max_anuncios') IS NOT NULL THEN
    _max := (_lim->>'max_anuncios')::int;
    SELECT count(*) INTO _count
    FROM public.anuncios
    WHERE vendedor_id = NEW.vendedor_id
      AND deleted_at IS NULL
      AND status = 'ativo';
    IF _count >= _max THEN
      RAISE EXCEPTION 'limite_anuncios_plano' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_plan_anuncios
  BEFORE INSERT ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_anuncios();

-- =========================
-- PAYWALL: alertas_preco
-- =========================
CREATE OR REPLACE FUNCTION public.enforce_plan_alertas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max int;
  _count int;
  _lim jsonb;
BEGIN
  _lim := public.current_plan_limites(NEW.usuario_id);
  IF _lim ? 'max_alertas' AND (_lim->>'max_alertas') IS NOT NULL THEN
    _max := (_lim->>'max_alertas')::int;
    SELECT count(*) INTO _count
    FROM public.alertas_preco
    WHERE usuario_id = NEW.usuario_id
      AND deleted_at IS NULL
      AND ativo = true;
    IF _count >= _max THEN
      RAISE EXCEPTION 'limite_alertas_plano' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_plan_alertas
  BEFORE INSERT ON public.alertas_preco
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_alertas();
