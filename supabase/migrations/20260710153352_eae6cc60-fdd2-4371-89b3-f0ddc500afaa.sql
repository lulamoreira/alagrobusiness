
DO $seed$
DECLARE
  _root uuid;
  _cat_id uuid;
  _next_ordem int;
  _cat record;
  _item record;
  _pt text; _en text; _es text;
  _alias text;
  _created_cat int := 0;
  _reused_cat int := 0;
  _created_item int := 0;
  _reused_item int := 0;
  _cats jsonb := $j$[
    {"pt":"Grãos e Cereais","en":"Grains & Cereals","es":"Granos y Cereales","alias":"Grãos","items":[
      ["Soja","Soybean","Soja"],["Milho","Corn","Maíz"],["Arroz","Rice","Arroz"],["Trigo","Wheat","Trigo"],
      ["Feijão","Beans","Frijol"],["Sorgo","Sorghum","Sorgo"],["Aveia","Oats","Avena"],["Cevada","Barley","Cebada"],
      ["Centeio","Rye","Centeno"],["Milheto","Millet","Mijo"]]},
    {"pt":"Oleaginosas","en":"Oilseeds","es":"Oleaginosas","items":[
      ["Girassol","Sunflower","Girasol"],["Amendoim","Peanut","Maní"],["Canola","Canola","Canola"],
      ["Gergelim","Sesame","Sésamo"],["Mamona","Castor bean","Ricino"]]},
    {"pt":"Café, Cacau e Chá","en":"Coffee, Cocoa & Tea","es":"Café, Cacao y Té","items":[
      ["Café Arábica","Arabica coffee","Café Arábica"],["Café Conilon/Robusta","Robusta coffee","Café Robusta"],
      ["Cacau","Cocoa","Cacao"],["Chá","Tea","Té"],["Erva-mate","Yerba mate","Yerba mate"]]},
    {"pt":"Frutas","en":"Fruits","es":"Frutas","items":[
      ["Laranja","Orange","Naranja"],["Limão","Lemon","Limón"],["Tangerina","Tangerine","Mandarina"],
      ["Banana","Banana","Banana"],["Manga","Mango","Mango"],["Abacaxi","Pineapple","Piña"],
      ["Mamão","Papaya","Papaya"],["Maracujá","Passion fruit","Maracuyá"],["Uva","Grape","Uva"],
      ["Maçã","Apple","Manzana"],["Morango","Strawberry","Fresa"],["Melancia","Watermelon","Sandía"],
      ["Melão","Melon","Melón"],["Coco","Coconut","Coco"],["Açaí","Açaí","Açaí"]]},
    {"pt":"Hortaliças e Legumes","en":"Vegetables","es":"Hortalizas y Verduras","items":[
      ["Alface","Lettuce","Lechuga"],["Couve","Kale","Col rizada"],["Tomate","Tomato","Tomate"],
      ["Pimentão","Bell pepper","Pimiento"],["Pepino","Cucumber","Pepino"],["Abobrinha","Zucchini","Calabacín"],
      ["Berinjela","Eggplant","Berenjena"],["Cebola","Onion","Cebolla"],["Alho","Garlic","Ajo"],
      ["Cenoura","Carrot","Zanahoria"],["Beterraba","Beet","Remolacha"],["Repolho","Cabbage","Repollo"],
      ["Brócolis","Broccoli","Brócoli"],["Couve-flor","Cauliflower","Coliflor"]]},
    {"pt":"Raízes e Tubérculos","en":"Roots & Tubers","es":"Raíces y Tubérculos","items":[
      ["Mandioca","Cassava","Yuca"],["Batata","Potato","Papa"],["Batata-doce","Sweet potato","Boniato"],
      ["Inhame","Yam","Ñame"],["Cará","Taro","Taro"]]},
    {"pt":"Cana e Açúcar","en":"Sugarcane & Sugar","es":"Caña y Azúcar","items":[
      ["Cana-de-açúcar","Sugarcane","Caña de azúcar"],["Açúcar","Sugar","Azúcar"],["Etanol","Ethanol","Etanol"],
      ["Melaço","Molasses","Melaza"],["Rapadura","Panela","Panela"]]},
    {"pt":"Pecuária (Bovinos e outros)","en":"Livestock","es":"Ganadería","items":[
      ["Boi gordo","Fat cattle","Novillo gordo"],["Bezerro","Calf","Ternero"],["Vaca","Cow","Vaca"],
      ["Novilha","Heifer","Vaquillona"],["Suíno","Swine","Cerdo"],["Ovino","Sheep","Ovino"],
      ["Caprino","Goat","Caprino"],["Búfalo","Buffalo","Búfalo"],["Equino","Horse","Equino"]]},
    {"pt":"Aves","en":"Poultry","es":"Aves","items":[
      ["Frango","Chicken","Pollo"],["Galinha","Hen","Gallina"],["Peru","Turkey","Pavo"],
      ["Pato","Duck","Pato"],["Codorna","Quail","Codorniz"],["Ovos","Eggs","Huevos"]]},
    {"pt":"Aquicultura e Pesca","en":"Aquaculture & Fishing","es":"Acuicultura y Pesca","items":[
      ["Tilápia","Tilapia","Tilapia"],["Tambaqui","Tambaqui","Tambaquí"],["Camarão","Shrimp","Camarón"],
      ["Peixe","Fish","Pescado"],["Ostra","Oyster","Ostra"]]},
    {"pt":"Leite e Derivados","en":"Dairy","es":"Lácteos","items":[
      ["Leite","Milk","Leche"],["Queijo","Cheese","Queso"],["Manteiga","Butter","Mantequilla"],
      ["Iogurte","Yogurt","Yogur"],["Requeijão","Cream cheese","Requesón"]]},
    {"pt":"Apicultura","en":"Beekeeping","es":"Apicultura","items":[
      ["Mel","Honey","Miel"],["Própolis","Propolis","Própolis"],["Cera","Beeswax","Cera"],["Pólen","Pollen","Polen"]]},
    {"pt":"Flores e Plantas Ornamentais","en":"Flowers & Ornamental Plants","es":"Flores y Plantas","items":[
      ["Flores de corte","Cut flowers","Flores de corte"],["Mudas","Seedlings","Plántulas"],
      ["Plantas ornamentais","Ornamental plants","Plantas ornamentales"]]},
    {"pt":"Fibras e Florestal","en":"Fibers & Forestry","es":"Fibras y Forestal","items":[
      ["Algodão","Cotton","Algodón"],["Sisal","Sisal","Sisal"],["Eucalipto","Eucalyptus","Eucalipto"],
      ["Madeira","Wood","Madera"],["Celulose","Pulp","Celulosa"]]},
    {"pt":"Insumos Agrícolas","en":"Farm Inputs","es":"Insumos Agrícolas","items":[
      ["Fertilizantes","Fertilizers","Fertilizantes"],["Defensivos","Pesticides","Agroquímicos"],
      ["Sementes","Seeds","Semillas"],["Corretivos (calcário)","Soil amendments","Correctivos"],
      ["Substratos","Substrates","Sustratos"]]},
    {"pt":"Nutrição Animal","en":"Animal Nutrition","es":"Nutrición Animal","items":[
      ["Ração","Animal feed","Alimento balanceado"],["Sal mineral","Mineral salt","Sal mineral"],
      ["Silagem","Silage","Ensilaje"],["Feno","Hay","Heno"],["Suplementos","Supplements","Suplementos"]]},
    {"pt":"Máquinas e Implementos","en":"Machinery & Equipment","es":"Maquinaria e Implementos","items":[
      ["Trator","Tractor","Tractor"],["Colheitadeira","Harvester","Cosechadora"],
      ["Plantadeira","Planter","Sembradora"],["Pulverizador","Sprayer","Pulverizador"],
      ["Implementos","Implements","Implementos"],["Irrigação","Irrigation","Riego"]]}
  ]$j$::jsonb;
BEGIN
  FOR _cat IN SELECT * FROM jsonb_array_elements(_cats) WITH ORDINALITY AS t(obj, idx)
  LOOP
    _pt := _cat.obj->>'pt';
    _en := _cat.obj->>'en';
    _es := _cat.obj->>'es';
    _alias := _cat.obj->>'alias';

    -- Try match by target pt, then by alias
    SELECT id INTO _cat_id
      FROM public.categorias_catalogo
     WHERE parent_id IS NULL AND deleted_at IS NULL
       AND (nome->>'pt') = _pt
     LIMIT 1;

    IF _cat_id IS NULL AND _alias IS NOT NULL THEN
      SELECT id INTO _cat_id
        FROM public.categorias_catalogo
       WHERE parent_id IS NULL AND deleted_at IS NULL
         AND (nome->>'pt') = _alias
       LIMIT 1;
    END IF;

    IF _cat_id IS NOT NULL THEN
      UPDATE public.categorias_catalogo
         SET nome = jsonb_build_object('pt', _pt, 'en', _en, 'es', _es),
             ativo = true, updated_at = now()
       WHERE id = _cat_id;
      _reused_cat := _reused_cat + 1;
    ELSE
      SELECT COALESCE(MAX(ordem), 0) + 1 INTO _next_ordem
        FROM public.categorias_catalogo WHERE parent_id IS NULL AND deleted_at IS NULL;
      INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo)
      VALUES (NULL, jsonb_build_object('pt', _pt, 'en', _en, 'es', _es), _next_ordem, true)
      RETURNING id INTO _cat_id;
      _created_cat := _created_cat + 1;
    END IF;

    -- Items
    FOR _item IN SELECT * FROM jsonb_array_elements(_cat.obj->'items') AS x(arr)
    LOOP
      DECLARE
        _ipt text := _item.arr->>0;
        _ien text := _item.arr->>1;
        _ies text := _item.arr->>2;
        _item_id uuid;
      BEGIN
        SELECT id INTO _item_id
          FROM public.categorias_catalogo
         WHERE parent_id = _cat_id AND deleted_at IS NULL
           AND (nome->>'pt') = _ipt
         LIMIT 1;

        IF _item_id IS NOT NULL THEN
          UPDATE public.categorias_catalogo
             SET nome = jsonb_build_object('pt', _ipt, 'en', _ien, 'es', _ies),
                 ativo = true, updated_at = now()
           WHERE id = _item_id;
          _reused_item := _reused_item + 1;
        ELSE
          SELECT COALESCE(MAX(ordem), 0) + 1 INTO _next_ordem
            FROM public.categorias_catalogo WHERE parent_id = _cat_id AND deleted_at IS NULL;
          INSERT INTO public.categorias_catalogo (parent_id, nome, ordem, ativo)
          VALUES (_cat_id, jsonb_build_object('pt', _ipt, 'en', _ien, 'es', _ies), _next_ordem, true);
          _created_item := _created_item + 1;
        END IF;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'SEED CATALOGO: categorias criadas=%, reaproveitadas=%, itens criados=%, reaproveitados=%',
    _created_cat, _reused_cat, _created_item, _reused_item;
END
$seed$;
