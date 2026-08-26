// ===================================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT (QR Asist - Versión Robusta y Estable)
// ===================================================================
// INSTRUCCIONES:
// 1. Abrí tu Google Sheet.
// 2. Andá a Extensiones > Apps Script.
// 3. Borrá todo y pegá exactamente este código.
// 4. Guardá con Ctrl+S.
// 5. Hacé clic en: Implementar > Administrar implementaciones > Editar (✏️) >
//    Versión: "Nueva versión" > Implementar.
// ===================================================================

function doGet(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (_) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Servidor ocupado, intentá de nuevo en unos segundos.',
      padron: [],
      records: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = obtenerDatosCompletos(ss);

    // Armar la matriz solo en doGet (lectura), nunca en el escaneo rápido
    try {
      armarMatriz(ss, data.padron, data.records);
    } catch (mErr) {
      Logger.log('Error armando matriz: ' + mErr.toString());
    }

    const response = {
      status: 'ok',
      padron: data.padron,
      records: data.records
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString(),
      padron: [],
      records: []
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (_) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: 'Servidor ocupado, intentá de nuevo en unos segundos.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let contents = {};
    try {
      contents = JSON.parse(e.postData.contents);
    } catch (_) {
      contents = e.parameter || {};
    }

    const action = contents.action || 'register';

    // ── Registro de asistencia individual ──────────────────────────
    if (action === 'register') {
      let sheetAsist = ss.getSheetByName('Asistencias');
      if (!sheetAsist) {
        sheetAsist = ss.insertSheet('Asistencias');
        sheetAsist.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido']);
      }

      const cleanDni = String(contents.dni || '').replace(/\D/g, '').trim();
      const cleanDate = String(contents.date || '').trim();
      const cleanTime = String(contents.time || '').trim();
      const cleanLib = String(contents.libreta || '').trim();
      const cleanNom = String(contents.nombre || '').trim();

      if (!cleanDni || !cleanDate) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          error: 'DNI y fecha son obligatorios.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // ── Validación de duplicados en backend (DNI + Fecha) ──────
      const aValues = sheetAsist.getDataRange().getValues();
      for (let i = 1; i < aValues.length; i++) {
        const existingDni = String(aValues[i][2] || '').replace(/\D/g, '').trim();
        const existingDate = normalizeDateGAS(aValues[i][0], ss);
        if (existingDni === cleanDni && existingDate === cleanDate) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'duplicate',
            message: cleanNom + ' ya tiene asistencia registrada el ' + cleanDate + '.'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      sheetAsist.appendRow([cleanDate, cleanTime, cleanDni, cleanLib, cleanNom]);

      // NO se regenera la matriz aquí — se actualiza solo en doGet o menú manual

      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'Registrado con éxito'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── Sincronización de padrón ───────────────────────────────────
    if (action === 'sync_padron') {
      // Protección: no borrar el padrón existente si el payload viene vacío
      if (!contents.padron || !Array.isArray(contents.padron) || contents.padron.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          error: 'El padrón enviado está vacío. No se realizaron cambios para proteger los datos existentes.'
        })).setMimeType(ContentService.MimeType.JSON);
      }

      let sheetPadron = ss.getSheetByName('Padron');
      if (sheetPadron) sheetPadron.clearContents();
      else sheetPadron = ss.insertSheet('Padron');

      sheetPadron.appendRow(['DNI', 'Libreta', 'Nombre_Apellido']);
      const rows = contents.padron.map(p => [
        String(p.dni).replace(/\D/g, '').trim(),
        String(p.libreta || '').trim(),
        String(p.nombre || '').trim()
      ]);
      sheetPadron.getRange(2, 1, rows.length, 3).setValues(rows);

      // Actualizar matriz tras cambio de padrón (operación menos frecuente, aceptable)
      try {
        const fullData = obtenerDatosCompletos(ss);
        armarMatriz(ss, fullData.padron, fullData.records);
      } catch (_) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        count: contents.padron.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ── Normalización de fecha dentro de Google Apps Script ────────────
// Usa la zona horaria de la hoja de cálculo (no del script)
function normalizeDateGAS(rawFecha, ss) {
  if (!rawFecha) return '';
  const tz = ss.getSpreadsheetTimeZone();
  if (rawFecha instanceof Date) {
    return Utilities.formatDate(rawFecha, tz, 'yyyy-MM-dd');
  }
  const str = String(rawFecha).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes('T')) return str.split('T')[0];
  return str;
}

// ── Lectura confiable de Padron y Asistencias ─────────────────────
function obtenerDatosCompletos(ss) {
  // Usar la zona horaria de la hoja de cálculo, no la del script
  const tz = ss.getSpreadsheetTimeZone();

  // 1. Padron
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
        time: String(aValues[i][1] || '').trim(),
        dni: rawDni,
        libreta: String(aValues[i][3] || '').trim(),
        nombre: String(aValues[i][4] || '').trim()
      });
    }
  }

  return { padron, records };
}

// ── Constructor de Matriz_Presentismo ─────────────────────────────
function armarMatriz(ss, padron, asistencias) {
  let sheetMatriz = ss.getSheetByName('Matriz_Presentismo');
  if (!sheetMatriz) {
    sheetMatriz = ss.insertSheet('Matriz_Presentismo');
  }

  if (!padron || padron.length === 0) return;

  // Fechas únicas
  const fechasSet = {};
  asistencias.forEach(a => {
    if (a.date) fechasSet[a.date] = true;
  });
  const fechas = Object.keys(fechasSet).sort();

  const headers = ['DNI', 'Libreta', 'Nombre y Apellido', ...fechas, 'Total Asistencias', '% Presentismo'];
  const totalCols = headers.length;

  // Mapa de asistencias por alumno: { dni: { fecha: true } }
  const asistMap = {};
  asistencias.forEach(a => {
    const d = String(a.dni).replace(/\D/g, '').trim();
    if (!asistMap[d]) asistMap[d] = {};
    asistMap[d][a.date] = true;
  });

  // Filas con valores calculados directamente (100% infalible en cualquier idioma de Sheets)
  const rows = padron.map(s => {
    const d = String(s.dni).replace(/\D/g, '').trim();
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

  // Escribir cabecera
  sheetMatriz.getRange(1, 1, 1, totalCols).setValues([headers]);
  sheetMatriz.getRange(1, 1, 1, totalCols)
    .setBackground('#1e1b4b')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  if (rows.length > 0) {
    sheetMatriz.getRange(2, 1, rows.length, totalCols).setValues(rows);
    sheetMatriz.getRange(2, 1, rows.length, 2).setHorizontalAlignment('center');
    sheetMatriz.getRange(2, 3, rows.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
    if (fechas.length > 0) {
      sheetMatriz.getRange(2, 4, rows.length, fechas.length).setHorizontalAlignment('center');
    }
    sheetMatriz.getRange(2, totalCols - 1, rows.length, 2).setHorizontalAlignment('center').setFontWeight('bold');
  }

  sheetMatriz.autoResizeColumns(1, totalCols);
}

// ── Menú de Google Sheets ─────────────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 QR Asist')
    .addItem('🔄 Actualizar Matriz de Presentismo', 'menuActualizarMatriz')
    .addToUi();
}

function menuActualizarMatriz() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = obtenerDatosCompletos(ss);
  armarMatriz(ss, data.padron, data.records);
  SpreadsheetApp.getUi().alert('✓ Matriz de presentismo actualizada.');
}
