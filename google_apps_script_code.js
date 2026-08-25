// ===================================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT (QR Asist - Con Matriz Automática)
// ===================================================================
// INSTRUCCIONES:
// 1. Abrí tu Google Sheet.
// 2. Andá a Extensiones > Apps Script.
// 3. Reemplazá todo el contenido con este código y Guardá (Ctrl+S).
// 4. Hacé clic en: Implementar > Administrar implementaciones > Editar >
//    Versión: "Nueva versión" > Implementar.
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
    sheetAsist.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido']);
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
        nombre: String(asistData[i][4] || '')
      });
    }
  }

  // 3. Actualizar la hoja Matriz_Presentismo
  actualizarMatriz(ss, padron, asistencias);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    padron: padron,
    records: asistencias
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
      sheetAsist.appendRow([
        data.date,
        data.time,
        String(data.dni),
        String(data.libreta || ''),
        String(data.nombre || '')
      ]);

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
          data.padron.map(p => [String(p.dni), String(p.libreta || ''), String(p.nombre)])
        );
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: data.padron.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Función que construye y actualiza la pestaña "Matriz_Presentismo" ──
function actualizarMatriz(ss, padron, asistencias) {
  try {
    let sheetMatriz = ss.getSheetByName('Matriz_Presentismo');
    if (!sheetMatriz) {
      sheetMatriz = ss.insertSheet('Matriz_Presentismo');
    }

    // Obtener fechas únicas ordenadas
    const fechasSet = {};
    asistencias.forEach(a => {
      if (a.date) fechasSet[a.date] = true;
    });
    const fechas = Object.keys(fechasSet).sort();

    // Estructura de encabezados
    const headers = ['DNI', 'Libreta', 'Nombre y Apellido', ...fechas, 'Total Clases Asistidas', '% Presentismo'];
    
    // Mapeo de asistencias por alumno: { dni: Set(fechas) }
    const asistenciasPorAlumno = {};
    asistencias.forEach(a => {
      const dni = String(a.dni).trim();
      if (!asistenciasPorAlumno[dni]) asistenciasPorAlumno[dni] = {};
      asistenciasPorAlumno[dni][a.date] = true;
    });

    // Construcción de filas
    const rows = padron.map(s => {
      const dni = String(s.dni).trim();
      let totalAsistidas = 0;
      const fechasCols = fechas.map(f => {
        const asistio = asistenciasPorAlumno[dni] && asistenciasPorAlumno[dni][f];
        if (asistio) {
          totalAsistidas++;
          return '✓';
        }
        return '—';
      });

      const totalFechas = fechas.length;
      const pct = totalFechas > 0 ? Math.round((totalAsistidas / totalFechas) * 100) + '%' : '0%';

      return [
        String(s.dni),
        String(s.libreta || ''),
        String(s.nombre || ''),
        ...fechasCols,
        totalAsistidas,
        pct
      ];
    });

    // Limpiar y reescribir la hoja Matriz
    sheetMatriz.clearContents();
    sheetMatriz.clearFormats();

    // Escribir encabezados
    sheetMatriz.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheetMatriz.getRange(1, 1, 1, headers.length)
      .setBackground('#1e1b4b')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // Escribir datos
    if (rows.length > 0) {
      sheetMatriz.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      // Formato alineación
      sheetMatriz.getRange(2, 1, rows.length, 2).setHorizontalAlignment('center');
      sheetMatriz.getRange(2, 3, rows.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
      if (fechas.length > 0) {
        sheetMatriz.getRange(2, 4, rows.length, fechas.length).setHorizontalAlignment('center');
      }
      sheetMatriz.getRange(2, headers.length - 1, rows.length, 2).setHorizontalAlignment('center').setFontWeight('bold');
    }

    // Auto-ajustar ancho de columnas principales
    sheetMatriz.autoResizeColumns(1, headers.length);
  } catch (err) {
    Logger.log('Error actualizando matriz: ' + err.toString());
  }
}

// ── Menú en Google Sheets para actualizar la matriz manualmente con 1 clic ──
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📋 QR Asist')
    .addItem('🔄 Actualizar Matriz de Presentismo', 'menuActualizarMatriz')
    .addToUi();
}

function menuActualizarMatriz() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPadron = ss.getSheetByName('Padron');
  const sheetAsist = ss.getSheetByName('Asistencias');
  
  if (!sheetPadron || !sheetAsist) {
    SpreadsheetApp.getUi().alert('Asegurate de que existan las hojas Padron y Asistencias.');
    return;
  }

  const pData = sheetPadron.getDataRange().getValues();
  const padron = [];
  for (let i = 1; i < pData.length; i++) {
    if (pData[i][0]) padron.push({ dni: pData[i][0], libreta: pData[i][1], nombre: pData[i][2] });
  }

  const aData = sheetAsist.getDataRange().getValues();
  const asistencias = [];
  for (let i = 1; i < aData.length; i++) {
    if (aData[i][0]) {
      let d = aData[i][0];
      let f = (d instanceof Date) ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(d);
      asistencias.push({ date: f, dni: aData[i][2] });
    }
  }

  actualizarMatriz(ss, padron, asistencias);
  SpreadsheetApp.getUi().alert('✓ Matriz de presentismo actualizada con éxito.');
}
