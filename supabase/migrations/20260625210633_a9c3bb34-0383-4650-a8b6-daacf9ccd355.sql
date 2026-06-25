
-- Permite tipo 'mensagem' em notificacoes
ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check
  CHECK (tipo IN ('alerta','noticia','preco','sistema','mensagem'));

-- ===== CONVERSAS =====
CREATE TABLE public.conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  comprador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT conversas_comprador_nao_vendedor CHECK (comprador_id <> vendedor_id)
);

CREATE UNIQUE INDEX conversas_anuncio_comprador_unique
  ON public.conversas (anuncio_id, comprador_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversas_comprador ON public.conversas (comprador_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversas_vendedor ON public.conversas (vendedor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversas_last_msg ON public.conversas (last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversas_anuncio ON public.conversas (anuncio_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas TO authenticated;
GRANT ALL ON public.conversas TO service_role;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversas_select_participant_or_admin ON public.conversas
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    auth.uid() = comprador_id
    OR auth.uid() = vendedor_id
    OR public.is_admin(auth.uid())
  )
);

CREATE POLICY conversas_insert_comprador ON public.conversas
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = comprador_id
  AND comprador_id <> vendedor_id
  AND EXISTS (
    SELECT 1 FROM public.anuncios a
    WHERE a.id = anuncio_id
      AND a.vendedor_id = conversas.vendedor_id
      AND a.deleted_at IS NULL
  )
);

CREATE POLICY conversas_update_participant_or_admin ON public.conversas
FOR UPDATE TO authenticated
USING (auth.uid() = comprador_id OR auth.uid() = vendedor_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = comprador_id OR auth.uid() = vendedor_id OR public.is_admin(auth.uid()));

CREATE POLICY conversas_delete_participant_or_admin ON public.conversas
FOR DELETE TO authenticated
USING (auth.uid() = comprador_id OR auth.uid() = vendedor_id OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_conversas_updated_at
BEFORE UPDATE ON public.conversas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== MENSAGENS =====
CREATE TABLE public.mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  remetente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conteudo text NOT NULL CHECK (length(btrim(conteudo)) > 0 AND length(conteudo) <= 4000),
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_mensagens_conversa_created ON public.mensagens (conversa_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_mensagens_nao_lidas ON public.mensagens (conversa_id, remetente_id) WHERE lida = false AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY mensagens_select_participant_or_admin ON public.mensagens
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversas c
      WHERE c.id = mensagens.conversa_id
        AND c.deleted_at IS NULL
        AND (c.comprador_id = auth.uid() OR c.vendedor_id = auth.uid())
    )
  )
);

CREATE POLICY mensagens_insert_participant_active ON public.mensagens
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = remetente_id
  AND EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND c.deleted_at IS NULL
      AND (c.comprador_id = auth.uid() OR c.vendedor_id = auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.status <> 'bloqueado'
  )
);

CREATE POLICY mensagens_update_participant_or_admin ON public.mensagens
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (c.comprador_id = auth.uid() OR c.vendedor_id = auth.uid())
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = mensagens.conversa_id
      AND (c.comprador_id = auth.uid() OR c.vendedor_id = auth.uid())
  )
);

CREATE TRIGGER trg_mensagens_updated_at
BEFORE UPDATE ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Trigger: nova mensagem -> atualiza conversa + cria notificação =====
CREATE OR REPLACE FUNCTION public.handle_new_mensagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _comprador_id uuid;
  _vendedor_id uuid;
  _anuncio_id uuid;
  _anuncio_titulo text;
  _destinatario uuid;
  _preview text;
BEGIN
  SELECT c.comprador_id, c.vendedor_id, c.anuncio_id
    INTO _comprador_id, _vendedor_id, _anuncio_id
  FROM public.conversas c
  WHERE c.id = NEW.conversa_id;

  IF _comprador_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.conversas
     SET last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversa_id;

  IF NEW.remetente_id = _comprador_id THEN
    _destinatario := _vendedor_id;
  ELSE
    _destinatario := _comprador_id;
  END IF;

  SELECT titulo INTO _anuncio_titulo FROM public.anuncios WHERE id = _anuncio_id;
  _preview := substring(NEW.conteudo from 1 for 140);

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (
    _destinatario,
    'mensagem',
    COALESCE(_anuncio_titulo, ''),
    _preview,
    '/mensagens/' || NEW.conversa_id::text
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_mensagem_inserted
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.handle_new_mensagem();

-- ===== Realtime =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
