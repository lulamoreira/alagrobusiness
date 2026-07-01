
CREATE TABLE public.progresso_aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  concluida boolean NOT NULL DEFAULT false,
  assistido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX progresso_aulas_uid_aid_uniq
  ON public.progresso_aulas (usuario_id, aula_id)
  WHERE deleted_at IS NULL;

CREATE INDEX progresso_aulas_usuario_idx ON public.progresso_aulas (usuario_id) WHERE deleted_at IS NULL;
CREATE INDEX progresso_aulas_aula_idx ON public.progresso_aulas (aula_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progresso_aulas TO authenticated;
GRANT ALL ON public.progresso_aulas TO service_role;

ALTER TABLE public.progresso_aulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progresso_select_own_or_admin" ON public.progresso_aulas
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (usuario_id = auth.uid() OR public.is_admin(auth.uid())));

CREATE POLICY "progresso_insert_own" ON public.progresso_aulas
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "progresso_update_own_or_admin" ON public.progresso_aulas
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "progresso_delete_own_or_admin" ON public.progresso_aulas
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_progresso_aulas_updated
  BEFORE UPDATE ON public.progresso_aulas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
