
-- 1) Promove o dono a admin e garante status ativo/perfil completo
UPDATE public.profiles
   SET tipo_perfil = 'admin',
       status = 'ativo',
       perfil_completo = true,
       updated_at = now()
 WHERE lower(email) = lower('lula1973@gmail.com');

-- 2) Concede plano Pro vitalício (sem data fim) ao dono
DO $$
DECLARE
  _uid uuid;
  _plano_pro uuid;
BEGIN
  SELECT id INTO _uid FROM public.profiles WHERE lower(email) = lower('lula1973@gmail.com') LIMIT 1;
  SELECT id INTO _plano_pro FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL LIMIT 1;
  IF _uid IS NOT NULL AND _plano_pro IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.assinaturas WHERE usuario_id = _uid AND deleted_at IS NULL) THEN
      UPDATE public.assinaturas
         SET plano_id = _plano_pro,
             status = 'ativa',
             inicio = now(),
             fim = NULL,
             trial_ate = NULL,
             origem = 'admin_cortesia',
             updated_at = now()
       WHERE usuario_id = _uid AND deleted_at IS NULL;
    ELSE
      INSERT INTO public.assinaturas (usuario_id, plano_id, status, inicio, fim, origem)
      VALUES (_uid, _plano_pro, 'ativa', now(), NULL, 'admin_cortesia');
    END IF;
  END IF;
END $$;

-- 3) current_plan: admins sempre recebem plano Pro ativo com limites Pro
CREATE OR REPLACE FUNCTION public.current_plan()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _a record;
  _codigo text;
  _status text;
  _trial_ate timestamptz;
  _dias_restantes int;
  _limites jsonb;
BEGIN
  IF _uid IS NULL THEN
    SELECT limites INTO _limites FROM public.planos WHERE codigo = 'free' AND deleted_at IS NULL;
    RETURN jsonb_build_object('codigo','free','status','none','trial_ate',null,'dias_restantes',0,'limites',COALESCE(_limites,'{}'::jsonb));
  END IF;

  -- Admins têm acesso máximo, sempre
  IF public.is_admin(_uid) THEN
    SELECT limites INTO _limites FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL;
    RETURN jsonb_build_object(
      'codigo','pro',
      'status','ativa',
      'trial_ate', null,
      'dias_restantes', 0,
      'limites', COALESCE(_limites,'{}'::jsonb) || jsonb_build_object(
        'painel_completo', true,
        'clube', true,
        'cursos', 'full',
        'max_anuncios', null,
        'max_alertas', null,
        'admin', true
      )
    );
  END IF;

  SELECT a.status, a.trial_ate, a.fim, a.plano_id, p.codigo
    INTO _a
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.usuario_id = _uid AND a.deleted_at IS NULL
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF _a.status = 'trial' AND _a.trial_ate IS NOT NULL AND _a.trial_ate > now() THEN
      _codigo := 'pro'; _status := 'trial'; _trial_ate := _a.trial_ate;
      _dias_restantes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_a.trial_ate - now()))/86400)::int);
      SELECT limites INTO _limites FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL;
    ELSIF _a.status = 'ativa' AND (_a.fim IS NULL OR _a.fim > now()) THEN
      _codigo := _a.codigo; _status := 'ativa'; _trial_ate := null; _dias_restantes := 0;
      SELECT limites INTO _limites FROM public.planos WHERE id = _a.plano_id;
    ELSE
      _codigo := 'free'; _status := COALESCE(_a.status::text,'expirada');
      _trial_ate := _a.trial_ate; _dias_restantes := 0;
      SELECT limites INTO _limites FROM public.planos WHERE codigo = 'free' AND deleted_at IS NULL;
    END IF;
  ELSE
    _codigo := 'free'; _status := 'none'; _trial_ate := null; _dias_restantes := 0;
    SELECT limites INTO _limites FROM public.planos WHERE codigo = 'free' AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'codigo', _codigo, 'status', _status, 'trial_ate', _trial_ate,
    'dias_restantes', _dias_restantes, 'limites', COALESCE(_limites,'{}'::jsonb)
  );
END;
$function$;

-- 4) current_plan_limites: admins recebem limites Pro (sem teto)
CREATE OR REPLACE FUNCTION public.current_plan_limites(uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _a record;
  _limites jsonb;
BEGIN
  IF uid IS NOT NULL AND public.is_admin(uid) THEN
    SELECT limites INTO _limites FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL;
    RETURN COALESCE(_limites,'{}'::jsonb) || jsonb_build_object(
      'painel_completo', true, 'clube', true, 'cursos', 'full',
      'max_anuncios', null, 'max_alertas', null, 'admin', true
    );
  END IF;

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
$function$;
