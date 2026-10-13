/* Módulo de disponibilidad. Usa disponibilidad_integrantes y excepciones_disponibilidad. */
const DIAS_SEMANA = [
  {n:0, nombre:"Domingo"}, {n:1, nombre:"Lunes"}, {n:2, nombre:"Martes"},
  {n:3, nombre:"Miércoles"}, {n:4, nombre:"Jueves"}, {n:5, nombre:"Viernes"}, {n:6, nombre:"Sábado"}
];
let dispIntegrantes = [];
let dispExcepciones = [];
let dispDisponibilidad = [];

const $disp = id => document.getElementById(id);
function mensajeDisp(texto, tipo="") {
  const el=$disp("mensajeEstado"); if(!el)return;
  el.textContent=texto; el.className="mensaje-estado"+(tipo?" "+tipo:"");
}
function escapeDisp(v) {
  return String(v ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function fechaLegible(f) {
  if(!f)return "";
  const [y,m,d]=f.split("-"); return `${d}/${m}/${y}`;
}
function integranteNombre(id) {
  return dispIntegrantes.find(i=>String(i.id)===String(id))?.nombre || "Integrante";
}
async function cargarDispIntegrantes() {
  const {data,error}=await supabaseClient.from("integrantes").select("id,nombre,activo").order("nombre");
  if(error)throw error;
  dispIntegrantes=(data||[]).filter(i=>i.activo===true);
  const options='<option value="">Selecciona un integrante…</option>'+dispIntegrantes.map(i=>`<option value="${escapeDisp(i.id)}">${escapeDisp(i.nombre)}</option>`).join("");
  $disp("integranteSelect").innerHTML=options;
  $disp("excepcionIntegrante").innerHTML=options;
  $disp("filtroIntegrante").innerHTML='<option value="">Todos los integrantes</option>'+dispIntegrantes.map(i=>`<option value="${escapeDisp(i.id)}">${escapeDisp(i.nombre)}</option>`).join("");
  $disp("totalIntegrantes").textContent=dispIntegrantes.length;
}
function renderDiasSemana() {
  const seleccionado=String($disp("integranteSelect").value||"");
  const rows=dispDisponibilidad.filter(d=>String(d.integrante_id)===seleccionado);
  const map=new Map(rows.map(d=>[Number(d.dia_semana),d.disponible===true]));
  $disp("diasSemana").innerHTML=DIAS_SEMANA.map(d=>`<label class="dia-opcion"><span>${d.nombre}</span><input type="checkbox" data-dia="${d.n}" ${map.get(d.n)===true?"checked":""}><small>Disponible</small></label>`).join("");
}
async function cargarSemana() {
  const id=$disp("integranteSelect").value;
  if(!id){mensajeDisp("Selecciona un integrante para consultar su disponibilidad.","error");return;}
  const {data,error}=await supabaseClient.from("disponibilidad_integrantes").select("*").eq("integrante_id",id);
  if(error)throw error;
  dispDisponibilidad=(dispDisponibilidad||[]).filter(d=>String(d.integrante_id)!==String(id)).concat(data||[]);
  renderDiasSemana(); mensajeDisp(`Disponibilidad habitual cargada para ${integranteNombre(id)}.`);
}
async function guardarSemana() {
  const id=$disp("integranteSelect").value;
  if(!id){mensajeDisp("Selecciona un integrante.","error");return;}
  const checks=[...$disp("diasSemana").querySelectorAll("input[data-dia]")];
  if(checks.length!==7){mensajeDisp("No se pudo cargar la semana. Pulsa Consultar e intenta de nuevo.","error");return;}
  for(const check of checks) {
    const dia=Number(check.dataset.dia), disponible=check.checked;
    const existente=dispDisponibilidad.find(d=>String(d.integrante_id)===String(id)&&Number(d.dia_semana)===dia);
    let res;
    if(existente) res=await supabaseClient.from("disponibilidad_integrantes").update({disponible}).eq("integrante_id",id).eq("dia_semana",dia);
    else res=await supabaseClient.from("disponibilidad_integrantes").insert({integrante_id:id,dia_semana:dia,disponible});
    if(res.error)throw res.error;
  }
  await cargarSemana(); mensajeDisp(`Disponibilidad habitual guardada para ${integranteNombre(id)}.`,"exito");
}
function actualizarTipoFecha() {
  const periodo=$disp("tipoFecha").value==="periodo";
  $disp("labelFechaFin").classList.toggle("oculto",!periodo);
  $disp("fechaFin").required=periodo;
  if(!periodo)$disp("fechaFin").value="";
}
function resetFormExcepcion() {
  $disp("formExcepcion").reset(); $disp("excepcionId").value="";
  $disp("tipoFecha").value="unica"; actualizarTipoFecha();
  $disp("btnGuardarExcepcion").textContent="Guardar registro";
  $disp("btnCancelarEdicion").classList.add("oculto");
}
async function cargarExcepciones() {
  const {data,error}=await supabaseClient.from("excepciones_disponibilidad").select("*").order("fecha_inicio",{ascending:true});
  if(error)throw error;
  dispExcepciones=data||[];
  $disp("totalExcepciones").textContent=dispExcepciones.length;
  renderExcepciones();
}
function renderExcepciones() {
  const filtro=$disp("filtroIntegrante").value;
  const rows=dispExcepciones.filter(e=>!filtro||String(e.integrante_id)===String(filtro));
  $disp("listaExcepciones").innerHTML=rows.length?rows.map(e=>{
    const esPeriodo=e.fecha_fin && e.fecha_fin!==e.fecha_inicio;
    const estado=e.disponible===true;
    return `<tr><td>${escapeDisp(integranteNombre(e.integrante_id))}</td><td>${fechaLegible(e.fecha_inicio)}${esPeriodo?" – "+fechaLegible(e.fecha_fin):""}</td><td><span class="disp-badge ${estado?"si":"no"}">${estado?"Disponible":"No disponible"}</span></td><td>${escapeDisp(e.motivo||"—")}</td><td><button class="disp-accion-tabla" data-editar="${escapeDisp(e.id)}">Editar</button><button class="disp-accion-tabla eliminar" data-eliminar="${escapeDisp(e.id)}">Eliminar</button></td></tr>`;
  }).join(""):'<tr><td colspan="5">No hay registros para este filtro.</td></tr>';
}
async function guardarExcepcion(ev) {
  ev.preventDefault();
  const id=$disp("excepcionId").value;
  const integrante_id=$disp("excepcionIntegrante").value;
  const fecha_inicio=$disp("fechaInicio").value;
  const fecha_fin=$disp("tipoFecha").value==="periodo"?$disp("fechaFin").value:fecha_inicio;
  const disponible=$disp("estadoDisponibilidad").value==="true";
  const motivo=$disp("motivo").value.trim()||null;
  if(!integrante_id||!fecha_inicio||!fecha_fin){mensajeDisp("Completa el integrante y las fechas.","error");return;}
  if(fecha_fin<fecha_inicio){mensajeDisp("La fecha final no puede ser anterior a la inicial.","error");return;}
  const payload={integrante_id,fecha_inicio,fecha_fin,disponible,motivo};
  const res=id?await supabaseClient.from("excepciones_disponibilidad").update(payload).eq("id",id):await supabaseClient.from("excepciones_disponibilidad").insert(payload);
  if(res.error)throw res.error;
  resetFormExcepcion(); await cargarExcepciones(); mensajeDisp("Registro de disponibilidad guardado correctamente.","exito");
}
function editarExcepcion(id) {
  const e=dispExcepciones.find(x=>String(x.id)===String(id)); if(!e)return;
  $disp("excepcionId").value=e.id; $disp("excepcionIntegrante").value=e.integrante_id;
  $disp("tipoFecha").value=e.fecha_fin&&e.fecha_fin!==e.fecha_inicio?"periodo":"unica";
  actualizarTipoFecha(); $disp("fechaInicio").value=e.fecha_inicio;
  $disp("fechaFin").value=e.fecha_fin||e.fecha_inicio; $disp("estadoDisponibilidad").value=String(e.disponible);
  $disp("motivo").value=e.motivo||""; $disp("btnGuardarExcepcion").textContent="Guardar cambios";
  $disp("btnCancelarEdicion").classList.remove("oculto");
  $disp("formExcepcion").scrollIntoView({behavior:"smooth",block:"start"});
}
async function eliminarExcepcion(id) {
  const e=dispExcepciones.find(x=>String(x.id)===String(id)); if(!e)return;
  if(!confirm(`¿Eliminar el registro de ${integranteNombre(e.integrante_id)} del ${fechaLegible(e.fecha_inicio)}?`))return;
  const {error}=await supabaseClient.from("excepciones_disponibilidad").delete().eq("id",id);
  if(error)throw error; await cargarExcepciones(); mensajeDisp("Registro eliminado.","exito");
}
document.addEventListener("DOMContentLoaded",async()=>{
  DIAS_SEMANA.forEach(d=>{});
  $disp("tipoFecha").addEventListener("change",actualizarTipoFecha);
  $disp("integranteSelect").addEventListener("change",()=>cargarSemana().catch(e=>mensajeDisp(e.message,"error")));
  $disp("btnCargarSemana").addEventListener("click",()=>cargarSemana().catch(e=>mensajeDisp(e.message,"error")));
  $disp("btnGuardarSemana").addEventListener("click",()=>guardarSemana().catch(e=>mensajeDisp(e.message||"No fue posible guardar la disponibilidad.","error")));
  $disp("formExcepcion").addEventListener("submit",e=>guardarExcepcion(e).catch(err=>mensajeDisp(err.message||"No fue posible guardar el registro.","error")));
  $disp("btnCancelarEdicion").addEventListener("click",resetFormExcepcion);
  $disp("filtroIntegrante").addEventListener("change",renderExcepciones);
  $disp("listaExcepciones").addEventListener("click",e=>{
    const edit=e.target.closest("[data-editar]"), del=e.target.closest("[data-eliminar]");
    if(edit)editarExcepcion(edit.dataset.editar);
    if(del)eliminarExcepcion(del.dataset.eliminar).catch(err=>mensajeDisp(err.message||"No fue posible eliminar.","error"));
  });
  actualizarTipoFecha();
  try { await cargarDispIntegrantes(); await cargarExcepciones(); if(dispIntegrantes.length){await cargarSemana();} mensajeDisp("Disponibilidad lista para administrar."); }
  catch(e){console.error("Error cargando disponibilidad:",e);mensajeDisp("No se pudo cargar el módulo. Ejecuta primero el SQL de excepciones_disponibilidad y revisa las políticas de Supabase. Detalle: "+(e.message||e),"error");}
});
