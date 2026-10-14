/* Protección visual y de sesión para las páginas administrativas. */
document.documentElement.classList.add("auth-pending");
(async function protegerPaginaAdministrativa(){
  const enAdmin=window.location.pathname.includes("/admin/");
  const prefijo=enAdmin?"../":"./";
  const urlLogin=new URL(prefijo+"login.html",window.location.href);
  const raiz=new URL(prefijo,window.location.href);
  const relativo=window.location.pathname.startsWith(raiz.pathname)?window.location.pathname.slice(raiz.pathname.length):"index.html";
  const siguiente=(relativo||"index.html")+window.location.search+window.location.hash;
  const {data:{session},error:sessionError}=await supabaseClient.auth.getSession();
  if(sessionError||!session){urlLogin.searchParams.set("next",siguiente);window.location.replace(urlLogin.href);return;}
  const {data:esAdmin,error}=await supabaseClient.rpc("es_administrador");
  if(error||esAdmin!==true){
    await supabaseClient.auth.signOut();
    urlLogin.searchParams.set("denegado","1");
    window.location.replace(urlLogin.href);return;
  }
  document.documentElement.classList.remove("auth-pending");
  const topbar=document.querySelector(".app-topbar");
  if(topbar&&!document.getElementById("btnCerrarSesion")){
    const button=document.createElement("button");
    button.id="btnCerrarSesion";button.type="button";button.textContent="Cerrar sesión";
    button.style.cssText="margin-left:auto;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:9px;padding:8px 12px;font:inherit;font-size:.88rem;cursor:pointer;";
    topbar.appendChild(button);
    button.addEventListener("click",async()=>{button.disabled=true;await supabaseClient.auth.signOut();window.location.replace(new URL(prefijo+"login.html",window.location.href).href);});
  }
})();
