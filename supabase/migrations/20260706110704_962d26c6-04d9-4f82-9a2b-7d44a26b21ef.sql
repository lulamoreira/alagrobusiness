
-- Editar dados básicos de um usuário (nome, email, telefone)
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_usuario uuid,
  p_nome text,
  p_email text,
  p_telefone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_usuario AND is_super_admin = true) THEN
    IF NOT public.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'super_admin_imutavel' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.profiles
     SET nome_completo = COALESCE(NULLIF(trim(p_nome), ''), nome_completo),
         email = COALESCE(NULLIF(trim(p_email), ''), email),
         telefone = NULLIF(trim(p_telefone), ''),
         updated_at = now()
   WHERE id = p_usuario AND deleted_at IS NULL;
END;
$$;

-- Bloquear/desbloquear (escopo acessos)
CREATE OR REPLACE FUNCTION public.admin_acessos_set_status(
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
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_usuario AND is_super_admin = true) THEN
    RAISE EXCEPTION 'super_admin_imutavel' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('ativo','aguardando_aprovacao','bloqueado') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO _prev FROM public.profiles WHERE id = p_usuario AND deleted_at IS NULL;
  IF _prev IS NULL THEN
    RAISE EXCEPTION 'usuario_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
     SET status = p_status, updated_at = now()
   WHERE id = p_usuario;

  IF p_status = 'bloqueado' THEN
    _titulo := 'notifications.blockedTitle'; _msg := 'notifications.blockedMsg';
  ELSIF p_status = 'ativo' AND _prev = 'bloqueado' THEN
    _titulo := 'notifications.reactivatedTitle'; _msg := 'notifications.reactivatedMsg';
  ELSIF p_status = 'ativo' AND _prev = 'aguardando_aprovacao' THEN
    _titulo := 'notifications.approvedTitle'; _msg := 'notifications.approvedMsg';
  ELSE
    _titulo := NULL;
  END IF;

  IF _titulo IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
    VALUES (p_usuario, 'sistema', _titulo, _msg, '/painel');
  END IF;
END;
$$;

-- Excluir usuário (soft delete no profiles + cancelar assinaturas)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_usuario uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_usuario AND is_super_admin = true) THEN
    RAISE EXCEPTION 'super_admin_imutavel' USING ERRCODE = '42501';
  END IF;

  IF p_usuario = auth.uid() THEN
    RAISE EXCEPTION 'nao_pode_excluir_a_si_mesmo' USING ERRCODE = '42501';
  END IF;

  UPDATE public.assinaturas
     SET status = 'cancelada', fim = now(), updated_at = now()
   WHERE usuario_id = p_usuario AND deleted_at IS NULL;

  UPDATE public.profiles
     SET deleted_at = now(),
         status = 'bloqueado',
         updated_at = now()
   WHERE id = p_usuario AND deleted_at IS NULL;
END;
$$;
