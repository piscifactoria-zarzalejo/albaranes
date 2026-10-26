// ════════════════════════════════════════════════════════
//  ACCESO A DATOS
//  - BackendSupabase: la base de datos real (tablas alb_*)
//  - BackendPrueba:   todo en este navegador (localStorage), para probar
//  Las dos tienen exactamente las mismas funciones.
// ════════════════════════════════════════════════════════
(function () {

  const ES_RED = /Failed to fetch|NetworkError|Load failed|fetch failed|network|AbortError|aborted|tiempo de espera/i;
  const esErrorRed = e => !!e && (e.sinRed || ES_RED.test(e.message || String(e)));

  function errorLegible(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'El usuario no está confirmado en Supabase.';
    if (e && e.sinRed || ES_RED.test(m)) return 'No hay conexión a internet. Esto solo se puede hacer con conexión; inténtalo cuando vuelva.';
    if (/NUMERO_OCUPADO/.test(m)) return 'Ese número de albarán ya existe en la base de datos.';
    if (/JWT expired/i.test(m)) return 'La sesión ha caducado. Vuelve a entrar.';
    if (/CONFLICTO/.test(m)) return m.replace(/^.*CONFLICTO:\s*/, '');
    if (/duplicate key.*codigo/i.test(m)) return 'Ya existe un cliente con ese código.';
    if (/duplicate key.*nombre/i.test(m)) return 'Ya existe un producto con ese nombre.';
    if (/relation .* does not exist|Could not find the (table|function)|Invalid schema|schema must be one of/i.test(m))
      return 'La base de datos de albaranes no está preparada o el esquema «albaranes» no está activado en Supabase (Settings → Data API → Exposed schemas).';
    return m;
  }

  // ───────────────────────── SUPABASE ─────────────────────────
  function BackendSupabase(url, key) {
    // si internet no responde (Starlink sin cobertura) no se queda colgado: corta a los 15 s
    const fetchConTiempo = (recurso, opciones = {}) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      if (opciones.signal) opciones.signal.addEventListener('abort', () => ctrl.abort());
      return fetch(recurso, { ...opciones, signal: ctrl.signal }).finally(() => clearTimeout(t));
    };
    const sb = window.supabase.createClient(url, key, {
      global: { fetch: fetchConTiempo },
      db: { schema: 'albaranes' },                 // esquema propio, separado de etiquetado
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'alb-sesion' }
    });
    const ok = r => {
      if (r.error) { const e = new Error(errorLegible(r.error)); e.sinRed = esErrorRed(r.error); e.original = r.error.message; throw e; }
      return r.data;
    };

    this.modo = 'supabase';
    this.sesion = async () => { const { data } = await sb.auth.getSession(); return data.session ? data.session.user.email : null; };
    this.entrar = async (email, pass) => { ok(await sb.auth.signInWithPassword({ email, password: pass })); return email; };
    this.salir = async () => { await sb.auth.signOut(); };

    this.ajustes = async () => {
      const rows = ok(await sb.from('ajustes').select('clave,valor'));
      const o = {}; rows.forEach(r => o[r.clave] = r.valor); return o;
    };
    this.guardarAjuste = async (clave, valor) => ok(await sb.from('ajustes').upsert({ clave, valor }));

    this.contador = async anio => {
      const r = ok(await sb.from('contadores').select('siguiente').eq('anio', anio).maybeSingle());
      return r ? Number(r.siguiente) : anio * 10000 + 1;
    };
    this.fijarContador = async (anio, sig) => ok(await sb.rpc('fijar_contador', { p_anio: anio, p_siguiente: sig }));
    this.pedido = async () => { const r = ok(await sb.from('ajustes').select('valor').eq('clave', 'pedido').maybeSingle()); return r ? r.valor : { prefijo: 'B', siguiente: 1 }; };

    this.clientes = async () => ok(await sb.from('clientes').select('*').order('nombre').range(0, 9999));
    this.guardarCliente = async c => {
      const datos = { ...c }; delete datos.id; delete datos.created_at; delete datos.updated_at;
      if (c.id) return ok(await sb.from('clientes').update(datos).eq('id', c.id).select().single());
      return ok(await sb.from('clientes').insert(datos).select().single());
    };

    this.productos = async () => ok(await sb.from('productos').select('*').order('nombre'));
    this.guardarProducto = async p => {
      const datos = { ...p }; delete datos.id; delete datos.created_at; delete datos.updated_at;
      if (p.id) return ok(await sb.from('productos').update(datos).eq('id', p.id).select().single());
      return ok(await sb.from('productos').insert(datos).select().single());
    };

    this.albaranes = async (anio) => {
      let q = sb.from('albaranes').select('*').order('numero', { ascending: false }).range(0, 4999);
      if (anio) q = q.eq('anio', anio);
      return ok(await q);
    };
    this.anios = async () => {
      const r = ok(await sb.from('contadores').select('anio').order('anio', { ascending: false }));
      return r.map(x => x.anio);
    };
    this.albaran = async id => ok(await sb.from('albaranes').select('*').eq('id', id).single());
    this.crearAlbaran = async p => ok(await sb.rpc('crear_albaran', { p }));
    this.crearAlbaranConNumero = async (p, numero) => ok(await sb.rpc('crear_albaran_con_numero', { p, p_numero: numero }));
    this.hayRed = async () => { try { const r = await fetchConTiempo(url + '/auth/v1/health', { headers: { apikey: key } }); return r.ok || r.status < 500; } catch (e) { return false; } };
    this.modificarAlbaran = async (id, p, version) => ok(await sb.rpc('modificar_albaran', { p_id: id, p, p_version: version }));
    this.anularAlbaran = async (id, motivo) => ok(await sb.rpc('anular_albaran', { p_id: id, p_motivo: motivo || '' }));
    this.reactivarAlbaran = async id => ok(await sb.rpc('reactivar_albaran', { p_id: id }));
    this.marcarEnviados = async ids => ok(await sb.rpc('marcar_enviados', { p_ids: ids }));
    this.marcarEmail = async id => ok(await sb.rpc('marcar_email', { p_id: id }));
    this.historial = async id => ok(await sb.from('historial').select('id,accion,usuario,fecha,antes,despues').eq('albaran_id', id).order('fecha'));

    this.subirPdf = async (anio, numero, blob) => {
      const ruta = `${anio}/ALBARAN_${numero}.pdf`;
      ok(await sb.storage.from(CONFIG.BUCKET_PDF).upload(ruta, blob, { upsert: true, contentType: 'application/pdf' }));
      return ruta;
    };
  }

  // ───────────────────────── PRUEBA (localStorage) ─────────────────────────
  function BackendPrueba() {
    const KEY = 'alb_prueba_v1';
    let db;
    const cargar = () => {
      try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
      // si han cambiado los datos iniciales (clientes, productos, empresa), se recargan solos
      if (db && db.version !== window.SEMILLA.version) db = null;
      if (!db) {
        const S = window.SEMILLA;
        let id = 1;
        db = {
          ajustes: { empresa: S.ajustes.empresa, pedido: { prefijo: 'B', siguiente: 1 } },
          contadores: { 2026: S.siguiente },
          clientes: S.clientes.map(c => ({ id: id++, ...c })),
          productos: S.productos.map((p, i) => ({ id: i + 1, ...p })),
          version: S.version,
          albaranes: [], historial: [], seq: { cli: id, pro: S.productos.length + 1, alb: 1, his: 1 }
        };
        guardar();
      }
    };
    const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento: queda en memoria */ } };
    const copia = o => JSON.parse(JSON.stringify(o));
    const ahora = () => new Date().toISOString();
    const yo = 'prueba@local';
    const hist = (a, accion, antes) => db.historial.push({ id: db.seq.his++, albaran_id: a.id, numero: a.numero, accion, usuario: yo, fecha: ahora(), antes: antes ? copia(antes) : null, despues: copia(a) });
    const CAMPOS = ['fecha','pedido','cliente_id','cliente','observaciones','precinto','descuento','consumo_preferente','lineas','desglose_iva','kilos','unidades','suma','base','iva','total'];
    cargar();

    this.modo = 'prueba';
    this.reiniciar = () => { localStorage.removeItem(KEY); cargar(); };
    this.sesion = async () => yo;
    this.entrar = async () => yo;
    this.salir = async () => {};
    this.ajustes = async () => copia(db.ajustes);
    this.guardarAjuste = async (k, v) => { db.ajustes[k] = v; guardar(); };
    this.contador = async anio => db.contadores[anio] || anio * 10000 + 1;
    this.fijarContador = async (anio, sig) => { db.contadores[anio] = sig; guardar(); };
    this.pedido = async () => copia(db.ajustes.pedido || { prefijo: 'B', siguiente: 1 });
    const pedidoAuto = p => {                     // igual que en el servidor
      if (!p.pedido_auto) return p.pedido;
      const c = db.ajustes.pedido || { prefijo: 'B', siguiente: 1 };
      const t = U.pedidoTexto(c, p.fecha.slice(0, 4)); c.siguiente++; db.ajustes.pedido = c; return t;
    };
    this.clientes = async () => copia(db.clientes).sort((a, b) => a.nombre.localeCompare(b.nombre));
    this.guardarCliente = async c => {
      if (db.clientes.some(x => x.codigo === c.codigo && x.id !== c.id)) throw new Error('Ya existe un cliente con ese código.');
      if (c.id) { const i = db.clientes.findIndex(x => x.id === c.id); db.clientes[i] = { ...db.clientes[i], ...c }; guardar(); return copia(db.clientes[i]); }
      const n = { ...c, id: db.seq.cli++ }; db.clientes.push(n); guardar(); return copia(n);
    };
    this.productos = async () => copia(db.productos).sort((a, b) => a.nombre.localeCompare(b.nombre));
    this.guardarProducto = async p => {
      if (db.productos.some(x => x.nombre === p.nombre && x.id !== p.id)) throw new Error('Ya existe un producto con ese nombre.');
      if (p.id) { const i = db.productos.findIndex(x => x.id === p.id); db.productos[i] = { ...db.productos[i], ...p }; guardar(); return copia(db.productos[i]); }
      const n = { ...p, id: db.seq.pro++ }; db.productos.push(n); guardar(); return copia(n);
    };
    this.albaranes = async anio => copia(db.albaranes.filter(a => !anio || a.anio === anio)).sort((a, b) => b.numero - a.numero);
    this.anios = async () => Object.keys(db.contadores).map(Number).sort((a, b) => b - a);
    this.albaran = async id => { const a = db.albaranes.find(x => x.id === Number(id)); if (!a) throw new Error('El albarán no existe'); return copia(a); };
    this.crearAlbaran = async p => {
      const anio = Number(p.fecha.slice(0, 4));
      let num = db.contadores[anio] || anio * 10000 + 1;
      const max = Math.max(0, ...db.albaranes.filter(a => a.anio === anio).map(a => a.numero));
      if (max >= num) num = max + 1;
      db.contadores[anio] = num + 1;
      p = { ...p, pedido: pedidoAuto(p) };
      const a = { id: db.seq.alb++, numero: num, anio, estado: 'activo', motivo_anulacion: null, enviado_asesoria_at: null, modificado_tras_envio: false, creado_por: yo, modificado_por: yo, created_at: ahora(), updated_at: ahora() };
      CAMPOS.forEach(k => a[k] = p[k] ?? null);
      db.albaranes.push(a); hist(a, 'creado'); guardar(); return copia(a);
    };
    this.crearAlbaranConNumero = async (p, numero) => {
      if (db.albaranes.some(x => x.numero === numero)) throw new Error('NUMERO_OCUPADO');
      const anio = Number(p.fecha.slice(0, 4));
      db.contadores[anio] = Math.max(db.contadores[anio] || 0, numero + 1);
      if (p.pedido_auto && p.pedido_n) { const c = db.ajustes.pedido || { prefijo: 'B', siguiente: 1 }; c.siguiente = Math.max(c.siguiente, p.pedido_n + 1); db.ajustes.pedido = c; }
      const a = { id: db.seq.alb++, numero, anio, estado: 'activo', motivo_anulacion: null, enviado_asesoria_at: null, modificado_tras_envio: false, creado_por: yo, modificado_por: yo, created_at: ahora(), updated_at: ahora() };
      CAMPOS.forEach(k => a[k] = p[k] ?? null);
      db.albaranes.push(a); hist(a, 'creado'); guardar(); return copia(a);
    };
    this.hayRed = async () => true;
    this.modificarAlbaran = async (id, p, version) => {
      const a = db.albaranes.find(x => x.id === id);
      if (version && a.updated_at !== version) throw new Error('Otra persona ha modificado este albarán mientras lo tenías abierto. Vuelve a abrirlo.');
      const antes = copia(a);
      CAMPOS.forEach(k => a[k] = p[k] ?? null);
      a.modificado_tras_envio = !!a.enviado_asesoria_at || a.modificado_tras_envio;
      a.updated_at = ahora(); a.modificado_por = yo; hist(a, 'modificado', antes); guardar(); return copia(a);
    };
    this.anularAlbaran = async (id, motivo) => {
      const a = db.albaranes.find(x => x.id === id); const antes = copia(a);
      a.estado = 'anulado'; a.motivo_anulacion = motivo || null; a.updated_at = ahora();
      a.modificado_tras_envio = !!a.enviado_asesoria_at || a.modificado_tras_envio;
      hist(a, 'anulado', antes); guardar(); return copia(a);
    };
    this.reactivarAlbaran = async id => {
      const a = db.albaranes.find(x => x.id === id); const antes = copia(a);
      a.estado = 'activo'; a.motivo_anulacion = null; a.updated_at = ahora(); hist(a, 'reactivado', antes); guardar(); return copia(a);
    };
    this.marcarEnviados = async ids => {
      ids.forEach(id => { const a = db.albaranes.find(x => x.id === id); if (a) { a.enviado_asesoria_at = ahora(); a.modificado_tras_envio = false; hist(a, 'enviado'); } });
      guardar(); return ids.length;
    };
    this.historial = async id => copia(db.historial.filter(h => h.albaran_id === Number(id)));
    this.marcarEmail = async id => { const a = db.albaranes.find(x => x.id === id); a.email_enviado_at = ahora(); a.email_enviado_por = yo; hist(a, 'email'); guardar(); return copia(a); };
    this.subirPdf = async () => null;
  }

  // ───────────────── TRABAJO SIN CONEXIÓN ─────────────────
  //  Envuelve cualquiera de los dos anteriores:
  //  - guarda en el ordenador clientes, productos, ajustes y el siguiente número
  //  - si no hay internet, los albaranes nuevos quedan "pendientes" en el ordenador
  //    con su número, y se suben solos cuando vuelve la conexión
  function ConCache(base) {
    const K = 'alb-cache-' + base.modo, KP = 'alb-pendientes-' + base.modo;
    const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || def; } catch (e) { return def; } };
    const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento lleno o bloqueado */ } };
    let cache = leer(K, { sig: {} });
    let pend = leer(KP, []);
    const guardarCache = () => escribir(K, cache);
    const guardarPend = () => escribir(KP, pend);
    const self = this;
    this.modo = base.modo;
    this.enLinea = true;
    this.reiniciar = base.reiniciar ? () => { base.reiniciar(); cache = { sig: {} }; pend = []; guardarCache(); guardarPend(); } : undefined;

    const avisar = () => window.dispatchEvent(new CustomEvent('alb-red'));
    const marcar = v => { if (self.enLinea !== v) { self.enLinea = v; avisar(); } };
    const simulaSinRed = () => base.modo === 'prueba' && (() => { try { return localStorage.getItem('alb-simular-sin-red') === '1'; } catch (e) { return false; } })();
    async function red(fn) {
      if (simulaSinRed()) { marcar(false); const e = new Error('Failed to fetch (simulado)'); e.sinRed = true; e.message = errorLegible(e); throw e; }
      try { const r = await fn(); marcar(true); return r; }
      catch (e) { if (esErrorRed(e)) { e.sinRed = true; marcar(false); } throw e; }
    }
    const conCopia = async (fn, clave) => {
      try { const r = await red(fn); cache[clave] = r; guardarCache(); return r; }
      catch (e) { if (e.sinRed && cache[clave] !== undefined) return JSON.parse(JSON.stringify(cache[clave])); throw e; }
    };

    // ── sesión ──
    this.sesion = async () => {
      let u = null;
      try { u = await base.sesion(); } catch (e) { /* sin red */ }
      if (u) { cache.usuario = u; guardarCache(); return u; }
      if (cache.usuario && !(await this.hayRed())) { marcar(false); return cache.usuario; }   // sin internet: sigue con el último usuario
      return null;
    };
    this.entrar = async (email, pass) => { const u = await red(() => base.entrar(email, pass)); cache.usuario = u; guardarCache(); return u; };
    this.salir = async () => {
      if (pend.length) throw new Error('Hay albaranes hechos sin conexión que aún no se han subido. Espera a que vuelva internet antes de cerrar la sesión.');
      await red(() => base.salir()); cache = { sig: {} }; guardarCache();
    };
    this.hayRed = async () => { if (simulaSinRed()) return false; if (navigator.onLine === false) return false; return base.hayRed ? base.hayRed() : true; };

    // ── datos que se guardan en el ordenador ──
    this.ajustes = () => conCopia(() => base.ajustes(), 'ajustes');
    this.clientes = () => conCopia(() => base.clientes(), 'clientes');
    this.productos = () => conCopia(() => base.productos(), 'productos');

    const siguienteLocal = anio => Math.max(cache.sig[anio] || anio * 10000 + 1, ...pend.filter(x => x.anio === anio).map(x => x.numero + 1));
    this.contador = async anio => {
      try { const n = await red(() => base.contador(anio)); cache.sig[anio] = n; guardarCache(); return Math.max(n, siguienteLocal(anio)); }
      catch (e) { if (e.sinRed) return siguienteLocal(anio); throw e; }
    };
    this.fijarContador = async (anio, sig) => { await red(() => base.fijarContador(anio, sig)); cache.sig[anio] = sig; guardarCache(); };
    // tras usar un pedido automático, el siguiente que se recuerda sin conexión avanza
    const anotarPedido = (p, a) => {
      if (!p.pedido_auto) return;
      const n = Math.max(p.pedido_n || 0, parseInt(String(a.pedido || '').slice(-4), 10) || 0);
      const c = cache.pedido || (cache.ajustes && cache.ajustes.pedido) || { prefijo: 'B', siguiente: 1 };
      cache.pedido = { ...c, siguiente: Math.max(c.siguiente || 1, n + 1) };
    };
    // siguiente nº de pedido (teniendo en cuenta los hechos sin conexión)
    this.pedido = async () => {
      let v;
      try { v = await red(() => base.pedido()); cache.pedido = v; guardarCache(); }
      catch (e) { if (!e.sinRed) throw e; v = cache.pedido || (cache.ajustes && cache.ajustes.pedido) || { prefijo: 'B', siguiente: 1 }; }
      v = { ...v };
      for (const x of pend) if (x.p.pedido_auto && x.p.pedido_n >= v.siguiente) v.siguiente = x.p.pedido_n + 1;
      return v;
    };

    // ── albaranes ──
    const comoAlbaran = x => ({ ...x.p, id: -x.numero, numero: x.numero, anio: x.anio, estado: 'activo', pendiente: true,
      conflicto: x.conflicto || false, creado_por: x.usuario, created_at: x.creado, updated_at: x.creado });
    this.pendientes = () => pend.map(comoAlbaran);
    this.albaranes = async anio => {
      const loc = pend.filter(x => !anio || x.anio === anio).map(comoAlbaran);
      try {
        const srv = await red(() => base.albaranes(anio));
        return [...loc, ...srv].sort((a, b) => b.numero - a.numero || (a.pendiente ? -1 : 1));
      } catch (e) { if (e.sinRed) return loc; throw e; }
    };
    this.anios = async () => { try { return await red(() => base.anios()); } catch (e) { if (e.sinRed) return [new Date().getFullYear()]; throw e; } };
    this.albaran = async id => {
      id = Number(id);
      if (id < 0) { const x = pend.find(y => y.numero === -id); if (!x) throw new Error('Ese albarán ya se ha subido. Búscalo en la lista.'); return comoAlbaran(x); }
      return red(() => base.albaran(id));
    };
    this.historial = async id => Number(id) < 0 ? [] : red(() => base.historial(id));
    this.crearAlbaran = async p => {
      const anio = Number(p.fecha.slice(0, 4));
      try {
        const a = await red(() => base.crearAlbaran(p));
        cache.sig[anio] = Math.max(cache.sig[anio] || 0, a.numero + 1);
        anotarPedido(p, a); guardarCache();
        return a;
      } catch (e) {
        if (!e.sinRed) throw e;
        // sin internet: se guarda en el ordenador con el siguiente número
        const x = { numero: siguienteLocal(anio), anio, p, usuario: cache.usuario || '', creado: new Date().toISOString() };
        pend.push(x); guardarPend(); avisar();
        return comoAlbaran(x);
      }
    };
    ['modificarAlbaran', 'anularAlbaran', 'reactivarAlbaran', 'marcarEnviados', 'marcarEmail', 'guardarCliente', 'guardarProducto', 'guardarAjuste', 'subirPdf']
      .forEach(f => { self[f] = (...args) => red(() => base[f](...args)); });

    // ── subir lo pendiente ──
    let subiendo = false;
    this.alSubir = null;                         // la app lo usa para subir el PDF de cada albarán
    this.sincronizar = async () => {
      if (subiendo || !pend.length) return { subidos: [], conflictos: pend.filter(x => x.conflicto).length };
      subiendo = true;
      const subidos = [];
      try {
        for (const x of [...pend].sort((a, b) => a.numero - b.numero)) {
          if (x.conflicto) continue;
          try {
            const a = await red(() => base.crearAlbaranConNumero(x.p, x.numero));
            pend = pend.filter(y => y !== x); guardarPend();
            cache.sig[x.anio] = Math.max(cache.sig[x.anio] || 0, a.numero + 1); anotarPedido(x.p, a); guardarCache();
            subidos.push(a);
            if (self.alSubir) try { await self.alSubir(a); } catch (e) { /* el PDF se puede volver a subir luego */ }
          } catch (e) {
            if (e.sinRed) break;
            if (/NUMERO_OCUPADO/.test(e.original || e.message)) { x.conflicto = true; guardarPend(); }
            else throw e;
          }
        }
      } finally { subiendo = false; avisar(); }
      return { subidos, conflictos: pend.filter(x => x.conflicto).length };
    };
    // número ocupado: se sube con el siguiente libre (hay que volver a imprimirlo)
    this.subirConNuevoNumero = async numeroLocal => {
      const x = pend.find(y => y.numero === numeroLocal);
      if (!x) throw new Error('Ese albarán ya no está pendiente.');
      const a = await red(() => base.crearAlbaran(x.p));
      pend = pend.filter(y => y !== x); guardarPend();
      cache.sig[a.anio] = Math.max(cache.sig[a.anio] || 0, a.numero + 1); anotarPedido(x.p, a); guardarCache(); avisar();
      return a;
    };
  }

  window.crearBackend = function () {
    const prueba = window.FORZAR_PRUEBA || /[?&]prueba\b/.test(location.search) || !CONFIG.SUPABASE_URL || !window.supabase;
    return new ConCache(prueba ? new BackendPrueba() : new BackendSupabase(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY));
  };
  window.esErrorRed = esErrorRed;
  window.errorLegible = errorLegible;
})();
