
-- 1) Tabela de movimentações
CREATE TABLE public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  centro_id uuid NOT NULL REFERENCES public.centros_distribuicao(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  observacao text,
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX estoque_mov_anuncio_idx ON public.estoque_movimentacoes(anuncio_id);
CREATE INDEX estoque_mov_centro_idx ON public.estoque_movimentacoes(centro_id);
CREATE INDEX estoque_mov_anuncio_centro_idx ON public.estoque_movimentacoes(anuncio_id, centro_id);

GRANT SELECT, INSERT, DELETE ON public.estoque_movimentacoes TO authenticated;
GRANT ALL ON public.estoque_movimentacoes TO service_role;

ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- 2) Helper
CREATE OR REPLACE FUNCTION public.can_manage_estoque(_anuncio uuid, _centro uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR public.is_cd_operador(auth.uid(), _centro)
    OR EXISTS (SELECT 1 FROM public.anuncios a WHERE a.id = _anuncio AND a.vendedor_id = auth.uid());
$$;

-- 3) Policies
CREATE POLICY "estoque_select" ON public.estoque_movimentacoes
  FOR SELECT TO authenticated
  USING (public.can_manage_estoque(anuncio_id, centro_id));

CREATE POLICY "estoque_insert" ON public.estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_estoque(anuncio_id, centro_id)
    AND EXISTS (
      SELECT 1 FROM public.anuncio_centros ac
      WHERE ac.anuncio_id = estoque_movimentacoes.anuncio_id
        AND ac.centro_id = estoque_movimentacoes.centro_id
    )
  );

CREATE POLICY "estoque_delete" ON public.estoque_movimentacoes
  FOR DELETE TO authenticated
  USING (public.can_manage_estoque(anuncio_id, centro_id));

-- 4) Trigger guarda-saldo
CREATE OR REPLACE FUNCTION public.guard_estoque_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _saldo numeric;
BEGIN
  IF NEW.tipo = 'saida' THEN
    SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE -quantidade END), 0)
      INTO _saldo
    FROM public.estoque_movimentacoes
    WHERE anuncio_id = NEW.anuncio_id AND centro_id = NEW.centro_id;
    IF _saldo - NEW.quantidade < 0 THEN
      RAISE EXCEPTION 'saldo_insuficiente' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_estoque_saldo
BEFORE INSERT ON public.estoque_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.guard_estoque_saldo();

-- 5) View de saldos
CREATE VIEW public.estoque_saldos WITH (security_invoker = on) AS
SELECT anuncio_id, centro_id,
       SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE -quantidade END) AS saldo
  FROM public.estoque_movimentacoes
 GROUP BY anuncio_id, centro_id;

GRANT SELECT ON public.estoque_saldos TO authenticated;
