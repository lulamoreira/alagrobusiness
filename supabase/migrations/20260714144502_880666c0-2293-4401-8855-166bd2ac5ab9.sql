CREATE TABLE public.cotacoes_cambio (
  moeda public.moeda_app PRIMARY KEY,
  valor_brl numeric NOT NULL CHECK (valor_brl > 0),
  fonte text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cotacoes_cambio TO authenticated;
GRANT ALL ON public.cotacoes_cambio TO service_role;

ALTER TABLE public.cotacoes_cambio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotacoes_cambio_select_auth"
  ON public.cotacoes_cambio
  FOR SELECT
  TO authenticated
  USING (true);