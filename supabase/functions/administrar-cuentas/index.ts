import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
 try{
  const auth=req.headers.get("Authorization")||"";const token=auth.replace(/^Bearer\s+/i,"");if(!token)return json({ok:false,error:"Sesión requerida."},401);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:{user:caller},error:authErr}=await admin.auth.getUser(token);if(authErr||!caller)return json({ok:false,error:"Sesión inválida."},401);
  const {data:callerRole}=await admin.from("admin_users").select("rol,activo").eq("user_id",caller.id).maybeSingle();if(!callerRole?.activo||callerRole.rol!=="admin")return json({ok:false,error:"Solo un administrador total puede gestionar cuentas."},403);
  const body=await req.json();const accion=body.accion;
  if(accion==="listar"){
   const {data:rows,error}=await admin.from("admin_users").select("user_id,email,nombre,rol,activo,creado_en").order("creado_en");if(error)throw error;
   return json({ok:true,usuarios:rows});
  }
  if(accion==="crear"){
   const email=String(body.email||"").trim().toLowerCase(),password=String(body.password_temporal||""),nombre=String(body.nombre||"").trim(),rol=body.rol;
   if(!email||!nombre||password.length<8||!['admin','consulta'].includes(rol))return json({ok:false,error:"Completa nombre, correo, contraseña de mínimo 8 caracteres y permisos válidos."},400);
   const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nombre,must_change_password:true}});if(error)throw error;
   const {error:dbErr}=await admin.from("admin_users").insert({user_id:data.user.id,email,nombre,rol,activo:true});if(dbErr){await admin.auth.admin.deleteUser(data.user.id);throw dbErr;}
   return json({ok:true,email});
  }
  const id=String(body.user_id||"");if(!id)return json({ok:false,error:"Falta el identificador de la cuenta."},400);
  if(id===caller.id)return json({ok:false,error:"No puedes cambiar tus propios permisos o desactivar tu propia cuenta."},400);
  if(accion==="cambiar_rol"){
   const rol=body.rol;if(!['admin','consulta'].includes(rol))return json({ok:false,error:"Permiso no válido."},400);
   const {data:target}=await admin.from("admin_users").select("rol,activo").eq("user_id",id).maybeSingle();if(!target)return json({ok:false,error:"Cuenta no encontrada."},404);
   if(target.rol==='admin'&&target.activo&&rol==='consulta'){const {count}=await admin.from("admin_users").select("user_id",{count:"exact",head:true}).eq("rol","admin").eq("activo",true);if((count||0)<=1)return json({ok:false,error:"No puedes retirar el último administrador activo."},400);}
   const {error}=await admin.from("admin_users").update({rol,actualizado_en:new Date().toISOString()}).eq("user_id",id);if(error)throw error;return json({ok:true});
  }
  if(accion==="cambiar_estado"){
   const activo=body.activo===true;const {data:target}=await admin.from("admin_users").select("rol,activo,email").eq("user_id",id).maybeSingle();if(!target)return json({ok:false,error:"Cuenta no encontrada."},404);
   if(!activo&&target.rol==='admin'&&target.activo){const {count}=await admin.from("admin_users").select("user_id",{count:"exact",head:true}).eq("rol","admin").eq("activo",true);if((count||0)<=1)return json({ok:false,error:"No puedes desactivar el último administrador activo."},400);}
   const {error}=await admin.from("admin_users").update({activo,actualizado_en:new Date().toISOString()}).eq("user_id",id);if(error)throw error;
   await admin.auth.admin.updateUserById(id,{ban_duration:activo?"none":"876000h"});return json({ok:true});
  }
  return json({ok:false,error:"Acción no reconocida."},400);
 }catch(e){return json({ok:false,error:e?.message||"Error interno."},400);}
});
