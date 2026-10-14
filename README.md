# Alabanza IPUC Líbano Central — actualización de disponibilidad

## Contenido de esta actualización
- `admin/disponibilidad.html`, `css/disponibilidad.css`, `js/disponibilidad.js`: gestión administrativa de disponibilidad habitual y excepciones por fecha o periodo.
- `supabase_disponibilidad_excepciones.sql`: crea la tabla nueva `excepciones_disponibilidad`.
- `js/app.js`: el generador admite un mes `YYYY-MM`, deja de exigir exactamente 24 integrantes/14 servicios y aplica las excepciones al asignar músicos. La consulta del cronograma de Inicio permite seleccionar mes y muestra noviembre de 2026 por defecto.
- `index.html`: selector de mes en el cronograma.

## Instalación recomendada
1. Descarga una copia de seguridad de tu repositorio actual.
2. En Supabase, abre **SQL Editor**, pega y ejecuta una vez `supabase_disponibilidad_excepciones.sql`.
3. En GitHub, reemplaza `admin/disponibilidad.html`, `css/disponibilidad.css`, `js/disponibilidad.js`, `js/app.js` e `index.html` por los de esta carpeta.
4. Haz Commit y espera a que GitHub Pages publique los cambios.
5. Abre `admin/disponibilidad.html`. Comprueba que aparecen los integrantes activos.
6. Selecciona un integrante, pulsa **Consultar**, marca los días habituales y guarda.
7. Registra una fecha específica de “No disponible” y después un periodo. Confirma que ambos aparecen en la lista y que se pueden editar/eliminar.

## Compartir el cronograma por WhatsApp
- En Inicio, selecciona el mes y pulsa **Consultar**.
- Pulsa **Preparar WhatsApp**. La aplicación arma un mensaje con todos los servicios y las asignaciones por rol, ordenados por fecha.
- Revisa o edita el texto; luego pulsa **Copiar mensaje** o **Abrir WhatsApp**.
- WhatsApp abre un chat con el mensaje preparado. Selecciona el grupo de alabanza y envíalo manualmente. La aplicación no envía mensajes por sí sola.
- Si un servicio no tiene asignaciones, el mensaje lo marca como pendiente de asignar equipo.

## Cómo se aplican las reglas de disponibilidad
- Si no existe una excepción para una fecha, se usa `disponibilidad_integrantes` por día de la semana.
- Una excepción “Disponible” habilita esa fecha aunque el día habitual esté desmarcado.
- Una excepción “No disponible” bloquea esa fecha.
- Si por error se superponen varias excepciones contradictorias, prevalece “No disponible”.
- El generador y el buscador de reemplazos consultan las excepciones.

## Preparar noviembre de 2026
- Primero crea los servicios activos de noviembre en la tabla `servicios` (jueves y sábados a las 18:30, domingos a las 10:00, según la programación habitual de la iglesia).
- El generador admite `generarCronograma(false, "2026-11")`. En esta versión el generador sigue siendo una función del navegador; para ejecutarlo desde la consola de desarrollador abre Inicio, pulsa F12 > Console y ejecuta:
  `generarCronograma(false, "2026-11")`
- Antes de generar, verifica que noviembre no tenga asignaciones ya creadas. El generador se detiene si ya existen, para evitar duplicados.
- Luego consulta noviembre desde el selector del cronograma.

## Importante
- No se cambia la conexión de `js/supabase.js`.
- No se reemplazan ni se borran datos de octubre.
- La tabla nueva habilita políticas para los roles `anon` y `authenticated`, siguiendo el modo de acceso actual del proyecto. Como el módulo administrativo aún no tiene autenticación, protege el acceso al sitio y endurece RLS antes de exponerlo públicamente.
- La comprobación de sintaxis JavaScript se realizó localmente, pero la conexión real y las políticas deben probarse en tu propio proyecto Supabase.


## Gestión de servicios y generación desde la interfaz

- En `Gestión → Servicios`, elige el mes, los días y horarios y pulsa **Crear servicios faltantes del mes**. Los horarios sugeridos son jueves/sábado 18:30 y domingo 10:00; puedes cambiarlos antes de crear. La operación evita duplicar servicios con la misma fecha y hora.
- Los servicios se pueden activar/desactivar. La interfaz impide eliminar servicios que tengan asignaciones.
- En Inicio, selecciona el mes y pulsa **Generar asignaciones**. El sistema comprueba que existan servicios activos y que no tengan asignaciones previas, pide confirmación y luego ejecuta el generador.
- La creación de servicios y la generación deben probarse en el sitio publicado conectado a Supabase. La aplicación usa las tablas actuales `servicios` y `asignaciones`; no se agregó ninguna tabla nueva.


## Seguimiento de confirmaciones y reemplazos

- En `Gestión → Confirmaciones`, selecciona el mes para ver el estado de cada asignación: pendiente, confirmado, no puede o reemplazado.
- Usa **Copiar enlace** para copiar el enlace personal de confirmación, o **WhatsApp** para preparar un mensaje individual. El envío al contacto o grupo sigue siendo manual.
- Si una asignación anterior no tiene `token_confirmacion`, el módulo genera y guarda uno al solicitar el enlace.
- Las asignaciones nuevas creadas por el generador y las asignaciones de reemplazo reciben un token desde el momento de su creación.
- En `Gestión → Reemplazos`, puedes revisar los reemplazos registrados por mes y preparar el mensaje para el reemplazante.
- Para registrar un reemplazo, abre el servicio desde Inicio y utiliza la opción de reemplazo que ya valida disponibilidad y reglas musicales.
- Esta actualización no requiere tablas nuevas ni ejecutar SQL. Es necesario que las políticas de Supabase permitan consultar y actualizar `asignaciones`, `confirmaciones`, `reemplazos`, `integrantes` y `servicios`.
- La sintaxis JavaScript se revisó localmente. Prueba el acceso y los cambios contra tu Supabase publicado; no se ha probado desde aquí una conexión real a tu proyecto.


## Seguridad Supabase (instalación inicial)

1. En Supabase Dashboard abre **Authentication → Users → Add user** y crea la cuenta del primer administrador. Usa un correo que controles y una contraseña única; no la incluyas en GitHub. Si se ofrece la opción, confirma el correo para facilitar la primera prueba.
2. En **SQL Editor**, ejecuta `supabase_seguridad.sql`. Este script reemplaza las políticas abiertas de desarrollo de las diez tablas objetivo por políticas de administrador.
3. Abre `supabase_primer_administrador.sql`, reemplaza las dos apariciones de `REEMPLAZA_POR_TU_CORREO` por el correo de la cuenta recién creada y ejecuta el script.
4. Publica los archivos de esta versión en GitHub Pages. Inicia sesión en `login.html`.
5. Prueba con un enlace de confirmación real que `CONFIRMO` y `NO PUEDO` funcionen y que el panel administrativo siga cargando datos.

**Importante:** el SQL cambia permisos de base de datos. Haz una copia de seguridad antes de ejecutarlo y no borres tu usuario de Auth. La función pública de confirmación solo permite consultar/responder usando un token de asignación válido. La cuenta inicial se agrega mediante SQL Editor, no mediante registro público.
