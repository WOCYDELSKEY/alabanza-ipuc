const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("token");
const estadoCarga = document.getElementById("estadoCarga");
const contenido = document.getElementById("contenidoConfirmacion");
const estadoError = document.getElementById("estadoError");
const mensajeError = document.getElementById("mensajeError");
const mensajeResultado = document.getElementById("mensajeResultado");
const btnConfirmar = document.getElementById("btnConfirmar");
const btnNoPuedo = document.getElementById("btnNoPuedo");
let asignacionActual = null;
function obtenerNombreRol(rol) {
  const nombres={"Batería":"🥁 Batería","Bajo":"🎸 Bajo","Guitarra eléctrica":"🎸 Guitarra eléctrica","Piano principal":"🎹 Piano principal","Piano auxiliar":"🎹 Piano auxiliar","Voz líder":"🎤 Voz líder","Coro":"🎶 Coro"};
  return nombres[rol]||rol;
}
function mostrarError(mensaje){estadoCarga.classList.add("oculto");contenido.classList.add("oculto");estadoError.classList.remove("oculto");mensajeError.textContent=mensaje;}
function formatearFecha(fechaTexto){const fecha=new Date(fechaTexto+"T12:00:00");const texto=fecha.toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long",year:"numeric"});return texto.charAt(0).toUpperCase()+texto.slice(1);}
function bloquearBotones(){btnConfirmar.disabled=true;btnNoPuedo.disabled=true;}
function mostrarResultado(tipo,mensaje){mensajeResultado.className=`mensaje-resultado ${tipo}`;mensajeResultado.textContent=mensaje;mensajeResultado.classList.remove("oculto");}
async function cargarAsignacion(){
  if(!token){mostrarError("El enlace de confirmación no contiene un token válido.");return;}
  try{
    const {data,error}=await supabaseClient.rpc("obtener_confirmacion_por_token",{p_token:token});
    if(error)throw error;
    if(!data)throw new Error("No se encontró una asignación para este enlace.");
    asignacionActual=data;
    document.getElementById("nombreIntegrante").textContent=data.integrantes?.nombre||"hermano(a)";
    document.getElementById("fechaServicio").textContent=formatearFecha(data.servicios.fecha);
    document.getElementById("horaServicio").textContent=String(data.servicios.hora).substring(0,5);
    document.getElementById("rolServicio").textContent=obtenerNombreRol(data.rol);
    estadoCarga.classList.add("oculto");contenido.classList.remove("oculto");
    if(data.estado==="Confirmado")mostrarResultado("exito","✅ Tu respuesta actual es CONFIRMO. Si tu disponibilidad cambió, puedes seleccionar NO PUEDO para actualizarla.");
    else if(data.estado==="No puede")mostrarResultado("rechazo","❌ Tu respuesta actual es NO PUEDO. Si ahora sí puedes participar, selecciona CONFIRMO para actualizarla.");
    else if(data.estado==="Reemplazado"){mostrarResultado("rechazo","🔄 Esta asignación ya fue reemplazada y no se puede modificar desde este enlace.");bloquearBotones();}
  }catch(error){console.error("Error cargando confirmación:",error);mostrarError("No fue posible encontrar esta asignación. Verifica que el enlace sea correcto o solicita uno nuevo al líder.");}
}
async function registrarRespuesta(estado){
  if(!asignacionActual||!token)return;
  bloquearBotones();
  try{
    const {data,error}=await supabaseClient.rpc("responder_confirmacion_por_token",{p_token:token,p_estado:estado});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.mensaje||"No se pudo registrar la respuesta.");
    asignacionActual.estado=estado;
    if(estado==="Confirmado")mostrarResultado("exito","✅ ¡Respuesta actualizada! Tu participación está confirmada. Si tu disponibilidad cambia, puedes modificarla desde este mismo enlace. 🙏");
    else mostrarResultado("rechazo","❌ ¡Respuesta actualizada! Registramos que no puedes participar. Si tu disponibilidad cambia, puedes modificarla desde este mismo enlace.");
    btnConfirmar.disabled=false;btnNoPuedo.disabled=false;
  }catch(error){console.error("Error registrando respuesta:",error);btnConfirmar.disabled=false;btnNoPuedo.disabled=false;mostrarResultado("rechazo","⚠️ No fue posible registrar tu respuesta. Intenta nuevamente o contacta al líder.");}
}
btnConfirmar.addEventListener("click",()=>registrarRespuesta("Confirmado"));
btnNoPuedo.addEventListener("click",()=>registrarRespuesta("No puede"));
document.addEventListener("DOMContentLoaded",cargarAsignacion);
