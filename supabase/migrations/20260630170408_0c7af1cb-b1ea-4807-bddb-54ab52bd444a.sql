
-- 1. commodities_catalogo
CREATE TABLE public.commodities_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome jsonb NOT NULL DEFAULT '{}'::jsonb,
  unidade_padrao_id uuid NOT NULL REFERENCES public.unidades(id),
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT ON public.commodities_catalogo TO authenticated;
GRANT ALL ON public.commodities_catalogo TO service_role;

ALTER TABLE public.commodities_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_select_ativos" ON public.commodities_catalogo
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (ativo = true OR public.is_admin(auth.uid())));

CREATE POLICY "catalogo_admin_insert" ON public.commodities_catalogo
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "catalogo_admin_update" ON public.commodities_catalogo
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "catalogo_admin_delete" ON public.commodities_catalogo
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_commodities_catalogo
  BEFORE UPDATE ON public.commodities_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_commodities_catalogo_codigo ON public.commodities_catalogo(codigo) WHERE deleted_at IS NULL;

-- Seed catalog
INSERT INTO public.commodities_catalogo (codigo, nome, unidade_padrao_id, ordem)
SELECT s.codigo, s.nome::jsonb, u.id, s.ordem
FROM (VALUES
  ('soja',         '{"pt-BR":"Soja","en":"Soybean","es":"Soja"}',                       'saca_60', 1),
  ('milho',        '{"pt-BR":"Milho","en":"Corn","es":"Maíz"}',                         'saca_60', 2),
  ('cafe_arabica', '{"pt-BR":"Café arábica","en":"Arabica coffee","es":"Café arábica"}','saca_60', 3),
  ('cafe_conilon', '{"pt-BR":"Café conilon","en":"Conilon coffee","es":"Café conilon"}','saca_60', 4),
  ('trigo',        '{"pt-BR":"Trigo","en":"Wheat","es":"Trigo"}',                       'saca_60', 5),
  ('feijao',       '{"pt-BR":"Feijão","en":"Beans","es":"Frijol"}',                     'saca_60', 6),
  ('arroz',        '{"pt-BR":"Arroz","en":"Rice","es":"Arroz"}',                        'saca_50', 7),
  ('boi_gordo',    '{"pt-BR":"Boi gordo","en":"Live cattle","es":"Ganado gordo"}',      'arroba',  8),
  ('algodao',      '{"pt-BR":"Algodão","en":"Cotton","es":"Algodón"}',                  'arroba',  9),
  ('suino',        '{"pt-BR":"Suíno","en":"Swine","es":"Porcino"}',                     'kg',      10)
) AS s(codigo, nome, unid, ordem)
JOIN public.unidades u ON u.nome_chave = s.unid;

-- 2. preferencias new columns
ALTER TABLE public.preferencias
  ADD COLUMN IF NOT EXISTS cotacoes_selecionadas text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tipos_dolar_visiveis text[] NOT NULL DEFAULT '{}'::text[];
