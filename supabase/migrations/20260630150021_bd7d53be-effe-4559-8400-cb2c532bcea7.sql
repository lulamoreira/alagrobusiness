CREATE TYPE public.pagamento_status AS ENUM ('aguardando','recebido');

ALTER TABLE public.vendas
  ADD COLUMN status_pagamento public.pagamento_status NOT NULL DEFAULT 'aguardando',
  ADD COLUMN data_recebimento date;

CREATE INDEX idx_vendas_status_pagamento ON public.vendas(vendedor_id, status_pagamento) WHERE deleted_at IS NULL;