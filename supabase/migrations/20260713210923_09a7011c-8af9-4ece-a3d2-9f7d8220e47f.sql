
-- 1) Columns + backfill
ALTER TABLE public.centros_distribuicao
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;

UPDATE public.centros_distribuicao SET aprovado = true WHERE created_by IS NULL AND aprovado = false;

-- 2) Insert policy: admin or self (pending only)
DROP POLICY IF EXISTS cds_insert_admin ON public.centros_distribuicao;
DROP POLICY IF EXISTS cds_insert_self_or_admin ON public.centros_distribuicao;
CREATE POLICY cds_insert_self_or_admin ON public.centros_distribuicao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (created_by = auth.uid() AND aprovado = false)
  );

-- 3) Guard: only admin toggles 'aprovado'
CREATE OR REPLACE FUNCTION public.guard_cd_aprovacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.aprovado IS DISTINCT FROM OLD.aprovado AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'apenas admin aprova CD' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_cd_aprovacao ON public.centros_distribuicao;
CREATE TRIGGER trg_guard_cd_aprovacao BEFORE UPDATE ON public.centros_distribuicao
  FOR EACH ROW EXECUTE FUNCTION public.guard_cd_aprovacao();

-- 4) Auto operator on insert
CREATE OR REPLACE FUNCTION public.cd_auto_operador() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.cd_operadores (centro_id, usuario_id)
    VALUES (NEW.id, NEW.created_by) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cd_auto_operador ON public.centros_distribuicao;
CREATE TRIGGER trg_cd_auto_operador AFTER INSERT ON public.centros_distribuicao
  FOR EACH ROW EXECUTE FUNCTION public.cd_auto_operador();

-- 5) habilita_cd flag on catalog
ALTER TABLE public.categorias_catalogo ADD COLUMN IF NOT EXISTS habilita_cd boolean NOT NULL DEFAULT false;
UPDATE public.categorias_catalogo SET habilita_cd = true
  WHERE nome->>'pt' IN ('Transporte e Logística','Armazenagem e Beneficiamento');
