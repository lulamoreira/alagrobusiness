CREATE TABLE public.vantagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  parceiro_nome TEXT NOT NULL,
  parceiro_logo_url TEXT,
  categoria TEXT,
  desconto TEXT NOT NULL,
  cupom TEXT,
  link_url TEXT,
  validade DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vantagens TO authenticated;
GRANT ALL ON public.vantagens TO service_role;

ALTER TABLE public.vantagens ENABLE ROW LEVEL SECURITY;

-- Paywall SELECT: admin OU (plano libera clube). Não-admin: só ativos e não removidos.
CREATE POLICY "vantagens_select_paywall" ON public.vantagens
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (
      deleted_at IS NULL
      AND ativo = true
      AND COALESCE((public.current_plan_limites(auth.uid()) ->> 'clube')::boolean, false) = true
    )
  );

CREATE POLICY "vantagens_admin_insert" ON public.vantagens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "vantagens_admin_update" ON public.vantagens
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "vantagens_admin_delete" ON public.vantagens
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_vantagens
  BEFORE UPDATE ON public.vantagens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_vantagens_ativo ON public.vantagens (ativo, ordem) WHERE deleted_at IS NULL;
CREATE INDEX idx_vantagens_categoria ON public.vantagens (categoria) WHERE deleted_at IS NULL;