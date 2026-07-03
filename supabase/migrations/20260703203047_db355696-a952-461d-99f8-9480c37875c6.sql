
CREATE OR REPLACE FUNCTION public.admin_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cad_total int; _cad_ag int; _cad_bl int; _cad_at int;
  _tx int; _vol numeric;
  _neg int; _pro int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _cad_total FROM public.profiles WHERE deleted_at IS NULL;
  SELECT count(*) INTO _cad_ag    FROM public.profiles WHERE deleted_at IS NULL AND status = 'aguardando_aprovacao';
  SELECT count(*) INTO _cad_bl    FROM public.profiles WHERE deleted_at IS NULL AND status = 'bloqueado';
  SELECT count(*) INTO _cad_at    FROM public.profiles WHERE deleted_at IS NULL AND status = 'ativo';

  SELECT count(*), COALESCE(sum(valor_total),0)
    INTO _tx, _vol
    FROM public.vendas WHERE deleted_at IS NULL;

  SELECT count(*) INTO _neg
    FROM public.conversas
    WHERE deleted_at IS NULL
      AND status_negociacao IN ('iniciado','em_negociacao');

  SELECT count(*) INTO _pro
    FROM public.assinaturas a
    JOIN public.planos p ON p.id = a.plano_id
   WHERE a.deleted_at IS NULL
     AND a.status = 'ativa'
     AND p.codigo = 'pro'
     AND (a.fim IS NULL OR a.fim > now());

  RETURN jsonb_build_object(
    'cadastros_total', _cad_total,
    'cadastros_aguardando', _cad_ag,
    'cadastros_bloqueados', _cad_bl,
    'cadastros_ativos', _cad_at,
    'transacoes', _tx,
    'volume_financeiro', _vol,
    'em_negociacao', _neg,
    'assinantes_pro', _pro
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kpis() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_usuario uuid,
  p_status public.status_perfil
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev public.status_perfil;
  _titulo text;
  _msg text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('ativo','aguardando_aprovacao','bloqueado') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO _prev FROM public.profiles WHERE id = p_usuario AND deleted_at IS NULL;
  IF _prev IS NULL THEN
    RAISE EXCEPTION 'usuario_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
     SET status = p_status,
         updated_at = now()
   WHERE id = p_usuario;

  IF p_status = 'ativo' AND _prev = 'aguardando_aprovacao' THEN
    _titulo := 'notifications.approvedTitle';
    _msg := 'notifications.approvedMsg';
  ELSIF p_status = 'bloqueado' THEN
    _titulo := 'notifications.blockedTitle';
    _msg := 'notifications.blockedMsg';
  ELSIF p_status = 'ativo' AND _prev = 'bloqueado' THEN
    _titulo := 'notifications.reactivatedTitle';
    _msg := 'notifications.reactivatedMsg';
  ELSE
    _titulo := NULL;
  END IF;

  IF _titulo IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
    VALUES (p_usuario, 'sistema', _titulo, _msg, '/painel');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, public.status_perfil) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, public.status_perfil) TO authenticated;
