// ===================================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT (QR Asist - Sincronización)
// ===================================================================
// INSTRUCCIONES:
// 1. Creá una hoja de cálculo nueva en Google Sheets (ej: "Asistencias 2026").
// 2. En el menú superior hacé clic en: Extensiones > Apps Script.
// 3. Borrá todo el código que haya y pegá exactamente este código completo.
// 4. Hacé clic en "Implementar" (arriba a la derecha) > "Nueva implementación".
// 5. En el engranaje seleccioná tipo: "Aplicación web".
// 6. Configuración:
//    - Descripción: "QR Asist API"
//    - Ejecutar como: "Yo" (tu cuenta de Google)
//    - Quién tiene acceso: "Cualquier persona" (Anyone) -> ¡Muy importante!
// 7. Hacé clic en "Implementar", autorizá los permisos y copiá la "URL de la aplicación web".
// 8. Pegá esa URL en la configuración de QR Asist.
// ===================================================================

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Obtener o crear hoja Padrón
  let sheetPadron = ss.getSheetByName('Padron');
  if (!sheetPadron) {
    sheetPadron = ss.insertSheet('Padron');
    sheetPadron.appendRow(['DNI', 'Libreta', 'Nombre_Apellido']);
  }
  const padronData = sheetPadron.getDataRange().getValues();
  const padron = [];
  for (let i = 1; i < padronData.length; i++) {
    if (padronData[i][0]) {
      padron.push({
        dni: String(padronData[i][0]).replace(/\D/g, '').trim(),
        libreta: String(padronData[i][1] || '').trim(),
        nombre: String(padronData[i][2] || '').trim()
      });
    }
  }

  // 2. Obtener o crear hoja Asistencias
  let sheetAsist = ss.getSheetByName('Asistencias');
  if (!sheetAsist) {
    sheetAsist = ss.insertSheet('Asistencias');
    sheetAsist.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido', 'Profesor', 'Materia']);
  }
  const asistData = sheetAsist.getDataRange().getValues();
  const asistencias = [];
  for (let i = 1; i < asistData.length; i++) {
    if (asistData[i][0]) {
      let rawDate = asistData[i][0];
      let formattedDate = rawDate;
      if (rawDate instanceof Date) {
        formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      asistencias.push({
        date: String(formattedDate),
        time: String(asistData[i][1] || ''),
        dni: String(asistData[i][2] || '').replace(/\D/g, '').trim(),
        libreta: String(asistData[i][3] || ''),
        nombre: String(asistData[i][4] || ''),
        profesor: String(asistData[i][5] || 'Docente'),
        materia: String(asistData[i][6] || '')
      });
    }
  }

  const response = {
    status: 'ok',
    padron: padron,
    records: asistencias
  };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
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
        sheetAsist.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido', 'Profesor', 'Materia']);
      }
      sheetAsist.appendRow([
        data.date,
        data.time,
        String(data.dni),
        String(data.libreta || ''),
        String(data.nombre || ''),
        String(data.profesor || 'Docente'),
        String(data.materia || '')
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Asistencia registrada' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sync_padron') {
      let sheetPadron = ss.getSheetByName('Padron');
      if (sheetPadron) {
        sheetPadron.clearContents();
      } else {
        sheetPadron = ss.insertSheet('Padron');
      }
      sheetPadron.appendRow(['DNI', 'Libreta', 'Nombre_Apellido']);
      if (data.padron && data.padron.length > 0) {
        const rows = data.padron.map(p => [String(p.dni), String(p.libreta || ''), String(p.nombre)]);
        sheetPadron.getRange(2, 1, rows.length, 3).setValues(rows);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: data.padron.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
