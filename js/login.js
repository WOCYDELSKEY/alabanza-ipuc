function loginMensaje(texto, error=false){
  const el=document.getElementById("loginMessage");
  el.textContent=texto;
  el.className=error?"msg error":"msg";
}
function destinoSeguro(){
  const p=new URLSearchParams(window.location.search).get("next")||"index.html";
  if(!p || p.startsWith("/") || p.includes(":") || p.includes("\\") || p.split("/").includes("..") || p.toLowerCase()==="login.html") return "index.html";
  return p;
}
async function irSiYaEsAdmin(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session)return;
  const {data,error}=await supabaseClient.rpc("es_administrador");
  if(!error && data===true){window.location.replace(new URL(destinoSeguro(),window.location.href).href);}
  else {await supabaseClient.auth.signOut();}
}
document.addEventListener("DOMContentLoaded",()=>{
  const form=document.getElementById("loginForm"),button=document.getElementById("btnLogin");
  irSiYaEsAdmin().catch(()=>{});
  form.addEventListener("submit",async event=>{
    event.preventDefault();button.disabled=true;button.textContent="Verificando…";
    const email=document.getElementById("email").value.trim();
    const password=document.getElementById("password").value;
    try{
      const {error:loginError}=await supabaseClient.auth.signInWithPassword({email,password});
      if(loginError)throw loginError;
      const {data:isAdmin,error:roleError}=await supabaseClient.rpc("es_administrador");
      if(roleError)throw new Error("No se pudo verificar el rol administrador. Confirma que la migración de seguridad esté instalada.");
      if(isAdmin!==true){await supabaseClient.auth.signOut();throw new Error("Esta cuenta todavía no está autorizada como administradora.");}
      window.location.replace(new URL(destinoSeguro(),window.location.href).href);
    }catch(error){
      loginMensaje(error.message||"No fue posible iniciar sesión.",true);
      button.disabled=false;button.textContent="Iniciar sesión";
    }
  });
});
