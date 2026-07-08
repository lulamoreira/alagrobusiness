
CREATE TABLE public.usuario_clima_locais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cidade text NOT NULL,
  estado text NULL,
  regiao text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE UNIQUE INDEX usuario_clima_locais_user_regiao_uniq
  ON public.usuario_clima_locais (usuario_id, regiao)
  WHERE deleted_at IS NULL;

CREATE INDEX usuario_clima_locais_regiao_idx
  ON public.usuario_clima_locais (regiao)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_clima_locais TO authenticated;
GRANT ALL ON public.usuario_clima_locais TO service_role;

ALTER TABLE public.usuario_clima_locais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.usuario_clima_locais
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id AND deleted_at IS NULL);

CREATE POLICY "own_insert" ON public.usuario_clima_locais
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "own_update" ON public.usuario_clima_locais
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "own_delete" ON public.usuario_clima_locais
  FOR DELETE TO authenticated
  USING (auth.uid() = usuario_id);

CREATE TRIGGER usuario_clima_locais_set_updated_at
  BEFORE UPDATE ON public.usuario_clima_locais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
