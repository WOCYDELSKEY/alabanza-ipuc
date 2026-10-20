-- Historial de actividad para Alabanza IPUC Líbano Central
-- Ejecutar una sola vez en Supabase > SQL Editor como administrador.
-- El registro comienza desde la instalación; no inventa ni reconstruye eventos anteriores.

CREATE TABLE IF NOT EXISTS public.historial_actividad (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creado_en timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid,
  accion text NOT NULL,
  entidad text NOT NULL,
  tabla_origen text NOT NULL,
  registro_id text,
  detalle text NOT NULL
);

ALTER TABLE public.historial_actividad ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.historial_actividad FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.historial_actividad TO authenticated;
DROP POLICY IF EXISTS historial_actividad_admin_select ON public.historial_actividad;
CREATE POLICY historial_actividad_admin_select
  ON public.historial_actividad
  FOR SELECT TO authenticated
  USING (public.es_administrador());

CREATE OR REPLACE FUNCTION public.registrar_historial_actividad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fila jsonb;
  v_id text;
  v_etiqueta text;
  v_entidad text;
  v_accion text;
  v_detalle text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_fila := to_jsonb(OLD);
    v_accion := 'Eliminación';
  ELSIF TG_OP = 'INSERT' THEN
    v_fila := to_jsonb(NEW);
    v_accion := 'Creación';
  ELSE
    v_fila := to_jsonb(NEW);
    v_accion := 'Actualización';
  END IF;

  v_id := COALESCE(v_fila->>'id', v_fila->>'integrante_id', v_fila->>'servicio_id', v_fila->>'token_confirmacion');
  v_etiqueta := COALESCE(
    NULLIF(v_fila->>'nombre', ''),
    NULLIF(v_fila->>'fecha', ''),
    NULLIF(v_fila->>'tipo', ''),
    NULLIF(v_fila->>'rol', ''),
    NULLIF(v_fila->>'estado', ''),
    NULLIF(v_fila->>'titulo', ''),
    NULLIF(v_id, ''),
    'registro'
  );

  v_entidad := CASE TG_TABLE_NAME
    WHEN 'integrantes' THEN 'Integrantes'
    WHEN 'roles_integrantes' THEN 'Roles de integrantes'
    WHEN 'reglas_asignacion' THEN 'Reglas de asignación'
    WHEN 'disponibilidad_integrantes' THEN 'Disponibilidad'
    WHEN 'excepciones_disponibilidad' THEN 'Excepciones de disponibilidad'
    WHEN 'servicios' THEN 'Servicios'
    WHEN 'asignaciones' THEN 'Asignaciones del cronograma'
    WHEN 'confirmaciones' THEN 'Confirmaciones'
    WHEN 'reemplazos' THEN 'Reemplazos'
    WHEN 'mensajes' THEN 'Mensajes'
    ELSE TG_TABLE_NAME
  END;

  v_detalle := v_accion || ' · ' || v_entidad || ': ' || v_etiqueta;

  INSERT INTO public.historial_actividad
    (usuario_id, accion, entidad, tabla_origen, registro_id, detalle)
  VALUES
    (auth.uid(), v_accion, v_entidad, TG_TABLE_NAME, v_id, v_detalle);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_historial_actividad() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'integrantes', 'roles_integrantes', 'reglas_asignacion',
    'disponibilidad_integrantes', 'excepciones_disponibilidad',
    'servicios', 'asignaciones', 'confirmaciones', 'reemplazos', 'mensajes'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS registrar_historial_actividad ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER registrar_historial_actividad AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_actividad()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Solo lectura para administradores desde la aplicación; los eventos se insertan por triggers.
