const $cal = id => document.getElementById(id);
let serviciosCalendario = [];
let asignacionesCalendario = [];
let mesConsultadoCalendario = '';

function escaparCalendario(valor) { return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function horaCalendario(hora) { return String(hora || '').slice(0,5); }
function fechaTextoCalendario(fecha, conAnio=true) { return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',...(conAnio?{year:'numeric'}:{})}); }
function mensajeCalendario(texto, error=false) { const el=$cal('mensajeCalendario');el.textContent=texto;el.classList.toggle('error',error); }
function claveMesCalendario(fecha) { return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`; }
function cambiarMesCalendario(delta) { const campo=$cal('mesCalendario');const [y,m]=campo.value.split('-').map(Number);const d=new Date(y,m-1+delta,1,12);campo.value=claveMesCalendario(d);cargarCalendario(); }

async function cargarCalendario() {
  const mes=$cal('mesCalendario').value;
  if(!/^\d{4}-\d{2}$/.test(mes)){mensajeCalendario('Selecciona un mes válido.',true);return;}
  mesConsultadoCalendario=mes;mensajeCalendario('Cargando servicios y asignaciones…');
  $cal('rejillaCalendario').innerHTML='<p class="calendario-vacio">Cargando calendario…</p>';
  const [y,m]=mes.split('-').map(Number);const desde=`${mes}-01`;const hasta=`${mes}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  const {data:servicios,error}=await supabaseClient.from('servicios').select('*').gte('fecha',desde).lte('fecha',hasta).order('fecha',{ascending:true}).order('hora',{ascending:true});
  if(error){console.error(error);serviciosCalendario=[];asignacionesCalendario=[];mensajeCalendario(`No se pudieron cargar los servicios: ${error.message}`,true);$cal('rejillaCalendario').innerHTML='<p class="calendario-vacio">No fue posible cargar el calendario. Revisa la conexión y los permisos.</p>';actualizarResumenCalendario();return;}
  serviciosCalendario=servicios||[];
  const ids=serviciosCalendario.map(s=>s.id);
  if(ids.length){const r=await supabaseClient.from('asignaciones').select('id,servicio_id,integrante_id,rol,estado,integrantes(id,nombre,instrumento)').in('servicio_id',ids);if(r.error){console.error(r.error);asignacionesCalendario=[];mensajeCalendario(`Servicios cargados, pero fallaron las asignaciones: ${r.error.message}`,true);}else{asignacionesCalendario=r.data||[];mensajeCalendario('Calendario actualizado. Selecciona un servicio para consultar sus integrantes.');}}
  else {asignacionesCalendario=[];mensajeCalendario('No hay servicios registrados para este mes. Puedes crearlos desde el módulo Servicios.');}
  renderizarCalendario();actualizarResumenCalendario();
}
function actualizarResumenCalendario(){const visibles=serviciosCalendario.filter(s=>$cal('mostrarInactivos').checked||s.activo!==false);const conAsig=new Set(asignacionesCalendario.map(a=>String(a.servicio_id)));$cal('totalServiciosMes').textContent=visibles.length;$cal('serviciosAsignadosMes').textContent=visibles.filter(s=>conAsig.has(String(s.id))).length;$cal('serviciosPendientesMes').textContent=visibles.filter(s=>!conAsig.has(String(s.id))).length;}
function renderizarCalendario(){
  const [y,m]=mesConsultadoCalendario.split('-').map(Number);const primero=new Date(y,m-1,1,12);const dias=new Date(y,m,0).getDate();
  $cal('tituloMesCalendario').textContent=primero.toLocaleDateString('es-CO',{month:'long',year:'numeric'});
  const hoy=new Date();const hoyClave=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  const mostrarInactivos=$cal('mostrarInactivos').checked;const porFecha={};
  serviciosCalendario.filter(s=>mostrarInactivos||s.activo!==false).forEach(s=>(porFecha[s.fecha]??=[]).push(s));
  const celdas=[];for(let i=0;i<primero.getDay();i++)celdas.push('<div class="dia-calendario vacio" aria-hidden="true"></div>');
  for(let d=1;d<=dias;d++){const fecha=`${mesConsultadoCalendario}-${String(d).padStart(2,'0')}`;const servicios=porFecha[fecha]||[];const hoyClass=fecha===hoyClave?' dia-hoy':'';const tarjetas=servicios.map(s=>{const asignaciones=asignacionesCalendario.filter(a=>String(a.servicio_id)===String(s.id));const activo=s.activo!==false;const sin=!asignaciones.length;const etiqueta=s.tipo||'Servicio';return `<button type="button" class="servicio-mini ${activo?'':'inactivo'} ${sin?'sin-asignaciones':''}" data-servicio-id="${escaparCalendario(s.id)}" aria-label="Ver ${escaparCalendario(etiqueta)} del ${escaparCalendario(fecha)} a las ${escaparCalendario(horaCalendario(s.hora))}"><strong>${escaparCalendario(horaCalendario(s.hora))} · ${escaparCalendario(etiqueta)}</strong><span>${asignaciones.length} asignación(es)${activo?'':' · Inactivo'}</span></button>`;}).join('');celdas.push(`<div class="dia-calendario${hoyClass}"><div class="numero-dia">${d}</div>${tarjetas}</div>`);}
  $cal('rejillaCalendario').innerHTML=celdas.join('');$cal('rejillaCalendario').querySelectorAll('[data-servicio-id]').forEach(b=>b.addEventListener('click',()=>abrirDetalleCalendario(b.dataset.servicioId)));
}
function abrirDetalleCalendario(id){const servicio=serviciosCalendario.find(s=>String(s.id)===String(id));if(!servicio)return;const asignaciones=asignacionesCalendario.filter(a=>String(a.servicio_id)===String(servicio.id)).sort((a,b)=>String(a.rol||'').localeCompare(String(b.rol||''),'es'));const activo=servicio.activo!==false;const grupos=asignaciones.length?`<div class="asignaciones-calendario">${asignaciones.map(a=>`<div class="asignacion-calendario"><span>${escaparCalendario(a.rol||'Rol sin especificar')}</span><strong>${escaparCalendario(a.integrantes?.nombre||'Integrante no disponible')}</strong></div>`).join('')}</div>`:'<div class="sin-asignaciones-calendario">Este servicio todavía no tiene asignaciones registradas.</div>';$cal('contenidoDetalleCalendario').innerHTML=`<h2 class="detalle-calendario-titulo">${escaparCalendario(servicio.tipo||'Servicio')}</h2><p class="detalle-calendario-subtitulo">${escaparCalendario(fechaTextoCalendario(servicio.fecha))} · ${escaparCalendario(horaCalendario(servicio.hora))}</p><div class="detalle-calendario-meta"><span class="badge-calendario ${activo?'':'inactivo'}">${activo?'Activo':'Inactivo'}</span><span>${asignaciones.length} asignación(es)</span></div><h3>Equipo asignado</h3><div style="margin-top:10px">${grupos}</div>`;$cal('modalDetalleCalendario').classList.add('abierto');document.body.style.overflow='hidden';}
function cerrarDetalleCalendario(){$cal('modalDetalleCalendario').classList.remove('abierto');document.body.style.overflow='';}
function toggleMenuCalendario(){$cal('sidebar').classList.toggle('abierto');$cal('menuOverlayCalendario').classList.toggle('activo');}
function cerrarMenuCalendario(){$cal('sidebar').classList.remove('abierto');$cal('menuOverlayCalendario').classList.remove('activo');}
document.addEventListener('DOMContentLoaded',()=>{const ahora=new Date();$cal('mesCalendario').value=claveMesCalendario(ahora);$cal('btnActualizarCalendario').addEventListener('click',cargarCalendario);$cal('mesCalendario').addEventListener('change',cargarCalendario);$cal('mostrarInactivos').addEventListener('change',()=>{renderizarCalendario();actualizarResumenCalendario();});$cal('mesAnterior').addEventListener('click',()=>cambiarMesCalendario(-1));$cal('mesSiguiente').addEventListener('click',()=>cambiarMesCalendario(1));$cal('btnMenuCalendario').addEventListener('click',toggleMenuCalendario);$cal('menuOverlayCalendario').addEventListener('click',cerrarMenuCalendario);$cal('cerrarDetalleCalendario').addEventListener('click',cerrarDetalleCalendario);$cal('modalDetalleCalendario').addEventListener('click',e=>{if(e.target===$cal('modalDetalleCalendario'))cerrarDetalleCalendario();});document.addEventListener('keydown',e=>{if(e.key==='Escape')cerrarDetalleCalendario();});cargarCalendario();});
