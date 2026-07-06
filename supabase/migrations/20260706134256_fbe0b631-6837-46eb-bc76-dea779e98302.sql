
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE
USING ((id = auth.uid()) OR is_admin(auth.uid()))
WITH CHECK (
  is_admin(auth.uid())
  OR (
    id = auth.uid()
    AND tipo_perfil     = (SELECT p.tipo_perfil     FROM public.profiles p WHERE p.id = auth.uid())
    AND status          = (SELECT p.status          FROM public.profiles p WHERE p.id = auth.uid())
    AND is_super_admin  IS NOT DISTINCT FROM (SELECT p.is_super_admin  FROM public.profiles p WHERE p.id = auth.uid())
    AND admin_permissoes IS NOT DISTINCT FROM (SELECT p.admin_permissoes FROM public.profiles p WHERE p.id = auth.uid())
  )
);
