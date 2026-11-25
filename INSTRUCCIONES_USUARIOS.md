# Nuevo módulo de administración de cuentas

## Qué incorpora
- Cuentas individuales con correo y contraseña temporal.
- Cambio obligatorio de contraseña en el primer ingreso.
- Roles `admin` (control total) y `consulta` (lectura).
- Activación/desactivación y cambio de rol.
- Tu cuenta actual conserva su rol de administrador.
- Los permisos se validan con RLS en Supabase, no solo en la interfaz.

## Instalación (en este orden)

1. Haz una copia de seguridad del repositorio y de Supabase.
2. En Supabase > SQL Editor, ejecuta una sola vez `supabase_migracion_roles_usuarios.sql`.
3. Despliega la Edge Function `administrar-cuentas` incluida en `supabase/functions/administrar-cuentas/` (incluye el archivo compartido `supabase/functions/_shared/cors.ts`). Puedes hacerlo desde Supabase CLI desde la raíz del proyecto:

   ```bash
   supabase functions deploy administrar-cuentas
   ```

   La función usa automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de Supabase. No copies la service role key al HTML ni a JavaScript del navegador.

4. Sube los archivos del proyecto a GitHub Pages, conservando las carpetas.
5. Inicia sesión con tu cuenta actual. En el menú aparecerá **Administración de cuentas**.
6. Crea las cuentas del comité. Para cada una indica nombre, correo, contraseña temporal (mínimo 8 caracteres) y rol.
7. Entrega las credenciales temporales por un canal privado. En el primer inicio, la aplicación obliga a cambiar la contraseña.

## Importante
- La migración conserva los administradores que ya existen: el rol predeterminado es `admin`.
- No ejecutes de nuevo `supabase_seguridad.sql` ni `supabase_primer_administrador.sql` para esta actualización.
- Los usuarios `consulta` pueden leer los módulos y el historial; las escrituras quedan bloqueadas por RLS.
- No se permite que un administrador se quite sus propios permisos o desactive su propia cuenta desde este módulo, ni que se desactive al último administrador activo.
- Desactivar una cuenta también aplica un bloqueo de acceso en Supabase Auth.
- La Edge Function no crea cuentas anónimas; exige una sesión válida y verifica que quien la invoque sea administrador total.
- Tras desplegar, prueba con una cuenta temporal de consulta que puede ver datos pero no modificarlos, y con una cuenta admin que puede administrar.

## Nota de interfaz
El control real de permisos lo aplica Supabase. Algunas acciones de escritura pueden seguir apareciendo visualmente en ciertas pantallas para el rol de consulta, pero al intentar ejecutarlas Supabase las rechazará. La siguiente mejora de interfaz puede ocultar esos controles para una experiencia completamente de solo lectura.
