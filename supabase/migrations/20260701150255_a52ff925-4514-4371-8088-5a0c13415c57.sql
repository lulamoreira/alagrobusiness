
-- ============ CURSOS ============
CREATE TABLE public.cursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  capa_url TEXT,
  categoria TEXT,
  publicado BOOLEAN NOT NULL DEFAULT false,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cursos TO authenticated;
GRANT ALL ON public.cursos TO service_role;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cursos_select_publicados" ON public.cursos
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (publicado = true OR public.is_admin(auth.uid())));

CREATE POLICY "cursos_admin_insert" ON public.cursos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "cursos_admin_update" ON public.cursos
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "cursos_admin_delete" ON public.cursos
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_cursos
  BEFORE UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cursos_publicado ON public.cursos (publicado) WHERE deleted_at IS NULL;

-- ============ MODULOS ============
CREATE TABLE public.modulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos TO authenticated;
GRANT ALL ON public.modulos TO service_role;
ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modulos_select_via_curso" ON public.modulos
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.cursos c
      WHERE c.id = modulos.curso_id
        AND c.deleted_at IS NULL
        AND (c.publicado = true OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "modulos_admin_insert" ON public.modulos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "modulos_admin_update" ON public.modulos
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "modulos_admin_delete" ON public.modulos
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_modulos
  BEFORE UPDATE ON public.modulos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_modulos_curso ON public.modulos (curso_id) WHERE deleted_at IS NULL;

-- ============ AULAS ============
CREATE TABLE public.aulas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo_id UUID NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  duracao_seg INT,
  gratis BOOLEAN NOT NULL DEFAULT false,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aulas TO authenticated;
GRANT ALL ON public.aulas TO service_role;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aulas_select_via_curso" ON public.aulas
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.modulos m
      JOIN public.cursos c ON c.id = m.curso_id
      WHERE m.id = aulas.modulo_id
        AND m.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND (c.publicado = true OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "aulas_admin_insert" ON public.aulas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "aulas_admin_update" ON public.aulas
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "aulas_admin_delete" ON public.aulas
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_aulas
  BEFORE UPDATE ON public.aulas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_aulas_modulo ON public.aulas (modulo_id) WHERE deleted_at IS NULL;

-- ============ AULAS_VIDEO (paywall) ============
CREATE TABLE public.aulas_video (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aula_id UUID NOT NULL UNIQUE REFERENCES public.aulas(id) ON DELETE CASCADE,
  video_provider TEXT NOT NULL CHECK (video_provider IN ('youtube','vimeo')),
  video_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aulas_video TO authenticated;
GRANT ALL ON public.aulas_video TO service_role;
ALTER TABLE public.aulas_video ENABLE ROW LEVEL SECURITY;

-- Paywall SELECT: admin OU aula grátis OU plano libera cursos completos
CREATE POLICY "aulas_video_select_paywall" ON public.aulas_video
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.aulas a
        JOIN public.modulos m ON m.id = a.modulo_id
        JOIN public.cursos c ON c.id = m.curso_id
        WHERE a.id = aulas_video.aula_id
          AND a.deleted_at IS NULL
          AND m.deleted_at IS NULL
          AND c.deleted_at IS NULL
          AND c.publicado = true
          AND (
            a.gratis = true
            OR (public.current_plan_limites(auth.uid()) ->> 'cursos') = 'full'
          )
      )
    )
  );

CREATE POLICY "aulas_video_admin_insert" ON public.aulas_video
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "aulas_video_admin_update" ON public.aulas_video
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "aulas_video_admin_delete" ON public.aulas_video
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_aulas_video
  BEFORE UPDATE ON public.aulas_video
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
