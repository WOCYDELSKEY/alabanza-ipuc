-- Seguridad inicial para Alabanza IPUC Líbano Central
-- IMPORTANTE: crear primero el usuario inicial en Supabase Auth.
-- Después ejecutar este script y luego supabase_primer_administrador.sql.
-- Revise la aplicación después de instalar; no publique hasta probar login y confirmaciones.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.activo = true
  );
$$;
REVOKE ALL ON FUNCTION public.es_administrador() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_administrador() TO authenticated;

-- Elimina las políticas abiertas de desarrollo de las diez tablas objetivo.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'integrantes','roles_integrantes','reglas_asignacion',
        'disponibilidad_integrantes','excepciones_disponibilidad',
        'servicios','asignaciones','confirmaciones','reemplazos','mensajes'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Solo usuarios autenticados que figuren como administradores podrán operar las tablas.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'integrantes','roles_integrantes','reglas_asignacion',
    'disponibilidad_integrantes','excepciones_disponibilidad',
    'servicios','asignaciones','confirmaciones','reemplazos','mensajes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY admin_manage_all ON public.%I FOR ALL TO authenticated USING (public.es_administrador()) WITH CHECK (public.es_administrador())', t);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO authenticated;
DROP POLICY IF EXISTS admin_users_admin_all ON public.admin_users;
CREATE POLICY admin_users_admin_all ON public.admin_users
  FOR ALL TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- Las secuencias no dan acceso a las tablas; se habilita uso solo al rol autenticado.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- RPC pública limitada: devuelve solo los datos necesarios para una asignación con token válido.
CREATE OR REPLACE FUNCTION public.obtener_confirmacion_por_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 200 THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'id', a.id,
    'servicio_id', a.servicio_id,
    'integrante_id', a.integrante_id,
    'rol', a.rol,
    'estado', a.estado,
    'integrantes', jsonb_build_object('id', i.id, 'nombre', i.nombre),
    'servicios', jsonb_build_object('id', s.id, 'fecha', s.fecha, 'hora', s.hora, 'tipo', s.tipo)
  )
  INTO v_result
  FROM public.asignaciones a
  JOIN public.integrantes i ON i.id = a.integrante_id
  JOIN public.servicios s ON s.id = a.servicio_id
  WHERE a.token_confirmacion::text = p_token
  LIMIT 1;
  RETURN v_result;
END;
$$;

-- RPC pública limitada: solo permite responder a la asignación asociada al token.
CREATE OR REPLACE FUNCTION public.responder_confirmacion_por_token(p_token text, p_estado text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_asignacion_id public.asignaciones.id%TYPE;
  v_estado_actual text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Token inválido.');
  END IF;
  IF p_estado NOT IN ('Confirmado', 'No puede') THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Estado de respuesta no permitido.');
  END IF;

  SELECT a.id, a.estado
  INTO v_asignacion_id, v_estado_actual
  FROM public.asignaciones a
  WHERE a.token_confirmacion::text = p_token
  LIMIT 1
  FOR UPDATE;

  IF v_asignacion_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'No se encontró la asignación.');
  END IF;
  IF v_estado_actual = 'Reemplazado' THEN
    RETURN jsonb_build_object('ok', false, 'mensaje', 'Esta asignación ya fue reemplazada.');
  END IF;

  UPDATE public.asignaciones SET estado = p_estado WHERE id = v_asignacion_id;
  INSERT INTO public.confirmaciones (asignacion_id, estado, fecha_respuesta)
  VALUES (v_asignacion_id, p_estado, now())
  ON CONFLICT (asignacion_id) DO UPDATE
    SET estado = EXCLUDED.estado,
        fecha_respuesta = EXCLUDED.fecha_respuesta;

  RETURN jsonb_build_object('ok', true, 'estado', p_estado);
END;
$$;
REVOKE ALL ON FUNCTION public.obtener_confirmacion_por_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.responder_confirmacion_por_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_confirmacion_por_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.responder_confirmacion_por_token(text, text) TO anon, authenticated;

-- Recomendado: impedir privilegios automáticos a anon en tablas creadas posteriormente.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
