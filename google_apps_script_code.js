// ===================================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT (QR Asist - Matriz con Fórmulas Vivas)
// ===================================================================
// INSTRUCCIONES:
// 1. Abrí tu Google Sheet.
// 2. Andá a Extensiones > Apps Script.
// 3. Reemplazá todo el contenido con este código y Guardá (Ctrl+S).
// 4. Hacé clic en: Implementar > Administrar implementaciones > Editar (✏️) >
//    Versión: "Nueva versión" > Implementar.
// ===================================================================

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = obtenerDatosCompletos(ss);

  // Asegurar que la matriz de fórmulas esté armada
  armarMatrizConFormulas(ss);

  const output = ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    padron: data.padron,
    records: data.records
  }));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'register';

    if (action === 'register') {
      let sheetAsist = ss.getSheetByName('Asistencias');
      if (!sheetAsist) {
        sheetAsist = ss.insertSheet('Asistencias');
        sheetAsist.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido']);
      }
      
      const cleanDni = String(data.dni).replace(/\D/g, '').trim();
      const cleanDate = String(data.date).trim();

      sheetAsist.appendRow([
        cleanDate,
        data.time,
        cleanDni,
        String(data.libreta || ''),
        String(data.nombre || '')
      ]);

      // Re-verificar que las fechas en la cabecera de la matriz estén al día
      armarMatrizConFormulas(ss);

      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Registrado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sync_padron') {
      let sheetPadron = ss.getSheetByName('Padron');
      if (sheetPadron) sheetPadron.clearContents();
      else sheetPadron = ss.insertSheet('Padron');
      
      sheetPadron.appendRow(['DNI', 'Libreta', 'Nombre_Apellido']);
      if (data.padron && data.padron.length > 0) {
        sheetPadron.getRange(2, 1, data.padron.length, 3).setValues(
          data.padron.map(p => [String(p.dni).replace(/\D/g, '').trim(), String(p.libreta || ''), String(p.nombre)])
        );
      }

      armarMatrizConFormulas(ss);

      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: data.padron.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Helper para leer Padron y Asistencias limpiando formatos ──────
function obtenerDatosCompletos(ss) {
  const tz = Session.getScriptTimeZone();

  // 1. Padrón
  let sheetPadron = ss.getSheetByName('Padron');
  if (!sheetPadron) {
    sheetPadron = ss.insertSheet('Padron');
    sheetPadron.appendRow(['DNI', 'Libreta', 'Nombre_Apellido']);
  }
  const pValues = sheetPadron.getDataRange().getValues();
  const padron = [];
  for (let i = 1; i < pValues.length; i++) {
    const rawDni = String(pValues[i][0] || '').replace(/\D/g, '').trim();
    if (rawDni) {
      padron.push({
        dni: rawDni,
        libreta: String(pValues[i][1] || '').trim(),
        nombre: String(pValues[i][2] || '').trim()
      });
    }
  }

  // 2. Asistencias
  let sheetAsist = ss.getSheetByName('Asistencias');
  if (!sheetAsist) {
    sheetAsist = ss.insertSheet('Asistencias');
    sheetAsist.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido']);
  }
  const aValues = sheetAsist.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < aValues.length; i++) {
    const rawFecha = aValues[i][0];
    const rawDni = String(aValues[i][2] || '').replace(/\D/g, '').trim();
    if (rawFecha && rawDni) {
      let formattedDate = '';
      if (rawFecha instanceof Date) {
        formattedDate = Utilities.formatDate(rawFecha, tz, 'yyyy-MM-dd');
      } else {
        const str = String(rawFecha).trim();
        formattedDate = str.includes('T') ? str.split('T')[0] : str;
      }

      records.push({
        date: formattedDate,
        time: String(aValues[i][1] || ''),
        dni: rawDni,
        libreta: String(aValues[i][3] || ''),
        nombre: String(aValues[i][4] || '')
      });
    }
  }

  return { padron, records };
}

// ── Constructor de la Matriz con FÓRMULAS VIVAS de Google Sheets ───
function armarMatrizConFormulas(ss) {
  try {
    let sheetMatriz = ss.getSheetByName('Matriz_Presentismo');
    if (!sheetMatriz) {
      sheetMatriz = ss.insertSheet('Matriz_Presentismo');
    }

    let sheetPadron = ss.getSheetByName('Padron');
    let sheetAsist = ss.getSheetByName('Asistencias');
    if (!sheetPadron) return;

    const numAlumnos = Math.max(0, sheetPadron.getLastRow() - 1);
    if (numAlumnos === 0) return;

    // Obtener fechas únicas desde la hoja Asistencias
    const tz = Session.getScriptTimeZone();
    const fechasSet = {};
    if (sheetAsist && sheetAsist.getLastRow() > 1) {
      const aData = sheetAsist.getRange(2, 1, sheetAsist.getLastRow() - 1, 1).getValues();
      aData.forEach(r => {
        if (r[0]) {
          let f = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).trim();
          if (f.includes('T')) f = f.split('T')[0];
          if (f) fechasSet[f] = true;
        }
      });
    }
    const fechas = Object.keys(fechasSet).sort();

    // Encabezados
    const headers = ['DNI', 'Libreta', 'Nombre y Apellido', ...fechas, 'Total Asistencias', '% Presentismo'];
    const totalCols = headers.length;

    // Construcción de la matriz con FÓRMULAS NATIVAS
    const formulaRows = [];
    for (let i = 2; i <= numAlumnos + 1; i++) {
      const row = [];
      // Columnas A, B, C enlazadas directamente con Padron
      row.push(`=TO_TEXT(Padron!A${i})`);
      row.push(`=TO_TEXT(Padron!B${i})`);
      row.push(`=Padron!C${i}`);

      // Fórmulas para cada fecha: =SI(CONTAR.SI.CONJUNTO(Asistencias!$C:$C; TO_TEXT($A2); Asistencias!$A:$A; D$1)>0; "✓"; "—")
      fechas.forEach((f, idx) => {
        const colLet = getColLetter(4 + idx);
        row.push(`=IF(COUNTIFS(Asistencias!$C:$C, TO_TEXT($A${i}), Asistencias!$A:$A, ${colLet}$1)>0, "✓", "—")`);
      });

      // Total y % Presentismo
      if (fechas.length > 0) {
        const firstDateCol = getColLetter(4);
        const lastDateCol = getColLetter(3 + fechas.length);
        // Total = COUNTIF(D2:Z2, "✓")
        row.push(`=COUNTIF(${firstDateCol}${i}:${lastDateCol}${i}, "✓")`);
        // % = COUNTIF / total fechas
        row.push(`=IF(COUNTA($${firstDateCol}$1:$${lastDateCol}$1)>0, COUNTIF(${firstDateCol}${i}:${lastDateCol}${i}, "✓")/COUNTA($${firstDateCol}$1:$${lastDateCol}$1), 0)`);
      } else {
        row.push(0);
        row.push(0);
      }

      formulaRows.push(row);
    }

    sheetMatriz.clearContents();

    // Escribir cabecera
    sheetMatriz.getRange(1, 1, 1, totalCols).setValues([headers]);
    sheetMatriz.getRange(1, 1, 1, totalCols)
      .setBackground('#1e1b4b')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // Escribir fórmulas en todas las celdas
    sheetMatriz.getRange(2, 1, formulaRows.length, totalCols).setFormulas(formulaRows);

    // Formatear columna de porcentaje
    const pctColIdx = totalCols;
    sheetMatriz.getRange(2, pctColIdx, formulaRows.length, 1).setNumberFormat('0.0%');

    // Alineaciones
    sheetMatriz.getRange(2, 1, formulaRows.length, 2).setHorizontalAlignment('center');
    sheetMatriz.getRange(2, 3, formulaRows.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
    if (fechas.length > 0) {
      sheetMatriz.getRange(2, 4, formulaRows.length, fechas.length).setHorizontalAlignment('center');
    }
    sheetMatriz.getRange(2, totalCols - 1, formulaRows.length, 2).setHorizontalAlignment('center').setFontWeight('bold');

    sheetMatriz.autoResizeColumns(1, totalCols);
  } catch (err) {
    Logger.log('Error armando matriz con fórmulas: ' + err.toString());
  }
}

function getColLetter(col) {
  let temp, letter = '';
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

// ── Menú en Google Sheets ─────────────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 QR Asist')
    .addItem('🔄 Actualizar Fórmulas de la Matriz', 'armarMatrizConFormulasMenu')
    .addToUi();
}

function armarMatrizConFormulasMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  armarMatrizConFormulas(ss);
  SpreadsheetApp.getUi().alert('✓ Matriz con fórmulas actualizada con éxito.');
}
