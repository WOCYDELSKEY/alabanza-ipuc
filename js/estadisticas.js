(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  let datosActuales = { mes:'', servicios:[], asignaciones:[], integrantes:[], reemplazos:[] };
  const estados = [
    {key:'Confirmado',label:'Confirmadas',color:'verde'},
    {key:'Pendiente',label:'Pendientes',color:'ambar'},
    {key:'No puede',label:'No puede',color:'rojo'},
    {key:'Reemplazado',label:'Reemplazadas',color:''}
  ];
  function escapar(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function mesLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  function limitesMes(mes){const [y,m]=mes.split('-').map(Number);return {desde:`${mes}-01`,hasta:`${mes}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`};}
  function fechaBonita(f){return f?new Date(`${f}T12:00:00`).toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short',year:'numeric'}):'—';}
  function horaBonita(h){return String(h||'').slice(0,5)||'—';}
  function estadoAsignacion(a){return a.estado||'Pendiente';}
  function mostrarMensaje(texto,tipo=''){const e=$('mensajeEstadisticas');e.textContent=texto;e.className=`mensaje-estadisticas ${tipo}`.trim();}
  function contarEstado(lista,estado){return lista.filter(a=>estadoAsignacion(a)===estado).length;}
  function dibujarBarras(id,items){
    const cont=$ (id);
    if(!items.length){cont.innerHTML='<p class="sin-datos-estadisticas">No hay datos para mostrar en este mes.</p>';return;}
    const max=Math.max(1,...items.map(x=>x.valor));
    cont.innerHTML=items.map(x=>`<div class="barra-fila"><span class="barra-etiqueta" title="${escapar(x.label)}">${escapar(x.label)}</span><div class="barra-fondo"><div class="barra-relleno ${escapar(x.color||'')}" style="width:${Math.max(x.valor>0?3:0,(x.valor/max)*100)}%"></div></div><span class="barra-valor">${x.valor}</span></div>`).join('');
  }
  function renderEstados(asignaciones){
    const items=estados.map(e=>({label:e.label,valor:contarEstado(asignaciones,e.key),color:e.color}));
    dibujarBarras('graficaEstados',items);
    $('leyendaEstados').innerHTML=items.map(e=>`<span><i class="leyenda-punto ${e.color}"></i>${escapar(e.label)}: ${e.valor}</span>`).join('');
  }
  function renderRoles(asignaciones){
    const mapa=new Map();asignaciones.forEach(a=>{const rol=String(a.rol||'Sin rol');mapa.set(rol,(mapa.get(rol)||0)+1);});
    const items=[...mapa.entries()].map(([label,valor])=>({label,valor})).sort((a,b)=>b.valor-a.valor||a.label.localeCompare(b.label,'es'));
    dibujarBarras('graficaRoles',items);
  }
  function renderParticipacion(){
    const busqueda=$('buscarEstadistica').value.trim().toLocaleLowerCase('es');
    const porPersona=new Map();
    datosActuales.integrantes.forEach(p=>porPersona.set(String(p.id),{id:p.id,nombre:p.nombre||'Sin nombre',instrumento:p.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0}));
    datosActuales.asignaciones.forEach(a=>{
      const id=String(a.integrante_id);if(!porPersona.has(id))porPersona.set(id,{id:a.integrante_id,nombre:a.integrantes?.nombre||'Integrante',instrumento:a.integrantes?.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0});
      const p=porPersona.get(id);p.total++;
      const estado=estadoAsignacion(a);if(estado==='Confirmado')p.confirmadas++;else if(estado==='No puede')p.noPuede++;else if(estado==='Reemplazado')p.reemplazado++;else p.pendientes++;
    });
    const lista=[...porPersona.values()].filter(p=>`${p.nombre} ${p.instrumento}`.toLocaleLowerCase('es').includes(busqueda)).sort((a,b)=>b.total-a.total||a.nombre.localeCompare(b.nombre,'es'));
    const tbody=$('tablaParticipacion');
    if(!lista.length){tbody.innerHTML='<tr><td colspan="7" class="sin-datos-estadisticas">No hay integrantes que coincidan con la búsqueda.</td></tr>';return;}
    tbody.innerHTML=lista.map(p=>`<tr><td><span class="participacion-nombre">${escapar(p.nombre)}</span></td><td>${escapar(p.instrumento)}</td><td class="numero">${p.total}</td><td class="numero">${p.confirmadas}</td><td class="numero">${p.pendientes}</td><td class="numero">${p.noPuede}</td><td class="numero">${p.reemplazado}</td></tr>`).join('');
  }
  function renderServicios(){
    const asignacionesPorServicio=new Map();datosActuales.asignaciones.forEach(a=>{const k=String(a.servicio_id);if(!asignacionesPorServicio.has(k))asignacionesPorServicio.set(k,[]);asignacionesPorServicio.get(k).push(a);});
    const servicios=[...datosActuales.servicios].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||String(a.hora).localeCompare(String(b.hora)));
    const tbody=$('tablaServiciosEstadisticas');
    if(!servicios.length){tbody.innerHTML='<tr><td colspan="7" class="sin-datos-estadisticas">No hay servicios registrados para este mes.</td></tr>';return;}
    tbody.innerHTML=servicios.map(s=>{const lista=asignacionesPorServicio.get(String(s.id))||[];const activo=s.activo!==false;return `<tr><td>${escapar(fechaBonita(s.fecha))}</td><td>${escapar(horaBonita(s.hora))}</td><td>${escapar(s.tipo||'—')}</td><td><span class="etiqueta-servicio ${activo?'':'inactivo'}">${activo?'Activo':'Inactivo'}</span></td><td class="numero">${lista.length}</td><td class="numero">${contarEstado(lista,'Confirmado')}</td><td class="numero">${contarEstado(lista,'Pendiente')}</td></tr>`;}).join('');
  }
  function renderTodo(){
    const s=datosActuales.servicios,a=datosActuales.asignaciones,r=datosActuales.reemplazos;
    const activas=s.filter(x=>x.activo!==false).length;
    const confirmadas=contarEstado(a,'Confirmado'),pendientes=contarEstado(a,'Pendiente');
    const pct=a.length?Math.round(confirmadas/a.length*100):0;
    $('kpiServicios').textContent=s.length;$('kpiServiciosDetalle').textContent=`${activas} activos · ${s.length-activas} inactivos`;
    $('kpiAsignaciones').textContent=a.length;$('kpiConfirmadas').textContent=confirmadas;$('kpiConfirmadasDetalle').textContent=`${pct}% de las asignaciones`;
    $('kpiPendientes').textContent=pendientes;$('kpiReemplazos').textContent=r.length;$('kpiReemplazosDetalle').textContent=`${r.filter(x=>['Pendiente','Asignado','Aceptado'].includes(x.estado)).length} activos o pendientes`;
    renderEstados(a);renderRoles(a);renderParticipacion();renderServicios();
  }
  async function cargarEstadisticas(){
    const mes=$('mesEstadisticas').value;if(!/^\d{4}-\d{2}$/.test(mes)){mostrarMensaje('Selecciona un mes válido.','error');return;}
    const btn=$('actualizarEstadisticas');btn.disabled=true;btn.textContent='Consultando…';mostrarMensaje(`Consultando datos de ${mes}…`);
    try{
      const {desde,hasta}=limitesMes(mes);
      const [serviciosResp,integrantesResp]=await Promise.all([
        supabaseClient.from('servicios').select('id,fecha,hora,tipo,activo').gte('fecha',desde).lte('fecha',hasta).order('fecha').order('hora'),
        supabaseClient.from('integrantes').select('id,nombre,instrumento,activo').eq('activo',true).order('nombre')
      ]);
      if(serviciosResp.error)throw new Error(`Servicios: ${serviciosResp.error.message}`);
      if(integrantesResp.error)throw new Error(`Integrantes: ${integrantesResp.error.message}`);
      const servicios=serviciosResp.data||[],integrantes=integrantesResp.data||[],ids=servicios.map(s=>s.id);
      let asignaciones=[];
      if(ids.length){const {data,error}=await supabaseClient.from('asignaciones').select('id,servicio_id,integrante_id,rol,estado,reemplaza_asignacion_id,integrantes(id,nombre,instrumento)').in('servicio_id',ids);if(error)throw new Error(`Asignaciones: ${error.message}`);asignaciones=data||[];}
      const idsAsignacion=new Set(asignaciones.map(a=>String(a.id)));
      let reemplazos=[];
      if(idsAsignacion.size){const {data,error}=await supabaseClient.from('reemplazos').select('id,asignacion_original_id,integrante_reemplazo_id,estado,motivo').in('asignacion_original_id',[...idsAsignacion]);if(error)throw new Error(`Reemplazos: ${error.message}`);reemplazos=data||[];}
      datosActuales={mes,servicios,asignaciones,integrantes,reemplazos};renderTodo();
      mostrarMensaje(`Estadísticas actualizadas para ${mes}. Se analizaron ${servicios.length} servicio(s), ${asignaciones.length} asignación(es) y ${reemplazos.length} reemplazo(s).`,'exito');
    }catch(e){console.error('Error cargando estadísticas:',e);mostrarMensaje(`No fue posible cargar las estadísticas. ${e.message||'Revisa la conexión y los permisos de Supabase.'}`,'error');}
    finally{btn.disabled=false;btn.textContent='↻ Actualizar';}
  }
  function exportarCSV(){
    const filas=[['Informe de Alabanza IPUC',datosActuales.mes],[],['Participación por integrante','Instrumento','Asignaciones','Confirmadas','Pendientes','No puede','Reemplazado']];
    const map=new Map();datosActuales.integrantes.forEach(p=>map.set(String(p.id),{nombre:p.nombre||'Sin nombre',instrumento:p.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0}));
    datosActuales.asignaciones.forEach(a=>{const k=String(a.integrante_id);if(!map.has(k))map.set(k,{nombre:a.integrantes?.nombre||'Integrante',instrumento:a.integrantes?.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0});const p=map.get(k);p.total++;const e=estadoAsignacion(a);if(e==='Confirmado')p.confirmadas++;else if(e==='No puede')p.noPuede++;else if(e==='Reemplazado')p.reemplazado++;else p.pendientes++;});
    [...map.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).forEach(p=>filas.push([p.nombre,p.instrumento,p.total,p.confirmadas,p.pendientes,p.noPuede,p.reemplazado]));
    filas.push([],['Servicios','Fecha','Hora','Tipo','Estado','Asignaciones','Confirmadas','Pendientes']);
    const porServicio=new Map();datosActuales.asignaciones.forEach(a=>{const k=String(a.servicio_id);if(!porServicio.has(k))porServicio.set(k,[]);porServicio.get(k).push(a);});
    datosActuales.servicios.forEach(s=>{const aa=porServicio.get(String(s.id))||[];filas.push([s.id,s.fecha,horaBonita(s.hora),s.tipo||'',s.activo===false?'Inactivo':'Activo',aa.length,contarEstado(aa,'Confirmado'),contarEstado(aa,'Pendiente')]);});
    const csv='\uFEFF'+filas.map(f=>f.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`estadisticas-alabanza-${datosActuales.mes||'mes'}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);mostrarMensaje('Informe CSV descargado.','exito');
  }
  window.toggleMenuEstadisticas=function(){document.querySelector('.sidebar')?.classList.toggle('abierto');$('menuOverlayEstadisticas')?.classList.toggle('activo');};
  window.cerrarMenuEstadisticas=function(){document.querySelector('.sidebar')?.classList.remove('abierto');$('menuOverlayEstadisticas')?.classList.remove('activo');};
  document.addEventListener('DOMContentLoaded',()=>{$('mesEstadisticas').value=mesLocal();$('actualizarEstadisticas').addEventListener('click',cargarEstadisticas);$('mesEstadisticas').addEventListener('change',cargarEstadisticas);$('buscarEstadistica').addEventListener('input',renderParticipacion);$('exportarEstadisticas').addEventListener('click',exportarCSV);cargarEstadisticas();});
})();
