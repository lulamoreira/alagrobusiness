
-- 1) Lock down SECURITY DEFINER functions: revoke from PUBLIC, grant only to roles that need them.
REVOKE ALL ON FUNCTION public.marcar_mensagens_lidas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_mensagens_lidas(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gravar_cotacoes_ia(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_cotacoes_ia(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_profile(text, text, text, text, text, text, text[], text, text, text, text[], boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_profile(text, text, text, text, text, text, text[], text, text, text, text[], boolean, text) TO authenticated;

-- Trigger-only functions: revoke from everyone; triggers run with table owner privileges and don't need explicit grants.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_mensagem() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Fix mensagens UPDATE policy: restrict to authenticated role (was 'public').
DROP POLICY IF EXISTS mensagens_update_own_or_admin ON public.mensagens;
CREATE POLICY mensagens_update_own_or_admin ON public.mensagens
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = remetente_id) OR public.is_admin(auth.uid()))
  WITH CHECK ((auth.uid() = remetente_id) OR public.is_admin(auth.uid()));
