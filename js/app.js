// ============================================================
// CONFIGURACIÓN SUPABASE
// ============================================================

const SUPABASE_URL = "https://eowvywzafmxjfeqsfzcg.supabase.co";

const SUPABASE_KEY = "sb_publishable_npJQw6k00asz-E_eYJGs9g_t9HC74kS";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =========================================================
// CONEXIÓN
// =========================================================

async function comprobarConexion() {
    console.log("Intentando conectar con Supabase...");
    console.log("URL:", SUPABASE_URL);

    const { data, error } = await supabaseClient
        .from("integrantes")
        .select("id")
        .limit(1);

    if (error) {
        console.error("Error conectando con Supabase:", error);
        return false;
    }

    console.log("✅ Supabase conectado correctamente");
    console.log("Datos recibidos:", data);

    return true;
}


// =========================================================
// GENERADOR DE CRONOGRAMA
// =========================================================

async function generarCronograma() {

    console.log("=================================");
    console.log("GENERANDO CRONOGRAMA");
    console.log("=================================");

    // -----------------------------------------------------
    // 1. OBTENER INTEGRANTES
    // -----------------------------------------------------

    const { data: integrantes, error: errorIntegrantes } =
        await supabaseClient
            .from("integrantes")
            .select("*")
            .eq("activo", true);

    if (errorIntegrantes) {
        console.error("Error obteniendo integrantes:", errorIntegrantes);
        return;
    }

    // -----------------------------------------------------
    // 2. OBTENER DISPONIBILIDADES
    // -----------------------------------------------------

    const { data: disponibilidades, error: errorDisponibilidad } =
        await supabaseClient
            .from("disponibilidad_integrantes")
            .select("*");

    if (errorDisponibilidad) {
        console.error(
            "Error obteniendo disponibilidades:",
            errorDisponibilidad
        );
        return;
    }

    // -----------------------------------------------------
    // 3. OBTENER SERVICIOS
    // -----------------------------------------------------

    const { data: servicios, error: errorServicios } =
        await supabaseClient
            .from("servicios")
            .select("*")
            .eq("activo", true)
            .gte("fecha", "2026-10-01")
            .lte("fecha", "2026-10-31")
            .order("fecha");

    if (errorServicios) {
        console.error("Error obteniendo servicios:", errorServicios);
        return;
    }

    console.log("Integrantes:", integrantes.length);
    console.log("Servicios:", servicios.length);

    if (servicios.length === 0) {
        console.warn("No hay servicios disponibles.");
        return;
    }


    // =====================================================
    // ESTRUCTURAS AUXILIARES
    // =====================================================

    const disponibilidad = {};

    disponibilidades.forEach(d => {

        if (!disponibilidad[d.integrante_id]) {
            disponibilidad[d.integrante_id] = {};
        }

        disponibilidad[d.integrante_id][d.dia_semana] =
            d.disponible;
    });


    // Contador de participaciones
    const participaciones = {};

    integrantes.forEach(persona => {
        participaciones[persona.id] = 0;
    });


    // =====================================================
    // FUNCIONES AUXILIARES
    // =====================================================

    function diaSemana(fecha) {

        // PostgreSQL y JavaScript usan:
        // Domingo = 0
        // Lunes = 1
        // ...
        // Sábado = 6

        const fechaLocal = new Date(fecha + "T12:00:00");

        return fechaLocal.getDay();
    }


    function estaDisponible(persona, servicio) {

        const dia = diaSemana(servicio.fecha);

        return disponibilidad[persona.id]?.[dia] === true;
    }


    function yaAsignado(persona, asignados) {

        return asignados.some(
            asignacion => asignacion.integrante_id === persona.id
        );
    }


    function elegirMenorParticipacion(lista) {

        if (lista.length === 0) {
            return null;
        }

        lista.sort((a, b) => {

            const diferencia =
                participaciones[a.id] -
                participaciones[b.id];

            if (diferencia !== 0) {
                return diferencia;
            }

            return a.nombre.localeCompare(
                b.nombre,
                "es"
            );
        });

        return lista[0];
    }


    function candidatosPorInstrumento(
        instrumento,
        servicio,
        asignados
    ) {

        return integrantes.filter(persona =>

            persona.instrumento === instrumento &&

            estaDisponible(persona, servicio) &&

            !yaAsignado(persona, asignados)

        );
    }


    // =====================================================
    // GENERAR CADA SERVICIO
    // =====================================================

    const todasLasAsignaciones = [];


    for (const servicio of servicios) {

        console.log("");
        console.log("---------------------------------");
        console.log(
            "Servicio:",
            servicio.fecha,
            servicio.tipo
        );
        console.log("---------------------------------");


        const asignados = [];


        // =================================================
        // BATERÍA
        // =================================================

        let candidatosBateria =
            candidatosPorInstrumento(
                "Batería",
                servicio,
                asignados
            );

        const bateria =
            elegirMenorParticipacion(candidatosBateria);

        if (!bateria) {
            console.error(
                "❌ No hay baterista disponible para",
                servicio.fecha
            );
            continue;
        }

        asignados.push({
            integrante_id: bateria.id,
            rol: "Batería"
        });

        participaciones[bateria.id]++;


        // =================================================
        // BAJO
        // =================================================

        let candidatosBajo =
            candidatosPorInstrumento(
                "Bajo",
                servicio,
                asignados
            );

        // Regla:
        // Johan NO puede tocar con Santiago.
        //
        // Si elegimos Johan, luego guitarra debe ser Wolfran.
        // Si elegimos Arquimedes, podemos usar Santiago o Wolfran.

        let bajo;

        const arquimedes =
            candidatosBajo.find(
                p => p.nombre === "Arquimedes Esquivel"
            );

        const johan =
            candidatosBajo.find(
                p => p.nombre === "Johan Díaz"
            );


        // Intentamos balancear entre ambos
        bajo = elegirMenorParticipacion(
            candidatosBajo
        );

        if (!bajo) {
            console.error(
                "❌ No hay bajista disponible para",
                servicio.fecha
            );
            continue;
        }

        asignados.push({
            integrante_id: bajo.id,
            rol: "Bajo"
        });

        participaciones[bajo.id]++;


        // =================================================
        // GUITARRA
        // =================================================

        let candidatosGuitarra =
            candidatosPorInstrumento(
                "Guitarra eléctrica",
                servicio,
                asignados
            );


        // Regla fundamental:
        //
        // Johan + Santiago = PROHIBIDO
        //
        // Si el bajista es Johan:
        //     guitarra = Wolfran
        //
        // Si el bajista es Arquimedes:
        //     puede ser Santiago o Wolfran.

        if (bajo.nombre === "Johan Díaz") {

            candidatosGuitarra =
                candidatosGuitarra.filter(
                    p => p.nombre === "Wolfran Castañeda"
                );

        }


        const guitarra =
            elegirMenorParticipacion(
                candidatosGuitarra
            );


        if (!guitarra) {

            console.error(
                "❌ No existe combinación válida Bajo/Guitarra para",
                servicio.fecha
            );

            continue;
        }


        asignados.push({
            integrante_id: guitarra.id,
            rol: "Guitarra eléctrica"
        });

        participaciones[guitarra.id]++;


        // =================================================
        // VOZ LÍDER
        // =================================================

        let candidatosLider =
            integrantes.filter(persona =>

                persona.puede_ser_lider === true &&

                persona.instrumento === "Voz líder" ||

                (
                    persona.puede_ser_lider === true &&
                    persona.instrumento === "Piano"
                )

            );


        candidatosLider =
            candidatosLider.filter(persona =>

                estaDisponible(persona, servicio) &&

                !yaAsignado(persona, asignados)

            );


        const lider =
            elegirMenorParticipacion(
                candidatosLider
            );


        if (!lider) {

            console.error(
                "❌ No hay líder disponible para",
                servicio.fecha
            );

            continue;
        }


        asignados.push({
            integrante_id: lider.id,
            rol: "Voz líder"
        });

        participaciones[lider.id]++;


        // =================================================
        // PIANO PRINCIPAL
        // =================================================

        let candidatosPiano =
            candidatosPorInstrumento(
                "Piano",
                servicio,
                asignados
            );


        // Si Oscar es líder:
        //     Nicol debe ser piano principal
        //
        // Si Nicol es líder:
        //     Oscar debe ser piano principal
        //
        // Si Mayerly es líder:
        //     Oscar o Nicol pueden tocar.

        if (lider.nombre === "Oscar Julián Díaz") {

            candidatosPiano =
                candidatosPiano.filter(
                    p => p.nombre === "Nicol Pineda"
                );

        } else if (lider.nombre === "Nicol Pineda") {

            candidatosPiano =
                candidatosPiano.filter(
                    p => p.nombre === "Oscar Julián Díaz"
                );

        } else {

            candidatosPiano =
                candidatosPiano.filter(
                    p =>
                        p.nombre === "Oscar Julián Díaz" ||
                        p.nombre === "Nicol Pineda"
                );

        }


        const piano =
            elegirMenorParticipacion(
                candidatosPiano
            );


        if (!piano) {

            console.error(
                "❌ No hay pianista principal válido para",
                servicio.fecha
            );

            continue;
        }


        asignados.push({
            integrante_id: piano.id,
            rol: "Piano principal"
        });

        participaciones[piano.id]++;


        // =================================================
        // PIANO AUXILIAR
        // =================================================

        const juanJose =
            integrantes.find(
                p => p.nombre === "Juan José Restrepo"
            );


        if (
            juanJose &&
            estaDisponible(juanJose, servicio) &&
            !yaAsignado(juanJose, asignados)
        ) {

            // Lo dejamos como auxiliar solamente
            // cuando no es necesario que el equipo
            // quede excesivamente cargado.

            asignados.push({
                integrante_id: juanJose.id,
                rol: "Piano auxiliar"
            });

            participaciones[juanJose.id]++;
        }


        // =================================================
        // COROS
        // =================================================

        let candidatosCoros =
            integrantes.filter(persona =>

                persona.instrumento === "Coro" &&

                estaDisponible(persona, servicio) &&

                !yaAsignado(persona, asignados)

            );


        // Elegimos los 3 con menos participaciones
        candidatosCoros.sort((a, b) => {

            const diferencia =
                participaciones[a.id] -
                participaciones[b.id];

            if (diferencia !== 0) {
                return diferencia;
            }

            return a.nombre.localeCompare(
                b.nombre,
                "es"
            );
        });


        const coros =
            candidatosCoros.slice(0, 3);


        if (coros.length < 3) {

            console.error(
                "❌ No hay 3 coristas disponibles para",
                servicio.fecha
            );

            continue;
        }


        coros.forEach(coro => {

            asignados.push({
                integrante_id: coro.id,
                rol: "Coro"
            });

            participaciones[coro.id]++;
        });


        // =================================================
        // GUARDAR EN MEMORIA
        // =================================================

        asignados.forEach(asignacion => {

            todasLasAsignaciones.push({

                servicio_id: servicio.id,

                integrante_id:
                    asignacion.integrante_id,

                rol:
                    asignacion.rol,

                estado: "Pendiente",

                es_principal:
                    asignacion.rol !== "Piano auxiliar"

            });

        });


        // Mostrar resultado
        console.log(
            "Batería:",
            bateria.nombre
        );

        console.log(
            "Bajo:",
            bajo.nombre
        );

        console.log(
            "Guitarra:",
            guitarra.nombre
        );

        console.log(
            "Voz líder:",
            lider.nombre
        );

        console.log(
            "Piano:",
            piano.nombre
        );

        console.log(
            "Piano auxiliar:",
            juanJose ? juanJose.nombre : "Ninguno"
        );

        console.log(
            "Coros:",
            coros.map(c => c.nombre)
        );
    }


    // =====================================================
    // INSERTAR ASIGNACIONES
    // =====================================================

    console.log("");
    console.log(
        "Total de asignaciones:",
        todasLasAsignaciones.length
    );


    if (todasLasAsignaciones.length === 0) {

        console.warn(
            "No se generaron asignaciones."
        );

        return;
    }


    const { data, error } =
        await supabaseClient
            .from("asignaciones")
            .insert(todasLasAsignaciones)
            .select();


    if (error) {

        console.error(
            "❌ Error guardando asignaciones:",
            error
        );

        return;
    }


    console.log(
        "================================="
    );

    console.log(
        "✅ CRONOGRAMA GENERADO"
    );

    console.log(
        "Asignaciones guardadas:",
        data.length
    );

    console.log(
        "================================="
    );


    // Mostrar resumen de participaciones

    console.log(
        "Participaciones por integrante:"
    );

    integrantes.forEach(persona => {

        console.log(
            persona.nombre,
            "→",
            participaciones[persona.id]
        );

    });
}


// =========================================================
// NAVEGACIÓN TEMPORAL
// =========================================================

function irA(seccion) {

    if (seccion === "cronograma") {

        alert(
            "El cronograma estará disponible próximamente."
        );

    }

    if (seccion === "agenda") {

        alert(
            "La agenda personal estará disponible próximamente."
        );

    }

    if (seccion === "admin") {

        alert(
            "El panel administrativo estará disponible próximamente."
        );

    }

}


// =========================================================
// INICIO
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        comprobarConexion();

    }
);
