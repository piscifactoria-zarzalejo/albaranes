// ════════════════════════════════════════════════════════
//  APLICACIÓN DE ALBARANES · Piscifactoría Ind. El Zarzalejo
// ════════════════════════════════════════════════════════
(function () {
  const B = window.crearBackend();
  const ST = {
    usuario: null, ajustes: {}, clientes: [], productos: [],
    anio: new Date().getFullYear(),
    filtros: { texto: '', mes: '', estado: 'todos', pendientes: false },
    sucio: false
  };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = U.esc;
  const vista = () => $('#vista');

  // ── Avisos y ventanas ─────────────────────────────────
  function aviso(txt, tipo = 'ok', ms = 3500) {
    const d = document.createElement('div');
    d.className = 'aviso aviso-' + tipo; d.textContent = txt;
    $('#avisos').appendChild(d);
    setTimeout(() => d.classList.add('fuera'), ms);
    setTimeout(() => d.remove(), ms + 400);
  }
  function modal(html, alAbrir) {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(fondo);
    const cerrar = () => fondo.remove();
    fondo.addEventListener('mousedown', e => { if (e.target === fondo) cerrar(); });
    fondo.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
    $$('[data-cerrar]', fondo).forEach(b => b.onclick = cerrar);
    if (alAbrir) alAbrir(fondo, cerrar);
    const f = $('input,select,textarea,button', fondo); if (f) f.focus();
    return cerrar;
  }
  function confirmar(titulo, texto, boton = 'Aceptar', peligro = false) {
    return new Promise(res => {
      modal(`<h2>${esc(titulo)}</h2><p>${texto}</p>
        <div class="modal-botones"><button class="btn" data-cerrar data-no>Cancelar</button>
        <button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" data-si>${esc(boton)}</button></div>`,
        (m, cerrar) => {
          $('[data-si]', m).onclick = () => { cerrar(); res(true); };
          $('[data-no]', m).onclick = () => { cerrar(); res(false); };
        });
    });
  }
  async function ocupado(btn, fn) {
    const txt = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="giro"></span> Un momento…'; }
    try { return await fn(); }
    catch (e) { console.error(e); aviso(errorLegible(e), 'error', 7000); }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = txt; } }
  }

  // ── Carga de datos comunes ────────────────────────────
  async function cargarComunes() {
    const [aj, cl, pr] = await Promise.all([B.ajustes(), B.clientes(), B.productos()]);
    ST.ajustes = aj; ST.clientes = cl; ST.productos = pr;
    if (!ST.ajustes.empresa) ST.ajustes.empresa = window.SEMILLA.ajustes.empresa;
  }
  const clientePorId = id => ST.clientes.find(c => c.id === id);
  const productoPorId = id => ST.productos.find(p => p.id === id);

  // ── Navegación ────────────────────────────────────────
  const RUTAS = [
    [/^#\/albaranes$/, verLista],
    [/^#\/nuevo$/, () => verEditor(null)],
    [/^#\/nuevo\/copia\/(\d+)$/, m => verEditor(null, Number(m[1]))],
    [/^#\/editar\/(\d+)$/, m => verEditor(Number(m[1]))],
    [/^#\/albaran\/(\d+)$/, m => verAlbaran(Number(m[1]))],
    [/^#\/clientes$/, verClientes],
    [/^#\/productos$/, verProductos],
    [/^#\/resumen$/, verResumen],
    [/^#\/ajustes$/, verAjustes]
  ];
  let hashAnterior = location.hash;
  async function enrutar() {
    if (ST.sucio && location.hash !== hashAnterior) {
      const ok = await confirmar('Cambios sin guardar', 'Has hecho cambios en el albarán que no se han guardado. ¿Salir sin guardar?', 'Salir sin guardar', true);
      if (!ok) { history.replaceState(null, '', hashAnterior); return; }
      ST.sucio = false;
    }
    hashAnterior = location.hash;
    $$('.modal-fondo').forEach(m => m.remove());
    if (!ST.usuario) return verLogin();
    const h = location.hash || '#/albaranes';
    $$('.nav a').forEach(a => a.classList.toggle('activo', h.startsWith(a.getAttribute('href')) || (a.getAttribute('href') === '#/albaranes' && /^#\/(albaran|editar)/.test(h))));
    for (const [re, fn] of RUTAS) {
      const m = h.match(re);
      if (m) {
        window.scrollTo(0, 0);
        try { return await fn(m); }
        catch (e) {
          console.error(e);
          vista().innerHTML = `<div class="tarjeta vacio"><h2>No se ha podido abrir</h2><p>${esc(errorLegible(e))}</p>
            <div class="fila-botones" style="justify-content:center"><button class="btn" onclick="location.reload()">Reintentar</button><a class="btn" href="#/albaranes">Ir a albaranes</a></div></div>`;
          return;
        }
      }
    }
    location.hash = '#/albaranes';
  }
  window.addEventListener('hashchange', enrutar);
  window.addEventListener('beforeunload', e => { if (ST.sucio) { e.preventDefault(); e.returnValue = ''; } });

  // ══════════════════════════════════════════════════════
  //  ENTRAR
  // ══════════════════════════════════════════════════════
  function verLogin() {
    $('#cabecera').hidden = true;
    vista().innerHTML = `
      <div class="login">
        <img src="${window.IMG.logo.src}" alt="" class="login-logo">
        <h1>Albaranes</h1>
        <p class="tenue">Piscifactoría Ind. El Zarzalejo</p>
        <form id="f-login" class="tarjeta">
          <label>Correo<input type="email" name="email" autocomplete="username" required></label>
          <label>Contraseña<input type="password" name="pass" autocomplete="current-password" required></label>
          <button class="btn btn-primario btn-grande" type="submit">Entrar</button>
        </form>
      </div>`;
    $('#f-login').onsubmit = e => {
      e.preventDefault();
      const f = e.target;
      ocupado($('button', f), async () => {
        ST.usuario = await B.entrar(f.email.value.trim(), f.pass.value);
        await arrancar();
      });
    };
  }

  // ══════════════════════════════════════════════════════
  //  LISTADO DE ALBARANES
  // ══════════════════════════════════════════════════════
  async function verLista() {
    vista().innerHTML = '<div class="cargando"><span class="giro"></span> Cargando albaranes…</div>';
    const [lista, anios] = await Promise.all([B.albaranes(ST.anio), B.anios()]);
    if (!anios.includes(ST.anio)) anios.unshift(ST.anio);
    ST.lista = lista;
    if (!ST.sel) ST.sel = new Set();
    for (const id of [...ST.sel]) if (!lista.some(a => a.id === id)) ST.sel.delete(id);
    const F = ST.filtros;
    vista().innerHTML = `
      <div class="barra-titulo">
        <h1>Albaranes</h1>
        <div class="acciones">
          <button class="btn" id="b-exportar" title="Descarga un Excel con todos los albaranes de todos los años">Exportar todo a Excel</button>
          <a class="btn btn-primario btn-grande" href="#/nuevo">+ Nuevo albarán</a>
        </div>
      </div>
      <div class="filtros tarjeta">
        <label class="crece">Buscar<input id="f-texto" type="search" placeholder="Nº de albarán, cliente, lote…" value="${esc(F.texto)}"></label>
        <label>Año<select id="f-anio">${anios.map(a => `<option ${a === ST.anio ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label>Mes<select id="f-mes"><option value="">Todos</option>${U.MESES.map((m, i) => `<option value="${i + 1}" ${String(i + 1) === String(F.mes) ? 'selected' : ''}>${m[0] + m.slice(1).toLowerCase()}</option>`).join('')}</select></label>
        <label>Estado<select id="f-estado">
          <option value="todos">Todos</option><option value="activo" ${F.estado === 'activo' ? 'selected' : ''}>Válidos</option>
          <option value="anulado" ${F.estado === 'anulado' ? 'selected' : ''}>Anulados</option></select></label>
        <label class="check"><input type="checkbox" id="f-pend" ${F.pendientes ? 'checked' : ''}> Pendientes de enviar a asesoría</label>
      </div>
      <div class="barra-sel tarjeta" id="barra-sel">
        <span id="sel-texto" class="sel-texto"></span>
        <div class="acciones">
          <button class="btn" id="b-imprimir-sel">🖨 Imprimir</button>
          <button class="btn" id="b-pdf-sel">Guardar PDF</button>
          <button class="btn" id="b-enviados">Marcar enviados a asesoría</button>
          <button class="btn enlace" id="b-quitar-sel">Quitar selección</button>
        </div>
      </div>
      <div id="tabla-lista"></div>`;

    // los albaranes sobre los que actúan los botones: los marcados, o si no hay ninguno, los de la lista
    const objetivo = () => { const f = filtrarLista(); const m = f.filter(a => ST.sel.has(a.id)); return m.length ? m : f; };
    const pintarBarra = () => {
      const f = filtrarLista(), n = f.filter(a => ST.sel.has(a.id)).length;
      $('#sel-texto').innerHTML = n ? `<b>${n}</b> ${n > 1 ? 'albaranes seleccionados' : 'albarán seleccionado'}` : `Sin selección: los botones actúan sobre los <b>${f.length}</b> albaranes de la lista`;
      $('#barra-sel').classList.toggle('con-sel', n > 0);
      $('#b-quitar-sel').hidden = !n;
      const todos = $('#sel-todos');
      if (todos) { todos.checked = n > 0 && n === f.length; todos.indeterminate = n > 0 && n < f.length; }
    };
    const pintar = () => {
      const filtrados = filtrarLista();
      const validos = filtrados.filter(a => a.estado === 'activo');
      const sumT = validos.reduce((s, a) => s + Number(a.total || 0), 0);
      $('#tabla-lista').innerHTML = filtrados.length === 0
        ? `<div class="vacio tarjeta">${lista.length ? 'Ningún albarán coincide con la búsqueda.' : 'Todavía no hay albaranes en ' + ST.anio + '. Pulsa <b>+ Nuevo albarán</b> para hacer el primero.'}</div>`
        : `<div class="tabla-envoltura tarjeta"><table class="tabla tabla-clic">
          <thead><tr><th class="col-sel"><input type="checkbox" id="sel-todos" aria-label="Seleccionar todos"></th><th>Nº albarán</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th class="num">Kilos</th><th class="num">Total</th><th>Estado</th></tr></thead>
          <tbody>${filtrados.map(a => `
            <tr data-id="${a.id}" class="${a.estado === 'anulado' ? 'fila-anulada' : ''} ${ST.sel.has(a.id) ? 'fila-sel' : ''}">
              <td class="col-sel"><input type="checkbox" data-sel="${a.id}" ${ST.sel.has(a.id) ? 'checked' : ''} aria-label="Seleccionar albarán ${a.numero}"></td>
              <td class="fuerte">${a.numero}</td><td>${U.fechaLarga(a.fecha)}</td>
              <td>${esc(a.cliente?.nombre)}</td>
              <td class="tenue peq">${esc(resumenProductos(a))}</td>
              <td class="num">${U.kg(a.kilos)}</td><td class="num fuerte">${U.eur(a.total)}</td>
              <td>${etiquetasEstado(a)}</td>
            </tr>`).join('')}</tbody>
          <tfoot><tr><td></td><td colspan="4">${filtrados.length} albaranes${validos.length !== filtrados.length ? ` (${filtrados.length - validos.length} anulados, no suman)` : ''}</td>
            <td></td><td class="num">${U.eur(sumT)}</td><td></td></tr></tfoot>
        </table></div>`;
      $$('#tabla-lista tbody tr').forEach(tr => tr.onclick = e => {
        if (e.target.closest('.col-sel')) return;
        location.hash = '#/albaran/' + tr.dataset.id;
      });
      $$('#tabla-lista td.col-sel').forEach(td => td.onclick = e => {
        const cb = $('input', td); if (e.target !== cb) cb.checked = !cb.checked;
        const id = Number(cb.dataset.sel);
        cb.checked ? ST.sel.add(id) : ST.sel.delete(id);
        td.parentElement.classList.toggle('fila-sel', cb.checked);
        pintarBarra();
      });
      const todos = $('#sel-todos');
      if (todos) todos.onchange = () => {
        filtrados.forEach(a => todos.checked ? ST.sel.add(a.id) : ST.sel.delete(a.id));
        pintar();
      };
      pintarBarra();
    };
    pintar();
    $('#f-texto').oninput = e => { F.texto = e.target.value; pintar(); };
    $('#f-mes').onchange = e => { F.mes = e.target.value; pintar(); };
    $('#f-estado').onchange = e => { F.estado = e.target.value; pintar(); };
    $('#f-pend').onchange = e => { F.pendientes = e.target.checked; pintar(); };
    $('#f-anio').onchange = e => { ST.anio = Number(e.target.value); ST.sel.clear(); verLista(); };
    $('#b-quitar-sel').onclick = () => { ST.sel.clear(); pintar(); };

    $('#b-exportar').onclick = e => ocupado(e.target, async () => {
      const todos = await B.albaranes(null);
      exportarExcel(todos.sort((x, y) => x.numero - y.numero), 'albaranes_todos_' + U.hoy() + '.xlsx');
    });

    $('#b-imprimir-sel').onclick = async e => {
      const l = objetivo().filter(a => a.estado === 'activo');
      if (!l.length) return aviso('No hay albaranes válidos para imprimir (los anulados no se imprimen).', 'info');
      if (l.length > 1 && !await confirmar('Imprimir albaranes', `Se imprimirán <b>${l.length}</b> albaranes, 2 copias de cada uno (${l.length * 2} hojas).`, 'Imprimir')) return;
      ocupado(e.target, async () => ARCHIVOS.imprimir(window.generarPdfVarios(l, ST.ajustes, 2).output('blob')));
    };

    $('#b-pdf-sel').onclick = async e => {
      const l = objetivo();
      if (!l.length) return;
      let carpeta = null;                                     // siempre se elige dónde guardarlos
      if (ARCHIVOS.soportado()) {
        try { carpeta = await window.showDirectoryPicker({ id: 'albaranes-exportar', mode: 'readwrite', startIn: 'documents' }); }
        catch (err) { if (err.name === 'AbortError') return; carpeta = null; }
      }
      if (!carpeta && l.length > 1 && !await confirmar('Descargar PDF', `Se descargarán <b>${l.length}</b> archivos PDF. Si el navegador pregunta, permite las descargas múltiples.`, 'Descargar')) return;
      ocupado(e.target, async () => {
        let n = 0;
        for (const a of l) {
          const blob = window.generarPdf(a, ST.ajustes, 1).output('blob');
          if (carpeta) await ARCHIVOS.guardarEnCarpeta(carpeta, window.nombrePdfMes(a), blob);
          else { ARCHIVOS.descargar(blob, window.nombrePdfMes(a)); await new Promise(r => setTimeout(r, 350)); }
          n++;
        }
        aviso(carpeta ? `${n} PDF guardados en la carpeta «${carpeta.name}»` : `${n} PDF descargados`);
      });
    };

    $('#b-enviados').onclick = async e => {
      const ids = objetivo().filter(a => !a.enviado_asesoria_at || a.modificado_tras_envio).map(a => a.id);
      if (!ids.length) return aviso('Esos albaranes ya están marcados como enviados.', 'info');
      if (!await confirmar('Marcar como enviados', `Se marcarán <b>${ids.length}</b> albaranes como entregados a la asesoría. Si después se modifica alguno, aparecerá como <b>modificado tras envío</b>.`, 'Marcar enviados')) return;
      ocupado(e.target, async () => { await B.marcarEnviados(ids); ST.sel.clear(); aviso(ids.length + ' albaranes marcados como enviados'); verLista(); });
    };
  }

  function filtrarLista() {
    const F = ST.filtros, q = U.norm(F.texto.trim());
    return (ST.lista || []).filter(a => {
      if (F.estado !== 'todos' && a.estado !== F.estado) return false;
      if (F.mes && Number(a.fecha.slice(5, 7)) !== Number(F.mes)) return false;
      if (F.pendientes && a.enviado_asesoria_at && !a.modificado_tras_envio) return false;
      if (q) {
        const txt = U.norm([a.numero, a.pedido, a.cliente?.nombre, a.cliente?.cif, a.precinto, a.observaciones,
          ...(a.lineas || []).flatMap(l => [l.concepto, l.lote, l.estanque])].join(' '));
        return q.split(/\s+/).every(p => txt.includes(p));
      }
      return true;
    });
  }
  function resumenProductos(a) {
    const n = [...new Set((a.lineas || []).map(l => l.concepto))];
    return n.length > 2 ? n.slice(0, 2).join(', ') + ' y ' + (n.length - 2) + ' más' : n.join(', ');
  }
  function etiquetasEstado(a) {
    let s = '';
    if (a.estado === 'anulado') s += '<span class="etq etq-roja">Anulado</span>';
    if (a.modificado_tras_envio) s += '<span class="etq etq-naranja">Modificado tras envío</span>';
    else if (a.enviado_asesoria_at) s += '<span class="etq etq-verde">Enviado</span>';
    return s;
  }

  function exportarExcel(lista, nombreArchivo) {
    if (!lista.length) return aviso('No hay albaranes en la lista para exportar.', 'info');
    const cab = lista.map(a => ({
      'Nº albarán': a.numero, 'Fecha': U.fechaLarga(a.fecha), 'Año': Number(String(a.fecha).slice(0, 4)), 'Mes': U.MESES[Number(String(a.fecha).slice(5, 7)) - 1], 'Nº pedido': a.pedido || '',
      'Cód. cliente': a.cliente?.codigo ?? '', 'Cliente': a.cliente?.nombre || '', 'CIF/NIF': a.cliente?.cif || '',
      'Estado': a.estado === 'anulado' ? 'ANULADO' : 'Válido',
      'Kilos': Number(a.kilos), 'Unidades': Number(a.unidades), 'Suma importes': Number(a.suma),
      'Descuento %': Number(a.descuento) || 0, 'Base imponible': Number(a.base),
      'IVA': a.cliente?.regimen_iva && a.cliente.regimen_iva !== 'nacional' ? 'Exento' : (a.desglose_iva || []).map(g => g.tipo + '%').join(' / '),
      'Importe IVA': Number(a.iva), 'Total': Number(a.total), 'Precinto': a.precinto || '', 'Observaciones': a.observaciones || '',
      'Enviado asesoría': a.enviado_asesoria_at ? U.fechaHora(a.enviado_asesoria_at) : '',
      'Modificado tras envío': a.modificado_tras_envio ? 'SÍ' : ''
    }));
    const lin = lista.flatMap(a => (a.lineas || []).map(l => ({
      'Nº albarán': a.numero, 'Fecha': U.fechaLarga(a.fecha), 'Año': Number(String(a.fecha).slice(0, 4)), 'Mes': U.MESES[Number(String(a.fecha).slice(5, 7)) - 1], 'Cliente': a.cliente?.nombre || '',
      'Estado': a.estado === 'anulado' ? 'ANULADO' : 'Válido', 'Concepto': l.concepto, 'Familia': U.FAMILIAS[l.familia] || l.familia,
      'Kilos': U.parse(l.kilos), 'Unidades': U.parse(l.unidades), 'Talla cm': U.parse(l.talla_cm),
      'Precio': U.parse(l.precio), 'Forma de precio': U.UNIDADES[l.unidad_precio]?.precio || '', 'Total línea': U.calcLinea(l).total,
      'Lote': l.lote || '', 'Estanque': l.estanque || ''
    })));
    const wb = XLSX.utils.book_new();
    const h1 = XLSX.utils.json_to_sheet(cab), h2 = XLSX.utils.json_to_sheet(lin);
    h1['!cols'] = [10, 11, 6, 11, 10, 8, 40, 14, 9, 10, 10, 13, 10, 13, 8, 11, 13, 10, 30, 16, 12].map(w => ({ wch: w }));
    h2['!cols'] = [10, 11, 6, 11, 40, 9, 30, 20, 10, 10, 8, 9, 13, 12, 18, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, h1, 'Albaranes');
    XLSX.utils.book_append_sheet(wb, h2, 'Líneas');
    XLSX.writeFile(wb, nombreArchivo || `albaranes_${ST.anio}.xlsx`);
  }

  // ══════════════════════════════════════════════════════
  //  VER UN ALBARÁN
  // ══════════════════════════════════════════════════════
  async function verAlbaran(id) {
    vista().innerHTML = '<div class="cargando"><span class="giro"></span> Cargando…</div>';
    const [a, hist] = await Promise.all([B.albaran(id), B.historial(id).catch(() => [])]);
    const blob = window.generarPdf(a, ST.ajustes, 1).output('blob');
    const url = URL.createObjectURL(blob);
    const anulado = a.estado === 'anulado';
    vista().innerHTML = `
      <div class="barra-titulo">
        <div><a href="#/albaranes" class="volver">← Albaranes</a>
          <h1>Albarán ${a.numero} ${etiquetasEstado(a)}</h1>
          <p class="tenue">${esc(a.cliente?.nombre)} · ${U.fechaLarga(a.fecha)} · ${U.eur(a.total)}</p></div>
        <div class="acciones">
          ${anulado ? '' : '<button class="btn btn-primario btn-grande" id="b-imprimir">🖨 Imprimir (2 copias)</button>'}
          <button class="btn" id="b-descargar">Descargar PDF</button>
          ${anulado ? '' : `<a class="btn" href="#/editar/${a.id}">Modificar</a>`}
          <a class="btn" href="#/nuevo/copia/${a.id}" title="Crea un albarán nuevo con los mismos datos">Duplicar</a>
          ${anulado ? '<button class="btn btn-primario" id="b-reactivar">Rehacer con este número</button>' : '<button class="btn btn-peligro-borde" id="b-anular">Anular</button>'}
        </div>
      </div>
      ${anulado ? `<div class="banda banda-roja">Este albarán está <b>anulado</b>${a.motivo_anulacion ? ': ' + esc(a.motivo_anulacion) : ''}. No cuenta en los totales. Puedes rehacerlo con el mismo número.</div>` : ''}
      ${a.modificado_tras_envio ? '<div class="banda banda-naranja">Se modificó <b>después de enviarlo a la asesoría</b>. Recuerda mandarles la versión nueva.</div>' : ''}
      <div class="ver-rejilla">
        ${matchMedia('(max-width: 1000px), (pointer: coarse)').matches
          ? `<div class="tarjeta vacio"><p>Vista previa del albarán en PDF</p><a class="btn btn-primario btn-grande" href="${url}" target="_blank" rel="noopener">Abrir PDF</a></div>`
          : `<div class="tarjeta visor"><iframe src="${url}#view=FitH&toolbar=0" title="Vista previa del albarán"></iframe></div>`}
        <div class="tarjeta historial">
          <h2>Historial</h2>
          <ol>${hist.map(h => `<li><b>${esc(textoAccion(h.accion))}</b> <span class="tenue">${U.fechaHora(h.fecha)} · ${esc(h.usuario)}</span>${h.accion === 'modificado' ? `<div class="peq">${esc(diferencias(h.antes, h.despues))}</div>` : ''}</li>`).join('') || '<li class="tenue">Sin registros</li>'}</ol>
        </div>
      </div>`;
    const b2 = () => window.generarPdf(a, ST.ajustes, 2).output('blob');
    if ($('#b-imprimir')) $('#b-imprimir').onclick = () => ARCHIVOS.imprimir(b2());
    $('#b-descargar').onclick = () => ARCHIVOS.descargar(blob, window.nombrePdfMes(a));
    if ($('#b-anular')) $('#b-anular').onclick = () => modal(`
      <h2>Anular el albarán ${a.numero}</h2>
      <p>El albarán se queda en la lista marcado como <b>ANULADO</b> y deja de contar en los totales. El número no se pierde: luego puedes rehacerlo con el mismo número.</p>
      <label>Motivo (opcional)<input id="m-motivo" placeholder="Ej.: cliente equivocado, venta no realizada…"></label>
      <div class="modal-botones"><button class="btn" data-cerrar>Cancelar</button><button class="btn btn-peligro" id="m-ok">Anular albarán</button></div>`,
      (m, cerrar) => $('#m-ok', m).onclick = async ev => {
        const carpeta = await ARCHIVOS.prepararPermiso();
        ocupado(ev.target, async () => {
          const r = await B.anularAlbaran(a.id, $('#m-motivo', m).value.trim());
          await guardarCopiasPdf(r, carpeta);
          cerrar(); aviso('Albarán ' + a.numero + ' anulado'); verAlbaran(a.id);
        });
      });
    if ($('#b-reactivar')) $('#b-reactivar').onclick = async ev => {
      if (!await confirmar('Rehacer el albarán ' + a.numero, 'El albarán vuelve a estar válido con el mismo número y se abre para que lo corrijas.', 'Rehacer')) return;
      ocupado(ev.target, async () => { await B.reactivarAlbaran(a.id); location.hash = '#/editar/' + a.id; });
    };
  }
  const textoAccion = a => ({ creado: 'Creado', modificado: 'Modificado', anulado: 'Anulado', reactivado: 'Reactivado para rehacer', enviado: 'Marcado como enviado a asesoría' }[a] || a);
  function diferencias(antes, desp) {
    if (!antes || !desp) return '';
    const d = [];
    if (antes.cliente?.nombre !== desp.cliente?.nombre) d.push(`cliente: ${antes.cliente?.nombre} → ${desp.cliente?.nombre}`);
    if (antes.fecha !== desp.fecha) d.push(`fecha: ${U.fechaLarga(antes.fecha)} → ${U.fechaLarga(desp.fecha)}`);
    if (Number(antes.total) !== Number(desp.total)) d.push(`total: ${U.eur(antes.total)} → ${U.eur(desp.total)}`);
    if (Number(antes.kilos) !== Number(desp.kilos)) d.push(`kilos: ${U.kg(antes.kilos)} → ${U.kg(desp.kilos)}`);
    const lotes = x => (x.lineas || []).map(l => l.lote).join(',');
    if (lotes(antes) !== lotes(desp)) d.push('lotes cambiados');
    if ((antes.precinto || '') !== (desp.precinto || '')) d.push('precinto cambiado');
    if ((antes.observaciones || '') !== (desp.observaciones || '')) d.push('observaciones cambiadas');
    if ((antes.pedido || '') !== (desp.pedido || '')) d.push('nº pedido cambiado');
    if (!d.length && JSON.stringify(antes.lineas) !== JSON.stringify(desp.lineas)) d.push('líneas cambiadas');
    return d.join(' · ');
  }

  // Guarda el PDF (1 copia) en la carpeta del ordenador y en Supabase
  async function guardarCopiasPdf(a, carpeta, nombreAnterior) {
    const blob = window.generarPdf(a, ST.ajustes, 1).output('blob');
    const avisos = [];
    if (carpeta) {
      try {
        await ARCHIVOS.guardarEnCarpeta(carpeta, window.nombrePdf(a), blob);
        // si al modificar cambió el mes, se borra el PDF con el nombre antiguo para no dejarlo duplicado
        if (nombreAnterior && nombreAnterior !== window.nombrePdf(a)) await ARCHIVOS.borrarDeCarpeta(carpeta, nombreAnterior);
      }
      catch (e) { avisos.push('No se pudo guardar el PDF en la carpeta del ordenador (' + (e.message || e) + ').'); }
    }
    try { await B.subirPdf(a.anio, a.numero, blob); }
    catch (e) { avisos.push('No se pudo subir la copia del PDF a la nube: ' + errorLegible(e)); }
    avisos.forEach(t => aviso(t, 'aviso', 8000));
  }

  // ══════════════════════════════════════════════════════
  //  EDITOR DE ALBARÁN (nuevo / modificar / duplicar)
  // ══════════════════════════════════════════════════════
  const lineaVacia = () => ({ producto_id: null, concepto: '', unidad_precio: 'kg', familia: 'OTROS', iva: 10, kilos: '', unidades: '', talla_cm: '', precio: '', lote: '', estanque: '' });

  async function verEditor(id, copiaDe) {
    vista().innerHTML = '<div class="cargando"><span class="giro"></span> Cargando…</div>';
    let original = null, f;
    if (id) {
      original = await B.albaran(id);
      if (original.estado === 'anulado') { aviso('Ese albarán está anulado. Rehazlo desde su ficha.', 'info'); location.hash = '#/albaran/' + id; return; }
      f = JSON.parse(JSON.stringify(original));
    } else if (copiaDe) {
      const o = await B.albaran(copiaDe);
      f = { fecha: U.hoy(), pedido: o.pedido, cliente_id: o.cliente_id, cliente: clientePorId(o.cliente_id) || o.cliente, observaciones: o.observaciones, precinto: '', descuento: o.descuento, lineas: JSON.parse(JSON.stringify(o.lineas)) };
    } else {
      f = { fecha: U.hoy(), pedido: '', cliente_id: null, cliente: null, observaciones: '', precinto: '', descuento: 0, lineas: [] };
    }
    f.lineas = (f.lineas || []).map(l => ({ ...lineaVacia(), ...l, kilos: numEdit(l.kilos), unidades: numEdit(l.unidades), talla_cm: numEdit(l.talla_cm), precio: numEdit(l.precio) }));
    if (!f.lineas.length) f.lineas.push(lineaVacia());
    f.descuento = Number(f.descuento) ? String(f.descuento).replace('.', ',') : '';
    ST.sucio = false;
    const marcarSucio = () => { ST.sucio = true; };

    const lotesUsados = await lotesRecientes();
    const numPrevisto = id ? null : await B.contador(Number(f.fecha.slice(0, 4))).catch(() => null);

    vista().innerHTML = `
      <div class="barra-titulo">
        <div><a href="${id ? '#/albaran/' + id : '#/albaranes'}" class="volver">← ${id ? 'Volver al albarán' : 'Albaranes'}</a>
        <h1>${id ? 'Modificar albarán ' + original.numero : 'Nuevo albarán <span id="num-previsto" class="num-previsto">' + (numPrevisto || '') + '</span>'}</h1>
        ${id ? '' : '<p class="tenue peq">Número asignado automáticamente. Si otra persona guarda uno antes, se usará el siguiente.</p>'}</div>
      </div>
      <form id="f-alb" autocomplete="off" novalidate>
        <div class="editor-rejilla">
          <section class="tarjeta">
            <h2>Cliente</h2>
            <div id="zona-cliente"></div>
          </section>
          <section class="tarjeta">
            <h2>Datos del albarán</h2>
            <div class="campos-2">
              <label>Fecha<input type="date" name="fecha" value="${esc(f.fecha)}" required></label>
              <label>Nº pedido<input name="pedido" value="${esc(f.pedido || '')}"></label>
              <label>Precinto Nº<input name="precinto" value="${esc(f.precinto || '')}"></label>
              <label>Descuento %<input name="descuento" inputmode="decimal" value="${esc(f.descuento)}" placeholder="0"></label>
            </div>
            <label>Observaciones<textarea name="observaciones" rows="2" placeholder="Ej.: PAGO CONTADO">${esc(f.observaciones || '')}</textarea></label>
          </section>
        </div>
        <section class="tarjeta">
          <div class="h2-fila"><h2>Productos</h2><span class="tenue peq">Máximo ${CONFIG.MAX_LINEAS} líneas por albarán</span></div>
          <div id="zona-lineas"></div>
          <button type="button" class="btn" id="b-linea">+ Añadir línea</button>
          <datalist id="dl-lotes">${lotesUsados.lotes.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
          <datalist id="dl-estanques">${lotesUsados.estanques.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
        </section>
        <section class="tarjeta" id="zona-totales"></section>
        <div class="barra-guardar">
          <span id="msg-falta" class="tenue"></span>
          <a class="btn" href="${id ? '#/albaran/' + id : '#/albaranes'}">Cancelar</a>
          <button type="button" class="btn btn-grande" id="b-guardar">Guardar</button>
          <button type="button" class="btn btn-primario btn-grande" id="b-guardar-imp">Guardar e imprimir</button>
        </div>
      </form>`;

    const form = $('#f-alb');

    // ── Cliente ──
    function pintarCliente() {
      const z = $('#zona-cliente');
      const c = f.cliente;
      if (c) {
        const actual = clientePorId(f.cliente_id);
        const distinto = actual && id && ['nombre', 'direccion', 'cp', 'poblacion', 'provincia', 'cif', 'telefono', 'regimen_iva'].some(k => (actual[k] || '') !== (c[k] || ''));
        z.innerHTML = `
          <div class="cliente-sel">
            <div><div class="fuerte">${esc(c.nombre)} <span class="tenue">· cód. ${esc(c.codigo)}</span></div>
              <div class="peq">${esc([c.direccion, [c.cp, c.poblacion].filter(Boolean).join(' '), c.provincia !== c.pais && c.pais !== 'España' ? c.pais : c.provincia].filter(Boolean).join(' · '))}</div>
              <div class="peq">CIF/NIF: ${esc(c.cif || '—')} · Tel.: ${esc(c.telefono || '—')}</div>
              ${c.regimen_iva && c.regimen_iva !== 'nacional' ? `<span class="etq etq-azul">${esc(U.REGIMEN[c.regimen_iva])}</span>` : ''}
              ${distinto ? `<div class="banda banda-naranja peq">Los datos de este cliente han cambiado desde que se hizo el albarán. <button type="button" class="enlace" id="b-actualizar-cli">Usar los datos actuales</button></div>` : ''}
            </div>
            <button type="button" class="btn" id="b-cambiar-cli">Cambiar</button>
          </div>`;
        $('#b-cambiar-cli').onclick = () => { f.cliente = null; f.cliente_id = null; marcarSucio(); pintarCliente(); recalcular(); $('#buscar-cli').focus(); };
        if (distinto) $('#b-actualizar-cli').onclick = () => { f.cliente = { ...actual }; marcarSucio(); pintarCliente(); recalcular(); };
      } else {
        z.innerHTML = `
          <div class="buscador">
            <input id="buscar-cli" type="search" placeholder="Escribe el nombre, código, población o CIF…" aria-label="Buscar cliente">
            <div id="res-cli" class="resultados" hidden></div>
          </div>
          <button type="button" class="enlace peq" id="b-cli-nuevo">+ Crear cliente nuevo</button>`;
        const inp = $('#buscar-cli'), res = $('#res-cli');
        let sel = 0, encontrados = [];
        const elegir = c => { f.cliente_id = c.id; f.cliente = { ...c }; marcarSucio(); pintarCliente(); recalcular(); };
        const pintarRes = () => {
          const q = U.norm(inp.value.trim());
          if (!q) { res.hidden = true; return; }
          const partes = q.split(/\s+/);
          encontrados = ST.clientes.filter(c => partes.every(p => U.norm([c.nombre, c.codigo, c.poblacion, c.provincia, c.cif, c.categoria].join(' ')).includes(p))).slice(0, 12);
          sel = 0;
          res.hidden = false;
          res.innerHTML = encontrados.length ? encontrados.map((c, i) => `<div class="res ${i === sel ? 'sel' : ''}" data-i="${i}"><b>${esc(c.nombre)}</b><span class="tenue peq"> · ${esc(c.codigo)} · ${esc(c.poblacion || '')} ${esc(c.categoria ? '· ' + c.categoria : '')}</span></div>`).join('')
            : '<div class="res tenue">No hay ningún cliente con ese nombre</div>';
          $$('.res[data-i]', res).forEach(d => d.onmousedown = e => { e.preventDefault(); elegir(encontrados[d.dataset.i]); });
        };
        inp.oninput = pintarRes;
        inp.onkeydown = e => {
          if (res.hidden || !encontrados.length) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + encontrados.length) % encontrados.length;
            $$('.res[data-i]', res).forEach((d, i) => d.classList.toggle('sel', i === sel));
          } else if (e.key === 'Enter') { e.preventDefault(); elegir(encontrados[sel]); }
        };
        inp.onblur = () => setTimeout(() => res.hidden = true, 150);
        $('#b-cli-nuevo').onclick = () => editarCliente(null, nuevo => elegir(nuevo));
      }
    }

    // ── Líneas ──
    function opcionesProducto(l) {
      const lista = ST.productos.filter(p => p.activo !== false || p.id === l.producto_id);
      const hay = l.producto_id && lista.some(p => p.id === l.producto_id);
      return `<option value="">— Elige producto —</option><option value="__libre">✎ Escribir concepto libre…</option>` +
        (!hay && l.concepto && !l.libre ? `<option value="" selected>${esc(l.concepto)}</option>` : '') +
        lista.map(p => `<option value="${p.id}" ${p.id === l.producto_id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
    }
    function pintarLineas() {
      $('#zona-lineas').innerHTML = `
        <div class="lineas">
          <div class="linea linea-cab"><span>Producto</span><span>Kilos</span><span>Unidades</span><span>Talla cm</span><span>Precio</span><span>Lote</span><span>Estanque</span><span class="num">Total</span><span></span></div>
          ${f.lineas.map((l, i) => {
            const up = l.unidad_precio;
            const req = k => (up === 'kg' && k === 'kilos') || ((up === 'unidad' || up === 'millar_cm') && k === 'unidades') || (up === 'millar_cm' && k === 'talla_cm');
            const c = U.calcLinea(l);
            return `
            <div class="linea" data-i="${i}">
              ${l.libre ? `
              <div class="l-prod l-libre"><span class="solo-movil">Concepto libre</span>
                <input data-k="concepto" value="${esc(l.concepto)}" placeholder="Escribe el concepto" class="req" maxlength="60">
                <div class="l-libre-op">
                  <select data-libre="unidad" aria-label="Cómo se cobra">${Object.entries(U.UNIDADES).map(([k, v]) => `<option value="${k}" ${up === k ? 'selected' : ''}>${v.nombre}</option>`).join('')}</select>
                  <button type="button" class="enlace peq" data-libre="volver">Elegir de la lista</button>
                </div>
                <small class="tenue">Concepto libre · cuenta como «Otros» en el resumen</small></div>`
              : `
              <label class="l-prod"><span class="solo-movil">Producto</span><select data-k="producto">${opcionesProducto(l)}</select>
                <small class="tenue">${l.concepto ? esc(U.UNIDADES[up]?.nombre || '') + (Number(l.iva) !== 10 ? ' · IVA ' + U.num(l.iva, 2, 0) + '%' : '') : ''}</small></label>`}
              <label><span class="solo-movil">Kilos</span><input data-k="kilos" inputmode="decimal" value="${esc(l.kilos)}" class="${req('kilos') ? 'req' : ''}"></label>
              <label><span class="solo-movil">Unidades</span><input data-k="unidades" inputmode="numeric" value="${esc(l.unidades)}" class="${req('unidades') ? 'req' : ''}"></label>
              <label><span class="solo-movil">Talla cm</span><input data-k="talla_cm" inputmode="decimal" value="${esc(l.talla_cm)}" class="${req('talla_cm') ? 'req' : ''}" ${up === 'millar_cm' ? '' : 'disabled placeholder="—"'}></label>
              <label><span class="solo-movil">Precio</span><input data-k="precio" inputmode="decimal" value="${esc(l.precio)}" class="req" placeholder="${esc(U.UNIDADES[up]?.precio || '')}"></label>
              <label><span class="solo-movil">Lote</span><input data-k="lote" list="dl-lotes" value="${esc(l.lote)}"></label>
              <label><span class="solo-movil">Estanque</span><input data-k="estanque" list="dl-estanques" value="${esc(l.estanque)}"></label>
              <div class="num l-total"><span class="solo-movil">Total </span><b data-total>${c.total !== null ? U.eur(c.total) : '—'}</b>${c.gr_uni ? `<small class="tenue" data-gr>${U.gramos(c.gr_uni)} g/ud</small>` : '<small class="tenue" data-gr></small>'}</div>
              <button type="button" class="btn-quitar" data-quitar title="Quitar línea" aria-label="Quitar línea">✕</button>
            </div>`;
          }).join('')}
        </div>`;
      $('#b-linea').hidden = f.lineas.length >= CONFIG.MAX_LINEAS;
      $$('#zona-lineas .linea[data-i]').forEach(fila => {
        const i = Number(fila.dataset.i), l = f.lineas[i];
        const selProd = $('select[data-k="producto"]', fila);
        if (selProd) selProd.onchange = e => {
          if (e.target.value === '__libre') {
            Object.assign(l, { libre: true, producto_id: null, concepto: '', unidad_precio: 'kg', familia: 'OTROS', iva: 10, nombre_en: null });
            marcarSucio(); pintarLineas(); recalcular();
            $(`.linea[data-i="${i}"] input[data-k="concepto"]`).focus();
            return;
          }
          const p = productoPorId(Number(e.target.value));
          if (p) Object.assign(l, { producto_id: p.id, concepto: p.nombre, unidad_precio: p.unidad_precio, familia: p.familia, iva: Number(p.iva), nombre_en: p.nombre_en || null });
          else Object.assign(l, { producto_id: null, concepto: '' });
          if (l.unidad_precio !== 'millar_cm') l.talla_cm = '';
          marcarSucio(); pintarLineas(); recalcular();
          const sig = $(`.linea[data-i="${i}"] input:not([disabled]).req`); if (sig) sig.focus();
        };
        const selUd = $('select[data-libre="unidad"]', fila);
        if (selUd) selUd.onchange = () => {
          l.unidad_precio = selUd.value; if (l.unidad_precio !== 'millar_cm') l.talla_cm = '';
          marcarSucio(); pintarLineas(); recalcular();
        };
        const volver = $('[data-libre="volver"]', fila);
        if (volver) volver.onclick = () => {
          Object.assign(l, { libre: false, producto_id: null, concepto: '' });
          marcarSucio(); pintarLineas(); recalcular(); $(`.linea[data-i="${i}"] select`).focus();
        };
        $$('input', fila).forEach(inp => inp.oninput = () => {
          l[inp.dataset.k] = inp.value; marcarSucio();
          const c = U.calcLinea(l);
          $('[data-total]', fila).textContent = c.total !== null ? U.eur(c.total) : '—';
          $('[data-gr]', fila).textContent = c.gr_uni ? U.gramos(c.gr_uni) + ' g/ud' : '';
          recalcular();
        });
        $('[data-quitar]', fila).onclick = () => {
          f.lineas.splice(i, 1); if (!f.lineas.length) f.lineas.push(lineaVacia());
          marcarSucio(); pintarLineas(); recalcular();
        };
      });
    }

    // ── Totales ──
    let calc;
    function lineasValidas() { return f.lineas.filter(l => l.concepto || l.kilos || l.unidades || l.precio || l.lote); }
    function recalcular() {
      calc = U.calcAlbaran(lineasValidas(), f.descuento, f.cliente?.regimen_iva);
      $('#zona-totales').innerHTML = `
        <div class="totales">
          <div><span class="tenue">Kilos</span><b>${U.kg(calc.kilos) || '0'}</b></div>
          <div><span class="tenue">Unidades</span><b>${U.num(calc.unidades, 0) || '0'}</b></div>
          <div><span class="tenue">Suma importes</span><b>${U.eur(calc.suma)}</b></div>
          ${calc.descuento ? `<div><span class="tenue">Descuento ${U.num(calc.descuento, 2, 0)}%</span><b>−${U.eur(calc.descuento_importe)}</b></div>` : ''}
          <div><span class="tenue">Base imponible</span><b>${U.eur(calc.base)}</b></div>
          ${calc.desglose_iva.map(g => `<div><span class="tenue">${g.exento ? 'IVA exento' : 'IVA ' + U.num(g.tipo, 2, 0) + '%'}</span><b>${U.eur(g.cuota)}</b></div>`).join('')}
          <div class="total-grande"><span>TOTAL</span><b>${U.eur(calc.total)}</b></div>
        </div>
`;
      $('#msg-falta').textContent = queFalta() || '';
    }
    function queFalta() {
      if (!f.cliente_id) return 'Falta elegir el cliente';
      if (!f.fecha) return 'Falta la fecha';
      const vl = lineasValidas();
      if (!vl.length) return 'Añade al menos un producto';
      for (let i = 0; i < vl.length; i++) { const m = U.faltaEnLinea(vl[i]); if (m) return `Línea ${f.lineas.indexOf(vl[i]) + 1}: ${m}`; }
      if (U.parse(f.descuento) !== null && (U.parse(f.descuento) < 0 || U.parse(f.descuento) > 100)) return 'El descuento debe estar entre 0 y 100';
      return '';
    }

    // ── Campos de cabecera ──
    $$('input[name],textarea[name]', form).forEach(inp => inp.addEventListener('input', () => { f[inp.name] = inp.value; marcarSucio(); recalcular(); }));
    if (!id) $('input[name=fecha]', form).addEventListener('change', async e => {
      const anio = Number((e.target.value || '').slice(0, 4));
      if (anio > 2000) { const n = await B.contador(anio).catch(() => null); $('#num-previsto').textContent = n || ''; }
    });
    $('#b-linea').onclick = () => { if (f.lineas.length < CONFIG.MAX_LINEAS) { f.lineas.push(lineaVacia()); marcarSucio(); pintarLineas(); recalcular(); $(`.linea[data-i="${f.lineas.length - 1}"] select`).focus(); } };

    // ── Guardar ──
    async function guardar(imprimir, btn) {
      const falta = queFalta();
      if (falta) { aviso(falta, 'error', 5000); return; }
      const carpeta = await ARCHIVOS.prepararPermiso();   // primero: necesita el clic
      await ocupado(btn, async () => {
        const vl = lineasValidas().map(l => {
          const n = k => { const v = U.parse(l[k]); return v === null ? null : v; };
          return { producto_id: l.producto_id, concepto: l.libre ? (l.concepto || '').trim().toUpperCase() : l.concepto, unidad_precio: l.unidad_precio, familia: l.familia, iva: Number(l.iva), nombre_en: l.nombre_en || null, libre: !!l.libre,
            kilos: n('kilos'), unidades: n('unidades'), talla_cm: n('talla_cm'), precio: n('precio'),
            lote: (l.lote || '').trim(), estanque: (l.estanque || '').trim(), total: U.calcLinea(l).total };
        });
        const c = U.calcAlbaran(vl, f.descuento, f.cliente.regimen_iva);
        const p = {
          fecha: f.fecha, pedido: (f.pedido || '').trim(), cliente_id: f.cliente_id, cliente: limpiarCliente(f.cliente),
          observaciones: (f.observaciones || '').trim(), precinto: (f.precinto || '').trim(), descuento: c.descuento,
          consumo_preferente: null, lineas: vl, desglose_iva: c.desglose_iva,
          kilos: c.kilos, unidades: c.unidades, suma: c.suma, base: c.base, iva: c.iva, total: c.total
        };
        const a = id ? await B.modificarAlbaran(id, p, original.updated_at) : await B.crearAlbaran(p);
        ST.sucio = false;
        await guardarCopiasPdf(a, carpeta, id ? window.nombrePdf(original) : null);
        if (imprimir) ARCHIVOS.imprimir(window.generarPdf(a, ST.ajustes, 2).output('blob'));
        aviso(`Albarán ${a.numero} ${id ? 'modificado' : 'guardado'}${carpeta ? ' y PDF guardado en la carpeta' : ''}`);
        hashAnterior = '#/albaran/' + a.id;
        location.hash = '#/albaran/' + a.id;
      });
    }
    $('#b-guardar').onclick = e => guardar(false, e.currentTarget);
    $('#b-guardar-imp').onclick = e => guardar(true, e.currentTarget);

    pintarCliente(); pintarLineas(); recalcular();
    if (!f.cliente) $('#buscar-cli').focus();
  }
  const numEdit = v => (v === null || v === undefined || v === '') ? '' : String(v).replace('.', ',');
  function limpiarCliente(c) {
    const o = {};
    ['id', 'codigo', 'nombre', 'direccion', 'cp', 'poblacion', 'provincia', 'pais', 'cif', 'telefono', 'email', 'explotacion', 'regimen_iva', 'categoria'].forEach(k => o[k] = c[k] ?? null);
    return o;
  }
  async function lotesRecientes() {
    try {
      const l = ST.lista && ST.lista.length ? ST.lista : await B.albaranes(ST.anio);
      const lotes = new Set(), est = new Set();
      l.slice(0, 300).forEach(a => (a.lineas || []).forEach(x => { if (x.lote) lotes.add(x.lote); if (x.estanque) est.add(x.estanque); }));
      return { lotes: [...lotes], estanques: [...est] };
    } catch (e) { return { lotes: [], estanques: [] }; }
  }

  // ══════════════════════════════════════════════════════
  //  CLIENTES
  // ══════════════════════════════════════════════════════
  let filtroCli = { texto: '', cat: '' };
  function verClientes() {
    const cats = [...new Set(ST.clientes.map(c => c.categoria).filter(Boolean))].sort();
    vista().innerHTML = `
      <div class="barra-titulo"><h1>Clientes</h1>
        <div class="acciones"><button class="btn btn-primario btn-grande" id="b-nuevo-cli">+ Nuevo cliente</button></div></div>
      <div class="filtros tarjeta">
        <label class="crece">Buscar<input id="c-texto" type="search" placeholder="Nombre, código, población, CIF…" value="${esc(filtroCli.texto)}"></label>
        <label>Tipo<select id="c-cat"><option value="">Todos</option>${cats.map(c => `<option ${c === filtroCli.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <div id="tabla-cli"></div>`;
    const pintar = () => {
      const q = U.norm(filtroCli.texto).split(/\s+/).filter(Boolean);
      const l = ST.clientes.filter(c => (!filtroCli.cat || c.categoria === filtroCli.cat) &&
        q.every(p => U.norm([c.nombre, c.codigo, c.poblacion, c.provincia, c.cif, c.contacto].join(' ')).includes(p)));
      const cel = (v, cls = '') => `<td class="${cls}" title="${esc(v || '')}">${esc(v || '')}</td>`;
      $('#tabla-cli').innerHTML = `<div class="tabla-envoltura tarjeta"><table class="tabla tabla-clic tabla-una-linea tabla-clientes">
        <colgroup><col class="c-cod"><col class="c-nom"><col class="c-tipo"><col class="c-pob"><col class="c-prov"><col class="c-cif"><col class="c-tel"><col class="c-iva"></colgroup>
        <thead><tr><th>Cód.</th><th>Nombre</th><th>Tipo</th><th>Población</th><th>Provincia / país</th><th>CIF/NIF</th><th>Teléfono</th><th>IVA</th></tr></thead>
        <tbody>${l.map(c => `<tr data-id="${c.id}">
          ${cel(String(c.codigo))}${cel(c.nombre, 'fuerte')}${cel(c.categoria, 'peq')}
          ${cel(c.poblacion)}${cel(c.pais && c.pais !== 'España' ? c.pais : c.provincia)}${cel(c.cif)}${cel(c.telefono)}
          <td>${c.regimen_iva === 'nacional' ? '' : `<span class="etq etq-azul" title="${esc(U.REGIMEN[c.regimen_iva])}">${c.regimen_iva === 'ue' ? 'UE' : 'EXP'}</span>`}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="8">${l.length} clientes</td></tr></tfoot></table></div>`;
      $$('#tabla-cli tbody tr').forEach(tr => tr.onclick = () => editarCliente(ST.clientes.find(c => c.id === Number(tr.dataset.id)), verClientes));
    };
    pintar();
    $('#c-texto').oninput = e => { filtroCli.texto = e.target.value; pintar(); };
    $('#c-cat').onchange = e => { filtroCli.cat = e.target.value; pintar(); };
    $('#b-nuevo-cli').onclick = () => editarCliente(null, verClientes);
  }

  function editarCliente(c, despues) {
    const nuevo = !c;
    c = c || { codigo: Math.max(0, ...ST.clientes.map(x => x.codigo)) + 1, pais: 'España', regimen_iva: 'nacional' };
    const cats = [...new Set(ST.clientes.map(x => x.categoria).filter(Boolean))].sort();
    const campo = (k, et, o = {}) => `<label class="${o.cls || ''}">${et}<input name="${k}" value="${esc(c[k] ?? '')}" ${o.attr || ''}></label>`;
    modal(`
      <h2>${nuevo ? 'Nuevo cliente' : 'Cliente ' + esc(c.codigo)}</h2>
      <form id="f-cli" class="campos-form">
        <div class="campos-3">
          ${campo('codigo', 'Código', { attr: 'inputmode="numeric" required' })}
          <label class="span2">Tipo de cliente<input name="categoria" list="dl-cats" value="${esc(c.categoria || '')}"><datalist id="dl-cats">${cats.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
        </div>
        ${campo('nombre', 'Nombre o razón social', { attr: 'required' })}
        ${campo('direccion', 'Dirección')}
        <div class="campos-3">${campo('cp', 'C.P.')}${campo('poblacion', 'Población', { cls: 'span2' })}</div>
        <div class="campos-3">${campo('provincia', 'Provincia')}${campo('pais', 'País')}
          <label>IVA<select name="regimen_iva">${Object.entries(U.REGIMEN).map(([k, v]) => `<option value="${k}" ${c.regimen_iva === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
        <div class="campos-3">${campo('cif', 'CIF / NIF / VAT')}${campo('telefono', 'Teléfono')}${campo('telefono2', 'Teléfono 2')}</div>
        <div class="campos-3">${campo('contacto', 'Persona de contacto')}${campo('email', 'Email', { attr: 'type="email"' })}${campo('explotacion', 'Nº explotación / REGA')}</div>
        <label>Notas<textarea name="notas" rows="2">${esc(c.notas || '')}</textarea></label>
        <div class="modal-botones"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario">Guardar cliente</button></div>
      </form>`, (m, cerrar) => {
        $('#f-cli', m).onsubmit = e => {
          e.preventDefault();
          const fd = new FormData(e.target), d = { ...(nuevo ? {} : { id: c.id }) };
          ['categoria', 'nombre', 'direccion', 'cp', 'poblacion', 'provincia', 'pais', 'cif', 'telefono', 'telefono2', 'contacto', 'email', 'explotacion', 'notas', 'regimen_iva']
            .forEach(k => { const v = (fd.get(k) || '').trim(); d[k] = v || null; });
          d.codigo = parseInt(fd.get('codigo'), 10); d.pais = d.pais || 'España'; d.regimen_iva = d.regimen_iva || 'nacional';
          if (!d.nombre) return aviso('Falta el nombre del cliente', 'error');
          if (!d.codigo) return aviso('El código debe ser un número', 'error');
          ocupado($('button.btn-primario', m), async () => {
            const g = await B.guardarCliente(d);
            ST.clientes = await B.clientes();
            cerrar(); aviso('Cliente guardado'); if (despues) despues(g);
          });
        };
      });
  }

  // ══════════════════════════════════════════════════════
  //  PRODUCTOS
  // ══════════════════════════════════════════════════════
  function verProductos() {
    vista().innerHTML = `
      <div class="barra-titulo"><h1>Productos</h1>
        <div class="acciones"><button class="btn btn-primario btn-grande" id="b-nuevo-pro">+ Nuevo producto</button></div></div>
      <div class="tabla-envoltura tarjeta"><table class="tabla tabla-clic">
        <thead><tr><th>Producto</th><th>Nombre en inglés</th><th>Se cobra</th><th>Familia (estadísticas)</th><th class="num">IVA</th><th></th></tr></thead>
        <tbody>${ST.productos.map(p => `<tr data-id="${p.id}" class="${p.activo === false ? 'fila-anulada' : ''}">
          <td class="fuerte">${esc(p.nombre)}</td><td class="tenue">${esc(p.nombre_en || '')}</td><td>${esc(U.UNIDADES[p.unidad_precio]?.nombre)}</td><td>${esc(U.FAMILIAS[p.familia] || p.familia)}</td>
          <td class="num">${U.num(p.iva, 2, 0)}%</td><td>${p.activo === false ? '<span class="etq">Desactivado</span>' : ''}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="tenue peq">Alevines: total = unidades ÷ 1.000 × talla (cm) × precio.</p>`;
    $$('tbody tr', vista()).forEach(tr => tr.onclick = () => editarProducto(ST.productos.find(p => p.id === Number(tr.dataset.id))));
    $('#b-nuevo-pro').onclick = () => editarProducto(null);
  }
  function editarProducto(p) {
    const nuevo = !p;
    p = p || { unidad_precio: 'kg', familia: 'OTROS', iva: 10, activo: true };
    modal(`
      <h2>${nuevo ? 'Nuevo producto' : 'Producto'}</h2>
      <form id="f-pro" class="campos-form">
        <label>Nombre (tal como sale en el albarán)<input name="nombre" value="${esc(p.nombre || '')}" required></label>
        <label>Nombre en inglés (para clientes extranjeros)<input name="nombre_en" value="${esc(p.nombre_en || '')}"></label>
        <div class="campos-2">
          <label>Se cobra<select name="unidad_precio">${Object.entries(U.UNIDADES).map(([k, v]) => `<option value="${k}" ${p.unidad_precio === k ? 'selected' : ''}>${v.nombre} (${v.precio})</option>`).join('')}</select></label>
          <label>Familia para estadísticas<select name="familia">${Object.entries(U.FAMILIAS).map(([k, v]) => `<option value="${k}" ${p.familia === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>IVA %<input name="iva" inputmode="decimal" value="${esc(U.num(p.iva, 2, 0))}"></label>
        </div>
        <label class="check"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}> Producto activo</label>
        ${nuevo ? '' : '<p class="tenue peq">Los cambios solo afectan a albaranes nuevos o que se modifiquen; los ya hechos conservan sus datos.</p>'}
        <div class="modal-botones"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario">Guardar producto</button></div>
      </form>`, (m, cerrar) => {
        $('#f-pro', m).onsubmit = e => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const d = { ...(nuevo ? {} : { id: p.id }), nombre: (fd.get('nombre') || '').trim().toUpperCase(), unidad_precio: fd.get('unidad_precio'), familia: fd.get('familia'),
            iva: U.parse(fd.get('iva')), nombre_en: (fd.get('nombre_en') || '').trim().toUpperCase() || null, activo: !!fd.get('activo') };
          if (!d.nombre) return aviso('Falta el nombre', 'error');
          if (d.iva === null || d.iva < 0 || d.iva > 30) return aviso('El IVA no es válido', 'error');
          ocupado($('button.btn-primario', m), async () => {
            await B.guardarProducto(d); ST.productos = await B.productos();
            cerrar(); aviso('Producto guardado'); verProductos();
          });
        };
      });
  }

  // ══════════════════════════════════════════════════════
  //  RESUMEN (sustituye a REGISTRO y CONSULTA)
  // ══════════════════════════════════════════════════════
  async function verResumen() {
    vista().innerHTML = '<div class="cargando"><span class="giro"></span> Calculando…</div>';
    const [lista, anios] = await Promise.all([B.albaranes(ST.anio), B.anios()]);
    if (!anios.includes(ST.anio)) anios.unshift(ST.anio);
    const val = lista.filter(a => a.estado === 'activo');
    const fams = Object.keys(U.FAMILIAS);
    const mes = Array.from({ length: 12 }, () => ({ eur: 0, n: 0, f: Object.fromEntries(fams.map(k => [k, 0])), alv: 0 }));
    const cli = {};
    for (const a of val) {
      const m = mes[Number(a.fecha.slice(5, 7)) - 1];
      m.eur += Number(a.base); m.n++;
      const nom = a.cliente?.nombre || '?';
      cli[nom] = cli[nom] || { n: 0, eur: 0, f: Object.fromEntries(fams.map(k => [k, 0])) };
      cli[nom].n++; cli[nom].eur += Number(a.base);
      for (const l of a.lineas || []) {
        const k = U.parse(l.kilos) || 0; m.f[l.familia || 'OTROS'] += k; cli[nom].f[l.familia || 'OTROS'] += k;
        if (l.familia === 'ALV') m.alv += U.parse(l.unidades) || 0;
      }
    }
    const usadas = fams.filter(k => mes.some(m => m.f[k]));
    const tot = { eur: mes.reduce((s, m) => s + m.eur, 0), n: val.length, f: Object.fromEntries(fams.map(k => [k, mes.reduce((s, m) => s + m.f[k], 0)])) };
    const clientes = Object.entries(cli).sort((a, b) => b[1].eur - a[1].eur);
    vista().innerHTML = `
      <div class="barra-titulo"><h1>Resumen ${ST.anio}</h1>
        <div class="acciones"><label>Año <select id="r-anio">${anios.map(a => `<option ${a === ST.anio ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div></div>
      <p class="tenue">Solo albaranes válidos (los anulados no cuentan). Importes sin IVA. Kilos por familia de producto.</p>
      <div class="tabla-envoltura tarjeta"><table class="tabla">
        <thead><tr><th>Mes</th><th class="num">Albaranes</th>${usadas.map(k => `<th class="num">${esc(U.FAMILIAS[k])} (kg)</th>`).join('')}<th class="num">Base imponible</th></tr></thead>
        <tbody>${mes.map((m, i) => m.n ? `<tr><td>${U.MESES[i][0] + U.MESES[i].slice(1).toLowerCase()}</td><td class="num">${m.n}</td>${usadas.map(k => `<td class="num">${U.kg(m.f[k]) || ''}</td>`).join('')}<td class="num fuerte">${U.eur(m.eur)}</td></tr>` : '').join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${tot.n}</td>${usadas.map(k => `<td class="num">${U.kg(tot.f[k])}</td>`).join('')}<td class="num">${U.eur(tot.eur)}</td></tr></tfoot>
      </table></div>
      <h2 class="h2-suelto">Por cliente</h2>
      <div class="tabla-envoltura tarjeta"><table class="tabla">
        <thead><tr><th>Cliente</th><th class="num">Albaranes</th>${usadas.map(k => `<th class="num">${esc(U.FAMILIAS[k])} (kg)</th>`).join('')}<th class="num">Base imponible</th></tr></thead>
        <tbody>${clientes.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="num">${c.n}</td>${usadas.map(k => `<td class="num">${U.kg(c.f[k]) || ''}</td>`).join('')}<td class="num fuerte">${U.eur(c.eur)}</td></tr>`).join('') || `<tr><td colspan="${usadas.length + 3}" class="tenue">Sin albaranes</td></tr>`}</tbody>
      </table></div>`;
    $('#r-anio').onchange = e => { ST.anio = Number(e.target.value); verResumen(); };
  }

  // ══════════════════════════════════════════════════════
  //  AJUSTES
  // ══════════════════════════════════════════════════════
  async function verAjustes() {
    const anio = new Date().getFullYear();
    const sig = await B.contador(anio);
    const carpeta = ARCHIVOS.soportado() ? await ARCHIVOS.nombreCarpeta() : null;
    const E = ST.ajustes.empresa || {};
    vista().innerHTML = `
      <div class="barra-titulo"><h1>Ajustes</h1></div>
      <div class="ajustes-rejilla">
        <section class="tarjeta">
          <h2>Carpeta de PDF en este ordenador</h2>
          ${ARCHIVOS.soportado() ? `
            <p>${carpeta ? `Los albaranes se guardan en la carpeta <b>${esc(carpeta)}</b>.` : '<span class="etq etq-naranja">Sin carpeta</span> Los PDF no se están guardando en este ordenador (sí en la nube).'}</p>
            <p class="tenue peq">Elige la carpeta donde guardabais los albaranes, por ejemplo <i>Documentos › Piscifactoria › Partes 2026 › Trucha › Albaranes › 2026</i>. Se guardan con el número y el mes: <i>ALBARAN 20260082 - OCTUBRE.pdf</i>. Cada ordenador elige la suya.</p>
            <div class="fila-botones"><button class="btn btn-primario" id="b-carpeta">${carpeta ? 'Cambiar carpeta' : 'Elegir carpeta'}</button>${carpeta ? '<button class="btn" id="b-olvidar">Dejar de guardar aquí</button>' : ''}</div>`
          : '<p>Este navegador no permite guardar en una carpeta. Usa <b>Google Chrome</b> o <b>Microsoft Edge</b> en el ordenador de la oficina. Mientras tanto, los PDF quedan guardados en la nube y se pueden descargar.</p>'}
        </section>
        <section class="tarjeta">
          <h2>Numeración</h2>
          <p>El próximo albarán de ${anio} será el <b>${sig}</b>.</p>
          <label>Cambiar el próximo número<input id="a-sig" inputmode="numeric" value="${sig}"></label>
          <p class="tenue peq">Solo para ajustar al empezar o cambiar de año. Si pones un número que ya existe, la app usa el siguiente libre.</p>
          <button class="btn" id="b-sig">Guardar numeración</button>
        </section>
        <section class="tarjeta span2">
          <h2>Datos de la empresa en el albarán</h2>
          <form id="f-emp" class="campos-form">
            <label>Nombre<input name="nombre" value="${esc(E.nombre)}"></label>
            ${[0, 1, 2, 3, 4, 5].map(i => `<label>Línea ${i + 1}<input name="l${i}" value="${esc((E.lineas || [])[i] || '')}"></label>`).join('')}
            <div class="campos-2"><label>GGN<input name="ggn" value="${esc(E.ggn)}"></label><label>IBAN<input name="iban" value="${esc(E.iban)}"></label></div>
            <label>Nota de precios<input name="nota_precio" value="${esc(E.nota_precio)}"></label>
            <label>Texto del pie<input name="pie" value="${esc(E.pie)}"></label>
            <div class="campos-2"><label>Nº de registro sanitario (óvalo ES … UE)<input name="registro_sanitario" value="${esc(E.registro_sanitario || '')}"></label>
            <label>Código del documento<input name="codigo_doc" value="${esc(E.codigo_doc)}"></label></div>
            <button class="btn btn-primario">Guardar datos de empresa</button>
          </form>
        </section>
        <section class="tarjeta">
          <h2>Sesión</h2>
          <p>Has entrado como <b>${esc(ST.usuario)}</b>.</p>
          ${B.modo === 'prueba' ? '<p class="tenue peq">Modo prueba: los datos se guardan solo en este navegador.</p><button class="btn btn-peligro-borde" id="b-reset">Borrar datos de prueba</button>' : '<button class="btn" id="b-salir">Cerrar sesión</button>'}
        </section>
      </div>`;
    if ($('#b-carpeta')) $('#b-carpeta').onclick = async () => { try { const n = await ARCHIVOS.elegirCarpeta(); aviso('Carpeta elegida: ' + n); verAjustes(); } catch (e) { if (e.name !== 'AbortError') aviso(String(e.message || e), 'error'); } };
    if ($('#b-olvidar')) $('#b-olvidar').onclick = async () => { await ARCHIVOS.olvidarCarpeta(); verAjustes(); };
    $('#b-sig').onclick = async e => {
      const n = parseInt($('#a-sig').value, 10);
      if (!n || String(n).slice(0, 4) !== String(anio)) return aviso(`El número debe empezar por ${anio} (por ejemplo ${anio}0082)`, 'error', 6000);
      if (!await confirmar('Cambiar numeración', `El próximo albarán será el <b>${n}</b>. ¿Seguro?`, 'Cambiar')) return;
      ocupado(e.target, async () => { await B.fijarContador(anio, n); aviso('Numeración cambiada'); verAjustes(); });
    };
    $('#f-emp').onsubmit = e => {
      e.preventDefault(); const fd = new FormData(e.target);
      const emp = { ...E };
      ['nombre', 'ggn', 'iban', 'nota_precio', 'pie', 'codigo_doc', 'registro_sanitario'].forEach(k => emp[k] = fd.get(k));
      emp.lineas = [0, 1, 2, 3, 4, 5].map(i => fd.get('l' + i)).filter(Boolean);
      ocupado($('button', e.target), async () => { await B.guardarAjuste('empresa', emp); ST.ajustes.empresa = emp; aviso('Datos de empresa guardados'); });
    };
    if ($('#b-salir')) $('#b-salir').onclick = async () => { await B.salir(); ST.usuario = null; location.hash = ''; verLogin(); };
    if ($('#b-reset')) $('#b-reset').onclick = async () => {
      if (!await confirmar('Borrar datos de prueba', 'Se borran los albaranes de prueba y se vuelven a cargar los clientes y productos del Excel.', 'Borrar', true)) return;
      B.reiniciar(); await cargarComunes(); aviso('Datos de prueba reiniciados'); location.hash = '#/albaranes';
    };
  }

  // ══════════════════════════════════════════════════════
  //  ARRANQUE
  // ══════════════════════════════════════════════════════
  async function arrancar() {
    try {
      await cargarComunes();
    } catch (e) {
      console.error(e);
      vista().innerHTML = `<div class="tarjeta vacio"><h2>No se puede abrir la aplicación</h2><p>${esc(errorLegible(e))}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
      return;
    }
    $('#cabecera').hidden = false;
    $('#modo-prueba').hidden = B.modo !== 'prueba';
    $('#usuario').textContent = ST.usuario;
    if (!location.hash || location.hash === '#') location.hash = '#/albaranes';
    else enrutar();
  }

  (async function inicio() {
    try { ST.usuario = await B.sesion(); } catch (e) { ST.usuario = null; }
    if (ST.usuario) arrancar(); else verLogin();
  })();
  window.APP = { ST, B };
})();
