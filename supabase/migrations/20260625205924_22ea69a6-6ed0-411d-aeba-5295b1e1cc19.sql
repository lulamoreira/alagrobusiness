DROP POLICY IF EXISTS anuncios_select_authenticated ON public.anuncios;

CREATE POLICY anuncios_select_authenticated
ON public.anuncios
FOR SELECT
TO authenticated
USING (
  (status = 'ativo'::public.status_anuncio AND deleted_at IS NULL)
  OR vendedor_id = auth.uid()
  OR public.is_admin(auth.uid())
);