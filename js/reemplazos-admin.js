const $rep=id=>document.getElementById(id);
let reemplazosCargados=[];
function escRep(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function mostrarRep(msg,error=false){const e=$rep("mensajeReemplazos");e.textContent=msg;e.style.background=error?"#fef2f2":"#f8fafc";e.style.color=error?"#991b1b":"#334155";}
function fechaRep(f){return f?new Date(`${f}T12:00:00`).toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"}):"—";}
async function cargarReemplazosAdmin(){
 const mes=$rep("mesReemplazos").value;if(!/^\d{4}-\d{2}$/.test(mes)){mostrarRep("Selecciona un mes válido.",true);return;}
 const [y,m]=mes.split("-").map(Number),ultimo=new Date(y,m,0).getDate();mostrarRep("Consultando reemplazos…");
 const {data:servicios,error:eS}=await supabaseClient.from("servicios").select("id,fecha,hora").gte("fecha",`${mes}-01`).lte("fecha",`${mes}-${String(ultimo).padStart(2,"0")}`);
 if(eS){mostrarRep(`No se pudieron consultar servicios: ${eS.message}`,true);return;}
 const serviceIds=(servicios||[]).map(s=>s.id);
 // Fetch the replacements table with its established column names, then hydrate related names.
 const {data:repls,error:eR}=await supabaseClient.from("reemplazos").select("*").order("id",{ascending:false});
 if(eR){mostrarRep(`No se pudieron consultar los reemplazos: ${eR.message}`,true);return;}
 const all=repls||[];
 if(!all.length){reemplazosCargados=[];renderReemplazosAdmin();mostrarRep("Todavía no hay reemplazos registrados.");return;}
 const originalIds=[...new Set(all.map(r=>r.asignacion_original_id).filter(v=>v!==null&&v!==undefined))];
 const {data:orig,error:eO}=await supabaseClient.from("asignaciones").select("id,servicio_id,integrante_id,rol,estado,integrantes(id,nombre),servicios(id,fecha,hora)").in("id",originalIds);
 if(eO){mostrarRep(`No se pudieron cargar las asignaciones originales: ${eO.message}`,true);return;}
 const candIds=[...new Set(all.map(r=>r.integrante_reemplazo_id).filter(v=>v!==null&&v!==undefined))];
 const {data:cands,error:eC}=candIds.length?await supabaseClient.from("integrantes").select("id,nombre,telefono").in("id",candIds):{data:[],error:null};
 if(eC){mostrarRep(`No se pudieron cargar los integrantes reemplazantes: ${eC.message}`,true);return;}
 const om=new Map((orig||[]).map(a=>[String(a.id),a])),cm=new Map((cands||[]).map(c=>[String(c.id),c]));
 reemplazosCargados=all.map(r=>({...r,original:om.get(String(r.asignacion_original_id)),candidato:cm.get(String(r.integrante_reemplazo_id))})).filter(r=>r.original?.servicios?.fecha?.startsWith(mes));
 renderReemplazosAdmin();mostrarRep(`Se cargaron ${reemplazosCargados.length} reemplazo(s) para ${mes}.`);
}
function renderReemplazosAdmin(){
 const filtro=$rep("filtroEstadoReemplazos").value;const lista=reemplazosCargados.filter(r=>filtro==="todos"||r.estado===filtro);
 $rep("totalReemplazos").textContent=reemplazosCargados.length;
 $rep("totalActivosReemplazos").textContent=reemplazosCargados.filter(r=>["Asignado","Aceptado","Pendiente"].includes(r.estado)).length;
 $rep("totalPendientesReemplazos").textContent=reemplazosCargados.filter(r=>r.estado==="Pendiente").length;
 const tbody=$rep("tablaReemplazos");if(!lista.length){tbody.innerHTML='<tr><td colspan="7">No hay reemplazos para este filtro y mes.</td></tr>';return;}
 tbody.innerHTML=lista.map(r=>{const a=r.original||{},s=a.servicios||{},nombreOriginal=a.integrantes?.nombre||"—",c=r.candidato||{};let confirm=`<span>${escRep(a.estado||"Pendiente")}</span>`;if(c.telefono&&a.servicio_id){confirm=`<button class="accion-confirmacion verde btn-whatsapp-reemplazo" onclick="prepararWhatsAppReemplazoAdmin('${escRep(r.id)}')">💬 Preparar WhatsApp</button>`;}return `<tr><td>${escRep(fechaRep(s.fecha))}<br>${escRep(String(s.hora||"").slice(0,5))}</td><td>${escRep(a.rol||"—")}</td><td>${escRep(nombreOriginal)}</td><td>${escRep(c.nombre||"—")}</td><td>${escRep(r.motivo||"—")}</td><td>${escRep(r.estado||"—")}</td><td>${confirm}</td></tr>`;}).join("");
}
async function prepararWhatsAppReemplazoAdmin(id){
 const r=reemplazosCargados.find(x=>String(x.id)===String(id));if(!r)return;
 const a=r.original||{},c=r.candidato||{},s=a.servicios||{};
 if(!c.telefono){mostrarRep(`${c.nombre||"El reemplazo"} no tiene teléfono registrado.`,true);return;}
 try{
  let token=null;
  const {data:assignment,error}=await supabaseClient.from("asignaciones").select("id,token_confirmacion,rol,integrantes(nombre),servicios(fecha,hora)").eq("reemplaza_asignacion_id",a.id).eq("integrante_id",c.id).maybeSingle();
  if(error)throw error;
  if(assignment){token=assignment.token_confirmacion;if(!token){token=(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():`${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;const {error:eU}=await supabaseClient.from("asignaciones").update({token_confirmacion:token}).eq("id",assignment.id);if(eU)throw eU;}}
  const nombre=c.nombre||"hermano(a)",fecha=fechaRep(s.fecha),hora=String(s.hora||"").slice(0,5);
  const base=new URL("../confirmacion.html",window.location.href);if(token)base.searchParams.set("token",token);
  const msg=`🎶 *IPUC Líbano Central*\n\nHola ${nombre} 👋\n\nHas sido propuesto(a) como reemplazo para el servicio.\n📅 ${fecha}\n🕐 ${hora}\n🎵 Rol: ${a.rol||""}\n👤 Reemplazas a: ${a.integrantes?.nombre||"el integrante asignado"}\n\n${token?`Confirma aquí:\n${base.href}`:"Solicita al administrador tu enlace de confirmación."}\n\nDios te bendiga 🙏`;
  let tel=String(c.telefono).replace(/\D/g,"");if(!tel.startsWith("57")&&tel.length===10)tel="57"+tel;
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
  mostrarRep("WhatsApp abierto con el mensaje preparado. El envío sigue siendo manual.");
 }catch(e){console.error(e);mostrarRep(`No se pudo preparar el mensaje: ${e.message||e}`,true);}
}
document.addEventListener("DOMContentLoaded",()=>{$rep("actualizarReemplazos").addEventListener("click",cargarReemplazosAdmin);$rep("mesReemplazos").addEventListener("change",cargarReemplazosAdmin);$rep("filtroEstadoReemplazos").addEventListener("change",renderReemplazosAdmin);cargarReemplazosAdmin();});
