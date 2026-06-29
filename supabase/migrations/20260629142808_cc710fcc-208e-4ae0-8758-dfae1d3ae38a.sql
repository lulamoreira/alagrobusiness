-- Limpa qualquer alerta de teste prévio destes 3 usuários
DELETE FROM public.alertas_preco
 WHERE usuario_id IN (
   '4147b874-890e-462b-b476-ef55826d94c6',
   '85a9b0b3-9b76-41ce-8602-5c57422d303f',
   '8b56b70e-0ec1-495e-ac6b-d7e744a4a26c'
 );
DELETE FROM public.notificacoes
 WHERE tipo='preco' AND usuario_id IN (
   '4147b874-890e-462b-b476-ef55826d94c6',
   '85a9b0b3-9b76-41ce-8602-5c57422d303f',
   '8b56b70e-0ec1-495e-ac6b-d7e744a4a26c'
 );

INSERT INTO public.alertas_preco (id, usuario_id, tipo_alerta, referencia, condicao, valor_alvo, moeda)
VALUES
 ('00000000-0000-0000-0000-000000000a01','4147b874-890e-462b-b476-ef55826d94c6','commodity','soja','acima',100,'BRL'),
 ('00000000-0000-0000-0000-000000000a02','4147b874-890e-462b-b476-ef55826d94c6','commodity','soja','acima',999,'BRL'),
 ('00000000-0000-0000-0000-000000000a03','85a9b0b3-9b76-41ce-8602-5c57422d303f','commodity','boi_gordo','acima',0.01,'BRL');

SELECT id, usuario_id, referencia, condicao, valor_alvo, ativo, disparado FROM public.alertas_preco ORDER BY id;