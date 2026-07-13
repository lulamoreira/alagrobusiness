
CREATE TABLE public.anuncio_centros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anuncio_id UUID NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  centro_id UUID NOT NULL REFERENCES public.centros_distribuicao(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (anuncio_id, centro_id)
);

CREATE INDEX idx_anuncio_centros_anuncio ON public.anuncio_centros(anuncio_id);
CREATE INDEX idx_anuncio_centros_centro ON public.anuncio_centros(centro_id);

GRANT SELECT, INSERT, DELETE ON public.anuncio_centros TO authenticated;
GRANT ALL ON public.anuncio_centros TO service_role;

ALTER TABLE public.anuncio_centros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anuncio_centros_select_auth"
  ON public.anuncio_centros
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "anuncio_centros_insert_owner_or_admin"
  ON public.anuncio_centros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anuncios a
      WHERE a.id = anuncio_id
        AND (a.vendedor_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "anuncio_centros_delete_owner_or_admin"
  ON public.anuncio_centros
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.anuncios a
      WHERE a.id = anuncio_id
        AND (a.vendedor_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );
