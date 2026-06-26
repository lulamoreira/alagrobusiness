
-- usa service role; ignora RLS
INSERT INTO public.cotacoes_commodities (produto, valor, moeda, unidade_id, data, fonte)
VALUES
  ('soja',          155.30, 'BRL', 'cb7beae7-e781-4039-8c69-0517db48fa61', current_date,           'manual'),
  ('milho',         70.40,  'BRL', 'cb7beae7-e781-4039-8c69-0517db48fa61', current_date,           'manual'),
  ('cafe_arabica',  1820.00,'BRL', 'cb7beae7-e781-4039-8c69-0517db48fa61', current_date,           'manual'),
  ('boi_gordo',     310.50, 'BRL', '0e9772e9-120e-4ba2-8c11-5ddade374054', current_date,           'manual'),
  ('soja',          152.10, 'BRL', 'cb7beae7-e781-4039-8c69-0517db48fa61', current_date - 1,       'manual')
ON CONFLICT (produto, data) WHERE deleted_at IS NULL DO UPDATE
  SET valor = EXCLUDED.valor, fonte = 'manual', updated_at = now();
