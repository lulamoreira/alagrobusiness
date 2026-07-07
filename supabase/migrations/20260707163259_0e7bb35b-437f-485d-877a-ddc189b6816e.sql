-- Reafirma proteção da tabela vendas (RLS + grants corretos + policies)
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- Revoga todos os privilégios de anon (não deve acessar dado financeiro)
REVOKE ALL ON public.vendas FROM anon;
REVOKE ALL ON public.vendas FROM PUBLIC;

-- Garante grants corretos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT ALL ON public.vendas TO service_role;

-- Policies (idempotentes)
DROP POLICY IF EXISTS vendas_select_own_or_admin ON public.vendas;
DROP POLICY IF EXISTS vendas_insert_own ON public.vendas;
DROP POLICY IF EXISTS vendas_update_own_or_admin ON public.vendas;
DROP POLICY IF EXISTS vendas_delete_own_or_admin ON public.vendas;

CREATE POLICY vendas_select_own_or_admin ON public.vendas
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (vendedor_id = auth.uid() OR public.is_admin(auth.uid())));

CREATE POLICY vendas_insert_own ON public.vendas
  FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid());

CREATE POLICY vendas_update_own_or_admin ON public.vendas
  FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (vendedor_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY vendas_delete_own_or_admin ON public.vendas
  FOR DELETE TO authenticated
  USING (vendedor_id = auth.uid() OR public.is_admin(auth.uid()));