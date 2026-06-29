SELECT net.http_post(
  url := 'https://jgkmyyxrtgcfhcnieegw.supabase.co/functions/v1/check-alertas-preco',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='edge_functions_token'),
    'apikey',(select decrypted_secret from vault.decrypted_secrets where name='edge_functions_token'),
    'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_secret')
  ),
  body := '{}'::jsonb
) AS request_id;