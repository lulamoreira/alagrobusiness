
-- (A) Fix bug: only expire ACTIVE subscriptions

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
       AND a.status = 'ativa'
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
       AND asg.status = 'ativa'
    RETURNING asg.usuario_id
  )
  SELECT count(*) INTO _bloqueados FROM upd_prof;

  RETURN jsonb_build_object('bloqueados', _bloqueados);
END;
$$;

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
  _ass record;
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

  SELECT a.status, a.fim INTO _ass
    FROM public.assinaturas a
   WHERE a.usuario_id = _uid AND a.deleted_at IS NULL
   ORDER BY a.created_at DESC
   LIMIT 1;

  -- Só expira se a assinatura mais recente estiver ativa e vencida
  IF _ass.status = 'ativa' AND _ass.fim IS NOT NULL AND _ass.fim < now() THEN
    UPDATE public.profiles SET status = 'bloqueado', updated_at = now() WHERE id = _uid;
    UPDATE public.assinaturas SET status = 'expirada', updated_at = now()
      WHERE usuario_id = _uid AND deleted_at IS NULL AND status = 'ativa';
    RETURN jsonb_build_object('bloqueado', true);
  END IF;

  RETURN jsonb_build_object('bloqueado', false);
END;
$$;

-- (B) Schedule sync-demo-auth-ban every 15 minutes (offset by 7 min from expirar)

DO $$
BEGIN
  PERFORM cron.unschedule('sync-demo-auth-ban-15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sync-demo-auth-ban-15m',
  '7-59/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://jgkmyyxrtgcfhcnieegw.supabase.co/functions/v1/sync-demo-auth-ban',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='edge_functions_token'),
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='edge_functions_token'),
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
