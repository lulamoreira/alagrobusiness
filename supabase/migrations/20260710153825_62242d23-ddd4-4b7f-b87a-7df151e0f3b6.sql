
DO $seed2$
DECLARE
  _cat_id uuid;
  _cat record;
  _item record;
  _ordem_cat int := 0;
  _ordem_item int;
  _inserted_cats int := 0;
  _reused_cats int := 0;
  _inserted_items int := 0;
  _reused_items int := 0;

  _cats jsonb := '[
    {"pt":"Alimentos Processados","en":"Processed Foods","es":"Alimentos Procesados","items":[
      ["Farinhas","Flours","Harinas"],["Massas","Pasta","Pastas"],["Biscoitos","Cookies","Galletas"],
      ["Conservas","Canned goods","Conservas"],["Molhos","Sauces","Salsas"],
      ["Doces e Geleias","Jams & Sweets","Dulces y Mermeladas"],["Snacks","Snacks","Snacks"],
      ["Temperos","Seasonings","Condimentos"]
    ]},
    {"pt":"Bebidas","en":"Beverages","es":"Bebidas","items":[
      ["Sucos","Juices","Jugos"],["Refrigerantes","Soft drinks","Refrescos"],["Água","Water","Agua"],
      ["Cerveja","Beer","Cerveza"],["Vinho","Wine","Vino"],["Cachaça","Cachaça","Cachaza"],
      ["Café Torrado","Roasted coffee","Café tostado"],["Energéticos","Energy drinks","Bebidas energéticas"]
    ]},
    {"pt":"Óleos e Gorduras","en":"Oils & Fats","es":"Aceites y Grasas","items":[
      ["Óleo de Soja","Soybean oil","Aceite de soja"],["Óleo de Girassol","Sunflower oil","Aceite de girasol"],
      ["Azeite","Olive oil","Aceite de oliva"],["Margarina","Margarine","Margarina"],
      ["Gordura Vegetal","Vegetable fat","Grasa vegetal"]
    ]},
    {"pt":"Laticínios Industrializados","en":"Processed Dairy","es":"Lácteos Industrializados","items":[
      ["Leite em Pó","Powdered milk","Leche en polvo"],["Leite Condensado","Condensed milk","Leche condensada"],
      ["Creme de Leite","Cream","Crema de leche"],["Manteiga Industrial","Industrial butter","Mantequilla industrial"],
      ["Queijo Processado","Processed cheese","Queso procesado"]
    ]},
    {"pt":"Carnes e Frigoríficos","en":"Meat & Processing","es":"Carnes y Frigoríficos","items":[
      ["Carne Bovina","Beef","Carne vacuna"],["Carne Suína","Pork","Carne de cerdo"],
      ["Frango Processado","Processed chicken","Pollo procesado"],["Embutidos","Sausages","Embutidos"],
      ["Peixe Processado","Processed fish","Pescado procesado"]
    ]},
    {"pt":"Produtos de Limpeza","en":"Cleaning Products","es":"Productos de Limpieza","items":[
      ["Detergentes","Detergents","Detergentes"],["Sabão","Soap","Jabón"],
      ["Desinfetantes","Disinfectants","Desinfectantes"],["Amaciantes","Fabric softeners","Suavizantes"]
    ]},
    {"pt":"Higiene e Cosméticos","en":"Hygiene & Cosmetics","es":"Higiene y Cosméticos","items":[
      ["Sabonetes","Bar soaps","Jabones"],["Shampoo","Shampoo","Champú"],
      ["Cremes","Creams","Cremas"],["Perfumes","Perfumes","Perfumes"]
    ]},
    {"pt":"Embalagens","en":"Packaging","es":"Envases y Embalajes","items":[
      ["Caixas","Boxes","Cajas"],["Sacaria","Sacks","Sacos"],["Plásticos","Plastics","Plásticos"],
      ["Vidros","Glass","Vidrios"],["Latas","Cans","Latas"],["Rótulos","Labels","Etiquetas"]
    ]},
    {"pt":"Têxteis e Vestuário","en":"Textiles & Apparel","es":"Textiles y Vestuario","items":[
      ["Tecidos","Fabrics","Telas"],["Fios","Yarn","Hilos"],["Roupas","Clothing","Ropa"],
      ["Uniformes","Uniforms","Uniformes"],["EPIs","PPE","EPP"]
    ]},
    {"pt":"Couro e Calçados","en":"Leather & Footwear","es":"Cuero y Calzado","items":[
      ["Couro","Leather","Cuero"],["Calçados","Footwear","Calzado"],
      ["Artefatos de Couro","Leather goods","Artículos de cuero"]
    ]},
    {"pt":"Papel e Celulose","en":"Paper & Pulp","es":"Papel y Celulosa","items":[
      ["Papel","Paper","Papel"],["Papelão","Cardboard","Cartón"],
      ["Celulose","Pulp","Celulosa"],["Produtos de Papel","Paper products","Productos de papel"]
    ]},
    {"pt":"Madeira e Móveis","en":"Wood & Furniture","es":"Madera y Muebles","items":[
      ["Madeira Serrada","Sawn wood","Madera aserrada"],["Móveis","Furniture","Muebles"],
      ["Painéis MDF","MDF panels","Paneles MDF"],["Pallets","Pallets","Pallets"]
    ]},
    {"pt":"Químicos e Fertilizantes Industriais","en":"Chemicals & Industrial Fertilizers","es":"Químicos y Fertilizantes","items":[
      ["Fertilizantes Industriais","Industrial fertilizers","Fertilizantes industriales"],
      ["Defensivos","Agrochemicals","Agroquímicos"],
      ["Produtos Químicos","Chemicals","Productos químicos"],["Adubos","Fertilizers","Abonos"]
    ]},
    {"pt":"Construção e Materiais","en":"Construction & Materials","es":"Construcción y Materiales","items":[
      ["Cimento","Cement","Cemento"],["Telhas","Roofing tiles","Tejas"],
      ["Estruturas Metálicas","Metal structures","Estructuras metálicas"],
      ["Madeira p/ Construção","Construction wood","Madera de construcción"],
      ["Ferramentas","Tools","Herramientas"]
    ]},
    {"pt":"Máquinas e Equipamentos Industriais","en":"Industrial Machinery","es":"Maquinaria Industrial","items":[
      ["Equipamentos Industriais","Industrial equipment","Equipos industriales"],
      ["Peças e Componentes","Parts & components","Piezas y componentes"],
      ["Motores","Motors","Motores"],["Geradores","Generators","Generadores"]
    ]},
    {"pt":"Energia e Combustíveis","en":"Energy & Fuels","es":"Energía y Combustibles","items":[
      ["Biocombustíveis","Biofuels","Biocombustibles"],
      ["Etanol Industrial","Industrial ethanol","Etanol industrial"],
      ["Biodiesel","Biodiesel","Biodiésel"],["Lenha e Biomassa","Firewood & biomass","Leña y biomasa"],
      ["Painéis Solares","Solar panels","Paneles solares"]
    ]}
  ]'::jsonb;
BEGIN
  FOR _cat IN SELECT * FROM jsonb_array_elements(_cats)
  LOOP
    _ordem_cat := _ordem_cat + 1;

    -- Reaproveita nó pai por nome->>'pt' com parent NULL
    SELECT id INTO _cat_id
      FROM public.categorias_catalogo
     WHERE parent_id IS NULL
       AND deleted_at IS NULL
       AND (nome->>'pt') = (_cat.value->>'pt')
     LIMIT 1;

    IF _cat_id IS NULL THEN
      INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo)
      VALUES (NULL,
              jsonb_build_object('pt', _cat.value->>'pt','en', _cat.value->>'en','es', _cat.value->>'es'),
              _ordem_cat, true)
      RETURNING id INTO _cat_id;
      _inserted_cats := _inserted_cats + 1;
    ELSE
      UPDATE public.categorias_catalogo
         SET ativo = true,
             nome = nome
                 || jsonb_build_object('en', COALESCE(nome->>'en', _cat.value->>'en'),
                                       'es', COALESCE(nome->>'es', _cat.value->>'es')),
             updated_at = now()
       WHERE id = _cat_id;
      _reused_cats := _reused_cats + 1;
    END IF;

    _ordem_item := 0;
    FOR _item IN SELECT * FROM jsonb_array_elements(_cat.value->'items')
    LOOP
      _ordem_item := _ordem_item + 1;
      IF EXISTS (
        SELECT 1 FROM public.categorias_catalogo
         WHERE parent_id = _cat_id
           AND deleted_at IS NULL
           AND (nome->>'pt') = (_item.value->>0)
      ) THEN
        UPDATE public.categorias_catalogo
           SET ativo = true, updated_at = now()
         WHERE parent_id = _cat_id
           AND deleted_at IS NULL
           AND (nome->>'pt') = (_item.value->>0);
        _reused_items := _reused_items + 1;
      ELSE
        INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo)
        VALUES (_cat_id,
                jsonb_build_object('pt', _item.value->>0, 'en', _item.value->>1, 'es', _item.value->>2),
                _ordem_item, true);
        _inserted_items := _inserted_items + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'LOTE2 categorias inseridas=% reaproveitadas=% | itens inseridos=% reaproveitados=%',
    _inserted_cats, _reused_cats, _inserted_items, _reused_items;
END $seed2$;
