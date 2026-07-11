CREATE TABLE public.centros_distribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  responsavel text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  latitude numeric,
  longitude numeric,
  capacidade text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_distribuicao TO authenticated;
GRANT ALL ON public.centros_distribuicao TO service_role;

ALTER TABLE public.centros_distribuicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cds_select_authenticated"
  ON public.centros_distribuicao FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "cds_insert_admin"
  ON public.centros_distribuicao FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "cds_update_admin"
  ON public.centros_distribuicao FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "cds_delete_admin"
  ON public.centros_distribuicao FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_cds_updated_at
  BEFORE UPDATE ON public.centros_distribuicao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cds_ativo ON public.centros_distribuicao (ativo) WHERE deleted_at IS NULL;
CREATE INDEX idx_cds_estado ON public.centros_distribuicao (estado) WHERE deleted_at IS NULL;