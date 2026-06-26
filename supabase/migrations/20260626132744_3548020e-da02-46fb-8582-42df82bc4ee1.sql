
-- 1) cotacoes_commodities: novos campos + índice único parcial
ALTER TABLE public.cotacoes_commodities
  ADD COLUMN IF NOT EXISTS data date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS fonte text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS fonte_url text;

ALTER TABLE public.cotacoes_commodities
  DROP CONSTRAINT IF EXISTS cotacoes_commodities_fonte_check;
ALTER TABLE public.cotacoes_commodities
  ADD CONSTRAINT cotacoes_commodities_fonte_check
  CHECK (fonte IN ('manual','auto','ia'));

CREATE UNIQUE INDEX IF NOT EXISTS cotacoes_commodities_produto_data_uniq
  ON public.cotacoes_commodities (produto, data)
  WHERE deleted_at IS NULL;

-- 2) cotacoes_dolar_historico
CREATE TABLE IF NOT EXISTS public.cotacoes_dolar_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_dolar NOT NULL,
  valor_brl numeric NOT NULL,
  data date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT ON public.cotacoes_dolar_historico TO authenticated;
GRANT ALL ON public.cotacoes_dolar_historico TO service_role;

ALTER TABLE public.cotacoes_dolar_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotacoes_dolar_historico_read ON public.cotacoes_dolar_historico;
CREATE POLICY cotacoes_dolar_historico_read
  ON public.cotacoes_dolar_historico FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS cotacoes_dolar_historico_admin ON public.cotacoes_dolar_historico;
CREATE POLICY cotacoes_dolar_historico_admin
  ON public.cotacoes_dolar_historico FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS cotacoes_dolar_historico_tipo_data_uniq
  ON public.cotacoes_dolar_historico (tipo, data)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS set_updated_at_cotacoes_dolar_historico ON public.cotacoes_dolar_historico;
CREATE TRIGGER set_updated_at_cotacoes_dolar_historico
  BEFORE UPDATE ON public.cotacoes_dolar_historico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) RPC para gravação IA respeitando regra híbrida (manual prevalece)
CREATE OR REPLACE FUNCTION public.gravar_cotacoes_ia(p_items jsonb)
RETURNS TABLE(produto text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _it jsonb;
  _produto text;
  _valor numeric;
  _unidade_id uuid;
  _moeda public.moeda_app;
  _fonte_url text;
  _has_manual boolean;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    _produto := _it->>'produto';
    _valor := NULLIF(_it->>'valor','')::numeric;
    _unidade_id := NULLIF(_it->>'unidade_id','')::uuid;
    _moeda := COALESCE(NULLIF(_it->>'moeda',''),'BRL')::public.moeda_app;
    _fonte_url := _it->>'fonte_url';

    IF _produto IS NULL OR _valor IS NULL THEN
      produto := _produto; status := 'skipped_invalid'; RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.cotacoes_commodities
      WHERE produto = _produto AND data = current_date
        AND fonte = 'manual' AND deleted_at IS NULL
    ) INTO _has_manual;

    IF _has_manual THEN
      produto := _produto; status := 'skipped_manual'; RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.cotacoes_commodities
      (produto, valor, moeda, unidade_id, data, fonte, fonte_url, atualizado_em)
    VALUES
      (_produto, _valor, _moeda, _unidade_id, current_date, 'ia', _fonte_url, now())
    ON CONFLICT (produto, data) WHERE deleted_at IS NULL
    DO UPDATE SET
      valor = EXCLUDED.valor,
      moeda = EXCLUDED.moeda,
      unidade_id = EXCLUDED.unidade_id,
      fonte = 'ia',
      fonte_url = EXCLUDED.fonte_url,
      atualizado_em = now(),
      updated_at = now()
    WHERE public.cotacoes_commodities.fonte <> 'manual';

    produto := _produto; status := 'ok'; RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.gravar_cotacoes_ia(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gravar_cotacoes_ia(jsonb) TO authenticated;
