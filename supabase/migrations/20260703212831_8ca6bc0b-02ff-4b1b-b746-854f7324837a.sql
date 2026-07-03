
-- 1) Colunas de permissões no profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Super admin: dono do sistema
UPDATE public.profiles
   SET is_super_admin = true,
       tipo_perfil = 'admin',
       admin_permissoes = jsonb_build_object(
         'acessos', true, 'gestao', true, 'moderacao', true,
         'cotacoes', true, 'cursos', true
       ),
       updated_at = now()
 WHERE email = 'lula1973@gmail.com';

-- 2) Helpers
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = _uid AND is_super_admin = true AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_admin_perm(_uid uuid, _perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _uid
       AND p.deleted_at IS NULL
       AND p.tipo_perfil = 'admin'
       AND (
         p.is_super_admin = true
         OR COALESCE((p.admin_permissoes ->> _perm)::boolean, false) = true
       )
  );
$$;

-- 3) Gestão de admins (só super-admin)
CREATE OR REPLACE FUNCTION public.admin_grant_admin(
  p_usuario uuid,
  p_permissoes jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET tipo_perfil = 'admin',
         admin_permissoes = COALESCE(p_permissoes, '{}'::jsonb),
         updated_at = now()
   WHERE id = p_usuario AND deleted_at IS NULL;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (p_usuario, 'sistema',
          'notifications.adminGrantedTitle',
          'notifications.adminGrantedMsg',
          '/painel');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_admin_perms(
  p_usuario uuid,
  p_permissoes jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_usuario AND is_super_admin = true) THEN
    RAISE EXCEPTION 'super_admin_imutavel' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET admin_permissoes = COALESCE(p_permissoes, '{}'::jsonb),
         updated_at = now()
   WHERE id = p_usuario AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_admin(p_usuario uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_usuario AND is_super_admin = true) THEN
    RAISE EXCEPTION 'super_admin_imutavel' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET tipo_perfil = 'comprador',
         admin_permissoes = '{}'::jsonb,
         updated_at = now()
   WHERE id = p_usuario AND deleted_at IS NULL;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (p_usuario, 'sistema',
          'notifications.adminRevokedTitle',
          'notifications.adminRevokedMsg',
          '/painel');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE(
  id uuid,
  nome_completo text,
  email text,
  is_super_admin boolean,
  admin_permissoes jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nome_completo, p.email, p.is_super_admin, p.admin_permissoes
    FROM public.profiles p
   WHERE p.deleted_at IS NULL
     AND p.tipo_perfil = 'admin'
   ORDER BY p.is_super_admin DESC, p.nome_completo NULLS LAST;
END;
$$;

-- 4) Reforço de permissão em RPCs existentes (super-admin bypass via has_admin_perm)
CREATE OR REPLACE FUNCTION public.admin_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cad_total int; _cad_ag int; _cad_bl int; _cad_at int;
  _tx int; _vol numeric;
  _neg int; _pro int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'gestao') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_usuario uuid, p_status status_perfil)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prev public.status_perfil;
  _titulo text;
  _msg text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'gestao') THEN
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
     SET status = p_status, updated_at = now()
   WHERE id = p_usuario;

  IF p_status = 'ativo' AND _prev = 'aguardando_aprovacao' THEN
    _titulo := 'notifications.approvedTitle'; _msg := 'notifications.approvedMsg';
  ELSIF p_status = 'bloqueado' THEN
    _titulo := 'notifications.blockedTitle'; _msg := 'notifications.blockedMsg';
  ELSIF p_status = 'ativo' AND _prev = 'bloqueado' THEN
    _titulo := 'notifications.reactivatedTitle'; _msg := 'notifications.reactivatedMsg';
  ELSE
    _titulo := NULL;
  END IF;

  IF _titulo IS NOT NULL THEN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
    VALUES (p_usuario, 'sistema', _titulo, _msg, '/painel');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
 RETURNS TABLE(id uuid, nome_completo text, email text, tipo_perfil text, plano_codigo text, status text, origem text, fim timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nome_completo, p.email, p.tipo_perfil::text,
         pl.codigo, a.status::text, a.origem::text, a.fim
    FROM public.profiles p
    LEFT JOIN public.assinaturas a ON a.usuario_id = p.id AND a.deleted_at IS NULL
    LEFT JOIN public.planos pl ON pl.id = a.plano_id
   WHERE p.deleted_at IS NULL
     AND (p_query IS NULL OR p_query = ''
          OR p.email ILIKE '%'||p_query||'%'
          OR p.nome_completo ILIKE '%'||p_query||'%')
   ORDER BY p.nome_completo NULLS LAST
   LIMIT 25;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_cortesias()
 RETURNS TABLE(usuario_id uuid, nome_completo text, email text, plano_codigo text, fim timestamp with time zone, inicio timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.usuario_id, p.nome_completo, p.email, pl.codigo, a.fim, a.inicio
    FROM public.assinaturas a
    JOIN public.profiles p ON p.id = a.usuario_id
    JOIN public.planos pl ON pl.id = a.plano_id
   WHERE a.deleted_at IS NULL
     AND a.origem = 'admin_cortesia'
     AND a.status = 'ativa'
     AND (a.fim IS NULL OR a.fim > now())
   ORDER BY a.inicio DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_grant_plan(p_usuario uuid, p_plano_codigo text DEFAULT 'pro'::text, p_dias integer DEFAULT NULL::integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _plano_id uuid; _fim timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_plan(p_usuario uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_perm(auth.uid(), 'acessos') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.assinaturas
     SET status = 'cancelada', fim = now(), updated_at = now()
   WHERE usuario_id = p_usuario AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_moderar_anuncio(p_anuncio_id uuid, p_acao text, p_motivo text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _vendedor uuid; _titulo text;
  _titulo_key text; _msg_key text;
BEGIN
  IF _uid IS NULL OR NOT public.has_admin_perm(_uid, 'moderacao') THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_acao NOT IN ('pausar','reativar','remover') THEN
    RAISE EXCEPTION 'acao_invalida' USING ERRCODE = '22023';
  END IF;

  SELECT vendedor_id, titulo INTO _vendedor, _titulo
    FROM public.anuncios WHERE id = p_anuncio_id AND deleted_at IS NULL;

  IF _vendedor IS NULL THEN
    RAISE EXCEPTION 'anuncio_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_acao = 'pausar' THEN
    UPDATE public.anuncios SET status = 'pausado', updated_at = now() WHERE id = p_anuncio_id;
    _titulo_key := 'notifications.adModeratedPausadoTitle';
    _msg_key := 'notifications.adModeratedPausadoMsg';
  ELSIF p_acao = 'reativar' THEN
    UPDATE public.anuncios SET status = 'ativo', updated_at = now() WHERE id = p_anuncio_id;
    _titulo_key := 'notifications.adModeratedReativadoTitle';
    _msg_key := 'notifications.adModeratedReativadoMsg';
  ELSE
    UPDATE public.anuncios SET deleted_at = now(), status = 'pausado', updated_at = now() WHERE id = p_anuncio_id;
    _titulo_key := 'notifications.adModeratedRemovidoTitle';
    _msg_key := 'notifications.adModeratedRemovidoMsg';
  END IF;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (_vendedor, 'sistema', _titulo_key,
          COALESCE(NULLIF(trim(p_motivo), ''), _msg_key), '/vender');
END;
$function$;

CREATE OR REPLACE FUNCTION public.gravar_cotacoes_ia(p_items jsonb)
 RETURNS TABLE(out_produto text, out_status text, out_motivo text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _it jsonb; _produto text; _valor numeric;
  _unidade_id uuid; _moeda public.moeda_app; _fonte_url text;
  _has_manual boolean; _err text;
BEGIN
  IF _uid IS NULL OR NOT public.has_admin_perm(_uid, 'cotacoes') THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    _produto := _it->>'produto';
    BEGIN _valor := NULLIF(_it->>'valor','')::numeric; EXCEPTION WHEN OTHERS THEN _valor := NULL; END;
    BEGIN _unidade_id := NULLIF(_it->>'unidade_id','')::uuid; EXCEPTION WHEN OTHERS THEN _unidade_id := NULL; END;
    _moeda := COALESCE(NULLIF(_it->>'moeda',''),'BRL')::public.moeda_app;
    _fonte_url := _it->>'fonte_url';

    IF _produto IS NULL OR _valor IS NULL OR _valor <= 0 THEN
      RETURN QUERY SELECT _produto, 'skipped_invalid'::text, 'produto/valor ausente'::text; CONTINUE;
    END IF;
    IF _unidade_id IS NULL THEN
      RETURN QUERY SELECT _produto, 'erro'::text, 'unidade obrigatória'::text; CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.cotacoes_commodities c
      WHERE c.produto = _produto AND c.data = current_date
        AND c.fonte = 'manual' AND c.deleted_at IS NULL
    ) INTO _has_manual;

    IF _has_manual THEN
      RETURN QUERY SELECT _produto, 'skipped_manual'::text, NULL::text; CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.cotacoes_commodities AS c
        (produto, valor, moeda, unidade_id, data, fonte, fonte_url, atualizado_em)
      VALUES (_produto, _valor, _moeda, _unidade_id, current_date, 'ia', _fonte_url, now())
      ON CONFLICT (produto, data) WHERE deleted_at IS NULL
      DO UPDATE SET valor = EXCLUDED.valor, moeda = EXCLUDED.moeda,
        unidade_id = EXCLUDED.unidade_id, fonte = 'ia',
        fonte_url = EXCLUDED.fonte_url, atualizado_em = now(), updated_at = now()
      WHERE c.fonte <> 'manual';
      RETURN QUERY SELECT _produto, 'ok'::text, NULL::text;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS _err = MESSAGE_TEXT;
      RETURN QUERY SELECT _produto, 'erro'::text, _err;
    END;
  END LOOP;
END;
$function$;
