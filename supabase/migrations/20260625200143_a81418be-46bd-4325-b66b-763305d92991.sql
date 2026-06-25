
-- 1) Extensões
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2) Token de invocação no Vault (não em texto plano no código)
do $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'edge_functions_token';
  if v_id is null then
    perform vault.create_secret('sb_publishable_AlABRoBuSineSS_PHASE0', 'edge_functions_token',
      'Token usado pelo pg_cron para chamar edge functions internas (verify_jwt=false).');
  end if;
end $$;

-- 3) Limpar jobs antigos de mesmo nome (idempotente)
do $$
begin
  perform cron.unschedule('fetch-dolar-daily');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('fetch-noticias-12h');
exception when others then null;
end $$;

-- 4) Agendar jobs
select cron.schedule(
  'fetch-dolar-daily',
  '0 9 * * *',
  $job$
  select net.http_post(
    url := 'https://jgkmyyxrtgcfhcnieegw.supabase.co/functions/v1/fetch-dolar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_token'),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);

select cron.schedule(
  'fetch-noticias-12h',
  '0 */12 * * *',
  $job$
  select net.http_post(
    url := 'https://jgkmyyxrtgcfhcnieegw.supabase.co/functions/v1/fetch-noticias-agro',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_token'),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);
