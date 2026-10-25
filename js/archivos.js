// ════════════════════════════════════════════════════════
//  GUARDAR PDF EN UNA CARPETA DEL ORDENADOR, IMPRIMIR, DESCARGAR
//  La carpeta se elige una vez (Chrome / Edge) y se recuerda.
// ════════════════════════════════════════════════════════
(function () {
  const IDB = 'alb-archivos', STORE = 'kv';
  const abrir = () => new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const leer = async k => { try { const db = await abrir(); return await new Promise(res => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } };
  const escribir = async (k, v) => { const db = await abrir(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); };
  const borrar = async k => { const db = await abrir(); return new Promise(res => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(k); tx.oncomplete = res; }); };

  const A = {};
  A.soportado = () => 'showDirectoryPicker' in window;
  A.carpeta = () => leer('carpeta');
  A.nombreCarpeta = async () => { const h = await leer('carpeta'); return h ? h.name : null; };

  A.elegirCarpeta = async () => {
    const h = await window.showDirectoryPicker({ id: 'albaranes', mode: 'readwrite', startIn: 'documents' });
    await escribir('carpeta', h);
    return h.name;
  };
  A.olvidarCarpeta = () => borrar('carpeta');

  // Llamar DIRECTAMENTE al pulsar el botón (antes de cualquier espera):
  // el navegador solo pide permiso en respuesta a un clic.
  A.prepararPermiso = async () => {
    const h = await leer('carpeta');
    if (!h) return null;
    try {
      let p = await h.queryPermission({ mode: 'readwrite' });
      if (p === 'prompt') p = await h.requestPermission({ mode: 'readwrite' });
      return p === 'granted' ? h : null;
    } catch (e) { return null; }
  };

  A.guardarEnCarpeta = async (h, nombre, blob) => {
    const f = await h.getFileHandle(nombre, { create: true });
    const w = await f.createWritable();
    await w.write(blob); await w.close();
  };

  A.borrarDeCarpeta = async (h, nombre) => { try { await h.removeEntry(nombre); } catch (e) { /* no existía */ } };

  A.descargar = (blob, nombre) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  };

  // Imprime un PDF: lo carga en un marco oculto y abre la ventana de impresión.
  // Si el navegador no lo permite, lo abre en una pestaña nueva.
  A.imprimir = (blob) => {
    const url = URL.createObjectURL(blob);
    let fr = document.getElementById('marco-impresion');
    if (fr) fr.remove();
    fr = document.createElement('iframe');
    fr.id = 'marco-impresion';
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
    fr.onload = () => {
      setTimeout(() => {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); }
        catch (e) { window.open(url, '_blank'); }
      }, 300);
    };
    fr.src = url;
    document.body.appendChild(fr);
  };

  window.ARCHIVOS = A;
})();
