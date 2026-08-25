// ===================================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT (QR Asist - Matriz en Tiempo Real)
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

  // Actualiza la matriz por si hubo cambios manuales
  construirMatriz(ss, data.padron, data.records);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    padron: data.padron,
    records: data.records
  })).setMimeType(ContentService.MimeType.JSON);
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

      // Actualizar la matriz inmediatamente en el mismo momento del escaneo
      const fullData = obtenerDatosCompletos(ss);
      construirMatriz(ss, fullData.padron, fullData.records);

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

      const fullData = obtenerDatosCompletos(ss);
      construirMatriz(ss, fullData.padron, fullData.records);

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

// ── Constructor y formateador de la Matriz_Presentismo ─────────────
function construirMatriz(ss, padron, asistencias) {
  try {
    let sheetMatriz = ss.getSheetByName('Matriz_Presentismo');
    if (!sheetMatriz) {
      sheetMatriz = ss.insertSheet('Matriz_Presentismo');
    }

    // Fechas únicas ordenadas
    const fechasSet = {};
    asistencias.forEach(a => {
      if (a.date) fechasSet[a.date] = true;
    });
    const fechas = Object.keys(fechasSet).sort();

    const headers = ['DNI', 'Libreta', 'Nombre y Apellido', ...fechas, 'Total Clases Asistidas', '% Presentismo'];
    
    // Mapeo: { [dni]: { [fecha]: true } }
    const asistMap = {};
    asistencias.forEach(a => {
      const d = String(a.dni).trim();
      if (!asistMap[d]) asistMap[d] = {};
      asistMap[d][a.date] = true;
    });

    const rows = padron.map(s => {
      const d = String(s.dni).trim();
      let total = 0;
      const fechasCols = fechas.map(f => {
        if (asistMap[d] && asistMap[d][f]) {
          total++;
          return '✓';
        }
        return '—';
      });

      const pct = fechas.length > 0 ? Math.round((total / fechas.length) * 100) + '%' : '0%';

      return [
        String(s.dni),
        String(s.libreta || ''),
        String(s.nombre || ''),
        ...fechasCols,
        total,
        pct
      ];
    });

    sheetMatriz.clearContents();
    sheetMatriz.clearFormats();

    sheetMatriz.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheetMatriz.getRange(1, 1, 1, headers.length)
      .setBackground('#1e1b4b')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    if (rows.length > 0) {
      sheetMatriz.getRange(2, 1, rows.length, headers.length).setValues(rows);
      sheetMatriz.getRange(2, 1, rows.length, 2).setHorizontalAlignment('center');
      sheetMatriz.getRange(2, 3, rows.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
      if (fechas.length > 0) {
        sheetMatriz.getRange(2, 4, rows.length, fechas.length).setHorizontalAlignment('center');
      }
      sheetMatriz.getRange(2, headers.length - 1, rows.length, 2).setHorizontalAlignment('center').setFontWeight('bold');
    }

    sheetMatriz.autoResizeColumns(1, headers.length);
  } catch (err) {
    Logger.log('Error construyendo matriz: ' + err.toString());
  }
}

// ── Menú manual en Google Sheets ──────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 QR Asist')
    .addItem('🔄 Actualizar Matriz de Presentismo', 'menuActualizarMatriz')
    .addToUi();
}

function menuActualizarMatriz() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = obtenerDatosCompletos(ss);
  construirMatriz(ss, data.padron, data.records);
  SpreadsheetApp.getUi().alert('✓ Matriz de presentismo actualizada.');
}
