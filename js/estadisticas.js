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

  function obtenerParticipacionCompleta(){
    const mapa=new Map();
    datosActuales.integrantes.forEach(p=>mapa.set(String(p.id),{nombre:p.nombre||'Sin nombre',instrumento:p.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0}));
    datosActuales.asignaciones.forEach(a=>{const k=String(a.integrante_id);if(!mapa.has(k))mapa.set(k,{nombre:a.integrantes?.nombre||'Integrante',instrumento:a.integrantes?.instrumento||'—',total:0,confirmadas:0,pendientes:0,noPuede:0,reemplazado:0});const x=mapa.get(k);x.total++;const e=estadoAsignacion(a);if(e==='Confirmado')x.confirmadas++;else if(e==='No puede')x.noPuede++;else if(e==='Reemplazado')x.reemplazado++;else x.pendientes++;});
    return [...mapa.values()].sort((a,b)=>b.total-a.total||a.nombre.localeCompare(b.nombre,'es'));
  }
  function htmlSeguro(v){return escapar(v);}
  function barrasInforme(items){
    if(!items.length)return '<p class="muted">Sin datos para este mes.</p>';
    const max=Math.max(1,...items.map(x=>x.valor));
    return `<div class="bars">${items.map(x=>`<div class="barrow"><span>${htmlSeguro(x.label)}</span><div class="track"><i style="width:${Math.max(x.valor?2:0,x.valor/max*100)}%;background:${x.color||'#2563eb'}"></i></div><b>${x.valor}</b></div>`).join('')}</div>`;
  }
  function descargarInformePDF(){
    if(!datosActuales.mes){mostrarMensaje('Primero carga las estadísticas del mes.','error');return;}
    const s=datosActuales.servicios,a=datosActuales.asignaciones,r=datosActuales.reemplazos;
    const activas=s.filter(x=>x.activo!==false).length,confirmadas=contarEstado(a,'Confirmado'),pendientes=contarEstado(a,'Pendiente');
    const porcentaje=a.length?Math.round(confirmadas/a.length*100):0;
    const participacion=obtenerParticipacionCompleta();
    const rolesMap=new Map();a.forEach(x=>{const rol=x.rol||'Sin rol';rolesMap.set(rol,(rolesMap.get(rol)||0)+1);});
    const roles=[...rolesMap.entries()].map(([label,valor])=>({label,valor})).sort((x,y)=>y.valor-x.valor);
    const estadoItems=[{label:'Confirmadas',valor:contarEstado(a,'Confirmado'),color:'#16a34a'},{label:'Pendientes',valor:pendientes,color:'#d97706'},{label:'No puede',valor:contarEstado(a,'No puede'),color:'#dc2626'},{label:'Reemplazadas',valor:contarEstado(a,'Reemplazado'),color:'#64748b'}];
    const porServicio=new Map();a.forEach(x=>{const k=String(x.servicio_id);if(!porServicio.has(k))porServicio.set(k,[]);porServicio.get(k).push(x);});
    const serviciosHTML=[...s].sort((x,y)=>String(x.fecha).localeCompare(String(y.fecha))||String(x.hora).localeCompare(String(y.hora))).map(x=>{const aa=porServicio.get(String(x.id))||[];return `<tr><td>${htmlSeguro(fechaBonita(x.fecha))}</td><td>${htmlSeguro(horaBonita(x.hora))}</td><td>${htmlSeguro(x.tipo||'—')}</td><td>${x.activo===false?'Inactivo':'Activo'}</td><td>${aa.length}</td><td>${contarEstado(aa,'Confirmado')}</td><td>${contarEstado(aa,'Pendiente')}</td></tr>`;}).join('');
    const integrantesHTML=participacion.map(x=>`<tr><td>${htmlSeguro(x.nombre)}</td><td>${htmlSeguro(x.instrumento)}</td><td>${x.total}</td><td>${x.confirmadas}</td><td>${x.pendientes}</td><td>${x.noPuede}</td><td>${x.reemplazado}</td></tr>`).join('');
    const doc=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de autoevaluación ${datosActuales.mes}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;background:#eef2f7;font-size:12px}.sheet{max-width:1000px;margin:24px auto;background:#fff;padding:34px 38px;box-shadow:0 5px 25px #0f172a18}.head{border-bottom:3px solid #1d4ed8;padding-bottom:18px;margin-bottom:20px}.eyebrow{color:#2563eb;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;font-size:10px}.head h1{font-size:27px;margin:7px 0}.sub{color:#64748b;font-size:13px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.kpi{border:1px solid #dbe3ef;border-radius:10px;padding:13px}.kpi small{display:block;color:#64748b;font-weight:700}.kpi strong{display:block;font-size:24px;margin-top:5px;color:#0f172a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.panel{border:1px solid #dbe3ef;border-radius:10px;padding:15px;break-inside:avoid}.panel h2,.section h2{font-size:15px;margin:0 0 12px;color:#1e3a8a}.bars{display:grid;gap:10px}.barrow{display:grid;grid-template-columns:115px 1fr 28px;gap:8px;align-items:center}.barrow span{font-size:11px;overflow-wrap:anywhere}.track{height:10px;background:#eef2f7;border-radius:20px;overflow:hidden}.track i{display:block;height:100%;border-radius:20px}.barrow b{text-align:right}.section{margin-top:22px}.section p{color:#64748b;margin:0 0 10px}table{width:100%;border-collapse:collapse;font-size:10.5px}th{background:#eff6ff;color:#1e3a8a;text-align:left}th,td{padding:8px 7px;border-bottom:1px solid #e2e8f0}td:nth-child(n+3),th:nth-child(n+3){text-align:center}.muted{color:#64748b}.reflection{display:grid;grid-template-columns:1fr 1fr;gap:12px}.question{border:1px solid #dbe3ef;border-radius:9px;padding:12px;min-height:82px}.question b{display:block;margin-bottom:8px}.lines{height:35px;border-bottom:1px dashed #cbd5e1}.foot{margin-top:24px;padding-top:12px;border-top:1px solid #dbe3ef;color:#64748b;font-size:10px;display:flex;justify-content:space-between}.print-tip{max-width:1000px;margin:12px auto;color:#475569;font-size:12px;text-align:center}@media print{body{background:#fff}.sheet{margin:0;max-width:none;box-shadow:none;padding:15mm}.print-tip{display:none}.panel,.kpi,.question{break-inside:avoid}table{break-inside:auto}tr{break-inside:avoid} @page{size:A4;margin:10mm}}
      </style></head><body><div class="print-tip">En la ventana de impresión, selecciona “Guardar como PDF” para descargar y compartir el informe.</div><main class="sheet"><header class="head"><div class="eyebrow">Alabanza · IPUC Líbano Central</div><h1>Informe mensual de autoevaluación</h1><div class="sub">Periodo: ${htmlSeguro(datosActuales.mes)} · Generado el ${new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'})}</div></header>
      <section class="kpis"><div class="kpi"><small>Servicios registrados</small><strong>${s.length}</strong><small>${activas} activos · ${s.length-activas} inactivos</small></div><div class="kpi"><small>Asignaciones</small><strong>${a.length}</strong></div><div class="kpi"><small>Confirmaciones</small><strong>${confirmadas}</strong><small>${porcentaje}% de asignaciones</small></div><div class="kpi"><small>Reemplazos registrados</small><strong>${r.length}</strong></div></section>
      <section class="grid"><article class="panel"><h2>Distribución por estado</h2>${barrasInforme(estadoItems)}</article><article class="panel"><h2>Participación por rol</h2>${barrasInforme(roles)}</article></section>
      <section class="section"><h2>Participación por integrante</h2><p>Incluye integrantes activos que no tuvieron asignaciones durante el periodo.</p><table><thead><tr><th>Integrante</th><th>Instrumento</th><th>Total</th><th>Confirmadas</th><th>Pendientes</th><th>No puede</th><th>Reemplazado</th></tr></thead><tbody>${integrantesHTML||'<tr><td colspan="7">Sin datos</td></tr>'}</tbody></table></section>
      <section class="section"><h2>Servicios del mes</h2><table><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Asignaciones</th><th>Confirmadas</th><th>Pendientes</th></tr></thead><tbody>${serviciosHTML||'<tr><td colspan="7">No hay servicios registrados</td></tr>'}</tbody></table></section>
      <section class="section"><h2>Espacio de autoevaluación grupal</h2><p>Preguntas para conversar al cierre del mes y acordar mejoras para el siguiente periodo.</p><div class="reflection"><div class="question"><b>1. ¿Qué hicimos bien como equipo este mes?</b><div class="lines"></div></div><div class="question"><b>2. ¿Qué dificultades se presentaron?</b><div class="lines"></div></div><div class="question"><b>3. ¿Cómo podemos mejorar la puntualidad, disponibilidad y confirmaciones?</b><div class="lines"></div></div><div class="question"><b>4. ¿Qué compromiso asumimos para el próximo mes?</b><div class="lines"></div></div></div></section>
      <footer class="foot"><span>Informe para reflexión y mejora del equipo de alabanza.</span><span>IPUC Líbano Central</span></footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`;
    const w=window.open('','_blank');if(!w){mostrarMensaje('El navegador bloqueó la ventana del informe. Permite ventanas emergentes para descargar el PDF.','error');return;}
    w.document.open();w.document.write(doc);w.document.close();mostrarMensaje('Informe preparado. En la ventana de impresión selecciona “Guardar como PDF”.','exito');
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
  document.addEventListener('DOMContentLoaded',()=>{$('mesEstadisticas').value=mesLocal();$('actualizarEstadisticas').addEventListener('click',cargarEstadisticas);$('mesEstadisticas').addEventListener('change',cargarEstadisticas);$('buscarEstadistica').addEventListener('input',renderParticipacion);$('exportarEstadisticas').addEventListener('click',exportarCSV);$('exportarPDFEstadisticas').addEventListener('click',descargarInformePDF);cargarEstadisticas();});
})();
