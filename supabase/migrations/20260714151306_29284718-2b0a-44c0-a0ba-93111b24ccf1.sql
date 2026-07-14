
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS para_exportacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incoterm text,
  ADD COLUMN IF NOT EXISTS paises_destino text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anuncios_incoterm_check'
  ) THEN
    ALTER TABLE public.anuncios
      ADD CONSTRAINT anuncios_incoterm_check
      CHECK (incoterm IS NULL OR incoterm IN ('EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_anuncios_para_exportacao
  ON public.anuncios (para_exportacao) WHERE para_exportacao = true;
