
-- ============================================
-- A) Novas categorias raiz de SERVIÇO (idempotente)
-- ============================================
INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, tipo, status, segmento)
SELECT NULL,
       jsonb_build_object('pt','Imobiliário','en','Real Estate','es','Inmobiliario'),
       16, true, 'servico', 'aprovado', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_catalogo
   WHERE parent_id IS NULL AND deleted_at IS NULL AND (nome->>'pt') = 'Imobiliário'
);

INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo, tipo, status, segmento)
SELECT NULL,
       jsonb_build_object('pt','Mão de Obra','en','Labor','es','Mano de Obra'),
       17, true, 'servico', 'aprovado', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_catalogo
   WHERE parent_id IS NULL AND deleted_at IS NULL AND (nome->>'pt') = 'Mão de Obra'
);

-- ============================================
-- C.1) profiles: cpf_cnpj + data_nascimento (opcionais)
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS data_nascimento date;

-- ============================================
-- C.2) app_config
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_config (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_config_select_auth ON public.app_config;
CREATE POLICY app_config_select_auth ON public.app_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS app_config_admin_insert ON public.app_config;
CREATE POLICY app_config_admin_insert ON public.app_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS app_config_admin_update ON public.app_config;
CREATE POLICY app_config_admin_update ON public.app_config
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_app_config_updated_at ON public.app_config;
CREATE TRIGGER trg_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_config (chave, valor)
VALUES ('documentos_obrigatorios', '{"ativo": false}'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- ============================================
-- C.3) complete_profile: adiciona p_cpf_cnpj e p_data_nascimento
-- ============================================
DROP FUNCTION IF EXISTS public.complete_profile(text, text, text, text, text, text, text[], text, text, text, text[], boolean, text);

CREATE OR REPLACE FUNCTION public.complete_profile(
  p_tipo_perfil TEXT,
  p_nome_completo TEXT,
  p_telefone TEXT,
  p_estado TEXT,
  p_cidade TEXT,
  p_cep TEXT,
  p_categorias TEXT[],
  p_idioma TEXT,
  p_moeda TEXT,
  p_tipo_dolar TEXT,
  p_temas TEXT[],
  p_lgpd BOOLEAN,
  p_termos_versao TEXT,
  p_cpf_cnpj TEXT DEFAULT NULL,
  p_data_nascimento DATE DEFAULT NULL
) RETURNS public.status_perfil
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _tipo public.tipo_perfil;
  _status public.status_perfil;
  _idioma public.idioma_app;
  _moeda public.moeda_app;
  _tipo_dolar public.tipo_dolar;
  _cats public.categoria_agro[];
  _docs_ativo BOOLEAN;
  _cpf TEXT;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_lgpd IS NOT TRUE THEN
    RAISE EXCEPTION 'LGPD obrigatória' USING ERRCODE = '22023';
  END IF;
  IF p_tipo_perfil NOT IN ('comprador','vendedor','lojista','marca') THEN
    RAISE EXCEPTION 'tipo_perfil inválido' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE((valor->>'ativo')::boolean, false) INTO _docs_ativo
    FROM public.app_config WHERE chave = 'documentos_obrigatorios';

  _cpf := regexp_replace(COALESCE(p_cpf_cnpj, ''), '\D', '', 'g');

  IF COALESCE(_docs_ativo, false) THEN
    IF _cpf = '' OR length(_cpf) NOT IN (11, 14) THEN
      RAISE EXCEPTION 'documentos_obrigatorios_cpf' USING ERRCODE = '22023';
    END IF;
    IF p_data_nascimento IS NULL THEN
      RAISE EXCEPTION 'documentos_obrigatorios_data' USING ERRCODE = '22023';
    END IF;
  END IF;

  _tipo := p_tipo_perfil::public.tipo_perfil;
  _idioma := COALESCE(NULLIF(p_idioma,''),'pt-BR')::public.idioma_app;
  _moeda := COALESCE(NULLIF(p_moeda,''),'BRL')::public.moeda_app;
  _tipo_dolar := COALESCE(NULLIF(p_tipo_dolar,''),'comercial')::public.tipo_dolar;

  IF _tipo IN ('comprador','vendedor') THEN _status := 'ativo';
  ELSE _status := 'aguardando_aprovacao';
  END IF;

  _cats := COALESCE(
    (SELECT array_agg(c::public.categoria_agro)
       FROM unnest(COALESCE(p_categorias,'{}'::text[])) c
       WHERE c IN ('fruta','grao','legumes','vegetal')),
    '{}'::public.categoria_agro[]
  );

  UPDATE public.profiles SET
    tipo_perfil = _tipo,
    nome_completo = COALESCE(NULLIF(p_nome_completo,''), nome_completo),
    telefone = NULLIF(p_telefone,''),
    estado = NULLIF(p_estado,''),
    cidade = NULLIF(p_cidade,''),
    cep = NULLIF(p_cep,''),
    categorias_interesse = _cats,
    idioma_preferido = _idioma,
    moeda_preferida = _moeda,
    tipo_dolar_preferido = _tipo_dolar,
    cpf_cnpj = COALESCE(NULLIF(_cpf, ''), cpf_cnpj),
    data_nascimento = COALESCE(p_data_nascimento, data_nascimento),
    status = _status,
    perfil_completo = true,
    termos_aceitos_em = COALESCE(termos_aceitos_em, now()),
    termos_versao = COALESCE(p_termos_versao, termos_versao, 'v1'),
    updated_at = now()
  WHERE id = _uid;

  INSERT INTO public.preferencias (usuario_id, idioma, moeda, tipo_dolar, temas_noticias)
  VALUES (_uid, _idioma, _moeda, _tipo_dolar, COALESCE(p_temas,'{}'::text[]))
  ON CONFLICT (usuario_id) DO UPDATE SET
    idioma = EXCLUDED.idioma,
    moeda = EXCLUDED.moeda,
    tipo_dolar = EXCLUDED.tipo_dolar,
    temas_noticias = EXCLUDED.temas_noticias,
    updated_at = now();

  RETURN _status;
END; $$;

REVOKE ALL ON FUNCTION public.complete_profile(text, text, text, text, text, text, text[], text, text, text, text[], boolean, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_profile(text, text, text, text, text, text, text[], text, text, text, text[], boolean, text, text, date) TO authenticated;
