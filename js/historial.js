(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const estado = { eventos: [], filtrados: [] };
  const campos = ['creado_en','accion','entidad','detalle','registro_id'];
  const entidadesConocidas = ['Integrantes','Roles de integrantes','Reglas de asignación','Disponibilidad','Excepciones de disponibilidad','Servicios','Asignaciones del cronograma','Confirmaciones','Reemplazos','Mensajes'];

  function escapar(valor){return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fechaLegible(valor){if(!valor)return '—';const d=new Date(valor);if(Number.isNaN(d.getTime()))return String(valor);return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(d);}
  function mensaje(texto,tipo=''){const el=$('mensajeHistorial');if(!el)return;el.textContent=texto;el.className='mensaje-historial'+(tipo?' '+tipo:'');}
  function badgeAccion(accion){const clase=accion==='Creación'?'creacion':accion==='Eliminación'?'eliminacion':'actualizacion';return `<span class="historial-badge ${clase}">${escapar(accion||'Acción')}</span>`;}

  async function cargarHistorial(){
    mensaje('Consultando los eventos registrados…');
    $('btnActualizarHistorial').disabled=true;
    try{
      const {data,error}=await supabaseClient.from('historial_actividad').select(campos.join(',')).order('creado_en',{ascending:false}).limit(500);
      if(error)throw error;
      estado.eventos=Array.isArray(data)?data:[];
      poblarEntidades();
      aplicarFiltros();
      const ultimo=estado.eventos[0];
      $('totalEventosHistorial').textContent=String(estado.eventos.length);
      $('ultimoEventoHistorial').textContent=ultimo?fechaLegible(ultimo.creado_en):'Sin eventos';
      mensaje(estado.eventos.length?'Historial actualizado.':'Aún no hay eventos. Las acciones quedarán registradas desde que se instaló el historial.', 'ok');
    }catch(error){
      console.error('Error cargando historial:',error);
      $('tablaHistorial').innerHTML='<tr><td colspan="5" class="historial-vacio">No se pudo cargar el historial.</td></tr>';
      $('pieHistorial').textContent='Verifica que hayas ejecutado supabase_historial_actividad.sql en Supabase y que la sesión sea de administrador.';
      mensaje('No se pudo cargar el historial: '+(error?.message||'error desconocido'), 'error');
    }finally{$('btnActualizarHistorial').disabled=false;}
  }
  function poblarEntidades(){
    const select=$('historialEntidad');const actual=select.value;
    const disponibles=[...new Set([...entidadesConocidas,...estado.eventos.map(e=>e.entidad).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'es'));
    select.innerHTML='<option value="">Todas las áreas</option>'+disponibles.map(v=>`<option value="${escapar(v)}">${escapar(v)}</option>`).join('');
    select.value=actual;
  }
  function aplicarFiltros(){
    const desde=$('historialDesde').value, hasta=$('historialHasta').value, accion=$('historialAccion').value, entidad=$('historialEntidad').value, q=$('buscarHistorial').value.trim().toLocaleLowerCase('es');
    estado.filtrados=estado.eventos.filter(e=>{
      const fecha=(e.creado_en||'').slice(0,10);
      if(desde&&fecha<desde)return false;if(hasta&&fecha>hasta)return false;
      if(accion&&e.accion!==accion)return false;if(entidad&&e.entidad!==entidad)return false;
      return !q||[e.detalle,e.entidad,e.accion,e.tabla_origen,e.registro_id].some(v=>String(v||'').toLocaleLowerCase('es').includes(q));
    });
    pintarTabla();
  }
  function pintarTabla(){
    const tbody=$('tablaHistorial');
    if(!estado.filtrados.length){tbody.innerHTML='<tr><td colspan="5" class="historial-vacio">No hay eventos que coincidan con estos filtros.</td></tr>';}
    else tbody.innerHTML=estado.filtrados.map(e=>`<tr><td>${escapar(fechaLegible(e.creado_en))}</td><td>${badgeAccion(e.accion)}</td><td>${escapar(e.entidad||e.tabla_origen||'—')}</td><td>${escapar(e.detalle||'—')}</td><td><span class="historial-id" title="${escapar(e.registro_id||'')}">${escapar(e.registro_id||'—')}</span></td></tr>`).join('');
    $('pieHistorial').textContent=`Mostrando ${estado.filtrados.length} de ${estado.eventos.length} eventos cargados (máximo 500 recientes).`;
  }
  function exportarCSV(){
    if(!estado.filtrados.length){mensaje('No hay eventos para exportar con los filtros actuales.','error');return;}
    const filas=[['Fecha y hora','Acción','Área','Detalle','ID del registro'],...estado.filtrados.map(e=>[e.creado_en,e.accion,e.entidad,e.detalle,e.registro_id])];
    const csv='\uFEFF'+filas.map(f=>f.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='historial-actividad.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);mensaje('CSV exportado.','ok');
  }
  function limpiarFiltros(){['historialDesde','historialHasta','historialAccion','historialEntidad','buscarHistorial'].forEach(id=>$(id).value='');aplicarFiltros();}
  function configurarMenu(){const b=$('btnMenuHistorial'),overlay=$('menuOverlayHistorial'),sidebar=document.querySelector('.sidebar');if(!b||!sidebar)return;b.addEventListener('click',()=>{sidebar.classList.toggle('abierto');overlay?.classList.toggle('activo');});overlay?.addEventListener('click',()=>{sidebar.classList.remove('abierto');overlay.classList.remove('activo');});}
  document.addEventListener('DOMContentLoaded',()=>{
    $('btnActualizarHistorial').addEventListener('click',cargarHistorial);$('btnExportarHistorial').addEventListener('click',exportarCSV);$('btnLimpiarFiltrosHistorial').addEventListener('click',limpiarFiltros);
    ['historialDesde','historialHasta','historialAccion','historialEntidad','buscarHistorial'].forEach(id=>$(id).addEventListener(id==='buscarHistorial'?'input':'change',aplicarFiltros));
    configurarMenu();cargarHistorial();
  });
})();
