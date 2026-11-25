/* Protección de sesión y permisos. */
document.documentElement.classList.add("auth-pending");
(async function protegerPaginaAdministrativa(){
  const enAdmin=window.location.pathname.includes("/admin/");
  const prefijo=enAdmin?"../":"./";
  const urlLogin=new URL(prefijo+"login.html",window.location.href);
  const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
  if(sessionError||!session){urlLogin.searchParams.set("next",window.location.pathname.split("/").pop()+window.location.search);window.location.replace(urlLogin.href);return;}
  const {data:perfil,error}=await supabaseClient.rpc("obtener_mi_perfil");
  if(error||!perfil||perfil.autorizado!==true){await supabaseClient.auth.signOut();urlLogin.searchParams.set("denegado","1");window.location.replace(urlLogin.href);return;}
  if(window.location.pathname.endsWith("/admin/usuarios.html") && perfil.rol!=="admin"){window.location.replace(new URL(prefijo+"index.html",window.location.href).href);return;}
  if(session.user.user_metadata?.must_change_password===true && !window.location.pathname.endsWith("cambiar-clave.html")){
    window.location.replace(new URL(prefijo+"cambiar-clave.html",window.location.href).href);return;
  }
  if(window.location.pathname.endsWith("cambiar-clave.html")){document.documentElement.classList.remove("auth-pending");return;}
  document.documentElement.dataset.rol=perfil.rol;
  if(perfil.rol!=="admin"){
    document.querySelectorAll('[data-admin-only]').forEach(el=>el.remove());
    document.documentElement.classList.add("modo-consulta");
  }
  document.documentElement.classList.remove("auth-pending");
  const topbar=document.querySelector(".app-topbar");
  if(topbar&&!document.getElementById("btnCerrarSesion")){
    const button=document.createElement("button");button.id="btnCerrarSesion";button.type="button";button.textContent="Cerrar sesión";
    button.style.cssText="margin-left:auto;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:9px;padding:8px 12px;font:inherit;font-size:.88rem;cursor:pointer;";
    topbar.appendChild(button);button.addEventListener("click",async()=>{button.disabled=true;await supabaseClient.auth.signOut();window.location.replace(new URL(prefijo+"login.html",window.location.href).href);});
  }
})().catch(()=>{window.location.replace("../login.html");});
