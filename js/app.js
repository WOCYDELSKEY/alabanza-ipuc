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

    console.clear();

    console.log("=================================");
    console.log("GENERADOR DE CRONOGRAMA");
    console.log("=================================");

    // =====================================================
    // 1. OBTENER DATOS
    // =====================================================

    const { data: integrantes, error: errorIntegrantes } =
        await supabaseClient
            .from("integrantes")
            .select("*")
            .eq("activo", true);

    if (errorIntegrantes) {
        console.error("Error obteniendo integrantes:", errorIntegrantes);
        return;
    }

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

    if (integrantes.length !== 24) {
        console.error("❌ Deben existir exactamente 24 integrantes.");
        return;
    }

    if (servicios.length !== 14) {
        console.error("❌ Deben existir exactamente 14 servicios.");
        return;
    }


    // =====================================================
    // 2. COMPROBAR SI YA EXISTE UN CRONOGRAMA
    // =====================================================

    const servicioIds = servicios.map(s => s.id);

    const { data: existentes, error: errorExistentes } =
        await supabaseClient
            .from("asignaciones")
            .select("id, servicio_id")
            .in("servicio_id", servicioIds);

    if (errorExistentes) {
        console.error(
            "Error comprobando asignaciones existentes:",
            errorExistentes
        );
        return;
    }

    if (existentes.length > 0) {

        console.error(
            "❌ Ya existen asignaciones para octubre."
        );

        console.error(
            "Primero debes eliminarlas desde Supabase antes de regenerar."
        );

        console.error(
            "Asignaciones existentes:",
            existentes.length
        );

        return;
    }


    // =====================================================
    // 3. DISPONIBILIDAD
    // =====================================================

    const disponibilidad = {};

    disponibilidades.forEach(d => {

        if (!disponibilidad[d.integrante_id]) {
            disponibilidad[d.integrante_id] = {};
        }

        disponibilidad[d.integrante_id][d.dia_semana] =
            d.disponible;
    });


    // =====================================================
    // 4. CONTADORES
    // =====================================================

    const participaciones = {};
    const participacionesPorRol = {};

    integrantes.forEach(persona => {

        participaciones[persona.id] = 0;

        participacionesPorRol[persona.id] = {
            bateria: 0,
            bajo: 0,
            guitarra: 0,
            piano: 0,
            lider: 0,
            coro: 0,
            auxiliar: 0
        };

    });


    // =====================================================
    // 5. FUNCIONES AUXILIARES
    // =====================================================

    function diaSemana(fecha) {

        const fechaLocal =
            new Date(fecha + "T12:00:00");

        return fechaLocal.getDay();
    }


    function estaDisponible(persona, servicio) {

        const dia = diaSemana(servicio.fecha);

        return disponibilidad[persona.id]?.[dia] === true;
    }


    function estaAsignado(persona, asignados) {

        return asignados.some(
            a => a.integrante_id === persona.id
        );
    }


    function ordenarPorParticipacion(lista) {

        return [...lista].sort((a, b) => {

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

    }


    function obtenerCandidatos(
        instrumento,
        servicio,
        asignados
    ) {

        return integrantes.filter(persona =>

            persona.instrumento === instrumento &&

            estaDisponible(persona, servicio) &&

            !estaAsignado(persona, asignados)

        );

    }


    function registrar(
        persona,
        rol,
        asignados
    ) {

        asignados.push({
            integrante_id: persona.id,
            rol: rol
        });

        participaciones[persona.id]++;


        if (rol === "Batería") {
            participacionesPorRol[persona.id].bateria++;
        }

        if (rol === "Bajo") {
            participacionesPorRol[persona.id].bajo++;
        }

        if (rol === "Guitarra eléctrica") {
            participacionesPorRol[persona.id].guitarra++;
        }

        if (rol === "Piano principal") {
            participacionesPorRol[persona.id].piano++;
        }

        if (rol === "Voz líder") {
            participacionesPorRol[persona.id].lider++;
        }

        if (rol === "Coro") {
            participacionesPorRol[persona.id].coro++;
        }

        if (rol === "Piano auxiliar") {
            participacionesPorRol[persona.id].auxiliar++;
        }

    }


    // =====================================================
    // 6. GENERACIÓN
    // =====================================================

    const todasLasAsignaciones = [];

    let errores = [];


    for (
        let indiceServicio = 0;
        indiceServicio < servicios.length;
        indiceServicio++
    ) {

        const servicio = servicios[indiceServicio];

        console.log("");
        console.log("---------------------------------");
        console.log(
            `${servicio.fecha} - ${servicio.tipo}`
        );
        console.log("---------------------------------");


        const asignados = [];


        // =================================================
        // BATERÍA
        // =================================================

        let candidatos =
            obtenerCandidatos(
                "Batería",
                servicio,
                asignados
            );

        candidatos =
            ordenarPorParticipacion(candidatos);

        const bateria = candidatos[0];

        if (!bateria) {

            errores.push(
                `${servicio.fecha}: no hay baterista disponible`
            );

            continue;
        }

        registrar(
            bateria,
            "Batería",
            asignados
        );


        // =================================================
        // BAJO + GUITARRA
        // =================================================
        //
        // Se seleccionan como PAREJA.
        //
        // Permitidas:
        //
        // Arquimedes + Santiago
        // Arquimedes + Wolfran
        // Johan + Wolfran
        //
        // PROHIBIDA:
        //
        // Johan + Santiago
        // =================================================

        const arquimedes =
            integrantes.find(
                p => p.nombre === "Arquimedes Esquivel"
            );

        const johan =
            integrantes.find(
                p => p.nombre === "Johan Díaz"
            );

        const wolfran =
            integrantes.find(
                p => p.nombre === "Wolfran Castañeda"
            );

        const santiago =
            integrantes.find(
                p => p.nombre === "Santiago Mendoza"
            );


        const parejas = [];


        // Arquimedes + Santiago
        if (
            arquimedes &&
            santiago &&
            estaDisponible(arquimedes, servicio) &&
            estaDisponible(santiago, servicio)
        ) {

            parejas.push({
                bajo: arquimedes,
                guitarra: santiago
            });

        }


        // Arquimedes + Wolfran
        if (
            arquimedes &&
            wolfran &&
            estaDisponible(arquimedes, servicio) &&
            estaDisponible(wolfran, servicio)
        ) {

            parejas.push({
                bajo: arquimedes,
                guitarra: wolfran
            });

        }


        // Johan + Wolfran
        if (
            johan &&
            wolfran &&
            estaDisponible(johan, servicio) &&
            estaDisponible(wolfran, servicio)
        ) {

            parejas.push({
                bajo: johan,
                guitarra: wolfran
            });

        }


        if (parejas.length === 0) {

            errores.push(
                `${servicio.fecha}: no existe pareja válida de bajo y guitarra`
            );

            continue;
        }


        // Elegimos la pareja con menor participación
        parejas.sort((a, b) => {

            const totalA =
                participaciones[a.bajo.id] +
                participaciones[a.guitarra.id];

            const totalB =
                participaciones[b.bajo.id] +
                participaciones[b.guitarra.id];

            return totalA - totalB;

        });


        const pareja = parejas[0];


        registrar(
            pareja.bajo,
            "Bajo",
            asignados
        );

        registrar(
            pareja.guitarra,
            "Guitarra eléctrica",
            asignados
        );


        // =================================================
        // VOZ LÍDER
        // =================================================

        let lideres =
            integrantes.filter(persona =>

                persona.puede_ser_lider === true &&

                estaDisponible(persona, servicio) &&

                !estaAsignado(persona, asignados)

            );


        // Primero buscamos quien tenga menos servicios
        // como líder, no menos participaciones totales.

        lideres.sort((a, b) => {

            const diferencia =
                participacionesPorRol[a.id].lider -
                participacionesPorRol[b.id].lider;

            if (diferencia !== 0) {
                return diferencia;
            }

            return participaciones[a.id] -
                participaciones[b.id];

        });


        const lider = lideres[0];


        if (!lider) {

            errores.push(
                `${servicio.fecha}: no hay líder disponible`
            );

            continue;
        }


        registrar(
            lider,
            "Voz líder",
            asignados
        );


        // =================================================
        // PIANO PRINCIPAL
        // =================================================

        let pianos =
            obtenerCandidatos(
                "Piano",
                servicio,
                asignados
            );


        // Si Oscar lidera → Nicol piano
        if (
            lider.nombre ===
            "Oscar Julián Díaz"
        ) {

            pianos =
                pianos.filter(
                    p =>
                        p.nombre ===
                        "Nicol Pineda"
                );

        }


        // Si Nicol lidera → Oscar piano
        else if (
            lider.nombre ===
            "Nicol Pineda"
        ) {

            pianos =
                pianos.filter(
                    p =>
                        p.nombre ===
                        "Oscar Julián Díaz"
                );

        }


        // Si Mayerly lidera → Oscar o Nicol
        else {

            pianos =
                pianos.filter(
                    p =>
                        p.nombre ===
                        "Oscar Julián Díaz" ||

                        p.nombre ===
                        "Nicol Pineda"
                );

        }


        pianos =
            ordenarPorParticipacion(pianos);


        const piano = pianos[0];


        if (!piano) {

            errores.push(
                `${servicio.fecha}: no hay piano principal válido`
            );

            continue;
        }


        registrar(
            piano,
            "Piano principal",
            asignados
        );


        // =================================================
        // PIANO AUXILIAR
        // =================================================
        //
        // Juan José es aprendiz y auxiliar.
        //
        // Lo utilizamos aproximadamente en la mitad
        // de los servicios para darle participación,
        // pero NO es obligatorio.
        // =================================================

        const juanJose =
            integrantes.find(
                p =>
                    p.nombre ===
                    "Juan José Restrepo"
            );


        const usarAuxiliar =
            indiceServicio % 2 === 1;


        if (
            usarAuxiliar &&
            juanJose &&
            estaDisponible(juanJose, servicio) &&
            !estaAsignado(juanJose, asignados)
        ) {

            registrar(
                juanJose,
                "Piano auxiliar",
                asignados
            );

        }


        // =================================================
        // COROS
        // =================================================

        let coristas =
            integrantes.filter(persona =>

                persona.instrumento === "Coro" &&

                estaDisponible(persona, servicio) &&

                !estaAsignado(persona, asignados)

            );


        coristas =
            ordenarPorParticipacion(coristas);


        const seleccionCoros =
            coristas.slice(0, 3);


        if (seleccionCoros.length !== 3) {

            errores.push(
                `${servicio.fecha}: no hay 3 coristas disponibles`
            );

            continue;
        }


        seleccionCoros.forEach(coro => {

            registrar(
                coro,
                "Coro",
                asignados
            );

        });


        // =================================================
        // GUARDAR EN MEMORIA
        // =================================================

        asignados.forEach(asignacion => {

            todasLasAsignaciones.push({

                servicio_id:
                    servicio.id,

                integrante_id:
                    asignacion.integrante_id,

                rol:
                    asignacion.rol,

                estado:
                    "Pendiente",

                es_principal:
                    asignacion.rol !==
                    "Piano auxiliar"

            });

        });


        // =================================================
        // MOSTRAR SERVICIO
        // =================================================

        console.log(
            "🥁 Batería:",
            bateria.nombre
        );

        console.log(
            "🎸 Bajo:",
            pareja.bajo.nombre
        );

        console.log(
            "🎸 Guitarra:",
            pareja.guitarra.nombre
        );

        console.log(
            "🎤 Líder:",
            lider.nombre
        );

        console.log(
            "🎹 Piano:",
            piano.nombre
        );

        console.log(
            "🎹 Auxiliar:",
            juanJose &&
            asignados.some(
                a =>
                    a.integrante_id ===
                    juanJose.id &&
                    a.rol ===
                    "Piano auxiliar"
            )
                ? juanJose.nombre
                : "Ninguno"
        );

        console.log(
            "🎶 Coros:",
            seleccionCoros.map(
                c => c.nombre
            )
        );

    }


    // =====================================================
    // 7. VALIDACIÓN GENERAL
    // =====================================================

    console.log("");
    console.log("=================================");
    console.log("VALIDANDO CRONOGRAMA");
    console.log("=================================");


    if (errores.length > 0) {

        console.error(
            "❌ EL CRONOGRAMA TIENE ERRORES"
        );

        errores.forEach(error => {
            console.error(error);
        });

        console.error(
            "No se guardará ninguna asignación."
        );

        return;
    }


    // =====================================================
    // VALIDAR CANTIDAD
    // =====================================================

    // 8 roles obligatorios:
    //
    // batería
    // bajo
    // guitarra
    // piano principal
    // líder
    // 3 coros
    //
    // = 8 asignaciones por servicio
    //
    // Piano auxiliar es opcional.

    const minimoEsperado =
        servicios.length * 8;


    if (
        todasLasAsignaciones.length <
        minimoEsperado
    ) {

        console.error(
            "❌ Faltan asignaciones."
        );

        return;
    }


    // =====================================================
    // VALIDAR DUPLICADOS
    // =====================================================

    for (const servicio of servicios) {

        const asignacionesServicio =
            todasLasAsignaciones.filter(
                a =>
                    a.servicio_id ===
                    servicio.id
            );


        const personas =
            asignacionesServicio.map(
                a =>
                    a.integrante_id
            );


        const personasUnicas =
            new Set(personas);


        if (
            personas.length !==
            personasUnicas.size
        ) {

            console.error(
                "❌ Hay una persona con dos roles en:",
                servicio.fecha
            );

            return;
        }


        const roles =
            asignacionesServicio.map(
                a => a.rol
            );


        const rolesObligatorios = [
            "Batería",
            "Bajo",
            "Guitarra eléctrica",
            "Piano principal",
            "Voz líder",
            "Coro"
        ];


        for (
            const rol of rolesObligatorios
        ) {

            const cantidad =
                roles.filter(
                    r => r === rol
                ).length;


            const esperado =
                rol === "Coro"
                    ? 3
                    : 1;


            if (
                cantidad !== esperado
            ) {

                console.error(
                    `❌ ${servicio.fecha}: ${rol} tiene ${cantidad}, esperado ${esperado}`
                );

                return;
            }

        }

    }


    // =====================================================
    // 8. VALIDAR JOHAN + SANTIAGO
    // =====================================================

    for (const servicio of servicios) {

        const asignacionesServicio =
            todasLasAsignaciones.filter(
                a =>
                    a.servicio_id ===
                    servicio.id
            );


        const nombres =
            asignacionesServicio.map(
                a => {

                    const persona =
                        integrantes.find(
                            p =>
                                p.id ===
                                a.integrante_id
                        );

                    return persona?.nombre;

                }
            );


        if (
            nombres.includes("Johan Díaz") &&
            nombres.includes("Santiago Mendoza")
        ) {

            console.error(
                "❌ REGLA VIOLADA:",
                servicio.fecha,
                "Johan Díaz y Santiago Mendoza no pueden coincidir."
            );

            return;
        }

    }


    // =====================================================
    // 9. GUARDAR
    // =====================================================

    console.log(
        "✅ Todas las validaciones fueron superadas."
    );

    console.log(
        "Guardando asignaciones..."
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from("asignaciones")
            .insert(
                todasLasAsignaciones
            )
            .select();


    if (error) {

        console.error(
            "❌ Error guardando asignaciones:",
            error
        );

        return;
    }


    // =====================================================
    // 10. RESUMEN
    // =====================================================

    console.log("");
    console.log("=================================");
    console.log("✅ CRONOGRAMA GENERADO");
    console.log("=================================");

    console.log(
        "Servicios:",
        servicios.length
    );

    console.log(
        "Asignaciones:",
        data.length
    );

    console.log("");
    console.log(
        "PARTICIPACIONES:"
    );


    integrantes
        .sort(
            (a, b) =>
                participaciones[b.id] -
                participaciones[a.id]
        )
        .forEach(persona => {

            console.log(
                `${persona.nombre} → ${participaciones[persona.id]}`
            );

        });


    console.log("");
    console.log(
        "================================="
    );

    console.log(
        "🎉 Cronograma listo."
    );

    console.log(
        "================================="

    );
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

// =====================================================
// CARGAR CRONOGRAMA EN PANTALLA
// =====================================================

async function cargarCronograma() {

    const contenedor = document.getElementById("cronograma");
    const estado = document.getElementById("estadoCronograma");

    if (!contenedor) {
        console.error("No se encontró el contenedor del cronograma.");
        return;
    }

    estado.textContent = "Cargando cronograma...";

    // -------------------------------------------------
    // 1. Obtener servicios de octubre 2026
    // -------------------------------------------------

    const { data: servicios, error: errorServicios } =
        await supabaseClient
            .from("servicios")
            .select("*")
            .gte("fecha", "2026-10-01")
            .lte("fecha", "2026-10-31")
            .order("fecha", { ascending: true })
            .order("hora", { ascending: true });

    if (errorServicios) {
        console.error("Error obteniendo servicios:", errorServicios);
        estado.textContent = "❌ Error cargando los servicios.";
        return;
    }

    if (!servicios || servicios.length === 0) {
        estado.textContent = "No hay servicios registrados.";
        contenedor.innerHTML = "";
        return;
    }

    // -------------------------------------------------
    // 2. Obtener asignaciones
    // -------------------------------------------------

    const servicioIds = servicios.map(servicio => servicio.id);

    const { data: asignaciones, error: errorAsignaciones } =
        await supabaseClient
            .from("asignaciones")
            .select(`
                id,
                servicio_id,
                integrante_id,
                rol,
                estado,
                es_principal,
                token_confirmacion,
                integrantes (
                    id,
                    nombre,
                    instrumento,
                    telefono
                )
            `)
            .in("servicio_id", servicioIds);

    if (errorAsignaciones) {
        console.error("Error obteniendo asignaciones:", errorAsignaciones);
        estado.textContent = "❌ Error cargando las asignaciones.";
        return;
    }
    
    // Guardar datos globalmente para la ventana de detalle
    window.serviciosCronograma = servicios;
    window.asignacionesCronograma = asignaciones;
    
    // -------------------------------------------------
    // 3. Construir cronograma
    // -------------------------------------------------

    contenedor.innerHTML = "";

    servicios.forEach(servicio => {

        const asignacionesServicio =
            asignaciones.filter(
                asignacion =>
                    asignacion.servicio_id === servicio.id
            );

        const fecha = new Date(
            servicio.fecha + "T12:00:00"
        );

        const fechaTexto = fecha.toLocaleDateString(
            "es-CO",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );

        const fechaCapitalizada =
            fechaTexto.charAt(0).toUpperCase() +
            fechaTexto.slice(1);

        const horaTexto =
            servicio.hora.substring(0, 5);

        const card =
            document.createElement("article");

        card.className = "servicio-card";

        card.onclick = () => {
            mostrarDetalleServicio(servicio.id);
        };

        // -------------------------------------------------
        // Encabezado
        // -------------------------------------------------

        const cabecera =
            document.createElement("div");

        cabecera.className =
            "servicio-cabecera";

        cabecera.innerHTML = `
            <div class="servicio-fecha">
                ${fechaCapitalizada}
            </div>

            <div class="servicio-hora">
                🕐 ${horaTexto}
            </div>
        `;

        card.appendChild(cabecera);

        // -------------------------------------------------
        // Asignaciones
        // -------------------------------------------------

        const lista =
            document.createElement("div");

        lista.className =
            "asignaciones";

        const ordenRoles = [
            "Batería",
            "Bajo",
            "Guitarra eléctrica",
            "Piano principal",
            "Piano auxiliar",
            "Voz líder",
            "Coro"
        ];

        const emojis = {
            "Batería": "🥁",
            "Bajo": "🎸",
            "Guitarra eléctrica": "🎸",
            "Piano principal": "🎹",
            "Piano auxiliar": "🎹",
            "Voz líder": "🎤",
            "Coro": "🎶"
        };

        ordenRoles.forEach(rol => {

            const asignacionesRol =
                asignacionesServicio.filter(
                    asignacion =>
                        asignacion.rol === rol
                );

            asignacionesRol.forEach(asignacion => {

                const integrante =
                    asignacion.integrantes;

                if (!integrante) return;

                const elemento =
                    document.createElement("div");

                elemento.className =
                    "asignacion";

                elemento.innerHTML = `
                    <span class="asignacion-rol">
                        ${emojis[rol] || ""} ${rol}
                    </span>

                    <span class="asignacion-nombre">
                        ${integrante.nombre}
                    </span>
                `;

                lista.appendChild(elemento);
            });
        });

        card.appendChild(lista);

        contenedor.appendChild(card);
    });

    estado.textContent =
        `✅ ${servicios.length} servicios cargados correctamente.`;
}


// =====================================================
// CARGAR CRONOGRAMA AL ABRIR LA PÁGINA
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        cargarCronograma();
    }
);

// =====================================================
// MOSTRAR DETALLE DEL SERVICIO
// =====================================================

function mostrarDetalleServicio(servicioId) {

    const servicios =
        window.serviciosCronograma || [];

    const asignaciones =
        window.asignacionesCronograma || [];

    const servicio =
        servicios.find(
            s => s.id === servicioId
        );

    if (!servicio) {
        console.error("No se encontró el servicio.");
        return;
    }

    const asignacionesServicio =
        asignaciones.filter(
            a => a.servicio_id === servicioId
        );

    const fecha =
        new Date(
            servicio.fecha + "T12:00:00"
        );

    const fechaTexto =
        fecha.toLocaleDateString(
            "es-CO",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );

    const fechaCapitalizada =
        fechaTexto.charAt(0).toUpperCase() +
        fechaTexto.slice(1);

    const hora =
        servicio.hora.substring(0, 5);

    const emojis = {
        "Batería": "🥁",
        "Bajo": "🎸",
        "Guitarra eléctrica": "🎸",
        "Piano principal": "🎹",
        "Piano auxiliar": "🎹",
        "Voz líder": "🎤",
        "Coro": "🎶"
    };


    // =================================================
    // CONTAR ESTADOS
    // =================================================

    const confirmados =
        asignacionesServicio.filter(
            a => a.estado === "Confirmado"
        ).length;

    const noPueden =
        asignacionesServicio.filter(
            a => a.estado === "No puede"
        ).length;

    const pendientes =
        asignacionesServicio.filter(
            a =>
                !a.estado ||
                a.estado === "Pendiente"
        ).length;


    // =================================================
    // HTML DEL DETALLE
    // =================================================

    const detalle =
        document.getElementById(
            "detalleServicio"
        );


    detalle.innerHTML = `

        <h2 class="detalle-titulo">
            ${fechaCapitalizada}
        </h2>

        <div class="detalle-hora">
            🕐 ${hora}
        </div>


        <!-- ========================================= -->
        <!-- RESUMEN DE CONFIRMACIONES -->
        <!-- ========================================= -->

        <div class="panel-confirmaciones">

            <h3>
                📊 Confirmaciones
            </h3>

            <div class="resumen-confirmaciones">

                <div class="resumen-item confirmado">
                    <strong>
                        ${confirmados}
                    </strong>

                    <span>
                        🟢 Confirmados
                    </span>
                </div>


                <div class="resumen-item pendiente">
                    <strong>
                        ${pendientes}
                    </strong>

                    <span>
                        🟡 Pendientes
                    </span>
                </div>


                <div class="resumen-item no-puede">
                    <strong>
                        ${noPueden}
                    </strong>

                    <span>
                        🔴 No pueden
                    </span>
                </div>

            </div>

        </div>


        <!-- ========================================= -->
        <!-- MÚSICOS -->
        <!-- ========================================= -->

        <div class="detalle-seccion">

            <h3>
                🎵 Músicos
            </h3>

            ${crearDetalleRol(
                asignacionesServicio,
                "Batería",
                emojis
            )}

            ${crearDetalleRol(
                asignacionesServicio,
                "Bajo",
                emojis
            )}

            ${crearDetalleRol(
                asignacionesServicio,
                "Guitarra eléctrica",
                emojis
            )}

            ${crearDetalleRol(
                asignacionesServicio,
                "Piano principal",
                emojis
            )}

            ${crearDetalleRol(
                asignacionesServicio,
                "Piano auxiliar",
                emojis
            )}

        </div>


        <!-- ========================================= -->
        <!-- VOCES -->
        <!-- ========================================= -->

        <div class="detalle-seccion">

            <h3>
                🎤 Voces
            </h3>

            ${crearDetalleRol(
                asignacionesServicio,
                "Voz líder",
                emojis
            )}

            ${crearDetalleRol(
                asignacionesServicio,
                "Coro",
                emojis
            )}

        </div>

    `;


    document
        .getElementById("modalServicio")
        .classList.add("activo");
}

// =====================================================
// CREAR PERSONAS DEL DETALLE
// =====================================================

function crearDetalleRol(
    asignaciones,
    rol,
    emojis
) {

    const lista =
        asignaciones.filter(
            a => a.rol === rol
        );

    if (lista.length === 0) {
        return "";
    }


    return lista.map(asignacion => {

        const nombre =
            asignacion.integrantes?.nombre ||
            "Sin nombre";

        const telefono =
            asignacion.integrantes?.telefono ||
            "";


        // =============================================
        // ESTADO
        // =============================================

        const estado =
            asignacion.estado ||
            "Pendiente";


        let estadoTexto = "Pendiente";
        let estadoClase = "pendiente";
        let estadoIcono = "🟡";


        if (estado === "Confirmado") {

            estadoTexto = "Confirmado";
            estadoClase = "confirmado";
            estadoIcono = "🟢";

        }


        if (estado === "No puede") {

            estadoTexto = "No puede";
            estadoClase = "no-puede";
            estadoIcono = "🔴";

        }


        // =============================================
        // BOTÓN WHATSAPP
        // =============================================

                let botonWhatsApp = "";

        if (estado === "Pendiente") {

            if (telefono) {
        
                if (asignacion.reemplaza_asignacion_id) {
        
                    botonWhatsApp = `
                        <button
                            class="btn-whatsapp"
                            onclick="event.stopPropagation(); enviarWhatsAppReemplazo('${asignacion.id}')"
                        >
                            📲 Avisar al reemplazo
                        </button>`;
        
                } else {
        
                    botonWhatsApp = `
                        <button
                            class="btn-whatsapp"
                            onclick="event.stopPropagation(); enviarWhatsApp('${asignacion.id}')"
                        >
                            📲 Enviar WhatsApp
                        </button>`;
        
                }
        
            } else {
        
                botonWhatsApp = `
                    <span class="telefono-faltante">
                        Sin teléfono registrado
                    </span>`;
        
            }
        
        } else if (estado === "Confirmado") {

            botonWhatsApp = `
                <span class="participacion-confirmada">
                    ✅ Participación confirmada
                </span>
            `;

        } else if (estado === "No puede") {

            botonWhatsApp = `
                <button
                    class="btn-reemplazo"
                    onclick="event.stopPropagation(); abrirReemplazos('${asignacion.id}')"
                >
                    🔄 Buscar reemplazo
                </button>
            `;

        }

        // =============================================
        // HTML
        // =============================================

        return `

            <div class="detalle-persona">

                <div class="detalle-persona-icono">
                    ${emojis[rol] || "🎵"}
                </div>


                <div class="detalle-persona-info">

                    <span class="detalle-persona-rol">
                        ${rol}
                    </span>


                    <span class="detalle-persona-nombre">
                        ${nombre}
                    </span>


                    <span class="estado-asignacion ${estadoClase}">
                        ${estadoIcono}
                        ${estadoTexto}
                    </span>


                    


                    ${botonWhatsApp}

                </div>

            </div>

        `;

    }).join("");
}

async function abrirReemplazos(asignacionId) {

    const asignaciones = window.asignacionesCronograma || [];
    const servicios = window.serviciosCronograma || [];

    const asignacion = asignaciones.find(a => a.id === asignacionId);

    if (!asignacion) {
        alert("No se encontró la asignación.");
        return;
    }

    const servicio = servicios.find(s => s.id === asignacion.servicio_id);

    if (!servicio) {
        alert("No se encontró el servicio.");
        return;
    }

    const detalle = document.getElementById("detalleServicio");

    detalle.innerHTML = `
        <div class="reemplazo-cargando">
            <div class="spinner"></div>
            <h2>🔄 Buscando reemplazos...</h2>
            <p>Verificando disponibilidad y reglas del equipo.</p>
        </div>
    `;

    try {

        // --------------------------------------------------
        // 1. Obtener integrantes activos
        // --------------------------------------------------

        const { data: integrantes, error: errorIntegrantes } =
            await supabaseClient
                .from("integrantes")
                .select(`
                    id,
                    nombre,
                    telefono,
                    instrumento,
                    nivel,
                    puede_ser_lider,
                    activo
                `)
                .eq("activo", true);

        if (errorIntegrantes) {
            throw errorIntegrantes;
        }

        // --------------------------------------------------
        // 2. Obtener disponibilidad del día
        // --------------------------------------------------

        const fecha = new Date(servicio.fecha + "T12:00:00");
        const diaSemana = fecha.getDay();

        const { data: disponibilidades, error: errorDisponibilidad } =
            await supabaseClient
                .from("disponibilidad_integrantes")
                .select(`
                    integrante_id,
                    disponible
                `)
                .eq("dia_semana", diaSemana)
                .eq("disponible", true);

        if (errorDisponibilidad) {
            throw errorDisponibilidad;
        }

        const disponibles = new Set(
            (disponibilidades || []).map(d => d.integrante_id)
        );

        // --------------------------------------------------
        // 3. Obtener todas las asignaciones del servicio
        // --------------------------------------------------

        const asignacionesServicio =
            asignaciones.filter(a => a.servicio_id === servicio.id);

        // Personas que ya están ocupando otro rol
        const personasAsignadas = new Set(
            asignacionesServicio.map(a => a.integrante_id)
        );

        // Personas asignadas EXCEPTO la persona que no puede
        // Esto es importante para evaluar correctamente
        // reglas de reemplazo.
        const otrasAsignaciones = asignacionesServicio.filter(
            a => a.id !== asignacionId
        );

        // --------------------------------------------------
        // 4. Información del rol a reemplazar
        // --------------------------------------------------

        const rol = asignacion.rol;

        // --------------------------------------------------
        // 5. Filtrar candidatos
        // --------------------------------------------------

        let candidatos = integrantes.filter(persona => {

            // Debe estar disponible ese día
            if (!disponibles.has(persona.id)) {
                return false;
            }

            // No puede estar ocupando otro rol en este servicio
            if (personasAsignadas.has(persona.id)) {
                return false;
            }

            // ----------------------------------------------
            // REGLA SEGÚN EL ROL
            // ----------------------------------------------

            if (rol === "Batería") {
                if (persona.instrumento !== "Batería") {
                    return false;
                }
            }

            if (rol === "Bajo") {
                if (persona.instrumento !== "Bajo") {
                    return false;
                }
            }

            if (rol === "Guitarra eléctrica") {
                if (persona.instrumento !== "Guitarra eléctrica") {
                    return false;
                }
            }

            if (rol === "Piano principal") {

                if (persona.instrumento !== "Piano") {
                    return false;
                }

                // Juan José es auxiliar, nunca principal
                if (persona.nombre === "Juan José Restrepo") {
                    return false;
                }

                // Revisamos quién es el líder de ese servicio
                const lider = asignacionesServicio.find(
                    a => a.rol === "Voz líder"
                );

                const nombreLider = lider?.integrantes?.nombre;

                // Si Oscar es líder, Nicol debe tocar piano
                if (nombreLider === "Oscar Julián Díaz") {
                    if (persona.nombre !== "Nicol Pineda") {
                        return false;
                    }
                }

                // Si Nicol es líder, Oscar debe tocar piano
                if (nombreLider === "Nicol Pineda") {
                    if (persona.nombre !== "Oscar Julián Díaz") {
                        return false;
                    }
                }

                // Si Mayerly es líder, cualquiera de los dos
                // principales puede tocar piano
                if (nombreLider === "Mayerly Trujillo") {
                    if (
                        persona.nombre !== "Oscar Julián Díaz" &&
                        persona.nombre !== "Nicol Pineda"
                    ) {
                        return false;
                    }
                }
            }

            if (rol === "Piano auxiliar") {
                if (persona.instrumento !== "Piano") {
                    return false;
                }
            }

            if (rol === "Voz líder") {

                if (!persona.puede_ser_lider) {
                    return false;
                }
            }

            if (rol === "Coro") {

                if (persona.instrumento !== "Coro") {
                    return false;
                }
            }

            // --------------------------------------------------
            // REGLA JOHAN + SANTIAGO
            // --------------------------------------------------

            const nombresOtros = otrasAsignaciones.map(
                a => a.integrantes?.nombre
            );

            if (
                persona.nombre === "Johan Díaz" &&
                nombresOtros.includes("Santiago Mendoza")
            ) {
                return false;
            }

            if (
                persona.nombre === "Santiago Mendoza" &&
                nombresOtros.includes("Johan Díaz")
            ) {
                return false;
            }

            return true;
        });

        // --------------------------------------------------
        // 6. Ordenar: principales primero
        // --------------------------------------------------

        candidatos.sort((a, b) => {

            const nivelA = a.nivel === "Principal" ? 0 : 1;
            const nivelB = b.nivel === "Principal" ? 0 : 1;

            if (nivelA !== nivelB) {
                return nivelA - nivelB;
            }

            return a.nombre.localeCompare(b.nombre);
        });

        window.candidatosReemplazo = candidatos;
        
        // --------------------------------------------------
        // 7. Formatear fecha
        // --------------------------------------------------

        const fechaTexto = fecha.toLocaleDateString(
            "es-CO",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );

        const fechaCapitalizada =
            fechaTexto.charAt(0).toUpperCase() +
            fechaTexto.slice(1);

        const hora = servicio.hora.substring(0, 5);

        // --------------------------------------------------
        // 8. Mostrar candidatos
        // --------------------------------------------------

        detalle.innerHTML = `
            <button
                class="btn-volver-servicio"
                onclick="mostrarDetalleServicio('${servicio.id}')">
                ← Volver al servicio
            </button>

            <div class="reemplazo-header">

                <div class="reemplazo-icono">
                    🔄
                </div>

                <h2>Buscar reemplazo</h2>

                <p>
                    <strong>${obtenerNombreRol(rol)}</strong>
                </p>

                <p>
                    ${fechaCapitalizada} · ${hora}
                </p>

                <p class="reemplazo-original">
                    Reemplazar a:
                    <strong>
                        ${asignacion.integrantes?.nombre || "Sin nombre"}
                    </strong>
                </p>

            </div>

            <div class="candidatos-contenedor">

                <h3>
                    👥 Candidatos disponibles
                    <span class="cantidad-candidatos">
                        ${candidatos.length}
                    </span>
                </h3>

                ${
                    candidatos.length === 0
                    ? `
                        <div class="sin-candidatos">
                            <div>😕</div>
                            <strong>No hay candidatos disponibles</strong>
                            <p>
                                No se encontró ningún integrante que
                                cumpla las reglas para este reemplazo.
                            </p>
                        </div>
                    `
                    : candidatos.map(persona => `
                        <div class="candidato-card">
                    
                            <div class="candidato-icono">
                                ${persona.instrumento === "Batería" ? "🥁" :
                                  persona.instrumento === "Bajo" ? "🎸" :
                                  persona.instrumento === "Guitarra eléctrica" ? "🎸" :
                                  persona.instrumento === "Piano" ? "🎹" :
                                  persona.instrumento === "Coro" ? "🎶" :
                                  persona.puede_ser_lider ? "🎤" : "🎵"}
                            </div>
                    
                            <div class="candidato-info">
                    
                                <strong>
                                    ${persona.nombre}
                                </strong>
                    
                                <span>
                                    ${persona.instrumento || "Sin instrumento"}
                                </span>
                    
                                <span class="candidato-nivel">
                                    ${persona.nivel || "Sin nivel"}
                                </span>
                    
                            </div>
                    
                            <button
                                class="btn-seleccionar-reemplazo"
                                onclick="seleccionarReemplazo(
                                    '${asignacion.id}',
                                    '${persona.id}'
                                )"
                            >
                                Seleccionar
                            </button>
                    
                        </div>
                    `).join("")
                }

            </div>
        `;

    } catch (error) {

        console.error("Error buscando reemplazos:", error);

        detalle.innerHTML = `
            <div class="error-reemplazo">

                <div>❌</div>

                <h2>Error buscando reemplazos</h2>

                <p>
                    No fue posible consultar los candidatos.
                </p>

                <button
                    class="btn-volver-servicio"
                    onclick="mostrarDetalleServicio('${servicio.id}')">
                    ← Volver al servicio
                </button>

            </div>
        `;
    }
}

async function seleccionarReemplazo(asignacionId, integranteId) {

    const asignaciones = window.asignacionesCronograma || [];
    const candidatos = window.candidatosReemplazo || [];

    // --------------------------------------------------
    // 1. Buscar asignación original
    // --------------------------------------------------

    const asignacionOriginal = asignaciones.find(
        a => a.id === asignacionId
    );

    if (!asignacionOriginal) {
        alert("No se encontró la asignación original.");
        return;
    }

    // --------------------------------------------------
    // 2. Buscar candidato
    // --------------------------------------------------

    const candidato = candidatos.find(
        persona => persona.id === integranteId
    );

    if (!candidato) {
        alert("No se encontró el candidato seleccionado.");
        return;
    }

    // --------------------------------------------------
    // 3. Confirmación del administrador
    // --------------------------------------------------

    const nombreOriginal =
        asignacionOriginal.integrantes?.nombre || "la persona asignada";

    const confirmar = confirm(
        `¿Deseas asignar a ${candidato.nombre} como reemplazo de ${nombreOriginal}?`
    );

    if (!confirmar) {
        return;
    }

    // --------------------------------------------------
    // 4. Evitar doble reemplazo
    // --------------------------------------------------

    try {

        const { data: reemplazoExistente, error: errorBusqueda } =
            await supabaseClient
                .from("reemplazos")
                .select("id, estado")
                .eq("asignacion_original_id", asignacionId)
                .in("estado", ["Pendiente", "Asignado", "Aceptado"])
                .maybeSingle();

        if (errorBusqueda) {
            throw errorBusqueda;
        }

        if (reemplazoExistente) {

            alert(
                "Esta asignación ya tiene un reemplazo registrado."
            );

            return;
        }

        // --------------------------------------------------
        // 5. Crear nueva asignación para el reemplazo
        // --------------------------------------------------

        const { data: nuevaAsignacion, error: errorAsignacion } =
            await supabaseClient
                .from("asignaciones")
                .insert({
                    servicio_id: asignacionOriginal.servicio_id,
                    integrante_id: candidato.id,
                    rol: asignacionOriginal.rol,
                    estado: "Pendiente",
                    es_principal: asignacionOriginal.es_principal,
                    reemplaza_asignacion_id: asignacionOriginal.id
                })
                .select(`
                    id,
                    servicio_id,
                    integrante_id,
                    rol,
                    estado,
                    es_principal,
                    token_confirmacion,
                    integrantes (
                        id,
                        nombre,
                        instrumento,
                        telefono
                    )
                `)
                .single();

        if (errorAsignacion) {
            throw errorAsignacion;
        }

        // --------------------------------------------------
        // 6. Registrar el reemplazo
        // --------------------------------------------------

        const { data: nuevoReemplazo, error: errorReemplazo } =
            await supabaseClient
                .from("reemplazos")
                .insert({
                    asignacion_original_id: asignacionOriginal.id,
                    integrante_reemplazo_id: candidato.id,
                    motivo: "Reemplazo solicitado",
                    estado: "Asignado"
                })
                .select()
                .single();

        if (errorReemplazo) {

            // Si falla el registro del reemplazo,
            // eliminamos la nueva asignación para
            // evitar dejar datos incompletos.

            await supabaseClient
                .from("asignaciones")
                .delete()
                .eq("id", nuevaAsignacion.id);

            throw errorReemplazo;
        }

        // --------------------------------------------------
        // 7. Actualizar la asignación original
        // --------------------------------------------------

        const { error: errorOriginal } =
            await supabaseClient
                .from("asignaciones")
                .update({
                    estado: "Reemplazado"
                })
                .eq("id", asignacionOriginal.id);

        if (errorOriginal) {

            // Si falla, intentamos limpiar el reemplazo
            // que acabamos de crear.

            await supabaseClient
                .from("reemplazos")
                .delete()
                .eq("id", nuevoReemplazo.id);

            await supabaseClient
                .from("asignaciones")
                .delete()
                .eq("id", nuevaAsignacion.id);

            throw errorOriginal;
        }

        // --------------------------------------------------
        // 8. Actualizar datos locales
        // --------------------------------------------------

        asignacionOriginal.estado = "Reemplazado";

        asignaciones.push(nuevaAsignacion);

        window.asignacionesCronograma = asignaciones;

        // --------------------------------------------------
        // 9. Mostrar resultado
        // --------------------------------------------------

        alert(
            `✅ Reemplazo registrado correctamente.\n\n` +
            `${candidato.nombre} ha sido asignado como reemplazo de ${nombreOriginal}.\n\n` +
            `Estado: Pendiente de confirmación.`
        );

        // Volver automáticamente al detalle del servicio
        mostrarDetalleServicio(asignacionOriginal.servicio_id);

    } catch (error) {

        console.error(
            "Error registrando reemplazo:",
            error
        );

        alert(
            "❌ No fue posible registrar el reemplazo.\n\n" +
            "Revisa la consola para conocer el error."
        );
    }
}
function encontrarIntegranteEnCronograma(integranteId) {

    const asignaciones = window.asignacionesCronograma || [];

    for (const asignacion of asignaciones) {

        if (
            asignacion.integrante_id === integranteId &&
            asignacion.integrantes
        ) {
            return asignacion.integrantes;
        }

    }

    return null;
}
// =====================================================
// CERRAR DETALLE
// =====================================================

function cerrarDetalleServicio() {

    document
        .getElementById("modalServicio")
        .classList.remove("activo");
}


// =====================================================
// CERRAR AL HACER CLICK FUERA
// =====================================================

document.addEventListener(
    "click",
    function(event) {

        const modal =
            document.getElementById(
                "modalServicio"
            );

        if (
            event.target === modal
        ) {
            cerrarDetalleServicio();
        }

    }
);

// =====================================================
// ENVIAR WHATSAPP
// =====================================================
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

function enviarWhatsApp(asignacionId) {

    const asignaciones =
        window.asignacionesCronograma || [];

    const servicios =
        window.serviciosCronograma || [];


    const asignacion =
        asignaciones.find(
            a => a.id === asignacionId
        );


    if (!asignacion) {

        alert(
            "No se encontró la asignación."
        );

        return;
    }


    const integrante =
        asignacion.integrantes;


    if (!integrante) {

        alert(
            "No se encontró el integrante."
        );

        return;
    }


    const telefono =
        integrante.telefono;


    if (!telefono) {

        alert(
            `No hay teléfono registrado para ${integrante.nombre}.`
        );

        return;
    }


    const servicio =
        servicios.find(
            s => s.id === asignacion.servicio_id
        );


    if (!servicio) {

        alert(
            "No se encontró el servicio."
        );

        return;
    }


    // -------------------------------------------------
    // FORMATEAR TELÉFONO
    // -------------------------------------------------

    let numero =
        String(telefono)
            .replace(/\D/g, "");


    // Si está como 3001234567
    if (numero.length === 10) {

        numero =
            "57" + numero;

    }


    // Si ya está como 573001234567
    // se deja igual.


    // -------------------------------------------------
    // FECHA
    // -------------------------------------------------

    const fecha =
        new Date(
            servicio.fecha +
            "T12:00:00"
        );


    const fechaTexto =
        fecha.toLocaleDateString(
            "es-CO",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );


    const fechaCapitalizada =
        fechaTexto
            .charAt(0)
            .toUpperCase() +
        fechaTexto.slice(1);


    const hora =
        servicio.hora.substring(
            0,
            5
        );


    // -------------------------------------------------
    // ENLACE PERSONALIZADO
    // -------------------------------------------------

    const enlaceConfirmacion =
        new URL(
            "confirmacion.html",
            window.location.href
        ).href +
        "?token=" +
        asignacion.token_confirmacion;


    // -------------------------------------------------
    // MENSAJE
    // -------------------------------------------------

    const mensaje =

`🎶 *ALABANZA IPUC LÍBANO CENTRAL*

Hola ${integrante.nombre}.

Has sido asignado para el servicio:

📅 *${fechaCapitalizada}*
🕐 *${hora}*

🎵 *Tu asignación:*
${obtenerNombreRol(asignacion.rol)}

Por favor confirma tu participación en el siguiente enlace:

👉 ${enlaceConfirmacion}

¡Dios te bendiga! 🙏`;


    // -------------------------------------------------
    // ABRIR WHATSAPP
    // -------------------------------------------------

    const urlWhatsApp =
        "https://wa.me/" +
        numero +
        "?text=" +
        encodeURIComponent(mensaje);


    window.open(
        urlWhatsApp,
        "_blank"
    );
}

async function enviarWhatsAppReemplazo(asignacionId) {

    try {

        // --------------------------------------------------
        // 1. Buscar la asignación del reemplazo
        // --------------------------------------------------

        const { data: asignacion, error: errorAsignacion } =
            await supabaseClient
                .from("asignaciones")
                .select(`
                    id,
                    servicio_id,
                    integrante_id,
                    rol,
                    estado,
                    token_confirmacion,
                    reemplaza_asignacion_id,
                    integrantes (
                        id,
                        nombre,
                        telefono
                    ),
                    servicios (
                        id,
                        fecha,
                        hora,
                        tipo
                    )
                `)
                .eq("id", asignacionId)
                .single();

        if (errorAsignacion) {
            throw errorAsignacion;
        }

        if (!asignacion) {
            alert("No se encontró la asignación del reemplazo.");
            return;
        }

        // --------------------------------------------------
        // 2. Buscar asignación original
        // --------------------------------------------------

        if (!asignacion.reemplaza_asignacion_id) {
            alert("Esta asignación no corresponde a un reemplazo.");
            return;
        }

        const { data: original, error: errorOriginal } =
            await supabaseClient
                .from("asignaciones")
                .select(`
                    id,
                    integrantes (
                        id,
                        nombre
                    )
                `)
                .eq("id", asignacion.reemplaza_asignacion_id)
                .single();

        if (errorOriginal) {
            throw errorOriginal;
        }

        // --------------------------------------------------
        // 3. Datos
        // --------------------------------------------------

        const nombreReemplazo =
            asignacion.integrantes?.nombre || "hermano(a)";

        const telefono =
            asignacion.integrantes?.telefono || "";

        const nombreOriginal =
            original?.integrantes?.nombre || "el integrante asignado";

        const servicio = asignacion.servicios;

        if (!telefono) {
            alert(
                `${nombreReemplazo} no tiene un número de teléfono registrado.`
            );
            return;
        }

        if (!servicio) {
            alert("No se encontró la información del servicio.");
            return;
        }

        if (!asignacion.token_confirmacion) {
            alert("Esta asignación no tiene token de confirmación.");
            return;
        }

        // --------------------------------------------------
        // 4. Formatear teléfono
        // --------------------------------------------------

        let numero = telefono.replace(/\D/g, "");

        if (numero.startsWith("57")) {
            // Ya tiene código de Colombia
        } else if (numero.length === 10) {
            numero = "57" + numero;
        }

        // --------------------------------------------------
        // 5. Formatear fecha
        // --------------------------------------------------

        const fecha = new Date(
            servicio.fecha + "T12:00:00"
        );

        const fechaTexto = fecha.toLocaleDateString(
            "es-CO",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );

        const fechaCapitalizada =
            fechaTexto.charAt(0).toUpperCase() +
            fechaTexto.slice(1);

        const hora = servicio.hora.substring(0, 5);

        // --------------------------------------------------
        // 6. Crear enlace personal
        // --------------------------------------------------

        const urlConfirmacion =
            `${window.location.origin}/confirmacion.html?token=${asignacion.token_confirmacion}`;

        // --------------------------------------------------
        // 7. Crear mensaje
        // --------------------------------------------------

        const mensaje =
`🎵 *IPUC Líbano Central*

Hola ${nombreReemplazo} 👋

Has sido propuesto(a) como *reemplazo* para nuestro próximo servicio.

📅 ${fechaCapitalizada}
🕐 ${hora}
🎶 Rol: ${obtenerNombreRol(asignacion.rol)}

👤 Reemplazas a: ${nombreOriginal}

Por favor confirma tu participación aquí:

${urlConfirmacion}

Puedes indicar si:

✅ CONFIRMAS tu participación
❌ NO PUEDES participar

Dios te bendiga 🙏`;

        // --------------------------------------------------
        // 8. Abrir WhatsApp
        // --------------------------------------------------

        const urlWhatsApp =
            `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

        window.open(
            urlWhatsApp,
            "_blank"
        );

    } catch (error) {

        console.error(
            "Error enviando WhatsApp al reemplazo:",
            error
        );

        alert(
            "❌ No fue posible preparar el mensaje de WhatsApp."
        );
    }
}
