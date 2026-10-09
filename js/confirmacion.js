const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("token");

const estadoCarga = document.getElementById("estadoCarga");
const contenido = document.getElementById("contenidoConfirmacion");
const estadoError = document.getElementById("estadoError");
const mensajeError = document.getElementById("mensajeError");
const mensajeResultado = document.getElementById("mensajeResultado");
const btnConfirmar = document.getElementById("btnConfirmar");
const btnNoPuedo = document.getElementById("btnNoPuedo");

let asignacionActual = null;

function obtenerNombreRol(rol) {
    const nombres = {
        "Batería": "🥁 Batería",
        "Bajo": "🎸 Bajo",
        "Guitarra eléctrica": "🎸 Guitarra eléctrica",
        "Piano principal": "🎹 Piano principal",
        "Piano auxiliar": "🎹 Piano auxiliar",
        "Voz líder": "🎤 Voz líder",
        "Coro": "🎶 Coro"
    };

    return nombres[rol] || rol;
}

function mostrarError(mensaje) {
    estadoCarga.classList.add("oculto");
    contenido.classList.add("oculto");
    estadoError.classList.remove("oculto");
    mensajeError.textContent = mensaje;
}

function formatearFecha(fechaTexto) {
    const fecha = new Date(fechaTexto + "T12:00:00");

    const texto = fecha.toLocaleDateString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

async function cargarAsignacion() {
    if (!token) {
        mostrarError("El enlace de confirmación no contiene un token válido.");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from("asignaciones")
            .select(`
                id,
                servicio_id,
                integrante_id,
                rol,
                estado,
                token_confirmacion,
                integrantes (
                    id,
                    nombre
                ),
                servicios (
                    id,
                    fecha,
                    hora,
                    tipo
                )
            `)
            .eq("token_confirmacion", token)
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error("No se encontró la asignación.");
        }

        asignacionActual = data;

        document.getElementById("nombreIntegrante").textContent =
            data.integrantes?.nombre || "hermano(a)";

        document.getElementById("fechaServicio").textContent =
            formatearFecha(data.servicios.fecha);

        document.getElementById("horaServicio").textContent =
            data.servicios.hora.substring(0, 5);

        document.getElementById("rolServicio").textContent =
            obtenerNombreRol(data.rol);

        estadoCarga.classList.add("oculto");
        contenido.classList.remove("oculto");

        if (data.estado === "Confirmado") {
            mostrarResultado(
                "exito",
                "✅ Tu respuesta actual es CONFIRMO. Si tu disponibilidad cambió, puedes seleccionar NO PUEDO para actualizarla."
            );
        } else if (data.estado === "No puede") {
            mostrarResultado(
                "rechazo",
                "❌ Tu respuesta actual es NO PUEDO. Si ahora sí puedes participar, selecciona CONFIRMO para actualizarla."
            );
        } else if (data.estado === "Reemplazado") {
            mostrarResultado(
                "rechazo",
                "🔄 Esta asignación ya fue reemplazada y no se puede modificar desde este enlace."
            );
            bloquearBotones();
        }
    } catch (error) {
        console.error("Error cargando confirmación:", error);
        mostrarError(
            "No fue posible encontrar esta asignación. Verifica que el enlace sea correcto."
        );
    }
}

function bloquearBotones() {
    btnConfirmar.disabled = true;
    btnNoPuedo.disabled = true;
}

function mostrarResultado(tipo, mensaje) {
    mensajeResultado.className = `mensaje-resultado ${tipo}`;
    mensajeResultado.textContent = mensaje;
    mensajeResultado.classList.remove("oculto");
}

async function registrarRespuesta(estado) {
    if (!asignacionActual) {
        return;
    }

    btnConfirmar.disabled = true;
    btnNoPuedo.disabled = true;

    try {
        const { error: errorAsignacion } = await supabaseClient
            .from("asignaciones")
            .update({ estado })
            .eq("id", asignacionActual.id);

        if (errorAsignacion) {
            throw errorAsignacion;
        }

        const { error: errorConfirmacion } = await supabaseClient
            .from("confirmaciones")
            .upsert({
                asignacion_id: asignacionActual.id,
                estado,
                fecha_respuesta: new Date().toISOString()
            }, {
                onConflict: "asignacion_id"
            });

        if (errorConfirmacion) {
            throw errorConfirmacion;
        }

        asignacionActual.estado = estado;

        if (estado === "Confirmado") {
            mostrarResultado(
                "exito",
                "✅ ¡Respuesta actualizada! Tu participación está confirmada. Si tu disponibilidad cambia, puedes volver a modificarla desde este mismo enlace. 🙏"
            );
        } else {
            mostrarResultado(
                "rechazo",
                "❌ ¡Respuesta actualizada! Registramos que no puedes participar. Si tu disponibilidad vuelve a cambiar, puedes modificarla desde este mismo enlace."
            );
        }

        // Permitir cambiar la decisión nuevamente, incluso sin recargar la página.
        btnConfirmar.disabled = false;
        btnNoPuedo.disabled = false;
    } catch (error) {
        console.error("Error registrando respuesta:", error);
        btnConfirmar.disabled = false;
        btnNoPuedo.disabled = false;

        mostrarResultado(
            "rechazo",
            "⚠️ No fue posible registrar tu respuesta. Intenta nuevamente."
        );
    }
}

btnConfirmar.addEventListener("click", () => {
    registrarRespuesta("Confirmado");
});

btnNoPuedo.addEventListener("click", () => {
    registrarRespuesta("No puede");
});

document.addEventListener("DOMContentLoaded", cargarAsignacion);
