-- Migración para roles admin/consulta y cuentas con cambio obligatorio de clave.
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor.
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'admin';
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_rol_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_rol_check CHECK (rol IN ('admin','consulta'));

CREATE OR REPLACE FUNCTION public.es_administrador()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=auth.uid() AND activo=true AND rol='admin');
$$;
CREATE OR REPLACE FUNCTION public.es_usuario_autorizado()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=auth.uid() AND activo=true);
$$;
CREATE OR REPLACE FUNCTION public.obtener_mi_perfil()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE((SELECT jsonb_build_object('autorizado',true,'rol',rol,'nombre',nombre,'debe_cambiar_clave',COALESCE((auth.jwt()->'user_metadata'->>'must_change_password')::boolean,false)) FROM public.admin_users WHERE user_id=auth.uid() AND activo=true),jsonb_build_object('autorizado',false));
$$;
REVOKE ALL ON FUNCTION public.es_administrador() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.es_usuario_autorizado() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.obtener_mi_perfil() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.es_administrador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_usuario_autorizado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_mi_perfil() TO authenticated;

-- Los usuarios de consulta pueden leer; solo los administradores pueden escribir.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['integrantes','roles_integrantes','reglas_asignacion','disponibilidad_integrantes','excepciones_disponibilidad','servicios','asignaciones','confirmaciones','reemplazos','mensajes'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS admin_manage_all ON public.%I',t);
   EXECUTE format('DROP POLICY IF EXISTS usuarios_autorizados_lectura ON public.%I',t);
   EXECUTE format('DROP POLICY IF EXISTS administradores_escritura ON public.%I',t);
   EXECUTE format('CREATE POLICY usuarios_autorizados_lectura ON public.%I FOR SELECT TO authenticated USING (public.es_usuario_autorizado())',t);
   EXECUTE format('CREATE POLICY administradores_escritura ON public.%I FOR ALL TO authenticated USING (public.es_administrador()) WITH CHECK (public.es_administrador())',t);
 END LOOP;
END $$;
-- La tabla de usuarios solo puede consultarse/alterarse mediante Edge Function con service role.
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC,anon,authenticated;
-- El historial también puede consultarse desde cuentas autorizadas de solo lectura.
DROP POLICY IF EXISTS historial_actividad_admin_select ON public.historial_actividad;
DROP POLICY IF EXISTS historial_actividad_autorizados_select ON public.historial_actividad;
CREATE POLICY historial_actividad_autorizados_select ON public.historial_actividad
 FOR SELECT TO authenticated USING (public.es_usuario_autorizado());
