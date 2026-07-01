
CREATE TABLE public.certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  codigo text NOT NULL UNIQUE,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX certificados_usuario_curso_unique
  ON public.certificados (usuario_id, curso_id)
  WHERE deleted_at IS NULL;

CREATE INDEX certificados_usuario_idx ON public.certificados (usuario_id) WHERE deleted_at IS NULL;

GRANT SELECT ON public.certificados TO authenticated;
GRANT ALL ON public.certificados TO service_role;

ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY certificados_select_own_or_admin ON public.certificados
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (usuario_id = auth.uid() OR public.is_admin(auth.uid())));

CREATE POLICY certificados_admin_insert ON public.certificados
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY certificados_admin_update ON public.certificados
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY certificados_admin_delete ON public.certificados
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER certificados_set_updated_at
  BEFORE UPDATE ON public.certificados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.emitir_certificado_se_completo(p_curso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _total int;
  _done int;
  _existente record;
  _codigo text;
  _emitido_em timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cursos
    WHERE id = p_curso_id AND publicado = true AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'curso_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT id, codigo, emitido_em
    INTO _existente
  FROM public.certificados
  WHERE usuario_id = _uid AND curso_id = p_curso_id AND deleted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'emitido', true,
      'codigo', _existente.codigo,
      'emitido_em', _existente.emitido_em,
      'ja_existia', true
    );
  END IF;

  SELECT count(a.id) INTO _total
  FROM public.aulas a
  JOIN public.modulos m ON m.id = a.modulo_id
  WHERE m.curso_id = p_curso_id
    AND a.deleted_at IS NULL
    AND m.deleted_at IS NULL;

  IF _total = 0 THEN
    RETURN jsonb_build_object('emitido', false, 'motivo', 'sem_aulas');
  END IF;

  SELECT count(p.id) INTO _done
  FROM public.progresso_aulas p
  JOIN public.aulas a ON a.id = p.aula_id
  JOIN public.modulos m ON m.id = a.modulo_id
  WHERE m.curso_id = p_curso_id
    AND p.usuario_id = _uid
    AND p.concluida = true
    AND p.deleted_at IS NULL
    AND a.deleted_at IS NULL
    AND m.deleted_at IS NULL;

  IF _done < _total THEN
    RETURN jsonb_build_object('emitido', false, 'motivo', 'incompleto', 'total', _total, 'concluidas', _done);
  END IF;

  -- Gera código único curto
  LOOP
    _codigo := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.certificados WHERE codigo = _codigo);
  END LOOP;

  _emitido_em := now();

  INSERT INTO public.certificados (usuario_id, curso_id, codigo, emitido_em)
  VALUES (_uid, p_curso_id, _codigo, _emitido_em);

  RETURN jsonb_build_object(
    'emitido', true,
    'codigo', _codigo,
    'emitido_em', _emitido_em,
    'ja_existia', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.emitir_certificado_se_completo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emitir_certificado_se_completo(uuid) TO authenticated;
