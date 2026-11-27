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

  function generarInformePDF(){
    if(!datosActuales.mes){mostrarMensaje('Primero carga las estadísticas de un mes.','error');return;}
    const personas=new Map();
    datosActuales.integrantes.forEach(p=>personas.set(String(p.id),{nombre:p.nombre||'Sin nombre',instrumento:p.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0}));
    datosActuales.asignaciones.forEach(a=>{
      const k=String(a.integrante_id);
      if(!personas.has(k))personas.set(k,{nombre:a.integrantes?.nombre||'Integrante',instrumento:a.integrantes?.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0});
      const p=personas.get(k);p.total++;
      const e=estadoAsignacion(a);if(e==='Confirmado')p.confirmadas++;else if(e==='No puede')p.noPuede++;else if(e==='Reemplazado')p.reemplazado++;else p.pendientes++;
    });
    const lista=[...personas.values()].sort((a,b)=>b.total-a.total||a.nombre.localeCompare(b.nombre,'es'));
    const total=datosActuales.asignaciones.length,confirmadas=contarEstado(datosActuales.asignaciones,'Confirmado');
    const pendientes=contarEstado(datosActuales.asignaciones,'Pendiente'),noPuede=contarEstado(datosActuales.asignaciones,'No puede'),reemplazadas=contarEstado(datosActuales.asignaciones,'Reemplazado');
    const pct=total?Math.round(confirmadas/total*100):0;
    const roles=new Map();datosActuales.asignaciones.forEach(a=>{const k=a.rol||'Sin rol';roles.set(k,(roles.get(k)||0)+1);});
    const maxEstado=Math.max(1,confirmadas,pendientes,noPuede,reemplazadas),maxRol=Math.max(1,...roles.values());
    const barra=(label,value,max,color)=>`<div class="barrow"><span>${escapar(label)}</span><div class="track"><i style="width:${Math.max(value?2:0,value/max*100)}%;background:${color}"></i></div><b>${value}</b></div>`;
    const filasPersonas=lista.map(p=>`<tr><td>${escapar(p.nombre)}</td><td>${escapar(p.instrumento)}</td><td>${p.total}</td><td>${p.confirmadas}</td><td>${p.pendientes}</td><td>${p.noPuede}</td><td>${p.reemplazado}</td></tr>`).join('');
    const asignacionesPorServicio=new Map();datosActuales.asignaciones.forEach(a=>{const k=String(a.servicio_id);if(!asignacionesPorServicio.has(k))asignacionesPorServicio.set(k,[]);asignacionesPorServicio.get(k).push(a);});
    const filasServicios=[...datosActuales.servicios].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||String(a.hora).localeCompare(String(b.hora))).map(s=>{const aa=asignacionesPorServicio.get(String(s.id))||[];return `<tr><td>${escapar(fechaBonita(s.fecha))}</td><td>${escapar(horaBonita(s.hora))}</td><td>${escapar(s.tipo||'—')}</td><td>${s.activo===false?'Inactivo':'Activo'}</td><td>${aa.length}</td><td>${contarEstado(aa,'Confirmado')}</td><td>${contarEstado(aa,'Pendiente')}</td></tr>`;}).join('');
    const mesTexto=new Date(`${datosActuales.mes}-15T12:00:00`).toLocaleDateString('es-CO',{month:'long',year:'numeric'});
    const w=window.open('','_blank');if(!w){mostrarMensaje('El navegador bloqueó la ventana del informe. Permite ventanas emergentes e inténtalo de nuevo.','error');return;}
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autoevaluación ${escapar(datosActuales.mes)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;background:#fff;font-size:12px}.page{max-width:1000px;margin:28px auto;padding:0 24px}.head{background:#172554;color:white;padding:25px 28px;border-radius:14px}.head h1{font-size:24px;margin:0 0 6px}.head p{margin:0;color:#dbeafe}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.kpi{border:1px solid #dbe3ef;border-radius:10px;padding:13px}.kpi small{display:block;color:#64748b}.kpi b{font-size:24px;display:block;margin-top:5px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{border:1px solid #dbe3ef;border-radius:10px;padding:15px;margin:0 0 16px;break-inside:avoid}.card h2{font-size:15px;margin:0 0 12px;color:#172554}.barrow{display:grid;grid-template-columns:120px 1fr 28px;gap:8px;align-items:center;margin:10px 0}.track{height:10px;background:#eef2f7;border-radius:20px;overflow:hidden}.track i{display:block;height:100%;border-radius:20px}.barrow b{text-align:right}.tablewrap{overflow:visible}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:7px 6px;border-bottom:1px solid #e5eaf1;text-align:left}th{background:#f1f5f9;color:#475569}td:nth-child(n+3){text-align:center}.prompts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.prompt{min-height:75px;border:1px solid #cbd5e1;border-radius:8px;padding:10px}.prompt b{display:block;margin-bottom:8px}.foot{color:#64748b;font-size:10px;margin:16px 0 28px}.actions{position:sticky;top:0;background:#fff;padding:12px;text-align:right;border-bottom:1px solid #e2e8f0}.actions button{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:bold;cursor:pointer}@media print{.actions{display:none}.page{margin:0 auto;padding:0 8px}.head{print-color-adjust:exact;-webkit-print-color-adjust:exact}.track i,.kpi{print-color-adjust:exact;-webkit-print-color-adjust:exact}body{font-size:11px}@page{size:A4;margin:12mm}}
      @media(max-width:650px){.cols,.prompts{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}.page{padding:0 12px}}
      </style></head><body><div class="actions"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div><main class="page">
      <header class="head"><h1>Informe mensual de alabanza</h1><p>IPUC Líbano Central · ${escapar(mesTexto)}</p><p>Informe de participación y autoevaluación grupal</p></header>
      <section class="kpis"><div class="kpi"><small>Servicios registrados</small><b>${datosActuales.servicios.length}</b></div><div class="kpi"><small>Asignaciones</small><b>${total}</b></div><div class="kpi"><small>Confirmaciones</small><b>${confirmadas} (${pct}%)</b></div><div class="kpi"><small>Reemplazos registrados</small><b>${datosActuales.reemplazos.length}</b></div></section>
      <section class="cols"><article class="card"><h2>Estado de las asignaciones</h2>${barra('Confirmadas',confirmadas,maxEstado,'#16a34a')}${barra('Pendientes',pendientes,maxEstado,'#d97706')}${barra('No puede',noPuede,maxEstado,'#dc2626')}${barra('Reemplazadas',reemplazadas,maxEstado,'#64748b')}</article><article class="card"><h2>Participación por rol</h2>${[...roles.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>barra(k,v,maxRol,'#2563eb')).join('')||'<p>Sin asignaciones registradas.</p>'}</article></section>
      <section class="card"><h2>Participación por integrante</h2><div class="tablewrap"><table><thead><tr><th>Integrante</th><th>Instrumento</th><th>Total</th><th>Confirmadas</th><th>Pendientes</th><th>No puede</th><th>Reemplazado</th></tr></thead><tbody>${filasPersonas||'<tr><td colspan="7">Sin datos</td></tr>'}</tbody></table></div></section>
      <section class="card"><h2>Resumen de servicios</h2><div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Asignaciones</th><th>Confirmadas</th><th>Pendientes</th></tr></thead><tbody>${filasServicios||'<tr><td colspan="7">Sin servicios</td></tr>'}</tbody></table></div></section>
      <section class="card"><h2>Autoevaluación del equipo</h2><div class="prompts"><div class="prompt"><b>1. ¿Qué hicimos bien como equipo este mes?</b></div><div class="prompt"><b>2. ¿Qué dificultades se presentaron?</b></div><div class="prompt"><b>3. ¿Qué debemos mejorar?</b></div><div class="prompt"><b>4. ¿Qué compromiso asumimos para el próximo mes?</b></div></div></section>
      <p class="foot">Los indicadores reflejan el estado actual de las asignaciones consultadas para el mes. Este informe es una herramienta de reflexión y mejora colectiva, no una calificación individual.</p></main></body></html>`);
    w.document.close();mostrarMensaje('Informe preparado. Usa “Imprimir / Guardar como PDF” en la nueva pestaña.','exito');
  }

  window.toggleMenuEstadisticas=function(){document.querySelector('.sidebar')?.classList.toggle('abierto');$('menuOverlayEstadisticas')?.classList.toggle('activo');};
  window.cerrarMenuEstadisticas=function(){document.querySelector('.sidebar')?.classList.remove('abierto');$('menuOverlayEstadisticas')?.classList.remove('activo');};
  document.addEventListener('DOMContentLoaded',()=>{$('mesEstadisticas').value=mesLocal();$('actualizarEstadisticas').addEventListener('click',cargarEstadisticas);$('mesEstadisticas').addEventListener('change',cargarEstadisticas);$('buscarEstadistica').addEventListener('input',renderParticipacion);$('exportarEstadisticas').addEventListener('click',exportarCSV);$('generarInformePDF').addEventListener('click',generarInformePDF);cargarEstadisticas();});
})();
