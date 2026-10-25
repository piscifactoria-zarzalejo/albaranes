// ════════════════════════════════════════════════════════
//  PDF DEL ALBARÁN
//  Diseño según "copia_solo_impresion.xlsm" (oct. 2026).
//  Medidas en mm sobre A4 vertical. Texto real (no imagen),
//  para que la app de trazabilidad pueda leerlo.
// ════════════════════════════════════════════════════════
(function () {
  const X0 = 17.8, X1 = 192.1;                 // márgenes izquierdo y derecho
  const NEGRO = [0, 0, 0], GRIS = [90, 90, 90], FONDO_CAB = [191, 191, 191], GRIS_MARCA = [205, 205, 205];
  // columnas de la tabla de líneas
  const COL = [17.8, 36.9, 85.2, 104.4, 125.1, 139.7, 153.3, 172.9, 192.1];
  const Y_CAB = 95.8, Y_LIN = 99.5;            // cabecera de la tabla y primera fila
  const FILA = 5.43, ALTO_TOT = 7.6;

  function pagina(doc, a, aj, etiqueta) {
    const E = aj.empresa || {};
    const t = (txt, x, y, o = {}) => {
      doc.setFont('helvetica', o.estilo || 'normal');
      doc.setFontSize(o.tam || 7);
      doc.setTextColor(...(o.color || NEGRO));
      doc.text(String(txt ?? ''), x, y, { align: o.al || 'left', baseline: 'middle', maxWidth: o.max });
    };
    const caja = (x, y, w, h, relleno) => { if (relleno) { doc.setFillColor(...relleno); doc.rect(x, y, w, h, 'FD'); } else doc.rect(x, y, w, h); };
    const linea = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2);
    const centro = (txt, xa, xb, y, o) => t(txt, (xa + xb) / 2, y, { ...o, al: 'center' });
    // reduce la letra hasta que el texto quepa en el ancho
    const ajustar = (txt, ancho, tamMax, estilo = 'normal', tamMin = 4.5) => {
      let tam = tamMax; doc.setFont('helvetica', estilo);
      while (tam > tamMin && doc.getStringUnitWidth(String(txt)) * tam / 72 * 25.4 > ancho - 1.2) tam -= 0.25;
      return tam;
    };
    const img = (k, x, y, w, h) => { const i = window.IMG[k]; if (i) doc.addImage(i.src, i.tipo || 'JPEG', x, y, w, h, k, 'FAST'); };

    doc.setLineWidth(0.2); doc.setDrawColor(0);

    // ── Cabecera de empresa ─────────────────────────────
    t(E.nombre, X0, 23.8, { tam: 7.5, estilo: 'bold' });
    (E.lineas || []).forEach((l, i) => t(l, X0, 27.3 + i * 3.6, { tam: 7 }));
    img('logo', 79.7, 22.4, 51.9, 51.9 * 237 / 500);
    t('PRODUCTO CERTIFICADO', 163.5, 23.8, { tam: 6, estilo: 'bold' });
    img('globalgap', 164, 26.6, 28.1, 4.7);
    t(E.ggn, 163.5, 34.2, { tam: 6, estilo: 'bold' });
    img('bureau', 163.5, 40.9, 28.2, 13.1);

    // ── ALBARÁN + datos ─────────────────────────────────
    t('ALBARÁN', X0 - 0.6, 67.5, { tam: 43, estilo: 'bold' });
    const hx = [17.8, 36.9, 56.1, 75.5, 89.8];
    caja(hx[0], 77.6, hx[4] - hx[0], 9); linea(hx[0], 81.3, hx[4], 81.3);
    for (let i = 1; i < 4; i++) linea(hx[i], 77.6, hx[i], 86.6);
    ['Nº ALBARAN', 'Nº PEDIDO', 'FECHA', 'CLIENTE'].forEach((s, i) => centro(s, hx[i], hx[i + 1], 79.5, { tam: 5.8, estilo: 'bold' }));
    const vals = [a.numero ?? '(sin guardar)', a.pedido || '', U.fechaCorta(a.fecha), a.cliente?.codigo ?? ''];
    vals.forEach((s, i) => centro(s, hx[i], hx[i + 1], 84, { tam: ajustar(s, hx[i + 1] - hx[i], 9) }));

    // Cuadro del cliente
    const c = a.cliente || {};
    const extranjero = c.pais && c.pais !== 'España';
    caja(99.5, 60.7, X1 - 99.5, 86.6 - 60.7);
    t(c.nombre, 104.4, 66.3, { tam: ajustar(c.nombre || '', 84, 7.5, 'bold'), estilo: 'bold' });
    t(c.direccion, 104.4, 71.1, { tam: ajustar(c.direccion || '', 84, 8) });
    // 3ª línea: CP   POBLACIÓN (Provincia o País), todo seguido
    const zona = extranjero ? c.pais : c.provincia;
    const repetida = zona && c.poblacion && U.norm(zona) === U.norm(c.poblacion);
    const l3 = [c.cp, c.poblacion].filter(Boolean).join('   ') + (zona && !repetida ? ' (' + zona + ')' : '');
    t(l3, 104.4, 75.5, { tam: ajustar(l3, X1 - 104.4 - 3, 8) });
    // 4ª línea: CIF/NIF y teléfono, cada valor junto a su etiqueta; sin teléfono no sale "Telf:"
    let x4 = 104.4;
    const par = (etq, val) => {
      t(etq, x4, 80.2, { tam: 6, estilo: 'bold' }); x4 += doc.getTextWidth(etq) + 1.8;
      t(val, x4, 80.2, { tam: 7.5 }); x4 += Math.max(doc.getTextWidth(val), val ? 0 : 22) + 9;
    };
    par('CIF/NIF:', c.cif || '');                 // siempre visible: si falta, se ve el hueco
    if (c.telefono) par('Telf:', c.telefono);

    // ── Tabla de líneas ─────────────────────────────────
    const nFil = CONFIG.MAX_LINEAS;
    const yFin = Y_LIN + nFil * FILA;            // fin de filas = inicio fila de totales
    // Marca sanitaria (óvalo gris claro de fondo, centrado en las líneas)
    if (E.registro_sanitario) {
      // cada texto en el centro de una fila: ES, nº y UE en tres filas seguidas
      const filaCentro = Math.floor((nFil - 1) / 2);                 // fila central (0-based)
      const cy = Y_LIN + FILA * (filaCentro + 0.5) + 0.2, tam = 12, paso = FILA;
      const eje = COL[3];                                            // línea entre LOTE y ESTANQUE
      const R = E.registro_sanitario;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(tam);
      const w = s => doc.getTextWidth(s);
      // la línea cae entre E|S, U|E y entre el "0" y el "2" de "02" del número
      const corte = R.indexOf('02');
      const xNum = corte >= 0 ? eje - w(R.slice(0, corte + 1)) : eje - w(R) / 2;
      const cx = xNum + w(R) / 2;
      const rx = w(R) / 2 + 13, ry = paso + 4.6;                     // óvalo alargado, ajustado al texto
      doc.setDrawColor(...GRIS_MARCA); doc.setLineWidth(0.5);
      doc.ellipse(cx, cy, rx, ry, 'S');
      t('ES', eje - w('E'), cy - paso, { tam, color: GRIS_MARCA });
      t(R, xNum, cy, { tam, color: GRIS_MARCA });
      t('UE', eje - w('U'), cy + paso, { tam, color: GRIS_MARCA });
      doc.setDrawColor(0); doc.setLineWidth(0.2);
    }
    caja(X0, Y_CAB, X1 - X0, Y_LIN - Y_CAB, FONDO_CAB);
    caja(X0, Y_CAB, X1 - X0, yFin + ALTO_TOT - Y_CAB);
    for (let i = 1; i < nFil; i++) linea(X0, Y_LIN + i * FILA, X1, Y_LIN + i * FILA);
    doc.setLineWidth(0.45); linea(X0, yFin, X1, yFin); doc.setLineWidth(0.2);
    for (let i = 1; i < COL.length - 1; i++) linea(COL[i], Y_CAB, COL[i], yFin + ALTO_TOT);
    ['KILOS/UNI', 'CONCEPTO', 'LOTE', 'ESTANQUE', 'GR/UNI', 'UNIDADES', 'PV*', '€ TOTAL']
      .forEach((s, i) => centro(s, COL[i], COL[i + 1], (Y_CAB + Y_LIN) / 2, { tam: 6, estilo: 'bold' }));

    (a.lineas || []).slice(0, nFil).forEach((l, i) => {
      const y = Y_LIN + i * FILA + FILA / 2;
      const calc = U.calcLinea(l);
      let concepto = (a.idioma === 'en' && l.nombre_en) ? l.nombre_en : (l.concepto || '');
      if (l.unidad_precio === 'millar_cm' && U.parse(l.talla_cm)) concepto += ' (' + U.num(U.parse(l.talla_cm), 1, 0) + ' cm)';
      const celdas = [
        U.kg(U.parse(l.kilos)), concepto, l.lote || '', l.estanque || '',
        calc.gr_uni ? U.gramos(calc.gr_uni) : '', U.num(U.parse(l.unidades), 0),
        U.parse(l.precio) !== null && l.unidad_precio !== 'fijo' ? U.eur(U.parse(l.precio)) : '',
        calc.total !== null ? U.eur(calc.total) : ''
      ];
      const tamBase = [8, 7.5, 5.8, 6.5, 7.5, 7.5, 7.5, 7.5];
      celdas.forEach((s, k) => { if (s) centro(s, COL[k], COL[k + 1], y, { tam: ajustar(s, COL[k + 1] - COL[k], tamBase[k]) }); });
    });
    // fila de totales
    const yT = yFin + ALTO_TOT / 2;
    if (a.kilos) centro(U.kg(a.kilos), COL[0], COL[1], yT, { tam: 8, estilo: 'bold' });
    if (a.unidades) centro(U.num(a.unidades, 0), COL[5], COL[6], yT, { tam: 7.5, estilo: 'bold' });
    centro(U.eur(a.suma), COL[7], COL[8], yT, { tam: ajustar(U.eur(a.suma), COL[8] - COL[7], 7.5, 'bold'), estilo: 'bold' });

    // ── Totales ─────────────────────────────────────────
    const y = yFin + ALTO_TOT + 3.4;              // ≈186.6
    const F = [17.8, 46.6, 56.6, 70.4, 94.9, 104.4, 134.6, 144.6, 158.2, 192.1];
    const desg = (a.desglose_iva && a.desglose_iva.length) ? a.desglose_iva : [{ tipo: 10, base: a.base, cuota: a.iva }];
    const hCab = 4.1, hFila = 7.2, altoVal = hFila * desg.length;
    caja(X0, y, X1 - X0, hCab + altoVal);
    linea(X0, y + hCab, X1, y + hCab);
    [1, 3, 4, 5, 6, 8].forEach(i => linea(F[i], y, F[i], y + hCab + altoVal));
    [2, 7].forEach(i => linea(F[i], y + hCab, F[i], y + hCab + altoVal));        // subdivisiones
    for (let i = 1; i < desg.length; i++) linea(F[3], y + hCab + hFila * i, F[6], y + hCab + hFila * i);
    [['SUMA DE IMPORTES', 0, 1], ['DESCUENTO', 1, 3], ['BASE IMPONIBLE', 3, 4], ['% IVA', 4, 5], ['IMPORTE IVA', 5, 6], ['% REC. EQUIV. IMPORTE', 6, 8], ['TOTAL ALB.', 8, 9]]
      .forEach(([s, i, j]) => centro(s, F[i], F[j], y + hCab / 2, { tam: ajustar(s, F[j] - F[i], 6, 'bold'), estilo: 'bold' }));
    const yv = y + hCab + altoVal / 2;
    centro(U.eur(a.suma), F[0], F[1], yv, { tam: 7, estilo: 'bold' });
    if (Number(a.descuento)) centro(U.num(a.descuento, 2, 0) + '%', F[1], F[2], yv, { tam: 7, estilo: 'bold' });
    centro(U.eur(U.round2(a.suma - a.base)), F[2], F[3], yv, { tam: 7, estilo: 'bold' });
    desg.forEach((g, i) => {
      const yy = y + hCab + hFila * i + hFila / 2;
      centro(U.eur(g.base), F[3], F[4], yy, { tam: 7, estilo: 'bold' });
      centro(g.exento ? 'EXENTO' : U.num(g.tipo, 2, 0) + '%', F[4], F[5], yy, { tam: g.exento ? 5.8 : 7, estilo: 'bold' });
      centro(U.eur(g.cuota), F[5], F[6], yy, { tam: 7, estilo: 'bold' });
    });
    centro(U.eur(a.total), F[8], F[9], yv, { tam: 8, estilo: 'bold' });
    const yDesp = y + hCab + altoVal;

    // ── Nota de precios, IBAN ───────────────────────────
    t(E.nota_precio, X0, yDesp + 2.6, { tam: 5.6, estilo: 'italic' });
    t('NUMERO DE CUENTA IBAN:  ' + (E.iban || ''), X0, yDesp + 10.1, { tam: 9.5 });

    // ── Observaciones y precinto ────────────────────────
    const yo = yDesp + 19.3, altoObs = 23.6;
    caja(X0, yo, X1 - X0, altoObs);
    t('Observaciones:', X0 + 0.4, yo + 2.3, { tam: 6 });
    // otras observaciones (p. ej. PAGO CONTADO): debajo del título, a la izquierda
    if (a.observaciones) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      const lin = doc.splitTextToSize(a.observaciones, X1 - X0 - 4).slice(0, 2);
      lin.forEach((s, i) => t(s, X0 + 0.4, yo + 6.4 + i * 3.6, { tam: 8 }));
    }
    // precinto: en medio del recuadro y más grande
    if (a.precinto) centro('PRECINTO Nº   ' + a.precinto, X0, X1, yo + altoObs / 2 + 2.5, { tam: 13 });

    // ── Firmas ──────────────────────────────────────────
    const yf = yo + altoObs + 3.4, altoF = 29.8, xs = [X0, 65.8, 129.8, X1];
    caja(X0, yf, X1 - X0, altoF);
    linea(xs[1], yf, xs[1], yf + altoF); linea(xs[2], yf, xs[2], yf + altoF);
    t('SALIDA PISCIFACTORIA', X0 + 0.4, yf + 1.9, { tam: 6 });
    t('RECIBI MERCANCIA', xs[1] + 0.4, yf + 1.9, { tam: 6 });
    t('DNI', xs[1] + 0.4, yf + 16.9, { tam: 6 });
    t('RECIBI TRANSPORTISTA', xs[2] + 0.4, yf + 1.9, { tam: 6 });

    // ── Pie ─────────────────────────────────────────────
    if (E.pie) t(E.pie, X0, yf + altoF + 5.5, { tam: ajustar(E.pie, X1 - X0, 5.2), max: X1 - X0 });
    t(E.codigo_doc, 200, 287.7, { tam: 6, al: 'right' });
    if (etiqueta) t(etiqueta, X0, 287.7, { tam: 6.5, estilo: 'italic', color: GRIS });

    // marca de anulado
    if (a.estado === 'anulado') {
      doc.setTextColor(220, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(64);
      doc.text('ANULADO', 105, 150, { align: 'center', angle: 30, baseline: 'middle' });
    }
  }

  // copias: 1 para guardar, 2 para imprimir
  window.generarPdf = function (albaran, ajustes, copias = 1) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    doc.setProperties({ title: 'ALBARAN ' + (albaran.numero || ''), author: ajustes.empresa?.nombre || '', creator: 'Albaranes Zarzalejo' });
    const etiquetas = [null, null];
    for (let i = 0; i < copias; i++) {
      if (i > 0) doc.addPage();
      pagina(doc, albaran, ajustes, copias > 1 ? etiquetas[i] : null);
    }
    return doc;
  };
  // varios albaranes en un solo PDF (para imprimir de una vez)
  window.generarPdfVarios = function (lista, ajustes, copias = 2) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    doc.setProperties({ title: 'Albaranes', author: ajustes.empresa?.nombre || '', creator: 'Albaranes Zarzalejo' });
    let primera = true;
    for (const a of lista) for (let i = 0; i < copias; i++) {
      if (!primera) doc.addPage();
      primera = false;
      pagina(doc, a, ajustes, null);
    }
    return doc;
  };
  // nombre del archivo: número y mes, p. ej. "ALBARAN 20260082 - OCTUBRE.pdf"
  window.nombrePdf = a => 'ALBARAN ' + a.numero + ' - ' + U.MESES[Number(String(a.fecha).slice(5, 7)) - 1] + '.pdf';
  window.nombrePdfMes = window.nombrePdf;
})();
