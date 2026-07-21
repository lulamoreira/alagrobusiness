
-- 1) Global expiration function (called by cron)
CREATE OR REPLACE FUNCTION public.expirar_acessos_demo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bloqueados int := 0;
BEGIN
  WITH alvos AS (
    SELECT p.id
      FROM public.profiles p
      JOIN public.assinaturas a ON a.usuario_id = p.id AND a.deleted_at IS NULL
     WHERE p.is_demo = true
       AND p.status = 'ativo'
       AND p.deleted_at IS NULL
       AND a.fim IS NOT NULL
       AND a.fim < now()
  ),
  upd_prof AS (
    UPDATE public.profiles pr
       SET status = 'bloqueado', updated_at = now()
      FROM alvos
     WHERE pr.id = alvos.id
    RETURNING pr.id
  ),
  upd_ass AS (
    UPDATE public.assinaturas asg
       SET status = 'expirada', updated_at = now()
      FROM alvos
     WHERE asg.usuario_id = alvos.id
       AND asg.deleted_at IS NULL
    RETURNING asg.usuario_id
  )
  SELECT count(*) INTO _bloqueados FROM upd_prof;

  RETURN jsonb_build_object('bloqueados', _bloqueados);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expirar_acessos_demo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expirar_acessos_demo() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expirar_acessos_demo() FROM anon;
GRANT EXECUTE ON FUNCTION public.expirar_acessos_demo() TO service_role;

-- 2) Per-user check called on boot
CREATE OR REPLACE FUNCTION public.checar_meu_acesso_demo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_demo boolean;
  _status public.status_perfil;
  _fim timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('bloqueado', false);
  END IF;

  SELECT p.is_demo, p.status
    INTO _is_demo, _status
    FROM public.profiles p
   WHERE p.id = _uid AND p.deleted_at IS NULL;

  IF NOT COALESCE(_is_demo, false) THEN
    RETURN jsonb_build_object('bloqueado', false);
  END IF;

  IF _status <> 'ativo' THEN
    RETURN jsonb_build_object('bloqueado', _status = 'bloqueado');
  END IF;

  SELECT a.fim INTO _fim
    FROM public.assinaturas a
   WHERE a.usuario_id = _uid AND a.deleted_at IS NULL
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF _fim IS NOT NULL AND _fim < now() THEN
    UPDATE public.profiles SET status = 'bloqueado', updated_at = now() WHERE id = _uid;
    UPDATE public.assinaturas SET status = 'expirada', updated_at = now()
      WHERE usuario_id = _uid AND deleted_at IS NULL;
    RETURN jsonb_build_object('bloqueado', true);
  END IF;

  RETURN jsonb_build_object('bloqueado', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.checar_meu_acesso_demo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checar_meu_acesso_demo() TO authenticated;

-- 3) Fix admin_demo_revogar to also block the profile (only for demo accounts)
CREATE OR REPLACE FUNCTION public.admin_demo_revogar(p_convite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
    -- Bloqueia apenas se for realmente conta demo
    UPDATE public.profiles
       SET status = 'bloqueado', updated_at = now()
     WHERE id = _c.usado_por
       AND is_demo = true
       AND deleted_at IS NULL;
  END IF;
  UPDATE public.convites_cortesia
     SET status = 'cancelado', updated_at = now()
   WHERE id = _c.id;
END; $$;

-- 4) Fix admin_demo_reativar to unblock the profile
CREATE OR REPLACE FUNCTION public.admin_demo_reativar(p_convite_id uuid, p_horas integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
    -- Desbloqueia apenas se for conta demo
    UPDATE public.profiles
       SET status = 'ativo', updated_at = now()
     WHERE id = _c.usado_por
       AND is_demo = true
       AND deleted_at IS NULL;
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
