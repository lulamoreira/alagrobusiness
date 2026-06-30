
-- Enum
DO $$ BEGIN
  CREATE TYPE public.tipo_evento AS ENUM ('plantio','colheita','entrega','pagamento','reuniao','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  tipo public.tipo_evento NOT NULL DEFAULT 'outro',
  data date NOT NULL,
  hora time,
  concluido boolean NOT NULL DEFAULT false,
  anuncio_id uuid REFERENCES public.anuncios(id) ON DELETE SET NULL,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Grants (no anon)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_eventos TO authenticated;
GRANT ALL ON public.agenda_eventos TO service_role;

-- RLS
ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY agenda_select_own_or_admin ON public.agenda_eventos
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (usuario_id = auth.uid() OR public.is_admin(auth.uid())));

CREATE POLICY agenda_insert_own ON public.agenda_eventos
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY agenda_update_own_or_admin ON public.agenda_eventos
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY agenda_delete_own_or_admin ON public.agenda_eventos
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

-- updated_at trigger
CREATE TRIGGER agenda_eventos_set_updated_at
  BEFORE UPDATE ON public.agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS agenda_eventos_owner_data_idx
  ON public.agenda_eventos (usuario_id, data) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS agenda_eventos_data_idx
  ON public.agenda_eventos (data) WHERE deleted_at IS NULL;
