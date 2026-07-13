ALTER TABLE public.preferencias
  ADD COLUMN IF NOT EXISTS destaque_scroll_segundos integer NOT NULL DEFAULT 3;

ALTER TABLE public.preferencias
  DROP CONSTRAINT IF EXISTS preferencias_destaque_scroll_range;

ALTER TABLE public.preferencias
  ADD CONSTRAINT preferencias_destaque_scroll_range
  CHECK (destaque_scroll_segundos BETWEEN 2 AND 15);