CREATE TABLE public.alertas_preco (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_alerta text NOT NULL CHECK (tipo_alerta IN ('commodity','dolar')),
  referencia text NOT NULL,
  condicao text NOT NULL CHECK (condicao IN ('acima','abaixo')),
  valor_alvo numeric NOT NULL CHECK (valor_alvo > 0),
  moeda public.moeda_app NOT NULL DEFAULT 'BRL',
  ativo boolean NOT NULL DEFAULT true,
  disparado boolean NOT NULL DEFAULT false,
  ultima_notificacao_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_alertas_preco_user ON public.alertas_preco(usuario_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alertas_preco_ativos ON public.alertas_preco(tipo_alerta, referencia) WHERE deleted_at IS NULL AND ativo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_preco TO authenticated;
GRANT ALL ON public.alertas_preco TO service_role;

ALTER TABLE public.alertas_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_preco_select_own_or_admin" ON public.alertas_preco
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "alertas_preco_insert_own" ON public.alertas_preco
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "alertas_preco_update_own_or_admin" ON public.alertas_preco
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "alertas_preco_delete_own_or_admin" ON public.alertas_preco
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_alertas_preco_updated_at
  BEFORE UPDATE ON public.alertas_preco
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();