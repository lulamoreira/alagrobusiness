
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.tipo_perfil AS ENUM ('comprador','vendedor','lojista','marca','admin');
CREATE TYPE public.status_perfil AS ENUM ('ativo','aguardando_aprovacao','bloqueado');
CREATE TYPE public.idioma_app AS ENUM ('pt-BR','en','es');
CREATE TYPE public.moeda_app AS ENUM ('BRL','USD','EUR');
CREATE TYPE public.tipo_dolar AS ENUM ('comercial','turismo','paralelo');
CREATE TYPE public.categoria_agro AS ENUM ('fruta','grao','legumes','vegetal');

-- =========================
-- updated_at trigger function
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  telefone TEXT,
  pais TEXT NOT NULL DEFAULT 'Brasil',
  estado TEXT,
  cidade TEXT,
  cep TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  tipo_perfil public.tipo_perfil NOT NULL DEFAULT 'comprador',
  categorias_interesse public.categoria_agro[] NOT NULL DEFAULT '{}',
  idioma_preferido public.idioma_app NOT NULL DEFAULT 'pt-BR',
  moeda_preferida public.moeda_app NOT NULL DEFAULT 'BRL',
  tipo_dolar_preferido public.tipo_dolar NOT NULL DEFAULT 'comercial',
  status public.status_perfil NOT NULL DEFAULT 'ativo',
  termos_aceitos_em TIMESTAMPTZ,
  termos_versao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND tipo_perfil = 'admin' AND deleted_at IS NULL);
$$;

CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (id = auth.uid()
        AND tipo_perfil = (SELECT p.tipo_perfil FROM public.profiles p WHERE p.id = auth.uid())
        AND status = (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()))
  );
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- PREFERENCIAS
-- =========================
CREATE TABLE public.preferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  idioma public.idioma_app NOT NULL DEFAULT 'pt-BR',
  moeda public.moeda_app NOT NULL DEFAULT 'BRL',
  tipo_dolar public.tipo_dolar NOT NULL DEFAULT 'comercial',
  temas_noticias TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preferencias TO authenticated;
GRANT ALL ON public.preferencias TO service_role;
ALTER TABLE public.preferencias ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_preferencias_updated_at BEFORE UPDATE ON public.preferencias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY preferencias_owner ON public.preferencias FOR ALL TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

-- =========================
-- NOTIFICACOES
-- =========================
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('alerta','noticia','preco','sistema')),
  titulo TEXT NOT NULL,
  mensagem TEXT,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_notificacoes_updated_at BEFORE UPDATE ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_notificacoes_usuario ON public.notificacoes(usuario_id) WHERE deleted_at IS NULL;
CREATE POLICY notificacoes_owner ON public.notificacoes FOR ALL TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

-- =========================
-- UNIDADES
-- =========================
CREATE TABLE public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome_chave TEXT NOT NULL,
  fator_kg NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_unidades_updated_at BEFORE UPDATE ON public.unidades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY unidades_read ON public.unidades FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY unidades_admin ON public.unidades FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.unidades (codigo, nome_chave, fator_kg) VALUES
  ('saca_60','saca_60',60),('tonelada','tonelada',1000),('kg','kg',1),('caixa','caixa',20),('arroba','arroba',15);

-- =========================
-- COTACOES DOLAR
-- =========================
CREATE TABLE public.cotacoes_dolar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_dolar NOT NULL,
  valor_brl NUMERIC NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT ON public.cotacoes_dolar TO authenticated;
GRANT ALL ON public.cotacoes_dolar TO service_role;
ALTER TABLE public.cotacoes_dolar ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX cotacoes_dolar_tipo_uniq ON public.cotacoes_dolar(tipo) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_cotacoes_dolar_updated_at BEFORE UPDATE ON public.cotacoes_dolar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY cotacoes_dolar_read ON public.cotacoes_dolar FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY cotacoes_dolar_admin ON public.cotacoes_dolar FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- NOTICIAS
-- =========================
CREATE TABLE public.noticias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  resumo TEXT,
  link TEXT NOT NULL,
  fonte TEXT,
  imagem TEXT,
  tema TEXT,
  publicado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT ON public.noticias TO authenticated;
GRANT ALL ON public.noticias TO service_role;
ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX noticias_link_uniq ON public.noticias(link) WHERE deleted_at IS NULL;
CREATE INDEX idx_noticias_publicado ON public.noticias(publicado_em DESC) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_noticias_updated_at BEFORE UPDATE ON public.noticias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY noticias_read ON public.noticias FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY noticias_admin ON public.noticias FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- COTACOES COMMODITIES (vazia)
-- =========================
CREATE TABLE public.cotacoes_commodities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  moeda public.moeda_app NOT NULL DEFAULT 'BRL',
  unidade_id UUID REFERENCES public.unidades(id),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT ON public.cotacoes_commodities TO authenticated;
GRANT ALL ON public.cotacoes_commodities TO service_role;
ALTER TABLE public.cotacoes_commodities ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cotacoes_commodities_updated_at BEFORE UPDATE ON public.cotacoes_commodities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY cotacoes_commodities_read ON public.cotacoes_commodities FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY cotacoes_commodities_admin ON public.cotacoes_commodities FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- CLIMA (vazia)
-- =========================
CREATE TABLE public.clima (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regiao TEXT NOT NULL,
  temperatura NUMERIC,
  condicao TEXT,
  previsao JSONB,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT ON public.clima TO authenticated;
GRANT ALL ON public.clima TO service_role;
ALTER TABLE public.clima ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clima_updated_at BEFORE UPDATE ON public.clima FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY clima_read ON public.clima FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY clima_admin ON public.clima FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- handle_new_user (sanitiza tipo_perfil; admin nunca aceito)
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _raw_tipo TEXT;
  _tipo public.tipo_perfil;
  _status public.status_perfil;
  _idioma public.idioma_app;
  _moeda public.moeda_app;
  _tipo_dolar public.tipo_dolar;
  _nome TEXT;
  _telefone TEXT;
  _pais TEXT;
  _estado TEXT;
  _cidade TEXT;
  _cats TEXT[];
  _temas TEXT[];
BEGIN
  _raw_tipo := COALESCE(NEW.raw_user_meta_data->>'tipo_perfil','comprador');

  -- SANITIZAÇÃO: admin OU valor inválido => comprador
  IF _raw_tipo NOT IN ('comprador','vendedor','lojista','marca') THEN
    _tipo := 'comprador';
  ELSE
    _tipo := _raw_tipo::public.tipo_perfil;
  END IF;

  -- status derivado no servidor
  IF _tipo IN ('comprador','vendedor') THEN
    _status := 'ativo';
  ELSE
    _status := 'aguardando_aprovacao';
  END IF;

  _idioma := COALESCE(NULLIF(NEW.raw_user_meta_data->>'idioma',''),'pt-BR')::public.idioma_app;
  _moeda := COALESCE(NULLIF(NEW.raw_user_meta_data->>'moeda',''),'BRL')::public.moeda_app;
  _tipo_dolar := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_dolar',''),'comercial')::public.tipo_dolar;
  _nome := COALESCE(NEW.raw_user_meta_data->>'nome_completo','');
  _telefone := NEW.raw_user_meta_data->>'telefone';
  _pais := COALESCE(NULLIF(NEW.raw_user_meta_data->>'pais',''),'Brasil');
  _estado := NEW.raw_user_meta_data->>'estado';
  _cidade := NEW.raw_user_meta_data->>'cidade';

  BEGIN
    _cats := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'categorias_interesse'));
  EXCEPTION WHEN OTHERS THEN _cats := '{}'::text[]; END;

  BEGIN
    _temas := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'temas_noticias'));
  EXCEPTION WHEN OTHERS THEN _temas := '{}'::text[]; END;

  INSERT INTO public.profiles (
    id, nome_completo, email, telefone, pais, estado, cidade,
    tipo_perfil, categorias_interesse, idioma_preferido, moeda_preferida,
    tipo_dolar_preferido, status, termos_aceitos_em, termos_versao
  ) VALUES (
    NEW.id, _nome, NEW.email, _telefone, _pais, _estado, _cidade,
    _tipo,
    (SELECT COALESCE(array_agg(c::public.categoria_agro),'{}') FROM unnest(_cats) c WHERE c IN ('fruta','grao','legumes','vegetal')),
    _idioma, _moeda, _tipo_dolar, _status,
    CASE WHEN (NEW.raw_user_meta_data->>'lgpd_aceito')::boolean THEN now() ELSE NULL END,
    NEW.raw_user_meta_data->>'termos_versao'
  );

  INSERT INTO public.preferencias (usuario_id, idioma, moeda, tipo_dolar, temas_noticias)
  VALUES (NEW.id, _idioma, _moeda, _tipo_dolar, _temas);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
