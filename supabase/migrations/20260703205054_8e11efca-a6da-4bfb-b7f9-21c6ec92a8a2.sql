
CREATE OR REPLACE FUNCTION public.admin_moderar_anuncio(
  p_anuncio_id uuid,
  p_acao text,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _vendedor uuid;
  _titulo text;
  _titulo_key text;
  _msg_key text;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_acao NOT IN ('pausar','reativar','remover') THEN
    RAISE EXCEPTION 'acao_invalida' USING ERRCODE = '22023';
  END IF;

  SELECT vendedor_id, titulo INTO _vendedor, _titulo
    FROM public.anuncios
   WHERE id = p_anuncio_id AND deleted_at IS NULL;

  IF _vendedor IS NULL THEN
    RAISE EXCEPTION 'anuncio_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_acao = 'pausar' THEN
    UPDATE public.anuncios
       SET status = 'pausado', updated_at = now()
     WHERE id = p_anuncio_id;
    _titulo_key := 'notifications.adModeratedPausadoTitle';
    _msg_key := 'notifications.adModeratedPausadoMsg';
  ELSIF p_acao = 'reativar' THEN
    UPDATE public.anuncios
       SET status = 'ativo', updated_at = now()
     WHERE id = p_anuncio_id;
    _titulo_key := 'notifications.adModeratedReativadoTitle';
    _msg_key := 'notifications.adModeratedReativadoMsg';
  ELSE
    UPDATE public.anuncios
       SET deleted_at = now(), status = 'pausado', updated_at = now()
     WHERE id = p_anuncio_id;
    _titulo_key := 'notifications.adModeratedRemovidoTitle';
    _msg_key := 'notifications.adModeratedRemovidoMsg';
  END IF;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (
    _vendedor,
    'sistema',
    _titulo_key,
    COALESCE(NULLIF(trim(p_motivo), ''), _msg_key),
    '/vender'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderar_anuncio(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderar_anuncio(uuid, text, text) TO authenticated;
