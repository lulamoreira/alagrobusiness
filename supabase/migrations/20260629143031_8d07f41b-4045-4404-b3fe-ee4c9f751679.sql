BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"85a9b0b3-9b76-41ce-8602-5c57422d303f","role":"authenticated"}';
SELECT id, usuario_id, referencia FROM public.alertas_preco ORDER BY id;
ROLLBACK;