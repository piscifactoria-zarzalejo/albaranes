// ════════════════════════════════════════════════════════
//  ACCESO A DATOS
//  - BackendSupabase: la base de datos real (tablas alb_*)
//  - BackendPrueba:   todo en este navegador (localStorage), para probar
//  Las dos tienen exactamente las mismas funciones.
// ════════════════════════════════════════════════════════
(function () {

  function errorLegible(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'El usuario no está confirmado en Supabase.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión con la base de datos. Comprueba internet e inténtalo de nuevo.';
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
    const sb = window.supabase.createClient(url, key, {
      db: { schema: 'albaranes' },                 // esquema propio, separado de etiquetado
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'alb-sesion' }
    });
    const ok = r => { if (r.error) throw new Error(errorLegible(r.error)); return r.data; };

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
    this.modificarAlbaran = async (id, p, version) => ok(await sb.rpc('modificar_albaran', { p_id: id, p, p_version: version }));
    this.anularAlbaran = async (id, motivo) => ok(await sb.rpc('anular_albaran', { p_id: id, p_motivo: motivo || '' }));
    this.reactivarAlbaran = async id => ok(await sb.rpc('reactivar_albaran', { p_id: id }));
    this.marcarEnviados = async ids => ok(await sb.rpc('marcar_enviados', { p_ids: ids }));
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
          ajustes: { empresa: S.ajustes.empresa },
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
      const a = { id: db.seq.alb++, numero: num, anio, estado: 'activo', motivo_anulacion: null, enviado_asesoria_at: null, modificado_tras_envio: false, creado_por: yo, modificado_por: yo, created_at: ahora(), updated_at: ahora() };
      CAMPOS.forEach(k => a[k] = p[k] ?? null);
      db.albaranes.push(a); hist(a, 'creado'); guardar(); return copia(a);
    };
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
    this.subirPdf = async () => null;
  }

  window.crearBackend = function () {
    const prueba = window.FORZAR_PRUEBA || /[?&]prueba\b/.test(location.search) || !CONFIG.SUPABASE_URL || !window.supabase;
    return prueba ? new BackendPrueba() : new BackendSupabase(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  };
  window.errorLegible = errorLegible;
})();
