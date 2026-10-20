(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const estado = { reglas: [], integrantes: [] };
  const tipos = {
    sin_roles_duplicados: { titulo: 'Sin roles duplicados', descripcion: 'Impide asignar más de una función a la misma persona en un servicio.', icono: '🧩', global: true },
    lider_no_puede_tocar_piano: { titulo: 'Voz líder no toca piano', descripcion: 'Evita asignar piano principal o auxiliar a quien también sirve como voz líder.', icono: '🎤', global: true },
    personas_no_pueden_coincidir: { titulo: 'Integrantes que no deben coincidir', descripcion: 'Impide que dos integrantes específicos sean asignados al mismo servicio.', icono: '🚫', global: false }
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nombreIntegrante = (id) => estado.integrantes.find(p => String(p.id) === String(id))?.nombre || 'Integrante no disponible';
  function mensaje(texto, tipo = '') { const el = $('mensajeReglas'); el.textContent = texto; el.className = `mensaje-reglas ${tipo}`.trim(); }
  function completarSelect(select, selected = '') {
    const opciones = estado.integrantes.map(p => `<option value="${escapeHtml(p.id)}" ${String(p.id) === String(selected) ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('');
    select.innerHTML = '<option value="">Selecciona integrante…</option>' + opciones;
  }
  function resumen() {
    const activas = estado.reglas.filter(r => r.activa === true).length;
    $('totalReglas').textContent = estado.reglas.length;
    $('totalReglasActivas').textContent = activas;
    $('totalReglasInactivas').textContent = estado.reglas.length - activas;
  }
  function descripcionRegla(regla) {
    const tipo = tipos[regla.tipo];
    if (!tipo) return `Tipo de regla: ${regla.tipo || 'sin tipo reconocido'}. Se puede activar o desactivar, pero esta interfaz no modifica su configuración.`;
    if (regla.tipo === 'personas_no_pueden_coincidir') return `${nombreIntegrante(regla.configuracion?.integrante_1)} no debe coincidir con ${nombreIntegrante(regla.configuracion?.integrante_2)}.`;
    return tipo.descripcion;
  }
  function render() {
    resumen();
    const q = ($('buscarRegla').value || '').trim().toLocaleLowerCase('es');
    const reglas = [...estado.reglas].sort((a,b) => Number(b.activa === true) - Number(a.activa === true) || (tipos[a.tipo]?.titulo || a.tipo).localeCompare(tipos[b.tipo]?.titulo || b.tipo, 'es'));
    const filtradas = reglas.filter(r => `${tipos[r.tipo]?.titulo || r.tipo} ${descripcionRegla(r)}`.toLocaleLowerCase('es').includes(q));
    if (!filtradas.length) {
      $('listaReglas').innerHTML = `<div class="regla-vacia">${estado.reglas.length ? 'No hay reglas que coincidan con la búsqueda.' : 'No se encontraron reglas en la tabla reglas_asignacion.'}</div>`;
      return;
    }
    $('listaReglas').innerHTML = filtradas.map(r => {
      const meta = tipos[r.tipo] || {titulo:r.tipo || 'Regla sin tipo', icono:'⚙️'};
      const pair = r.tipo === 'personas_no_pueden_coincidir';
      const uno = r.configuracion?.integrante_1 ?? '';
      const dos = r.configuracion?.integrante_2 ?? '';
      return `<article class="regla-item" data-rule-id="${escapeHtml(r.id)}">
        <div class="regla-item-cabecera"><div class="regla-item-titulo"><span class="regla-item-icono">${meta.icono || '⚙️'}</span><div><h3>${escapeHtml(meta.titulo || r.tipo)}</h3><p class="regla-item-descripcion">${escapeHtml(descripcionRegla(r))}</p></div></div><span class="regla-estado ${r.activa === true ? 'activa' : 'inactiva'}">${r.activa === true ? '● Activa' : '○ Inactiva'}</span></div>
        ${pair ? `<div class="regla-item-pareja"><label class="regla-edicion">Primer integrante<select data-pair="uno"><option value="">Selecciona…</option>${estado.integrantes.map(p => `<option value="${escapeHtml(p.id)}" ${String(p.id)===String(uno)?'selected':''}>${escapeHtml(p.nombre)}</option>`).join('')}</select></label><label class="regla-edicion">Segundo integrante<select data-pair="dos"><option value="">Selecciona…</option>${estado.integrantes.map(p => `<option value="${escapeHtml(p.id)}" ${String(p.id)===String(dos)?'selected':''}>${escapeHtml(p.nombre)}</option>`).join('')}</select></label></div>` : ''}
        <div class="regla-acciones"><label class="regla-switch-label"><input type="checkbox" data-action="toggle" ${r.activa === true ? 'checked' : ''}> Regla activa</label>${pair ? '<button type="button" class="reglas-btn reglas-btn-secundario" data-action="guardar-pareja">Guardar integrantes</button>' : ''}</div>
      </article>`;
    }).join('');
  }
  async function cargar() {
    $('btnActualizarReglas').disabled = true;
    mensaje('Cargando reglas e integrantes…');
    try {
      const [rr, ir] = await Promise.all([
        supabaseClient.from('reglas_asignacion').select('*'),
        supabaseClient.from('integrantes').select('id,nombre,activo').order('nombre', {ascending:true})
      ]);
      if (rr.error) throw new Error(`No se pudieron consultar las reglas: ${rr.error.message}`);
      if (ir.error) throw new Error(`No se pudieron consultar los integrantes: ${ir.error.message}`);
      estado.reglas = rr.data || [];
      estado.integrantes = (ir.data || []).filter(p => p.activo !== false);
      completarSelect($('integranteUno'));
      completarSelect($('integranteDos'));
      render();
      mensaje(`Datos actualizados. Se encontraron ${estado.reglas.length} reglas y ${estado.integrantes.length} integrantes activos.`, 'exito');
    } catch (e) {
      console.error('Error cargando reglas:', e);
      mensaje(e.message || 'Ocurrió un error al cargar las reglas.', 'error');
      $('listaReglas').innerHTML = '<div class="regla-vacia">No fue posible cargar los datos. Comprueba la conexión y los permisos de Supabase.</div>';
    } finally { $('btnActualizarReglas').disabled = false; }
  }
  async function cambiarActiva(id, activa, input) {
    input.disabled = true;
    const { error } = await supabaseClient.from('reglas_asignacion').update({ activa }).eq('id', id);
    if (error) {
      mensaje(`No se pudo cambiar el estado de la regla: ${error.message}`, 'error');
      input.checked = !activa;
    } else {
      mensaje(`Regla ${activa ? 'activada' : 'desactivada'}. El cambio se aplicará a las próximas generaciones del cronograma.`, 'exito');
      await cargar();
    }
    input.disabled = false;
  }
  async function guardarPareja(card) {
    const id = card.dataset.ruleId;
    const uno = card.querySelector('[data-pair="uno"]').value;
    const dos = card.querySelector('[data-pair="dos"]').value;
    if (!uno || !dos) return mensaje('Selecciona ambos integrantes antes de guardar.', 'error');
    if (uno === dos) return mensaje('Selecciona dos integrantes diferentes.', 'error');
    const otra = estado.reglas.find(r => r.tipo === 'personas_no_pueden_coincidir' && String(r.id) !== String(id) && ((String(r.configuracion?.integrante_1) === uno && String(r.configuracion?.integrante_2) === dos) || (String(r.configuracion?.integrante_1) === dos && String(r.configuracion?.integrante_2) === uno)));
    if (otra) return mensaje('Ya existe una regla para esa pareja de integrantes.', 'error');
    const button = card.querySelector('[data-action="guardar-pareja"]'); button.disabled = true;
    const nombreRegla = `No coincidir: ${nombreIntegrante(uno)} y ${nombreIntegrante(dos)}`;
    const { error } = await supabaseClient.from('reglas_asignacion').update({ nombre: nombreRegla, configuracion: { integrante_1: uno, integrante_2: dos } }).eq('id', id);
    if (error) { mensaje(`No se pudo guardar la pareja: ${error.message}`, 'error'); button.disabled = false; return; }
    mensaje('Restricción actualizada correctamente.', 'exito'); await cargar();
  }
  async function crearPareja(event) {
    event.preventDefault();
    const uno = $('integranteUno').value; const dos = $('integranteDos').value;
    if (!uno || !dos) return mensaje('Selecciona ambos integrantes.', 'error');
    if (uno === dos) return mensaje('La restricción necesita dos integrantes diferentes.', 'error');
    const existe = estado.reglas.some(r => r.tipo === 'personas_no_pueden_coincidir' && ((String(r.configuracion?.integrante_1) === uno && String(r.configuracion?.integrante_2) === dos) || (String(r.configuracion?.integrante_1) === dos && String(r.configuracion?.integrante_2) === uno)));
    if (existe) return mensaje('Esa restricción ya está registrada.', 'error');
    const button = $('btnCrearRegla'); button.disabled = true;
    const nombreRegla = `No coincidir: ${nombreIntegrante(uno)} y ${nombreIntegrante(dos)}`;
    const { error } = await supabaseClient.from('reglas_asignacion').insert({ nombre: nombreRegla, tipo: 'personas_no_pueden_coincidir', configuracion: { integrante_1: uno, integrante_2: dos }, activa: true });
    if (error) { mensaje(`No se pudo crear la regla: ${error.message}. No se modificó ningún cronograma.`, 'error'); button.disabled = false; return; }
    $('formNuevaRegla').reset(); mensaje('Restricción creada y activada. Se aplicará al generar nuevos cronogramas.', 'exito'); await cargar(); button.disabled = false;
  }
  $('btnActualizarReglas').addEventListener('click', cargar);
  $('buscarRegla').addEventListener('input', render);
  $('formNuevaRegla').addEventListener('submit', crearPareja);
  $('listaReglas').addEventListener('change', e => { const input = e.target.closest('[data-action="toggle"]'); if (!input) return; const card = input.closest('[data-rule-id]'); cambiarActiva(card.dataset.ruleId, input.checked, input); });
  $('listaReglas').addEventListener('click', e => { const button = e.target.closest('[data-action="guardar-pareja"]'); if (button) guardarPareja(button.closest('[data-rule-id]')); });
  const sidebar = $('sidebar'); const overlay = $('menuOverlayReglas');
  $('btnMenuReglas').addEventListener('click', () => { sidebar.classList.toggle('abierto'); overlay.classList.toggle('activo'); });
  overlay.addEventListener('click', () => { sidebar.classList.remove('abierto'); overlay.classList.remove('activo'); });
  cargar();
})();
