
-- Tighten mensagens UPDATE policy and add definer RPC for marking read
DROP POLICY IF EXISTS mensagens_update_participant_or_admin ON public.mensagens;

CREATE POLICY mensagens_update_own_or_admin ON public.mensagens
  FOR UPDATE
  USING (auth.uid() = remetente_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = remetente_id OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.marcar_mensagens_lidas(p_conversa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ok boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.conversas
    WHERE id = p_conversa_id
      AND deleted_at IS NULL
      AND (comprador_id = _uid OR vendedor_id = _uid)
  ) INTO _ok;

  IF NOT _ok THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.mensagens
     SET lida = true, updated_at = now()
   WHERE conversa_id = p_conversa_id
     AND remetente_id <> _uid
     AND lida = false
     AND deleted_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_mensagens_lidas(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marcar_mensagens_lidas(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_mensagens_lidas(uuid) TO authenticated;
