-- Ejecutar DESPUÉS de crear el usuario en Supabase Authentication > Users.
-- Reemplaza el correo entre comillas por el correo exacto de la cuenta administradora.
INSERT INTO public.admin_users (user_id, email, activo)
SELECT id, email, true
FROM auth.users
WHERE lower(email) = lower('REEMPLAZA_POR_TU_CORREO')
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    activo = true;

-- Verificación: debe devolver exactamente tu usuario y activo = true.
SELECT user_id, email, activo, creado_en
FROM public.admin_users
WHERE lower(email) = lower('REEMPLAZA_POR_TU_CORREO');
