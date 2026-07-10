
-- destaque_pacotes
CREATE TABLE public.destaque_pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dias int NOT NULL,
  preco_centavos int NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.destaque_pacotes TO authenticated;
GRANT ALL ON public.destaque_pacotes TO service_role;
ALTER TABLE public.destaque_pacotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY destaque_pacotes_select_ativos ON public.destaque_pacotes
  FOR SELECT TO authenticated
  USING (ativo = true OR public.is_admin(auth.uid()));

CREATE POLICY destaque_pacotes_admin_ins ON public.destaque_pacotes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY destaque_pacotes_admin_upd ON public.destaque_pacotes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY destaque_pacotes_admin_del ON public.destaque_pacotes
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_destaque_pacotes_updated_at
  BEFORE UPDATE ON public.destaque_pacotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.destaque_pacotes (dias, preco_centavos, ordem) VALUES
  (7, 2500, 1),
  (15, 4500, 2),
  (30, 8000, 3);

-- destaque_compras (histórico de receita; leitura só admin/service_role)
CREATE TABLE public.destaque_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dias int NOT NULL,
  valor_centavos int NOT NULL,
  stripe_session_id text UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.destaque_compras TO authenticated;
GRANT ALL ON public.destaque_compras TO service_role;
ALTER TABLE public.destaque_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY destaque_compras_select_own_or_admin ON public.destaque_compras
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX destaque_compras_anuncio_idx ON public.destaque_compras(anuncio_id);
CREATE INDEX destaque_compras_usuario_idx ON public.destaque_compras(usuario_id);
