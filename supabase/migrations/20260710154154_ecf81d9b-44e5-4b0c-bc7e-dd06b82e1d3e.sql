
DO $seed3$
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
    {"pt":"Consultoria e Assistência Técnica","en":"Consulting & Technical Assistance","es":"Consultoría y Asistencia Técnica","items":[
      ["Consultoria Agronômica","Agronomic consulting","Consultoría agronómica"],
      ["Assistência Veterinária","Veterinary assistance","Asistencia veterinaria"],
      ["Análise de Solo","Soil analysis","Análisis de suelo"],
      ["Planejamento de Safra","Crop planning","Planificación de cosecha"],
      ["Consultoria Zootécnica","Animal science consulting","Consultoría zootécnica"]
    ]},
    {"pt":"Transporte e Logística","en":"Transport & Logistics","es":"Transporte y Logística","items":[
      ["Frete de Grãos","Grain freight","Flete de granos"],
      ["Transporte de Animais","Livestock transport","Transporte de animales"],
      ["Transporte Refrigerado","Refrigerated transport","Transporte refrigerado"],
      ["Logística e Distribuição","Logistics & distribution","Logística y distribución"]
    ]},
    {"pt":"Armazenagem e Beneficiamento","en":"Storage & Processing","es":"Almacenamiento y Beneficio","items":[
      ["Armazém/Silo","Warehouse/Silo","Almacén/Silo"],
      ["Secagem de Grãos","Grain drying","Secado de granos"],
      ["Câmara Fria","Cold storage","Cámara fría"],
      ["Beneficiamento","Processing","Beneficio"]
    ]},
    {"pt":"Mecanização e Operações","en":"Mechanization & Field Operations","es":"Mecanización y Operaciones","items":[
      ["Colheita Terceirizada","Contract harvesting","Cosecha tercerizada"],
      ["Plantio","Planting service","Siembra"],
      ["Pulverização","Spraying","Pulverización"],
      ["Preparo de Solo","Soil prep","Preparación de suelo"],
      ["Locação de Máquinas","Machinery rental","Alquiler de maquinaria"]
    ]},
    {"pt":"Serviços Aéreos e Drones","en":"Aerial & Drone Services","es":"Servicios Aéreos y Drones","items":[
      ["Pulverização com Drone","Drone spraying","Pulverización con dron"],
      ["Mapeamento Aéreo","Aerial mapping","Mapeo aéreo"],
      ["Monitoramento por Drone","Drone monitoring","Monitoreo con dron"]
    ]},
    {"pt":"Serviços Veterinários","en":"Veterinary Services","es":"Servicios Veterinarios","items":[
      ["Atendimento Veterinário","Veterinary care","Atención veterinaria"],
      ["Inseminação Artificial","Artificial insemination","Inseminación artificial"],
      ["Vacinação","Vaccination","Vacunación"],
      ["Manejo Sanitário","Herd health","Manejo sanitario"]
    ]},
    {"pt":"Crédito, Seguro e Finanças","en":"Credit, Insurance & Finance","es":"Crédito, Seguro y Finanzas","items":[
      ["Crédito Rural","Rural credit","Crédito rural"],
      ["Seguro Agrícola","Crop insurance","Seguro agrícola"],
      ["Consultoria Financeira","Financial consulting","Consultoría financiera"],
      ["Contabilidade Rural","Rural accounting","Contabilidad rural"]
    ]},
    {"pt":"Certificação e Análises","en":"Certification & Lab Analysis","es":"Certificación y Análisis","items":[
      ["Certificação Orgânica","Organic certification","Certificación orgánica"],
      ["Análise Laboratorial","Lab analysis","Análisis de laboratorio"],
      ["Certificação de Qualidade","Quality certification","Certificación de calidad"],
      ["Rastreabilidade","Traceability","Trazabilidad"]
    ]},
    {"pt":"Tecnologia e Software","en":"Technology & Software","es":"Tecnología y Software","items":[
      ["Software de Gestão","Farm management software","Software de gestión"],
      ["Agricultura de Precisão","Precision agriculture","Agricultura de precisión"],
      ["Sensores e IoT","Sensors & IoT","Sensores e IoT"],
      ["Monitoramento por Satélite","Satellite monitoring","Monitoreo satelital"]
    ]},
    {"pt":"Marketing e Vendas","en":"Marketing & Sales","es":"Marketing y Ventas","items":[
      ["Corretagem","Brokerage","Corretaje"],
      ["Marketing Digital","Digital marketing","Marketing digital"],
      ["Intermediação Comercial","Trade intermediation","Intermediación comercial"],
      ["Feiras e Eventos","Trade fairs & events","Ferias y eventos"]
    ]},
    {"pt":"Irrigação e Recursos Hídricos","en":"Irrigation & Water","es":"Riego y Recursos Hídricos","items":[
      ["Projeto de Irrigação","Irrigation design","Proyecto de riego"],
      ["Perfuração de Poços","Well drilling","Perforación de pozos"],
      ["Manutenção de Irrigação","Irrigation maintenance","Mantenimiento de riego"]
    ]},
    {"pt":"Manutenção e Reparos","en":"Maintenance & Repairs","es":"Mantenimiento y Reparaciones","items":[
      ["Manutenção de Máquinas","Machinery maintenance","Mantenimiento de maquinaria"],
      ["Elétrica Rural","Rural electrical","Electricidad rural"],
      ["Solda e Serralheria","Welding & metalwork","Soldadura y herrería"]
    ]},
    {"pt":"Serviços Ambientais","en":"Environmental Services","es":"Servicios Ambientales","items":[
      ["Licenciamento Ambiental","Environmental licensing","Licenciamiento ambiental"],
      ["Recuperação de Áreas","Land restoration","Recuperación de áreas"],
      ["Gestão de Resíduos","Waste management","Gestión de residuos"],
      ["Georreferenciamento (CAR)","Georeferencing","Georreferenciación"]
    ]},
    {"pt":"Mão de Obra e Treinamento","en":"Labor & Training","es":"Mano de Obra y Capacitación","items":[
      ["Mão de Obra Rural","Farm labor","Mano de obra rural"],
      ["Treinamento e Capacitação","Training","Capacitación"],
      ["Gestão de Pessoas","HR services","Gestión de personas"]
    ]},
    {"pt":"Construção Rural","en":"Rural Construction","es":"Construcción Rural","items":[
      ["Construção de Galpões","Shed construction","Construcción de galpones"],
      ["Cercas e Currais","Fencing & corrals","Cercas y corrales"],
      ["Instalações","Facilities","Instalaciones"]
    ]}
  ]'::jsonb;
BEGIN
  FOR _cat IN SELECT * FROM jsonb_array_elements(_cats)
  LOOP
    _ordem_cat := _ordem_cat + 1;

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

  RAISE NOTICE 'LOTE3 categorias inseridas=% reaproveitadas=% | itens inseridos=% reaproveitados=%',
    _inserted_cats, _reused_cats, _inserted_items, _reused_items;
END $seed3$;
