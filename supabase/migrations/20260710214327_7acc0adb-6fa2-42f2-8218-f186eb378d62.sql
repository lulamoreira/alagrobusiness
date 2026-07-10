
-- 1) Add idioma column to mensagens
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS idioma text NULL;

-- 2) Trigger to auto-fill idioma from sender's profile on insert
CREATE OR REPLACE FUNCTION public.set_mensagem_idioma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.idioma IS NULL THEN
    SELECT idioma_preferido::text INTO NEW.idioma
    FROM public.profiles
    WHERE id = NEW.remetente_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_mensagem_idioma ON public.mensagens;
CREATE TRIGGER trg_set_mensagem_idioma
BEFORE INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.set_mensagem_idioma();

-- 3) Translation cache table
CREATE TABLE IF NOT EXISTS public.mensagens_traducoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  idioma text NOT NULL,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, idioma)
);

-- Grants: cache is service_role only (no anon, no authenticated)
GRANT ALL ON public.mensagens_traducoes TO service_role;

ALTER TABLE public.mensagens_traducoes ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: RLS enabled with no policies = denied.

CREATE INDEX IF NOT EXISTS idx_mensagens_traducoes_mensagem ON public.mensagens_traducoes(mensagem_id);
