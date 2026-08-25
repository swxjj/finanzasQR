import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import Papa from 'papaparse'
import {
  QrCode, Camera, CameraOff, Upload, Download, Search, Users, UserCheck,
  FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Trash2, Volume2,
  VolumeX, BarChart3, GraduationCap, ScanLine, X, Clock, Percent,
  Cloud, CloudOff, RefreshCw, Settings, Copy, Check, User
} from 'lucide-react'

// ─── Web Audio feedback ────────────────────────────────────────────
function beep(type) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (type === 'ok') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, t)
      osc.frequency.setValueAtTime(880, t + 0.08)
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.start(t); osc.stop(t + 0.25)
    } else if (type === 'dup') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, t)
      osc.frequency.setValueAtTime(340, t + 0.12)
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t); osc.stop(t + 0.3)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, t)
      osc.frequency.setValueAtTime(150, t + 0.15)
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.start(t); osc.stop(t + 0.35)
    }
  } catch (_) { /* silence */ }
}

// ─── localStorage helpers ──────────────────────────────────────────
const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value))

// ─── Date helper ───────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split('T')[0]
const nowTime = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const GOOGLE_SCRIPT_SNIPPET = `// Google Apps Script para QR Asist
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetPadron = ss.getSheetByName('Padron') || ss.insertSheet('Padron');
  if (sheetPadron.getLastRow() === 0) sheetPadron.appendRow(['DNI', 'Libreta', 'Nombre_Apellido']);
  
  const pData = sheetPadron.getDataRange().getValues();
  const padron = [];
  for (let i = 1; i < pData.length; i++) {
    if (pData[i][0]) padron.push({ dni: String(pData[i][0]).replace(/\\D/g, '').trim(), libreta: String(pData[i][1] || '').trim(), nombre: String(pData[i][2] || '').trim() });
  }

  let sheetAsist = ss.getSheetByName('Asistencias') || ss.insertSheet('Asistencias');
  if (sheetAsist.getLastRow() === 0) sheetAsist.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido', 'Profesor', 'Materia']);
  
  const aData = sheetAsist.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < aData.length; i++) {
    if (aData[i][0]) {
      let d = aData[i][0];
      let fDate = (d instanceof Date) ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(d);
      records.push({ date: fDate, time: String(aData[i][1] || ''), dni: String(aData[i][2] || '').replace(/\\D/g, '').trim(), libreta: String(aData[i][3] || ''), nombre: String(aData[i][4] || ''), profesor: String(aData[i][5] || 'Docente'), materia: String(aData[i][6] || '') });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', padron, records })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'register';

    if (action === 'register') {
      let sheet = ss.getSheetByName('Asistencias') || ss.insertSheet('Asistencias');
      if (sheet.getLastRow() === 0) sheet.appendRow(['Fecha', 'Hora', 'DNI', 'Libreta', 'Nombre_Apellido', 'Profesor', 'Materia']);
      sheet.appendRow([data.date, data.time, String(data.dni), String(data.libreta || ''), String(data.nombre || ''), String(data.profesor || 'Docente'), String(data.materia || '')]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sync_padron') {
      let sheet = ss.getSheetByName('Padron') || ss.insertSheet('Padron');
      sheet.clearContents();
      sheet.appendRow(['DNI', 'Libreta', 'Nombre_Apellido']);
      if (data.padron && data.padron.length > 0) {
        sheet.getRange(2, 1, data.padron.length, 3).setValues(data.padron.map(p => [String(p.dni), String(p.libreta || ''), String(p.nombre)]));
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: data.padron.length })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`

// ═══════════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  // ── Role selector ───────────────────────────────────────────────
  const [role, setRole] = useState(() => load('qr_role', null)) // 'profesor' | 'alumno' | null

  // ── Padrón (roster) ─────────────────────────────────────────────
  const [roster, setRoster] = useState(() => load('qr_roster', []))

  // ── Attendance records ──────────────────────────────────────────
  const [records, setRecords] = useState(() => load('qr_records', []))

  // ── Cloud Google Sheets configuration ───────────────────────────
  const [sheetsUrl, setSheetsUrl] = useState(() => {
    return load('qr_sheets_url', import.meta.env.VITE_SHEETS_API_URL || '')
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(() => load('qr_last_sync', null))

  // ── Professor identity ──────────────────────────────────────────
  const [profesorName, setProfesorName] = useState(() => load('qr_profesor_name', 'Hernán'))
  const [materiaName, setMateriaName] = useState(() => load('qr_materia_name', 'Física'))

  // ── UI state ────────────────────────────────────────────────────
  const [soundOn, setSoundOn] = useState(() => load('qr_sound', true))
  const [toast, setToast] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const toastTimer = useRef(null)

  // Persist
  useEffect(() => { save('qr_role', role) }, [role])
  useEffect(() => { save('qr_roster', roster) }, [roster])
  useEffect(() => { save('qr_records', records) }, [records])
  useEffect(() => { save('qr_sound', soundOn) }, [soundOn])
  useEffect(() => { save('qr_sheets_url', sheetsUrl) }, [sheetsUrl])
  useEffect(() => { save('qr_profesor_name', profesorName) }, [profesorName])
  useEffect(() => { save('qr_materia_name', materiaName) }, [materiaName])
  useEffect(() => { save('qr_last_sync', lastSyncTime) }, [lastSyncTime])

  // Toast helper
  const showToast = useCallback((type, text, ms = 4000) => {
    clearTimeout(toastTimer.current)
    setToast({ type, text })
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  // ── Cloud Pull: Sincronizar desde Google Sheets ─────────────────
  const pullFromSheets = useCallback(async (urlToUse = sheetsUrl, silent = false) => {
    if (!urlToUse) return
    setIsSyncing(true)
    try {
      const res = await fetch(urlToUse, { method: 'GET' })
      const data = await res.json()
      if (data && data.status === 'ok') {
        if (data.padron && Array.isArray(data.padron) && data.padron.length > 0) {
          setRoster(data.padron)
        }
        if (data.records && Array.isArray(data.records)) {
          setRecords(data.records)
        }
        const timeStr = nowTime()
        setLastSyncTime(timeStr)
        if (!silent) {
          showToast('ok', `☁️ Sincronizado con Sheets (${data.records.length} asistencias, ${data.padron.length} alumnos).`)
        }
      }
    } catch (err) {
      console.warn('Error syncing with Google Sheets:', err)
      if (!silent) {
        showToast('error', 'No se pudo conectar con Google Sheets. Revisa la URL o la conexión.')
      }
    } finally {
      setIsSyncing(false)
    }
  }, [sheetsUrl, showToast])

  // Auto-sync on first load if URL exists
  useEffect(() => {
    if (sheetsUrl && role === 'profesor') {
      pullFromSheets(sheetsUrl, true)
    }
  }, [role, sheetsUrl, pullFromSheets])

  // ── Cloud Push: Subir asistencia individual a Google Sheets ──────
  const pushAttendanceToSheets = useCallback(async (newRecord) => {
    if (!sheetsUrl) return
    try {
      await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'register',
          ...newRecord
        })
      })
    } catch (err) {
      console.warn('Could not push record to Google Sheets immediately (saved locally):', err)
    }
  }, [sheetsUrl])

  // ── Cloud Push: Subir Padrón completo a Google Sheets ────────────
  const pushRosterToSheets = useCallback(async (newRoster) => {
    if (!sheetsUrl) return
    setIsSyncing(true)
    try {
      const res = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sync_padron',
          padron: newRoster
        })
      })
      const data = await res.json()
      if (data.status === 'ok') {
        showToast('ok', `☁️ Padrón de ${newRoster.length} alumnos guardado en Google Sheets.`)
      }
    } catch (err) {
      console.warn('Error uploading roster to sheets:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [sheetsUrl, showToast])

  // ── Role screen ─────────────────────────────────────────────────
  if (!role) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center animate-slide-up">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-2xl shadow-indigo-600/40">
            <QrCode className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">QR Asist</h1>
            <p className="text-sm text-slate-400 mt-1">Control de asistencia compartido con Google Sheets</p>
          </div>

          <div className="grid gap-4 pt-2">
            <button onClick={() => setRole('profesor')}
              className="flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.97]">
              <GraduationCap className="h-6 w-6" /> Soy Profesor/a
            </button>
            <button onClick={() => setRole('alumno')}
              className="flex items-center justify-center gap-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-6 py-4 text-base font-bold text-white transition-all active:scale-[0.97]">
              <QrCode className="h-6 w-6 text-indigo-400" /> Soy Alumno/a
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  //  ALUMNO VIEW
  // ═══════════════════════════════════════════════════════════════
  if (role === 'alumno') return <AlumnoView onBack={() => setRole(null)} />

  // ═══════════════════════════════════════════════════════════════
  //  PROFESOR VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      <ProfesorView
        roster={roster} setRoster={setRoster}
        records={records} setRecords={setRecords}
        soundOn={soundOn} setSoundOn={setSoundOn}
        toast={toast} showToast={showToast} setToast={setToast}
        profesorName={profesorName} setProfesorName={setProfesorName}
        materiaName={materiaName} setMateriaName={setMateriaName}
        sheetsUrl={sheetsUrl} setSheetsUrl={setSheetsUrl}
        isSyncing={isSyncing} lastSyncTime={lastSyncTime}
        onPullFromSheets={pullFromSheets}
        onPushAttendance={pushAttendanceToSheets}
        onPushRoster={pushRosterToSheets}
        onOpenConfig={() => setShowConfigModal(true)}
        onBack={() => setRole(null)}
      />

      {/* Config Google Sheets Modal */}
      {showConfigModal && (
        <ConfigSheetsModal
          sheetsUrl={sheetsUrl}
          setSheetsUrl={setSheetsUrl}
          onClose={() => setShowConfigModal(false)}
          onTestSync={(url) => pullFromSheets(url, false)}
          showToast={showToast}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  ALUMNO VIEW
// ═══════════════════════════════════════════════════════════════════
function AlumnoView({ onBack }) {
  const [dni, setDni] = useState(() => load('qr_alumno_dni', ''))
  const qrRef = useRef(null)

  useEffect(() => { save('qr_alumno_dni', dni) }, [dni])

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const size = 800
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      const a = document.createElement('a')
      a.download = `QR_${dni || 'codigo'}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
          ← Volver
        </button>
        <h1 className="text-sm font-bold text-white flex items-center gap-2">
          <QrCode className="h-4 w-4 text-indigo-400" /> Mi Código QR
        </h1>
        <div className="w-14" />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 animate-slide-up">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-md space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tu número de DNI</label>
              <input type="text" inputMode="numeric" value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 45123456" maxLength={10}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-lg font-mono text-white placeholder-slate-500 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {dni.length >= 7 ? (
              <>
                <div ref={qrRef} className="flex justify-center">
                  <div className="bg-white p-5 rounded-2xl shadow-lg">
                    <QRCodeSVG value={dni} size={220} level="H" includeMargin />
                  </div>
                </div>
                <p className="text-center text-xs text-slate-400">DNI: <span className="font-mono font-bold text-white">{dni}</span></p>
                <button onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.97]">
                  <Download className="h-4 w-4" /> Descargar QR como imagen
                </button>
              </>
            ) : (
              <div className="py-10 text-center text-slate-500 text-xs">
                <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
                Ingresá tu DNI (mínimo 7 dígitos) para generar el código QR.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  PROFESOR VIEW
// ═══════════════════════════════════════════════════════════════════
function ProfesorView({
  roster, setRoster,
  records, setRecords,
  soundOn, setSoundOn,
  toast, showToast, setToast,
  profesorName, setProfesorName,
  materiaName, setMateriaName,
  sheetsUrl, setSheetsUrl,
  isSyncing, lastSyncTime,
  onPullFromSheets,
  onPushAttendance,
  onPushRoster,
  onOpenConfig,
  onBack
}) {
  const [tab, setTab] = useState('scan') // 'scan' | 'report'

  // Stable refs for scan logic
  const recordsRef = useRef(records)
  const rosterRef = useRef(roster)
  const soundRef = useRef(soundOn)
  const profRef = useRef(profesorName)
  const matRef = useRef(materiaName)

  useEffect(() => { recordsRef.current = records }, [records])
  useEffect(() => { rosterRef.current = roster }, [roster])
  useEffect(() => { soundRef.current = soundOn }, [soundOn])
  useEffect(() => { profRef.current = profesorName }, [profesorName])
  useEffect(() => { matRef.current = materiaName }, [materiaName])

  // ── CSV Upload ────────────────────────────────────────────────
  const handleCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map(r => {
          const dni = String(r.DNI || r.dni || r.Dni || r.Documento || '').replace(/\D/g, '').trim()
          const libreta = String(r.Libreta || r.libreta || r.LIBRETA || r.Legajo || r.legajo || '').trim()
          const nombre = String(r.Nombre_Apellido || r.nombre_apellido || r.Nombre || r.nombre || r.NOMBRE || r.Name || '').trim()
          if (!dni || !nombre) return null
          return { dni, libreta, nombre }
        }).filter(Boolean)
        if (parsed.length === 0) {
          showToast('error', 'CSV vacío o sin columnas DNI / Nombre_Apellido.')
          return
        }
        setRoster(parsed)
        showToast('ok', `Padrón cargado: ${parsed.length} alumnos.`)
        // Auto sync roster to cloud if connected
        if (sheetsUrl) {
          onPushRoster(parsed)
        }
      },
      error: () => showToast('error', 'Error al leer el archivo CSV.')
    })
    e.target.value = ''
  }

  const clearRoster = () => {
    if (window.confirm('¿Borrar el padrón y las asistencias locales?')) {
      setRoster([])
      setRecords([])
      showToast('ok', 'Datos locales eliminados.')
    }
  }

  // ── Attendance logic (stable callback) ────────────────────────
  const registerDni = useCallback((rawDni, source = 'QR') => {
    const dni = rawDni.replace(/\D/g, '').trim()
    if (!dni) return

    const currentRoster = rosterRef.current
    const currentRecords = recordsRef.current
    const sound = soundRef.current
    const prof = profRef.current
    const mat = matRef.current

    const student = currentRoster.find(s => s.dni === dni)
    if (!student) {
      if (sound) beep('err')
      showToast('error', `DNI ${dni} no está en el padrón.`)
      return
    }

    const today = todayISO()
    const dup = currentRecords.find(r => r.dni === dni && r.date === today)
    if (dup) {
      if (sound) beep('dup')
      showToast('dup', `${student.nombre} ya registró asistencia hoy (${dup.time}).`)
      return
    }

    const newRec = {
      dni,
      libreta: student.libreta || '',
      nombre: student.nombre,
      date: today,
      time: nowTime(),
      profesor: prof || 'Docente',
      materia: mat || ''
    }

    setRecords(prev => [...prev, newRec])
    if (sound) beep('ok')
    showToast('ok', `✓ ${student.nombre} — Presente`)

    // Background push to Google Sheets
    onPushAttendance(newRec)
  }, [showToast, setRecords, onPushAttendance])

  // ── Today count ───────────────────────────────────────────────
  const today = todayISO()
  const todayCount = useMemo(() => records.filter(r => r.date === today).length, [records, today])

  // ── Tabs ──────────────────────────────────────────────────────
  const tabs = [
    { id: 'scan', label: 'Escanear', icon: Camera },
    { id: 'report', label: 'Reporte General', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <header className="print:hidden sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-white">← Cambiar rol</button>
          
          {/* Active Teacher Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl text-xs">
            <User className="h-3.5 w-3.5 text-indigo-400" />
            <input
              type="text"
              value={profesorName}
              onChange={e => setProfesorName(e.target.value)}
              placeholder="Profesor..."
              title="Nombre del profesor que toma lista hoy"
              className="bg-transparent text-white font-bold w-24 sm:w-28 focus:outline-none"
            />
            <span className="text-slate-600">|</span>
            <input
              type="text"
              value={materiaName}
              onChange={e => setMateriaName(e.target.value)}
              placeholder="Materia..."
              title="Materia / Comisión"
              className="bg-transparent text-slate-400 w-16 sm:w-20 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Cloud Status / Sync button */}
            <button
              onClick={() => {
                if (sheetsUrl) onPullFromSheets(sheetsUrl, false)
                else onOpenConfig()
              }}
              title={sheetsUrl ? `Sincronizado con Google Sheets (Última: ${lastSyncTime || 'Nunca'})` : 'Conectar Google Sheets'}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                sheetsUrl
                  ? isSyncing
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              {sheetsUrl ? (
                <>
                  <Cloud className={`h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sheets'}</span>
                </>
              ) : (
                <>
                  <CloudOff className="h-4 w-4 text-slate-500" />
                  <span className="hidden sm:inline">Conectar Sheets</span>
                </>
              )}
            </button>

            {/* Settings button */}
            <button onClick={onOpenConfig} title="Configuración de Google Sheets"
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800 transition-colors">
              <Settings className="h-4 w-4" />
            </button>

            {/* Sound toggle */}
            <button onClick={() => setSoundOn(!soundOn)} title={soundOn ? 'Silenciar' : 'Activar sonido'}
              className={`p-2 rounded-lg transition-colors ${soundOn ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}>
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-2">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="print:hidden fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-fade-in">
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl border text-sm font-medium ${
            toast.type === 'ok'  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' :
            toast.type === 'dup' ? 'bg-amber-950/80 border-amber-500/40 text-amber-200' :
                                   'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}>
            {toast.type === 'ok'  && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
            {toast.type === 'dup' && <AlertCircle  className="h-5 w-5 text-amber-400 shrink-0" />}
            {toast.type === 'error' && <XCircle     className="h-5 w-5 text-rose-400 shrink-0" />}
            <span className="flex-1">{toast.text}</span>
            <button onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-5">
        {/* Roster & Cloud bar */}
        <div className="print:hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Users className="h-4 w-4 text-indigo-400" />
              <span className="text-slate-300 font-semibold">Padrón:</span>
              <span className="font-bold text-white">{roster.length}</span>
              <span className="text-slate-500">alumnos</span>
              {roster.length > 0 && (
                <>
                  <span className="text-slate-700">|</span>
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  <span className="font-bold text-emerald-400">{todayCount}</span>
                  <span className="text-slate-500">hoy</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {sheetsUrl && (
                <button
                  onClick={() => onPullFromSheets(sheetsUrl, false)}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sincronizar Sheets</span>
                </button>
              )}

              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all active:scale-[0.97]">
                <Upload className="h-4 w-4" />
                {roster.length ? 'Subir CSV' : 'Cargar Padrón CSV'}
                <input type="file" accept=".csv" onChange={handleCSV} className="hidden" />
              </label>

              {roster.length > 0 && (
                <button onClick={clearRoster} title="Borrar datos locales"
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {roster.length === 0 ? (
          <EmptyRosterHint onOpenConfig={onOpenConfig} hasSheets={Boolean(sheetsUrl)} />
        ) : tab === 'scan' ? (
          <ScanTab
            roster={roster}
            records={records}
            registerDni={registerDni}
            todayCount={todayCount}
            totalRoster={roster.length}
            profesorName={profesorName}
            materiaName={materiaName}
          />
        ) : (
          <ReportTab
            roster={roster}
            records={records}
            setRecords={setRecords}
            showToast={showToast}
          />
        )}
      </main>

      <footer className="print:hidden border-t border-slate-900 py-3 text-center text-[11px] text-slate-600">
        QR Asist • Sincronización Google Sheets + React 19 + Tailwind CSS v4
      </footer>
    </div>
  )
}

// ── Empty roster placeholder ─────────────────────────────────────
function EmptyRosterHint({ onOpenConfig, hasSheets }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center space-y-4 animate-slide-up">
      <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-600" />
      <div>
        <h3 className="text-base font-bold text-slate-300">Padrón no cargado</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Podés subir un archivo CSV con los alumnos o conectar tu Google Sheet para descargarlo automáticamente.
        </p>
      </div>

      <div className="flex justify-center gap-3 pt-1">
        {!hasSheets && (
          <button
            onClick={onOpenConfig}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200"
          >
            <Cloud className="h-4 w-4 text-indigo-400" /> Conectar Google Sheets
          </button>
        )}
      </div>

      <div className="inline-block rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-[11px] text-slate-400 font-mono text-left">
        DNI,Libreta,Nombre_Apellido<br/>
        44102931,LU-2024-01,Agustina Belén Morales<br/>
        43890123,LU-2024-02,Benjamín Ignacio Castro
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  SCAN TAB
// ═══════════════════════════════════════════════════════════════════
function ScanTab({ roster, records, registerDni, todayCount, totalRoster, profesorName, materiaName }) {
  const [scanning, setScanning] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const [manualDni, setManualDni] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const scannerRef = useRef(null)
  const containerId = 'qr-reader'
  const processingRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  // When containerReady flips to true, start camera
  useEffect(() => {
    if (!containerReady) return
    let cancelled = false

    const boot = async () => {
      try {
        const qr = new Html5Qrcode(containerId)
        scannerRef.current = qr

        const qrboxFunction = (vw, vh) => {
          const side = Math.floor(Math.max(150, Math.min(Math.min(vw, vh) * 0.7, 280)))
          return { width: side, height: side }
        }

        const scanConfig = { fps: 10, qrbox: qrboxFunction }

        const onSuccess = (text) => {
          if (processingRef.current) return
          processingRef.current = true
          const cleaned = text.replace(/\D/g, '').trim()
          registerDni(cleaned, 'QR')
          setTimeout(() => { processingRef.current = false }, 2500)
        }

        let started = false
        for (const constraint of [
          { facingMode: 'environment' },
          { facingMode: 'user' },
          null
        ]) {
          if (started || cancelled) break
          try {
            if (constraint) {
              await qr.start(constraint, scanConfig, onSuccess, () => {})
            } else {
              const cams = await Html5Qrcode.getCameras()
              if (cams && cams.length > 0) {
                await qr.start(cams[0].id, scanConfig, onSuccess, () => {})
              } else {
                throw new Error('No cameras found')
              }
            }
            started = true
          } catch (e) {
            console.warn('Camera attempt failed:', e)
          }
        }

        if (!started) throw new Error('All camera attempts failed')

        const videoEl = document.querySelector(`#${containerId} video`)
        if (videoEl) {
          videoEl.setAttribute('playsinline', 'true')
          videoEl.setAttribute('webkit-playsinline', 'true')
        }

        if (!cancelled) setScanning(true)
      } catch (err) {
        console.error('Camera error:', err)
        if (!cancelled) {
          setContainerReady(false)
          alert('No se pudo acceder a la cámara. Verificá los permisos en Ajustes > Navegador > Cámara.')
        }
      }
    }

    const timer = setTimeout(boot, 120)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [containerReady, registerDni])

  const startScanner = async () => {
    if (scannerRef.current) await stopScanner()
    setContainerReady(true)
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch (_) {}
      scannerRef.current = null
    }
    setScanning(false)
    setContainerReady(false)
  }

  const handleManual = (e) => {
    e.preventDefault()
    if (!manualDni.trim()) return
    registerDni(manualDni)
    setManualDni('')
  }

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    const q = searchTerm.toLowerCase()
    return roster.filter(s => s.nombre.toLowerCase().includes(q) || s.dni.includes(q)).slice(0, 8)
  }, [roster, searchTerm])

  const today = todayISO()
  const todayList = useMemo(() => records.filter(r => r.date === today), [records, today])
  const pct = totalRoster > 0 ? Math.round((todayCount / totalRoster) * 100) : 0

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Present counter */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-center shadow-xl">
          <div className="text-2xl font-extrabold text-indigo-400">{totalRoster}</div>
          <div className="text-[11px] text-slate-500 mt-1">En padrón</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center shadow-xl">
          <div className="text-2xl font-extrabold text-emerald-400">{todayCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Presentes hoy</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 text-center shadow-xl">
          <div className="text-2xl font-extrabold text-white">{pct}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Asistencia</div>
        </div>
      </div>

      {/* Scanner card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-indigo-400" /> Escáner QR
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Tomando lista: <strong className="text-indigo-300">{profesorName}</strong></span>
            {scanning && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold ml-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Activo
              </span>
            )}
          </div>
        </div>

        <div className="relative rounded-xl bg-slate-950 border border-slate-800 min-h-[260px] flex items-center justify-center overflow-hidden">
          <div id={containerId}
            className={`w-full ${(scanning || containerReady) ? 'min-h-[260px]' : 'absolute inset-0 opacity-0 pointer-events-none'}`}
            style={(scanning || containerReady) ? undefined : { height: '1px', overflow: 'hidden' }} />
          {!scanning && !containerReady && (
            <div className="flex flex-col items-center p-8 text-center space-y-4">
              <div className="rounded-full bg-slate-800/80 p-4 ring-1 ring-slate-700/50">
                <Camera className="h-10 w-10 text-slate-500" />
              </div>
              <button onClick={startScanner}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.97] animate-pulse-ring">
                <Camera className="h-4 w-4" /> Iniciar Cámara
              </button>
            </div>
          )}
          {scanning && (
            <button onClick={stopScanner}
              className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md shadow-md">
              <CameraOff className="h-3.5 w-3.5" /> Detener
            </button>
          )}
        </div>
      </div>

      {/* Manual input */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md">
        <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <UserCheck className="h-4 w-4 text-indigo-400" /> Ingreso manual por DNI
        </h3>
        <form onSubmit={handleManual} className="flex gap-2">
          <input type="text" inputMode="numeric" value={manualDni} onChange={e => setManualDni(e.target.value.replace(/\D/g, ''))}
            placeholder="Nro. de DNI..." maxLength={10}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <button type="submit"
            className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 text-sm font-bold text-white transition-all">
            Registrar
          </button>
        </form>
      </div>

      {/* Search students */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md">
        <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <Search className="h-4 w-4 text-indigo-400" /> Buscar alumno en padrón
        </h3>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Nombre o DNI..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
            {searchResults.map(s => {
              const presentToday = records.some(r => r.dni === s.dni && r.date === today)
              return (
                <div key={s.dni} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-white">{s.nombre}</span>
                    <span className="text-[11px] text-slate-500 ml-2 font-mono">DNI: {s.dni}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {presentToday ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        PRESENTE
                      </span>
                    ) : (
                      <button onClick={() => registerDni(s.dni, 'MANUAL')}
                        className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded hover:bg-indigo-500/20 transition-colors">
                        REGISTRAR
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Today attendance list */}
      {todayList.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md">
          <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" /> Asistencias de hoy ({todayList.length})
          </h3>
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
            {todayList.slice().reverse().map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-white">{r.nombre}</span>
                  <span className="text-[11px] text-slate-500 ml-2 font-mono">{r.dni}</span>
                  {r.profesor && <span className="text-[10px] text-indigo-400/80 ml-2">({r.profesor})</span>}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{r.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  REPORT TAB
// ═══════════════════════════════════════════════════════════════════
function ReportTab({ roster, records, setRecords, showToast }) {
  const [search, setSearch] = useState('')

  const allDates = useMemo(() => {
    const set = new Set(records.map(r => r.date))
    return Array.from(set).sort()
  }, [records])

  const matrix = useMemo(() => {
    const totalDates = allDates.length
    return roster.map(s => {
      const studentRecords = records.filter(r => r.dni === s.dni)
      const attendedDates = new Set(studentRecords.map(r => r.date))
      const total = attendedDates.size
      const pct = totalDates > 0 ? Math.round((total / totalDates) * 100) : 0
      const perDate = {}
      allDates.forEach(d => { perDate[d] = attendedDates.has(d) })
      return { ...s, attendedDates, total, pct, perDate }
    })
  }, [roster, records, allDates])

  const filtered = useMemo(() => {
    if (!search.trim()) return matrix
    const q = search.toLowerCase()
    return matrix.filter(s => s.nombre.toLowerCase().includes(q) || s.dni.includes(q))
  }, [matrix, search])

  const handleExport = () => {
    if (allDates.length === 0) {
      showToast('error', 'No hay asistencias registradas para exportar.')
      return
    }

    const header = ['DNI', 'Libreta', 'Nombre_Apellido', ...allDates, 'Total_Asistencias', 'Porcentaje_Presentismo']
    const rows = matrix.map(s => {
      const dateCols = allDates.map(d => s.perDate[d] ? '1' : '0')
      return [s.dni, s.libreta || '', s.nombre, ...dateCols, String(s.total), `${s.pct}%`]
    })

    const csvContent = Papa.unparse({ fields: header, data: rows })
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `matriz_asistencias_${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('ok', `Matriz CSV exportada (${roster.length} alumnos, ${allDates.length} fechas).`)
  }

  const clearRecords = () => {
    if (window.confirm('¿Borrar todas las asistencias registradas localmente?')) {
      setRecords([])
      showToast('ok', 'Asistencias eliminadas localmente.')
    }
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-400" /> Matriz Consolidada de Presentismo
            </h2>
            <p className="text-[11px] text-slate-500">
              {allDates.length} fecha{allDates.length !== 1 ? 's' : ''} con registro • {roster.length} alumnos en padrón
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={clearRecords}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition-colors">
              <Trash2 className="h-3.5 w-3.5 text-rose-400" /> Limpiar
            </button>
            <button onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all active:scale-[0.97]">
              <Download className="h-4 w-4" /> Exportar Matriz CSV
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por nombre o DNI..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
      </div>

      {/* Summary cards */}
      {allDates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
            <div className="text-lg font-extrabold text-white">{roster.length}</div>
            <div className="text-slate-500">Alumnos</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
            <div className="text-lg font-extrabold text-indigo-400">{allDates.length}</div>
            <div className="text-slate-500">Clases / Fechas</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="text-lg font-extrabold text-emerald-400">
              {roster.length > 0 ? Math.round(matrix.reduce((a, s) => a + s.pct, 0) / roster.length) : 0}%
            </div>
            <div className="text-slate-400">Promedio general</div>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
            <div className="text-lg font-extrabold text-rose-400">
              {matrix.filter(s => s.pct < 60).length}
            </div>
            <div className="text-slate-400">Menos del 60%</div>
          </div>
        </div>
      )}

      {/* Table */}
      {allDates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center text-slate-500 text-xs">
          No hay asistencias registradas todavía. Escaneá códigos QR para generar datos.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 sticky left-0 bg-slate-950/90 z-10">Alumno</th>
                  <th className="py-3 px-3">DNI</th>
                  {allDates.map(d => (
                    <th key={d} className="py-3 px-2 text-center whitespace-nowrap">
                      {d.slice(5)}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center">Total</th>
                  <th className="py-3 px-3 text-center">% Asist.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(s => (
                  <tr key={s.dni} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap sticky left-0 bg-slate-900/90 z-10">
                      {s.nombre}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{s.dni}</td>
                    {allDates.map(d => (
                      <td key={d} className="py-2.5 px-2 text-center">
                        {s.perDate[d] ? (
                          <span className="inline-block h-5 w-5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold leading-5">✓</span>
                        ) : (
                          <span className="inline-block h-5 w-5 rounded bg-slate-800 text-slate-600 text-[10px] font-bold leading-5">—</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-center font-bold text-white">{s.total}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.pct >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        s.pct >= 60 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        <Percent className="h-3 w-3" />{s.pct}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  CONFIG GOOGLE SHEETS MODAL
// ═══════════════════════════════════════════════════════════════════
function ConfigSheetsModal({ sheetsUrl, setSheetsUrl, onClose, onTestSync, showToast }) {
  const [urlInput, setUrlInput] = useState(sheetsUrl || '')
  const [copied, setCopied] = useState(false)

  const handleSave = () => {
    const trimmed = urlInput.trim()
    setSheetsUrl(trimmed)
    if (trimmed) {
      onTestSync(trimmed)
    }
    showToast('ok', 'Configuración de Google Sheets guardada.')
    onClose()
  }

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_SCRIPT_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cloud className="h-5 w-5 text-indigo-400" /> Conectar Google Sheets Compartido
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Permite que <strong>Hernán, Valeria y cualquier profesor</strong> sincronicen asistencias en tiempo real en una misma planilla de Google Sheets.
        </p>

        {/* Pasos de configuración */}
        <div className="space-y-3 rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs text-slate-300">
          <h4 className="font-bold text-indigo-400 uppercase tracking-wider text-[11px]">Pasos para conectar (2 minutos):</h4>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
            <li>Creá una hoja en blanco en <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-indigo-400 underline">sheets.new</a>.</li>
            <li>Andá al menú superior: <strong>Extensiones &gt; Apps Script</strong>.</li>
            <li>Pegá el código que copiás con el botón de abajo.</li>
            <li>Hacé clic en <strong>Implementar &gt; Nueva implementación</strong>:
              <ul className="list-disc list-inside ml-4 mt-1 text-[11px] text-slate-500">
                <li>Tipo: <em>Aplicación web</em></li>
                <li>Ejecutar como: <em>Yo</em></li>
                <li>Quién tiene acceso: <strong className="text-emerald-400">Cualquier persona (Anyone)</strong></li>
              </ul>
            </li>
            <li>Copiá la <strong>URL de la aplicación web</strong> que te da Google y pegala acá abajo.</li>
          </ol>

          <button onClick={handleCopyScript}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 py-2 text-xs font-bold text-indigo-300 transition-colors">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? '¡Código Copiado al portapapeles!' : 'Copiar Código de Google Apps Script'}
          </button>
        </div>

        {/* Input URL */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-200">
            URL de la Aplicación Web de Google Script
          </label>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30">
            Guardar y Sincronizar
          </button>
        </div>
      </div>
    </div>
  )
}
