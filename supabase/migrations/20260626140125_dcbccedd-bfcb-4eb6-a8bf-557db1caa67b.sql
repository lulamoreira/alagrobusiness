
DROP FUNCTION IF EXISTS public.gravar_cotacoes_ia(jsonb);

CREATE OR REPLACE FUNCTION public.gravar_cotacoes_ia(p_items jsonb)
 RETURNS TABLE(produto text, status text, motivo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _it jsonb;
  _produto text;
  _valor numeric;
  _unidade_id uuid;
  _moeda public.moeda_app;
  _fonte_url text;
  _has_manual boolean;
  _err text;
BEGIN
  IF _uid IS NULL OR NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    _produto := _it->>'produto';
    BEGIN _valor := NULLIF(_it->>'valor','')::numeric;
    EXCEPTION WHEN OTHERS THEN _valor := NULL; END;
    BEGIN _unidade_id := NULLIF(_it->>'unidade_id','')::uuid;
    EXCEPTION WHEN OTHERS THEN _unidade_id := NULL; END;
    _moeda := COALESCE(NULLIF(_it->>'moeda',''),'BRL')::public.moeda_app;
    _fonte_url := _it->>'fonte_url';

    IF _produto IS NULL OR _valor IS NULL OR _valor <= 0 THEN
      produto := _produto; status := 'skipped_invalid'; motivo := 'produto/valor ausente';
      RETURN NEXT; CONTINUE;
    END IF;

    IF _unidade_id IS NULL THEN
      produto := _produto; status := 'erro'; motivo := 'unidade obrigatória';
      RETURN NEXT; CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.cotacoes_commodities c
      WHERE c.produto = _produto AND c.data = current_date
        AND c.fonte = 'manual' AND c.deleted_at IS NULL
    ) INTO _has_manual;

    IF _has_manual THEN
      produto := _produto; status := 'skipped_manual'; motivo := NULL;
      RETURN NEXT; CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.cotacoes_commodities AS c
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
      WHERE c.fonte <> 'manual';

      produto := _produto; status := 'ok'; motivo := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS _err = MESSAGE_TEXT;
      produto := _produto; status := 'erro'; motivo := _err;
      RETURN NEXT;
    END;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.gravar_cotacoes_ia(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gravar_cotacoes_ia(jsonb) TO authenticated;
