
-- 1. cd_operadores
CREATE TABLE public.cd_operadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid NOT NULL REFERENCES public.centros_distribuicao(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centro_id, usuario_id)
);
CREATE INDEX cd_operadores_centro_idx ON public.cd_operadores(centro_id);
CREATE INDEX cd_operadores_usuario_idx ON public.cd_operadores(usuario_id);

GRANT SELECT, INSERT, DELETE ON public.cd_operadores TO authenticated;
GRANT ALL ON public.cd_operadores TO service_role;

ALTER TABLE public.cd_operadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY cd_operadores_select_self_or_admin ON public.cd_operadores
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY cd_operadores_insert_admin ON public.cd_operadores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY cd_operadores_delete_admin ON public.cd_operadores
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. Helper
CREATE OR REPLACE FUNCTION public.is_cd_operador(_uid uuid, _centro uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cd_operadores
     WHERE usuario_id = _uid AND centro_id = _centro
  );
$$;

-- 3. Amplia UPDATE em centros_distribuicao
DROP POLICY IF EXISTS cds_update_admin ON public.centros_distribuicao;
CREATE POLICY cds_update_admin_or_operator ON public.centros_distribuicao
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_cd_operador(auth.uid(), id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_cd_operador(auth.uid(), id));
