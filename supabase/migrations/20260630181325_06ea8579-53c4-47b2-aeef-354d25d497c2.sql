
CREATE OR REPLACE FUNCTION public.current_plan()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT a.status, a.trial_ate, a.fim, a.plano_id, p.codigo
    INTO _a
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.usuario_id = _uid AND a.deleted_at IS NULL
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF _a.status = 'trial' AND _a.trial_ate IS NOT NULL AND _a.trial_ate > now() THEN
      _codigo := 'pro';
      _status := 'trial';
      _trial_ate := _a.trial_ate;
      _dias_restantes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_a.trial_ate - now()))/86400)::int);
      SELECT limites INTO _limites FROM public.planos WHERE codigo = 'pro' AND deleted_at IS NULL;
    ELSIF _a.status = 'ativa' AND (_a.fim IS NULL OR _a.fim > now()) THEN
      _codigo := _a.codigo;
      _status := 'ativa';
      _trial_ate := null;
      _dias_restantes := 0;
      SELECT limites INTO _limites FROM public.planos WHERE id = _a.plano_id;
    ELSE
      _codigo := 'free';
      _status := COALESCE(_a.status::text,'expirada');
      _trial_ate := _a.trial_ate;
      _dias_restantes := 0;
      SELECT limites INTO _limites FROM public.planos WHERE codigo = 'free' AND deleted_at IS NULL;
    END IF;
  ELSE
    _codigo := 'free';
    _status := 'none';
    _trial_ate := null;
    _dias_restantes := 0;
    SELECT limites INTO _limites FROM public.planos WHERE codigo = 'free' AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'codigo', _codigo,
    'status', _status,
    'trial_ate', _trial_ate,
    'dias_restantes', _dias_restantes,
    'limites', COALESCE(_limites,'{}'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_plan() TO authenticated;
