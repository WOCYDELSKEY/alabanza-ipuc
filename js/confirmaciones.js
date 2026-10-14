const $conf=id=>document.getElementById(id);
let filasConfirmaciones=[];
function escaparConf(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fechaConf(fecha){return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"});}
function horaConf(hora){return String(hora||"").slice(0,5);}
function estadoNormalizado(estado){return estado||"Pendiente";}
function claseEstado(estado){return estado==="Confirmado"?"estado-confirmado":estado==="No puede"?"estado-no-puede":estado==="Reemplazado"?"estado-no-puede":"estado-pendiente";}
function urlConfirmacion(token){const u=new URL("../confirmacion.html",window.location.href);u.searchParams.set("token",token);return u.href;}
function mostrarEstadoConf(t,error=false){const el=$conf("mensajeConfirmaciones");el.textContent=t;el.style.background=error?"#fef2f2":"#f8fafc";el.style.color=error?"#991b1b":"#334155";}
async function asegurarToken(fila){
 if(fila.token_confirmacion)return fila.token_confirmacion;
 const token=(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():`${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
 const {error}=await supabaseClient.from("asignaciones").update({token_confirmacion:token}).eq("id",fila.id);
 if(error)throw error;
 fila.token_confirmacion=token;return token;
}
async function cargarConfirmaciones(){
 const mes=$conf("mesConfirmaciones").value;
 if(!/^\d{4}-\d{2}$/.test(mes)){mostrarEstadoConf("Selecciona un mes válido.",true);return;}
 const [y,m]=mes.split("-").map(Number),ultimo=new Date(y,m,0).getDate();
 mostrarEstadoConf("Consultando asignaciones…");
 const {data:servicios,error:errServ}=await supabaseClient.from("servicios").select("id,fecha,hora,tipo").gte("fecha",`${mes}-01`).lte("fecha",`${mes}-${String(ultimo).padStart(2,"0")}`).order("fecha").order("hora");
 if(errServ){mostrarEstadoConf(`No se pudieron consultar los servicios: ${errServ.message}`,true);return;}
 if(!servicios?.length){filasConfirmaciones=[];renderConfirmaciones();mostrarEstadoConf("No hay servicios registrados para este mes.");return;}
 const ids=servicios.map(s=>s.id);
 const {data:asignaciones,error:errAsig}=await supabaseClient.from("asignaciones").select("id,servicio_id,integrante_id,rol,estado,token_confirmacion,reemplaza_asignacion_id,integrantes(id,nombre,telefono)").in("servicio_id",ids);
 if(errAsig){mostrarEstadoConf(`No se pudieron consultar las asignaciones: ${errAsig.message}`,true);return;}
 const mapa=new Map(servicios.map(s=>[String(s.id),s]));
 filasConfirmaciones=(asignaciones||[]).map(a=>({...a,servicio:mapa.get(String(a.servicio_id)),estado:estadoNormalizado(a.estado)})).sort((a,b)=>(a.servicio?.fecha||"").localeCompare(b.servicio?.fecha||"")||(a.servicio?.hora||"").localeCompare(b.servicio?.hora||"")||(a.integrantes?.nombre||"").localeCompare(b.integrantes?.nombre||""));
 renderConfirmaciones();mostrarEstadoConf(`Se cargaron ${filasConfirmaciones.length} asignación(es). Los enlaces personales se generan al necesitarlos.`);
}
function renderConfirmaciones(){
 const filtro=$conf("filtroEstado").value;
 const lista=filasConfirmaciones.filter(f=>filtro==="todos"||f.estado===filtro);
 $conf("totalConfirmaciones").textContent=filasConfirmaciones.length;
 $conf("totalConfirmadas").textContent=filasConfirmaciones.filter(f=>f.estado==="Confirmado").length;
 $conf("totalNoPueden").textContent=filasConfirmaciones.filter(f=>f.estado==="No puede").length;
 $conf("totalPendientes").textContent=filasConfirmaciones.filter(f=>f.estado==="Pendiente").length;
 const tbody=$conf("tablaConfirmaciones");
 if(!lista.length){tbody.innerHTML='<tr><td colspan="6">No hay asignaciones para este filtro.</td></tr>';return;}
 tbody.innerHTML=lista.map(f=>{const estado=escaparConf(f.estado);const token=f.token_confirmacion;const enlace=token?`<a href="${escaparConf(urlConfirmacion(token))}" target="_blank" rel="noopener">Abrir enlace</a>`:'<span>Se crea al preparar</span>';return `<tr><td>${escaparConf(f.servicio?fechaConf(f.servicio.fecha):"")}<br>${escaparConf(horaConf(f.servicio?.hora))}</td><td>${escaparConf(f.integrantes?.nombre||"Integrante")}</td><td>${escaparConf(f.rol)}</td><td class="${claseEstado(f.estado)}">${estado}</td><td>${enlace}</td><td><button class="accion-confirmacion" onclick="copiarEnlaceConf('${escaparConf(f.id)}')">Copiar enlace</button><button class="accion-confirmacion verde" onclick="whatsappConf('${escaparConf(f.id)}')">WhatsApp</button></td></tr>`;}).join("");
}
function buscarFila(id){return filasConfirmaciones.find(f=>String(f.id)===String(id));}
async function copiarEnlaceConf(id){try{const f=buscarFila(id);if(!f)return;const token=await asegurarToken(f);await navigator.clipboard.writeText(urlConfirmacion(token));renderConfirmaciones();mostrarEstadoConf("Enlace personal copiado.");}catch(e){console.error(e);mostrarEstadoConf(`No se pudo copiar o generar el enlace: ${e.message||e}`,true);}}
async function whatsappConf(id){try{const f=buscarFila(id);if(!f)return;const token=await asegurarToken(f);const nombre=f.integrantes?.nombre||"hermano(a)",serv=f.servicio;const fecha=serv?new Date(`${serv.fecha}T12:00:00`).toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"}):"";const url=urlConfirmacion(token);const msg=`🎶 *IPUC Líbano Central*\n\nHola ${nombre} 👋\n\n¿Puedes participar en el servicio?\n📅 ${fecha}\n🕐 ${horaConf(serv?.hora)}\n🎵 Rol: ${f.rol}\n\nConfirma aquí:\n${url}\n\n✅ CONFIRMO o ❌ NO PUEDO\n\nDios te bendiga 🙏`;let tel=String(f.integrantes?.telefono||"").replace(/\D/g,"");if(tel&&!tel.startsWith("57")&&tel.length===10)tel="57"+tel;const wa=tel?`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`;window.open(wa,"_blank","noopener");renderConfirmaciones();mostrarEstadoConf(tel?"WhatsApp abierto con mensaje personal. Selecciona enviar manualmente.":"No hay teléfono registrado; WhatsApp se abrió sin destinatario, puedes copiar el enlace y enviarlo manualmente.");}catch(e){console.error(e);mostrarEstadoConf(`No se pudo preparar WhatsApp: ${e.message||e}`,true);}}
document.addEventListener("DOMContentLoaded",()=>{$conf("actualizarConfirmaciones").addEventListener("click",cargarConfirmaciones);$conf("mesConfirmaciones").addEventListener("change",cargarConfirmaciones);$conf("filtroEstado").addEventListener("change",renderConfirmaciones);cargarConfirmaciones();});
