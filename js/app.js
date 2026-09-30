// ============================================================
// CONFIGURACIÓN SUPABASE
// ============================================================

const SUPABASE_URL = "https://eowvywzafmxjfeqsfzcg.supabase.co/rest/v1/";

const SUPABASE_KEY = "sb_publishable_npJQw6k00asz-E_eYJGs9g_t9HC74kS";


// ============================================================
// CONEXIÓN
// ============================================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// COMPROBAR CONEXIÓN
// ============================================================

async function comprobarConexion() {

    const { data, error } = await supabaseClient
        .from("integrantes")
        .select("id")
        .limit(1);

    if (error) {

        console.error("Error conectando con Supabase:", error);

        return false;
    }

    console.log("✅ Supabase conectado correctamente");

    return true;
}


// ============================================================
// NAVEGACIÓN TEMPORAL
// ============================================================

function irA(seccion) {

    if (seccion === "cronograma") {
        alert("El cronograma estará disponible próximamente.");
    }

    if (seccion === "agenda") {
        alert("La agenda personal estará disponible próximamente.");
    }

    if (seccion === "admin") {
        alert("El panel administrativo estará disponible próximamente.");
    }

}


// ============================================================
// INICIAR APLICACIÓN
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    comprobarConexion();

});
