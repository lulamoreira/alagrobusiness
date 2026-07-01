
CREATE OR REPLACE FUNCTION public.get_stripe_webhook_secret()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'stripe_webhook_secret' LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_stripe_webhook_secret() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_stripe_webhook_secret(p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  _existing uuid;
BEGIN
  SELECT id INTO _existing FROM vault.secrets WHERE name = 'stripe_webhook_secret' LIMIT 1;
  IF _existing IS NULL THEN
    PERFORM vault.create_secret(p_secret, 'stripe_webhook_secret', 'Stripe webhook signing secret (whsec_...)');
  ELSE
    PERFORM vault.update_secret(_existing, p_secret);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_stripe_webhook_secret(text) FROM PUBLIC, anon, authenticated;
