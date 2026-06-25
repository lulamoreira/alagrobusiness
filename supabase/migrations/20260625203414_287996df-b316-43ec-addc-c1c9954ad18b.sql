
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
  p_termos_versao TEXT
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

REVOKE EXECUTE ON FUNCTION public.complete_profile(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT,TEXT,TEXT,TEXT[],BOOLEAN,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_profile(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT,TEXT,TEXT,TEXT[],BOOLEAN,TEXT) TO authenticated;
