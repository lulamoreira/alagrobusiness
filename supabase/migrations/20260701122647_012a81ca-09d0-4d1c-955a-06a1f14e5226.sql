
-- Enum origem_assinatura
DO $$ BEGIN
  CREATE TYPE public.origem_assinatura AS ENUM ('trial','stripe','admin_cortesia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS origem public.origem_assinatura;

-- Backfill: existing trials
UPDATE public.assinaturas
   SET origem = 'trial'
 WHERE origem IS NULL AND status = 'trial';

UPDATE public.assinaturas
   SET origem = COALESCE(origem,
     CASE WHEN stripe_subscription_id IS NOT NULL THEN 'stripe'::public.origem_assinatura
          ELSE 'trial'::public.origem_assinatura END)
 WHERE origem IS NULL;

ALTER TABLE public.assinaturas
  ALTER COLUMN origem SET DEFAULT 'trial'::public.origem_assinatura,
  ALTER COLUMN origem SET NOT NULL;

-- Grant plan (admin only)
CREATE OR REPLACE FUNCTION public.admin_grant_plan(
  p_usuario uuid,
  p_plano_codigo text DEFAULT 'pro',
  p_dias int DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plano_id uuid;
  _fim timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO _plano_id
    FROM public.planos
   WHERE codigo = p_plano_codigo AND deleted_at IS NULL AND ativo = true;
  IF _plano_id IS NULL THEN
    RAISE EXCEPTION 'plano_invalido' USING ERRCODE = '22023';
  END IF;

  _fim := CASE WHEN p_dias IS NULL THEN NULL
               ELSE now() + (p_dias || ' days')::interval END;

  -- Upsert respeitando índice único parcial (usuario_id) WHERE deleted_at IS NULL
  IF EXISTS (SELECT 1 FROM public.assinaturas
              WHERE usuario_id = p_usuario AND deleted_at IS NULL) THEN
    UPDATE public.assinaturas
       SET plano_id = _plano_id,
           status = 'ativa',
           inicio = now(),
           fim = _fim,
           trial_ate = NULL,
           origem = 'admin_cortesia',
           stripe_customer_id = NULL,
           stripe_subscription_id = NULL,
           updated_at = now()
     WHERE usuario_id = p_usuario AND deleted_at IS NULL;
  ELSE
    INSERT INTO public.assinaturas
      (usuario_id, plano_id, status, inicio, fim, origem)
    VALUES
      (p_usuario, _plano_id, 'ativa', now(), _fim, 'admin_cortesia');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_plan(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_plan(uuid, text, int) TO authenticated;

-- Revoke plan (admin only)
CREATE OR REPLACE FUNCTION public.admin_revoke_plan(p_usuario uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.assinaturas
     SET status = 'cancelada',
         fim = now(),
         updated_at = now()
   WHERE usuario_id = p_usuario AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_plan(uuid) TO authenticated;

-- Helper para admin buscar usuários (só admin)
CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  email text,
  tipo_perfil text,
  plano_codigo text,
  status text,
  origem text,
  fim timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nome_completo, p.email, p.tipo_perfil::text,
         pl.codigo, a.status::text, a.origem::text, a.fim
    FROM public.profiles p
    LEFT JOIN public.assinaturas a ON a.usuario_id = p.id AND a.deleted_at IS NULL
    LEFT JOIN public.planos pl ON pl.id = a.plano_id
   WHERE p.deleted_at IS NULL
     AND (p_query IS NULL OR p_query = ''
          OR p.email ILIKE '%'||p_query||'%'
          OR p.nome_completo ILIKE '%'||p_query||'%')
   ORDER BY p.nome_completo NULLS LAST
   LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text) TO authenticated;

-- Listar cortesias ativas
CREATE OR REPLACE FUNCTION public.admin_list_cortesias()
RETURNS TABLE(
  usuario_id uuid,
  nome_completo text,
  email text,
  plano_codigo text,
  fim timestamptz,
  inicio timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.usuario_id, p.nome_completo, p.email, pl.codigo, a.fim, a.inicio
    FROM public.assinaturas a
    JOIN public.profiles p ON p.id = a.usuario_id
    JOIN public.planos pl ON pl.id = a.plano_id
   WHERE a.deleted_at IS NULL
     AND a.origem = 'admin_cortesia'
     AND a.status = 'ativa'
     AND (a.fim IS NULL OR a.fim > now())
   ORDER BY a.inicio DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cortesias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_cortesias() TO authenticated;
