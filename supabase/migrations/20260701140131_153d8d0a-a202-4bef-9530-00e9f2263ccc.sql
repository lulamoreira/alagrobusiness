CREATE TABLE IF NOT EXISTS public.stripe_events_processados (
  event_id text PRIMARY KEY,
  tipo text NOT NULL,
  processado_em timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);
GRANT ALL ON public.stripe_events_processados TO service_role;
ALTER TABLE public.stripe_events_processados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_client_access" ON public.stripe_events_processados FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);