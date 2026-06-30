-- 1) Enum
DO $$ BEGIN
  CREATE TYPE public.negociacao_status AS ENUM ('iniciado','em_negociacao','fechado','descartado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Column
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS status_negociacao public.negociacao_status NOT NULL DEFAULT 'iniciado';

CREATE INDEX IF NOT EXISTS idx_conversas_vendedor_status
  ON public.conversas (vendedor_id, status_negociacao)
  WHERE deleted_at IS NULL;

-- 3) Guard: somente o vendedor (ou definer/service_role) pode alterar status_negociacao
CREATE OR REPLACE FUNCTION public.guard_conversas_status_negociacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF NEW.status_negociacao IS DISTINCT FROM OLD.status_negociacao THEN
    -- Permite quando não há usuário autenticado (definer/service_role)
    IF _uid IS NOT NULL AND _uid <> OLD.vendedor_id THEN
      RAISE EXCEPTION 'Apenas o vendedor pode alterar o status da negociação'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_conversas_status_negociacao ON public.conversas;
CREATE TRIGGER trg_guard_conversas_status_negociacao
  BEFORE UPDATE OF status_negociacao ON public.conversas
  FOR EACH ROW EXECUTE FUNCTION public.guard_conversas_status_negociacao();

-- 4) RPC autoritativa
CREATE OR REPLACE FUNCTION public.set_status_negociacao(
  p_conversa_id uuid,
  p_status public.negociacao_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _vendedor uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT vendedor_id INTO _vendedor
  FROM public.conversas
  WHERE id = p_conversa_id AND deleted_at IS NULL;

  IF _vendedor IS NULL THEN
    RAISE EXCEPTION 'Conversa não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF _vendedor <> _uid THEN
    RAISE EXCEPTION 'Apenas o vendedor pode alterar o status' USING ERRCODE = '42501';
  END IF;

  UPDATE public.conversas
     SET status_negociacao = p_status,
         updated_at = now()
   WHERE id = p_conversa_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_status_negociacao(uuid, public.negociacao_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_status_negociacao(uuid, public.negociacao_status) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.guard_conversas_status_negociacao() FROM PUBLIC, anon, authenticated;