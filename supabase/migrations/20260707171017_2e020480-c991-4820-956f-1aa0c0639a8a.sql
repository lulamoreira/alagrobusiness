
CREATE TABLE public.contatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  ip TEXT,
  user_agent TEXT,
  origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Sem grant para anon: o envio é feito por edge function com service_role
GRANT SELECT, UPDATE ON public.contatos TO authenticated;
GRANT ALL ON public.contatos TO service_role;

ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler/atualizar via API
CREATE POLICY "contatos_select_admin" ON public.contatos
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "contatos_update_admin" ON public.contatos
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_contatos_created_at ON public.contatos (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_contatos_lida ON public.contatos (lida) WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at_contatos
  BEFORE UPDATE ON public.contatos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
