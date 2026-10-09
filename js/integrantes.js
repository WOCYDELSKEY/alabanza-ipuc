(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const campos = ["integranteId", "nombre", "telefono", "instrumento", "nivel", "puedeSerLider", "activo"];
  let integrantes = [];
  let cargando = false;

  function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function mensaje(texto, tipo = "") {
    const el = $("mensajeEstado"); el.textContent = texto; el.className = `mensaje-estado ${tipo}`.trim();
  }
  function abrirModal(persona = null) {
    $("formIntegrante").reset();
    $("integranteId").value = persona?.id ?? "";
    $("nombre").value = persona?.nombre ?? "";
    $("telefono").value = persona?.telefono ?? "";
    $("instrumento").value = persona?.instrumento ?? "";
    $("nivel").value = persona?.nivel ?? "";
    $("puedeSerLider").checked = Boolean(persona?.puede_ser_lider);
    $("activo").checked = persona ? Boolean(persona.activo) : true;
    $("tituloModalIntegrante").textContent = persona ? "Editar integrante" : "Nuevo integrante";
    $("guardarIntegrante").textContent = persona ? "Guardar cambios" : "Guardar integrante";
    $("modalIntegrante").classList.add("abierto");
    $("modalIntegrante").setAttribute("aria-hidden", "false");
    setTimeout(() => $("nombre").focus(), 50);
  }
  function cerrarModal() {
    $("modalIntegrante").classList.remove("abierto");
    $("modalIntegrante").setAttribute("aria-hidden", "true");
  }
  function actualizarResumen() {
    $("totalIntegrantes").textContent = integrantes.length;
    $("totalActivos").textContent = integrantes.filter(p => p.activo).length;
    $("totalInactivos").textContent = integrantes.filter(p => !p.activo).length;
  }
  function renderizar() {
    const busqueda = $("buscarIntegrante").value.trim().toLocaleLowerCase("es");
    const estado = $("filtroEstado").value;
    const filtrados = integrantes.filter(p => {
      const texto = `${p.nombre ?? ""} ${p.telefono ?? ""} ${p.instrumento ?? ""} ${p.nivel ?? ""}`.toLocaleLowerCase("es");
      return texto.includes(busqueda) && (estado === "todos" || (estado === "activos" && p.activo) || (estado === "inactivos" && !p.activo));
    });
    const tbody = $("listaIntegrantes");
    if (!filtrados.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="tabla-vacia">${integrantes.length ? "No hay integrantes que coincidan con la búsqueda." : "Todavía no hay integrantes registrados."}</td></tr>`;
      return;
    }
    tbody.innerHTML = filtrados.map(p => `
      <tr>
        <td><div class="persona-nombre">${escapar(p.nombre || "Sin nombre")}</div><div class="persona-telefono">${escapar(p.telefono || "Sin teléfono registrado")}</div></td>
        <td>${escapar(p.instrumento || "Sin especificar")}</td>
        <td>${escapar(p.nivel || "Sin especificar")}</td>
        <td><span class="etiqueta ${p.puede_ser_lider ? "etiqueta-lider" : "etiqueta-normal"}">${p.puede_ser_lider ? "Sí" : "No"}</span></td>
        <td><span class="etiqueta ${p.activo ? "etiqueta-activo" : "etiqueta-inactivo"}">${p.activo ? "Activo" : "Inactivo"}</span></td>
        <td><div class="acciones-tabla"><button class="btn-tabla btn-editar" data-editar="${escapar(p.id)}">Editar</button><button class="btn-tabla btn-estado" data-estado="${escapar(p.id)}">${p.activo ? "Desactivar" : "Activar"}</button></div></td>
      </tr>`).join("");
  }
  async function cargarIntegrantes(mostrarMensaje = true) {
    if (cargando) return;
    cargando = true;
    if (mostrarMensaje) mensaje("Cargando integrantes…");
    try {
      const { data, error } = await supabaseClient.from("integrantes")
        .select("id, nombre, telefono, instrumento, nivel, puede_ser_lider, activo")
        .order("nombre", { ascending: true });
      if (error) throw error;
      integrantes = data || [];
      actualizarResumen(); renderizar();
      mensaje(`Se cargaron ${integrantes.length} integrantes.`, "exito");
    } catch (error) {
      console.error("Error cargando integrantes:", error);
      mensaje(`No fue posible cargar los integrantes. ${error.message || "Revisa la conexión y las políticas de Supabase."}`, "error");
    } finally { cargando = false; }
  }
  async function guardar(evento) {
    evento.preventDefault();
    const id = $("integranteId").value;
    const nombre = $("nombre").value.trim();
    if (!nombre) { mensaje("Escribe el nombre del integrante.", "error"); $("nombre").focus(); return; }
    const payload = {
      nombre,
      telefono: $("telefono").value.trim() || null,
      instrumento: $("instrumento").value || null,
      nivel: $("nivel").value || null,
      puede_ser_lider: $("puedeSerLider").checked,
      activo: $("activo").checked
    };
    const btn = $("guardarIntegrante"); btn.disabled = true; btn.textContent = "Guardando…";
    try {
      let error;
      if (id) {
        ({ error } = await supabaseClient.from("integrantes").update(payload).eq("id", id));
      } else {
        ({ error } = await supabaseClient.from("integrantes").insert(payload));
      }
      if (error) throw error;
      cerrarModal();
      await cargarIntegrantes(false);
      mensaje(id ? "Los datos del integrante fueron actualizados." : "El integrante fue registrado correctamente.", "exito");
    } catch (error) {
      console.error("Error guardando integrante:", error);
      mensaje(`No se pudieron guardar los cambios. ${error.message || "Verifica las políticas de Supabase."}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = $("integranteId").value ? "Guardar cambios" : "Guardar integrante";
    }
  }
  async function alternarEstado(id) {
    const persona = integrantes.find(p => String(p.id) === String(id));
    if (!persona) return;
    const nuevoEstado = !persona.activo;
    const accion = nuevoEstado ? "activar" : "desactivar";
    if (!confirm(`¿Seguro que deseas ${accion} a ${persona.nombre}? ${nuevoEstado ? "Podrá considerarse para nuevas asignaciones." : "No debería considerarse para nuevas asignaciones."}`)) return;
    try {
      const { error } = await supabaseClient.from("integrantes").update({ activo: nuevoEstado }).eq("id", id);
      if (error) throw error;
      await cargarIntegrantes(false);
      mensaje(`${persona.nombre} quedó ${nuevoEstado ? "activo" : "inactivo"}.`, "exito");
    } catch (error) {
      console.error("Error cambiando estado:", error);
      mensaje(`No se pudo cambiar el estado. ${error.message || "Verifica las políticas de Supabase."}`, "error");
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("btnNuevo").addEventListener("click", () => abrirModal());
    $("cerrarModal").addEventListener("click", cerrarModal);
    $("cancelarModal").addEventListener("click", cerrarModal);
    $("formIntegrante").addEventListener("submit", guardar);
    $("buscarIntegrante").addEventListener("input", renderizar);
    $("filtroEstado").addEventListener("change", renderizar);
    $("listaIntegrantes").addEventListener("click", event => {
      const editar = event.target.closest("[data-editar]");
      const estado = event.target.closest("[data-estado]");
      if (editar) { const p = integrantes.find(x => String(x.id) === editar.dataset.editar); if (p) abrirModal(p); }
      if (estado) alternarEstado(estado.dataset.estado);
    });
    $("modalIntegrante").addEventListener("click", event => { if (event.target === $("modalIntegrante")) cerrarModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") cerrarModal(); });
    cargarIntegrantes();
  });
  // Soporte del menú móvil compartido con las demás páginas.
  window.toggleMenu = function () { document.getElementById("sidebar")?.classList.toggle("abierto"); document.getElementById("menuOverlay")?.classList.toggle("activo"); };
  window.cerrarMenu = function () { document.getElementById("sidebar")?.classList.remove("abierto"); document.getElementById("menuOverlay")?.classList.remove("activo"); };
})();
