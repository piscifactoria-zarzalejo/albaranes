// ════════════════════════════════════════════════════════
//  UTILIDADES: formato de números/fechas y cálculos del albarán
// ════════════════════════════════════════════════════════
(function () {
  const U = {};

  U.UNIDADES = {
    kg:        { nombre: 'Por kilo',            precio: '€/kg' },
    unidad:    { nombre: 'Por unidad',          precio: '€/ud' },
    millar_cm: { nombre: 'Por millar y cm',     precio: '€/millar·cm' },
    fijo:      { nombre: 'Importe fijo',        precio: 'Importe €' }
  };

  U.FAMILIAS = {
    ALV:   'Alevines',
    RAC:   'Trucha ración',
    CONG:  'Trucha evisc. congelada',
    REP:   'Trucha repoblación',
    EVIS:  'Trucha eviscerada',
    EEST:  'Trucha evisc. estéril',
    HUE:   'Huevas',
    ENV:   'Producto envasado',
    OTROS: 'Otros'
  };

  U.REGIMEN = {
    nacional:    'Nacional (con IVA)',
    ue:          'Unión Europea (exento)',
    exportacion: 'Exportación fuera UE (exento)'
  };

  U.round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // Número → texto español con puntos de miles: 1234.5 → "1.234,50"
  U.num = function (n, dec = 2, minDec = dec) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '';
    n = Number(n);
    const neg = n < 0;
    let s = Math.abs(n).toFixed(dec);
    let [ent, fr] = s.split('.');
    if (fr) {
      while (fr.length > minDec && fr.endsWith('0')) fr = fr.slice(0, -1);
    }
    ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + ent + (fr ? ',' + fr : '');
  };
  U.eur = n => (n === null || n === undefined || n === '' || isNaN(n)) ? '' : U.num(n, 2) + ' €';
  U.kg = n => U.num(n, 2, 0);
  // nº de pedido: prefijo + año (2 cifras) + 4 cifras → B260081
  U.pedidoTexto = (cfg, anio) => (cfg?.prefijo ?? 'B') + String(anio).slice(-2) + String(cfg?.siguiente ?? 1).padStart(4, '0');
  // gramos por unidad: sin decimales a partir de 10 g (trucha); con 2 decimales en alevines pequeños
  U.gramos = g => (g === null || g === undefined) ? '' : (g >= 10 ? U.num(g, 0) : U.num(g, 2));

  // Texto escrito por el usuario → número ("1.234,5" o "1234.5")
  U.parse = function (v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim().replace(/\s|€/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    const n = Number(s);
    return isFinite(n) ? n : null;
  };

  // Fechas: guardamos 'YYYY-MM-DD'
  U.hoy = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  U.sumarDias = function (iso, dias) {
    const [y, m, d] = iso.split('-').map(Number);
    const f = new Date(y, m - 1, d + Number(dias || 0));
    return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
  };
  // '2026-10-01' → '1-10-26' (formato de los albaranes actuales)
  U.fechaCorta = function (iso) {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return Number(d) + '-' + m + '-' + y.slice(2);
  };
  U.fechaLarga = function (iso) {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return d + '/' + m + '/' + y;
  };
  U.fechaHora = function (ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };
  U.MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

  U.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ── Cálculo de una línea ──────────────────────────────
  U.calcLinea = function (l) {
    const kilos = U.parse(l.kilos), uds = U.parse(l.unidades), talla = U.parse(l.talla_cm), precio = U.parse(l.precio);
    let total = null;
    switch (l.unidad_precio) {
      case 'kg':        if (kilos !== null && precio !== null) total = kilos * precio; break;
      case 'unidad':    if (uds !== null && precio !== null) total = uds * precio; break;
      case 'millar_cm': if (uds !== null && talla !== null && precio !== null) total = uds / 1000 * talla * precio; break;
      case 'fijo':      if (precio !== null) total = precio; break;
    }
    const gr_uni = (kilos && uds) ? kilos * 1000 / uds : null;
    return { total: total === null ? null : U.round2(total), gr_uni };
  };

  // Qué falta en una línea (devuelve texto o '')
  U.faltaEnLinea = function (l) {
    if (!l.concepto) return 'elige el producto';
    const k = U.parse(l.kilos), u = U.parse(l.unidades), t = U.parse(l.talla_cm), p = U.parse(l.precio);
    if (l.unidad_precio === 'kg' && k === null) return 'faltan los kilos';
    if ((l.unidad_precio === 'unidad' || l.unidad_precio === 'millar_cm') && u === null) return 'faltan las unidades';
    if (l.unidad_precio === 'millar_cm' && t === null) return 'falta la talla en cm';
    if (p === null) return l.unidad_precio === 'fijo' ? 'falta el importe' : 'falta el precio';
    return '';
  };

  // ── Cálculo del albarán completo ──────────────────────
  // regimen: 'nacional' | 'ue' | 'exportacion'
  U.calcAlbaran = function (lineas, descuentoPct, regimen, fecha, diasConsumo) {
    const desc = (U.parse(descuentoPct) || 0) / 100;
    const exento = regimen && regimen !== 'nacional';
    let kilos = 0, unidades = 0, suma = 0;
    const grupos = {};
    for (const l of lineas) {
      const c = U.calcLinea(l);
      const t = c.total || 0;
      kilos += U.parse(l.kilos) || 0;
      unidades += U.parse(l.unidades) || 0;
      suma += t;
      const tipo = exento ? 0 : Number(l.iva ?? 10);
      grupos[tipo] = (grupos[tipo] || 0) + t;
    }
    suma = U.round2(suma);
    const descImporte = U.round2(suma * desc);
    const desglose = Object.keys(grupos).map(Number).sort((a, b) => a - b).map(tipo => {
      const base = U.round2(grupos[tipo] * (1 - desc));
      return { tipo, base, cuota: U.round2(base * tipo / 100), exento };
    });
    const base = U.round2(desglose.reduce((s, g) => s + g.base, 0));
    const iva = U.round2(desglose.reduce((s, g) => s + g.cuota, 0));
    return {
      kilos: U.round2(kilos), unidades: Math.round(unidades), suma, descuento: (U.parse(descuentoPct) || 0),
      descuento_importe: descImporte, desglose_iva: desglose, base, iva, total: U.round2(base + iva), exento
    };
  };

  window.U = U;
})();
