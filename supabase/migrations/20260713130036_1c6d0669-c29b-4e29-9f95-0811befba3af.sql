
-- Trigger to notify counterparty when negotiation status changes
CREATE OR REPLACE FUNCTION public.notify_negociacao_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _titulo text;
  _link text;
BEGIN
  IF NEW.status_negociacao IS NOT DISTINCT FROM OLD.status_negociacao THEN
    RETURN NEW;
  END IF;

  SELECT titulo INTO _titulo FROM public.anuncios WHERE id = NEW.anuncio_id;
  _link := '/mensagens/' || NEW.id::text;

  -- Notify the other party (or both if system-driven change)
  IF _actor IS NULL OR _actor <> NEW.comprador_id THEN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
    VALUES (NEW.comprador_id, 'negociacao_status', COALESCE(_titulo, ''), NEW.status_negociacao::text, _link);
  END IF;

  IF _actor IS NULL OR _actor <> NEW.vendedor_id THEN
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
    VALUES (NEW.vendedor_id, 'negociacao_status', COALESCE(_titulo, ''), NEW.status_negociacao::text, _link);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_negociacao_status_change ON public.conversas;
CREATE TRIGGER trg_notify_negociacao_status_change
AFTER UPDATE OF status_negociacao ON public.conversas
FOR EACH ROW EXECUTE FUNCTION public.notify_negociacao_status_change();

-- Ensure realtime is enabled on notificacoes
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
