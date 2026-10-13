/* Gestión de servicios: solo utiliza columnas ya usadas por el cronograma (id, fecha, hora, activo). */
const $serv = id => document.getElementById(id);
function toggleMenu(){document.querySelector('.sidebar')?.classList.toggle('abierto');document.getElementById('menuOverlay')?.classList.toggle('activo');}
function cerrarMenu(){document.querySelector('.sidebar')?.classList.remove('abierto');document.getElementById('menuOverlay')?.classList.remove('activo');}
let serviciosCargados = [];

function fechaBonitaServicio(fecha) {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
function horaBonitaServicio(hora) { return String(hora || '').slice(0,5); }
function escaparServicio(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function mensajeServicios(texto, error=false) { const el=$serv('estadoServicios'); if(el){el.textContent=texto;el.style.background=error?'#fef2f2':'#f8fafc';el.style.color=error?'#991b1b':'#334155';} }
async function cargarServiciosAdmin() {
  mensajeServicios('Cargando servicios…');
  const mes=$serv('mesServicios').value;
  let consulta=supabaseClient.from('servicios').select('*').order('fecha',{ascending:true}).order('hora',{ascending:true});
  if(/^\d{4}-\d{2}$/.test(mes)) { const [y,m]=mes.split('-').map(Number); consulta=consulta.gte('fecha',`${mes}-01`).lte('fecha',`${mes}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`); }
  const {data,error}=await consulta;
  if(error){console.error(error);serviciosCargados=[];$serv('listaServicios').innerHTML='<tr><td colspan="5" class="tabla-vacia-servicios">No fue posible cargar los servicios. Revisa la conexión y los permisos de Supabase.</td></tr>';$serv('resumenServicios').textContent='Error de consulta';mensajeServicios(`Error al consultar servicios: ${error.message}`,true);return;}
  serviciosCargados=data||[];
  const ids=serviciosCargados.map(s=>s.id); let asignaciones=[];
  if(ids.length){const r=await supabaseClient.from('asignaciones').select('id,servicio_id').in('servicio_id',ids);if(r.error){console.warn('No se pudieron consultar asignaciones',r.error);}else asignaciones=r.data||[];}
  const cuerpo=$serv('listaServicios');
  if(!serviciosCargados.length){cuerpo.innerHTML='<tr><td colspan="5" class="tabla-vacia-servicios">No hay servicios registrados para este mes.</td></tr>';}
  else cuerpo.innerHTML=serviciosCargados.map(s=>{const n=asignaciones.filter(a=>String(a.servicio_id)===String(s.id)).length;const activo=s.activo!==false;return `<tr><td>${escaparServicio(fechaBonitaServicio(s.fecha))}</td><td>${escaparServicio(horaBonitaServicio(s.hora))}</td><td><span class="etiqueta-estado ${activo?'':'etiqueta-inactivo'}">${activo?'Activo':'Inactivo'}</span></td><td>${n}</td><td><button class="accion-servicio" onclick="cambiarEstadoServicio('${escaparServicio(s.id)}',${activo?'false':'true'})">${activo?'Desactivar':'Activar'}</button> <button class="accion-servicio" onclick="eliminarServicio('${escaparServicio(s.id)}')" ${n?'disabled title="Tiene asignaciones"':''}>Eliminar</button></td></tr>`;}).join('');
  $serv('resumenServicios').textContent=`${serviciosCargados.length} servicio(s) · ${serviciosCargados.filter(s=>s.activo!==false).length} activo(s)`;
  mensajeServicios('Servicios cargados. Los servicios con asignaciones no se pueden eliminar; puedes desactivarlos para excluirlos de nuevas generaciones.');
}
function fechasDelMes(mes, dias) { const [y,m]=mes.split('-').map(Number);const total=new Date(y,m,0).getDate();const out=[];for(let d=1;d<=total;d++){const fecha=new Date(y,m-1,d,12);if(dias.includes(fecha.getDay()))out.push({fecha:`${mes}-${String(d).padStart(2,'0')}`,dia:fecha.getDay()});}return out; }
async function crearServiciosMes() {
  const mes=$serv('mesServicios').value;
  if(!/^\d{4}-\d{2}$/.test(mes)){mensajeServicios('Selecciona un mes válido.',true);return;}
  const dias=[];if($serv('diaDomingo').checked)dias.push(0);if($serv('diaJueves').checked)dias.push(4);if($serv('diaSabado').checked)dias.push(6);
  if(!dias.length){mensajeServicios('Selecciona al menos un día de servicio.',true);return;}
  const horas={'0':$serv('horaDomingo').value,'4':$serv('horaTarde').value,'6':$serv('horaTarde').value};
  const tipos={'0':$serv('tipoDomingo').value.trim(),'4':$serv('tipoJueves').value.trim(),'6':$serv('tipoSabado').value.trim()};
  if(dias.some(d=>!horas[d])){mensajeServicios('Completa los horarios seleccionados.',true);return;}
  if(dias.some(d=>!tipos[d])){mensajeServicios('Completa el tipo de servicio para cada día seleccionado.',true);return;}
  const boton=$serv('crearMesServicios');boton.disabled=true;boton.textContent='Creando…';
  try {
    const fechas=fechasDelMes(mes,dias);const {data:existentes,error:err}=await supabaseClient.from('servicios').select('fecha,hora').gte('fecha',`${mes}-01`).lte('fecha',`${mes}-${String(new Date(Number(mes.slice(0,4)),Number(mes.slice(5,7)),0).getDate()).padStart(2,'0')}`);
    if(err)throw err;
    const llaves=new Set((existentes||[]).map(s=>`${s.fecha}|${String(s.hora).slice(0,5)}`));const nuevos=fechas.map(x=>({fecha:x.fecha,hora:horas[x.dia],tipo:tipos[x.dia],activo:true})).filter(s=>!llaves.has(`${s.fecha}|${s.hora}`));
    if(!nuevos.length){mensajeServicios('No hay servicios faltantes: las fechas y horarios seleccionados ya existen.');return;}
    const {error}=await supabaseClient.from('servicios').insert(nuevos);if(error)throw error;
    mensajeServicios(`✅ Se crearon ${nuevos.length} servicio(s). Se omitieron ${fechas.length-nuevos.length} duplicado(s).`);await cargarServiciosAdmin();
  } catch(e){console.error(e);mensajeServicios(`No se pudieron crear los servicios: ${e.message||'error desconocido'}`,true);}
  finally{boton.disabled=false;boton.textContent='＋ Crear servicios faltantes del mes';}
}
async function cambiarEstadoServicio(id, activo) {
  const servicio=serviciosCargados.find(s=>String(s.id)===String(id));if(!servicio)return;
  const verbo=activo?'activar':'desactivar';if(!confirm(`¿Seguro que deseas ${verbo} el servicio del ${fechaBonitaServicio(servicio.fecha)}?`))return;
  const {error}=await supabaseClient.from('servicios').update({activo}).eq('id',id);if(error){console.error(error);mensajeServicios(`No se pudo actualizar el servicio: ${error.message}`,true);return;}mensajeServicios(`Servicio ${activo?'activado':'desactivado'}.`);await cargarServiciosAdmin();
}
async function eliminarServicio(id) {
  const servicio=serviciosCargados.find(s=>String(s.id)===String(id));if(!servicio)return;
  const {count,error:err}=await supabaseClient.from('asignaciones').select('id',{count:'exact',head:true}).eq('servicio_id',id);
  if(err){mensajeServicios(`No se pudo comprobar si tiene asignaciones: ${err.message}`,true);return;}
  if(count>0){mensajeServicios('Este servicio tiene asignaciones y no se puede eliminar. Desactívalo si ya no debe usarse.',true);return;}
  if(!confirm(`¿Eliminar el servicio del ${fechaBonitaServicio(servicio.fecha)} a las ${horaBonitaServicio(servicio.hora)}? Esta acción no se puede deshacer.`))return;
  const {error}=await supabaseClient.from('servicios').delete().eq('id',id);if(error){console.error(error);mensajeServicios(`No se pudo eliminar el servicio: ${error.message}`,true);return;}mensajeServicios('Servicio eliminado.');await cargarServiciosAdmin();
}
document.addEventListener('DOMContentLoaded',()=>{$serv('crearMesServicios').addEventListener('click',crearServiciosMes);$serv('recargarServicios').addEventListener('click',cargarServiciosAdmin);$serv('mesServicios').addEventListener('change',cargarServiciosAdmin);cargarServiciosAdmin();});
