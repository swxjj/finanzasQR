import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import Papa from 'papaparse'
import {
  QrCode, Camera, CameraOff, Upload, Download, Search, Users, UserCheck,
  FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Trash2, Volume2,
  VolumeX, BarChart3, GraduationCap, ScanLine, X, Clock, Percent,
  Cloud, CloudOff, RefreshCw, LogOut, Lock, Eye, EyeOff, Wifi, WifiOff
} from 'lucide-react'

// ─── Config ────────────────────────────────────────────────────────
const SHEETS_URL = import.meta.env.VITE_SHEETS_API_URL || ''
const PROF_USER = import.meta.env.VITE_PROF_USER || 'admin'
const PROF_PASS = import.meta.env.VITE_PROF_PASS || 'docente2026'

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
const load = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb } catch { return fb } }
const save = (key, v) => localStorage.setItem(key, JSON.stringify(v))

// ─── Date helpers ──────────────────────────────────────────────────
const todayISO = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const nowTime = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Normalizes any date format from Google Sheets to YYYY-MM-DD
const normalizeDate = (d) => {
  if (!d) return ''
  const str = String(d).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  if (str.includes('T')) return str.split('T')[0]
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split('/')
    return `${parts[2].split(' ')[0]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  try {
    const parsed = new Date(str)
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear()
      const m = String(parsed.getMonth() + 1).padStart(2, '0')
      const day = String(parsed.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  } catch {}
  return str
}

// ─── Offline queue for failed POSTs ───────────────────────────────
const QUEUE_KEY = 'qr_offline_queue'
function enqueue(record) {
  const q = load(QUEUE_KEY, [])
  q.push(record)
  save(QUEUE_KEY, q)
}
async function flushQueue() {
  if (!SHEETS_URL) return
  const q = load(QUEUE_KEY, [])
  if (q.length === 0) return
  const remaining = []
  for (const rec of q) {
    try {
      await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', ...rec })
      })
    } catch { remaining.push(rec) }
  }
  save(QUEUE_KEY, remaining)
}

// ═══════════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [role, setRole] = useState(() => load('qr_role', null))
  const [authed, setAuthed] = useState(() => load('qr_authed', false))

  // Core data
  const [roster, setRoster] = useState(() => load('qr_roster', []))
  const [records, setRecords] = useState(() => load('qr_records', []))

  // UI
  const [soundOn, setSoundOn] = useState(() => load('qr_sound', true))
  const [toast, setToast] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const toastTimer = useRef(null)

  // Persist
  useEffect(() => { save('qr_role', role) }, [role])
  useEffect(() => { save('qr_authed', authed) }, [authed])
  useEffect(() => { save('qr_roster', roster) }, [roster])
  useEffect(() => { save('qr_records', records) }, [records])
  useEffect(() => { save('qr_sound', soundOn) }, [soundOn])

  // Online/offline detection
  useEffect(() => {
    const on = () => { setIsOnline(true); flushQueue() }
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const showToast = useCallback((type, text, ms = 4000) => {
    clearTimeout(toastTimer.current)
    setToast({ type, text })
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  // ── Pull from Sheets ──────────────────────────────────────────
  const pullFromSheets = useCallback(async (silent = false) => {
    if (!SHEETS_URL) {
      if (!silent) showToast('error', 'Falta configurar VITE_SHEETS_API_URL en Vercel.')
      return
    }
    setIsSyncing(true)
    try {
      await flushQueue()
      const sep = SHEETS_URL.includes('?') ? '&' : '?'
      const res = await fetch(`${SHEETS_URL}${sep}_t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()
      if (data?.status === 'ok') {
        if (data.padron?.length > 0) setRoster(data.padron)
        if (Array.isArray(data.records)) {
          const clean = data.records.map(r => ({
            ...r,
            date: normalizeDate(r.date)
          }))
          setRecords(clean)
        }
        if (!silent) showToast('ok', `☁️ Sincronizado: ${data.padron?.length || 0} alumnos, ${data.records?.length || 0} asistencias.`)
      }
    } catch (err) {
      console.warn('Sync error:', err)
      if (!silent) showToast('error', 'Sin conexión con Google Sheets.')
    } finally { setIsSyncing(false) }
  }, [showToast])

  // Auto-sync on professor login
  useEffect(() => {
    if (role === 'profesor' && authed && SHEETS_URL) pullFromSheets(true)
  }, [role, authed, pullFromSheets])

  // ── Push single attendance to Sheets ──────────────────────────
  const pushToSheets = useCallback(async (rec) => {
    if (!SHEETS_URL) return
    try {
      await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', ...rec })
      })
    } catch {
      enqueue(rec)
    }
  }, [])

  // ── Push roster to Sheets ─────────────────────────────────────
  const pushRosterToSheets = useCallback(async (newRoster) => {
    if (!SHEETS_URL) return
    setIsSyncing(true)
    try {
      const res = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sync_padron', padron: newRoster })
      })
      const data = await res.json()
      if (data?.status === 'ok') showToast('ok', `☁️ Padrón (${newRoster.length} alumnos) guardado en Sheets.`)
    } catch (err) {
      console.warn('Roster push error:', err)
    } finally { setIsSyncing(false) }
  }, [showToast])

  // Logout
  const logout = () => { setAuthed(false); setRole(null) }

  // ── Role selection ──────────────────────────────────────────────
  if (!role) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center animate-slide-up">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-2xl shadow-indigo-600/40">
            <QrCode className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">QR Asist</h1>
            <p className="text-sm text-slate-400 mt-1">Control de asistencia con QR</p>
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
          {!SHEETS_URL && (
            <p className="text-[10px] text-amber-500/80 flex items-center justify-center gap-1">
              <CloudOff className="h-3 w-3" /> Modo offline — Google Sheets no configurado
            </p>
          )}
        </div>
      </div>
    )
  }

  if (role === 'alumno') return <AlumnoView onBack={() => setRole(null)} />

  // Professor needs auth
  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} onBack={() => setRole(null)} />
  }

  return (
    <ProfesorView
      roster={roster} setRoster={setRoster}
      records={records} setRecords={setRecords}
      soundOn={soundOn} setSoundOn={setSoundOn}
      toast={toast} showToast={showToast} setToast={setToast}
      isSyncing={isSyncing} isOnline={isOnline}
      onPull={pullFromSheets}
      onPushAttendance={pushToSheets}
      onPushRoster={pushRosterToSheets}
      onLogout={logout}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════
//  LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════
function LoginScreen({ onSuccess, onBack }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (user.trim() === PROF_USER && pass === PROF_PASS) {
      onSuccess()
    } else {
      setError('Usuario o contraseña incorrectos.')
      setShake(true)
      beep('err')
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className={`w-full max-w-sm animate-slide-up ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center mb-4 ring-1 ring-indigo-500/30">
              <Lock className="h-8 w-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Acceso Docente</h2>
            <p className="text-xs text-slate-400 mt-1">Ingresá tus credenciales para tomar asistencia</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Usuario</label>
              <input type="text" value={user} onChange={e => { setUser(e.target.value); setError('') }}
                placeholder="Usuario" autoComplete="username" autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={pass} onChange={e => { setPass(e.target.value); setError('') }}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 animate-fade-in">
                <XCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <button type="submit"
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.97]">
              Ingresar
            </button>
          </form>

          <button onClick={onBack}
            className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 text-center py-2 transition-colors">
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  ALUMNO VIEW (PUBLIC)
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
    const ctx2d = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx2d.fillStyle = '#ffffff'
      ctx2d.fillRect(0, 0, size, size)
      ctx2d.drawImage(img, 0, 0, size, size)
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
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-white">← Volver</button>
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
              <input type="text" inputMode="numeric" value={dni}
                onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
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
//  PROFESOR VIEW (AUTHENTICATED)
// ═══════════════════════════════════════════════════════════════════
function ProfesorView({
  roster, setRoster, records, setRecords,
  soundOn, setSoundOn,
  toast, showToast, setToast,
  isSyncing, isOnline,
  onPull, onPushAttendance, onPushRoster, onLogout
}) {
  const [tab, setTab] = useState('scan')

  // Stable refs for registerDni
  const recordsRef = useRef(records)
  const rosterRef = useRef(roster)
  const soundRef = useRef(soundOn)
  useEffect(() => { recordsRef.current = records }, [records])
  useEffect(() => { rosterRef.current = roster }, [roster])
  useEffect(() => { soundRef.current = soundOn }, [soundOn])

  // CSV Upload
  const handleCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map(r => {
          const dni = String(r.DNI || r.dni || r.Documento || '').replace(/\D/g, '').trim()
          const libreta = String(r.Libreta || r.libreta || r.Legajo || r.legajo || '').trim()
          const nombre = String(r.Nombre_Apellido || r.nombre_apellido || r.Nombre || r.nombre || r.Name || '').trim()
          if (!dni || !nombre) return null
          return { dni, libreta, nombre }
        }).filter(Boolean)
        if (!parsed.length) { showToast('error', 'CSV vacío o sin columnas DNI / Nombre_Apellido.'); return }
        setRoster(parsed)
        showToast('ok', `Padrón cargado: ${parsed.length} alumnos.`)
        onPushRoster(parsed)
      },
      error: () => showToast('error', 'Error al leer el archivo CSV.')
    })
    e.target.value = ''
  }

  // Register attendance (stable — never recreated)
  const registerDni = useCallback((rawDni) => {
    const dni = rawDni.replace(/\D/g, '').trim()
    if (!dni) return
    const curRoster = rosterRef.current
    const curRecords = recordsRef.current
    const snd = soundRef.current

    const student = curRoster.find(s => String(s.dni).replace(/\D/g, '').trim() === dni)
    if (!student) {
      if (snd) beep('err')
      showToast('error', `DNI ${dni} no está en el padrón.`)
      return
    }

    const today = todayISO()
    const dup = curRecords.find(r => String(r.dni).replace(/\D/g, '').trim() === dni && normalizeDate(r.date) === today)
    if (dup) {
      if (snd) beep('dup')
      showToast('dup', `${student.nombre} ya tiene asistencia hoy (${dup.time}).`)
      return
    }

    const rec = { dni, libreta: student.libreta || '', nombre: student.nombre, date: today, time: nowTime() }
    setRecords(prev => [...prev, rec])
    if (snd) beep('ok')
    showToast('ok', `✓ ${student.nombre} — Presente`)
    onPushAttendance(rec)
  }, [showToast, setRecords, onPushAttendance])

  const today = todayISO()
  const todayCount = useMemo(() => records.filter(r => normalizeDate(r.date) === today).length, [records, today])

  const tabs = [
    { id: 'scan', label: 'Escanear', icon: Camera },
    { id: 'report', label: 'Reporte', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      {/* Header */}
      <header className="print:hidden sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md">
              <QrCode className="h-4 w-4 text-white" />
            </div>
            <span className="font-extrabold text-white hidden sm:inline">QR Asist</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Connection indicator */}
            <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${
              !SHEETS_URL
                ? 'text-slate-500 bg-slate-900 border border-slate-800'
                : isOnline
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            }`}>
              {!SHEETS_URL ? <CloudOff className="h-3.5 w-3.5" /> :
               isOnline ? <Cloud className={`h-3.5 w-3.5 ${isSyncing ? 'animate-pulse' : ''}`} /> :
                          <WifiOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">
                {!SHEETS_URL ? 'Offline' : isOnline ? (isSyncing ? 'Sincronizando...' : 'Sheets ✓') : 'Sin red'}
              </span>
            </div>

            {/* Sync button */}
            {SHEETS_URL && (
              <button onClick={() => onPull(false)} disabled={isSyncing} title="Sincronizar con Google Sheets"
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Sound toggle */}
            <button onClick={() => setSoundOn(!soundOn)} title={soundOn ? 'Silenciar' : 'Activar sonido'}
              className={`p-2 rounded-lg transition-colors ${soundOn ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}>
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Logout */}
            <button onClick={onLogout} title="Cerrar sesión"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
              <LogOut className="h-4 w-4" />
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
        {/* Roster bar */}
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
              {SHEETS_URL && (
                <button onClick={() => onPull(false)} disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-colors">
                  <RefreshCw className={`h-3.5 w-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sincronizar
                </button>
              )}
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all active:scale-[0.97]">
                <Upload className="h-4 w-4" />
                {roster.length ? 'Subir CSV' : 'Cargar Padrón CSV'}
                <input type="file" accept=".csv" onChange={handleCSV} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {roster.length === 0 ? (
          <EmptyRosterHint hasSheets={Boolean(SHEETS_URL)} onPull={() => onPull(false)} />
        ) : tab === 'scan' ? (
          <ScanTab roster={roster} records={records} registerDni={registerDni} todayCount={todayCount} totalRoster={roster.length} />
        ) : (
          <ReportTab roster={roster} records={records} setRecords={setRecords} showToast={showToast} />
        )}
      </main>

      <footer className="print:hidden border-t border-slate-900 py-3 text-center text-[11px] text-slate-600">
        QR Asist • Google Sheets + React + Tailwind v4
      </footer>
    </div>
  )
}

// ── Empty roster placeholder ─────────────────────────────────────
function EmptyRosterHint({ hasSheets, onPull }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center space-y-4 animate-slide-up">
      <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-600" />
      <h3 className="text-base font-bold text-slate-300">Padrón no cargado</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto">
        {hasSheets
          ? 'Cargá el padrón subiendo un CSV o sincronizando desde Google Sheets.'
          : 'Subí un archivo CSV con columnas DNI, Libreta, Nombre_Apellido.'}
      </p>
      {hasSheets && (
        <button onClick={onPull}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all">
          <Cloud className="h-4 w-4" /> Descargar desde Google Sheets
        </button>
      )}
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
function ScanTab({ roster, records, registerDni, todayCount, totalRoster }) {
  const [scanning, setScanning] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const [manualDni, setManualDni] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const scannerRef = useRef(null)
  const containerId = 'qr-reader'
  const processingRef = useRef(false)

  useEffect(() => { return () => { stopScanner() } }, [])

  // Boot camera when container becomes ready
  useEffect(() => {
    if (!containerReady) return
    let cancelled = false
    const boot = async () => {
      try {
        const qr = new Html5Qrcode(containerId)
        scannerRef.current = qr
        const qrbox = (vw, vh) => {
          const s = Math.floor(Math.max(150, Math.min(Math.min(vw, vh) * 0.7, 280)))
          return { width: s, height: s }
        }
        const cfg = { fps: 10, qrbox }
        const onOk = (text) => {
          if (processingRef.current) return
          processingRef.current = true
          registerDni(text.replace(/\D/g, '').trim())
          setTimeout(() => { processingRef.current = false }, 2500)
        }
        let started = false
        for (const c of [{ facingMode: 'environment' }, { facingMode: 'user' }, null]) {
          if (started || cancelled) break
          try {
            if (c) { await qr.start(c, cfg, onOk, () => {}) }
            else {
              const cams = await Html5Qrcode.getCameras()
              if (cams?.length) await qr.start(cams[0].id, cfg, onOk, () => {})
              else throw new Error('No cameras')
            }
            started = true
          } catch (e) { console.warn('Cam fail:', e) }
        }
        if (!started) throw new Error('All cameras failed')
        const vid = document.querySelector(`#${containerId} video`)
        if (vid) { vid.setAttribute('playsinline', 'true'); vid.setAttribute('webkit-playsinline', 'true') }
        if (!cancelled) setScanning(true)
      } catch (err) {
        console.error(err)
        if (!cancelled) { setContainerReady(false); alert('No se pudo acceder a la cámara. Verificá los permisos.') }
      }
    }
    const t = setTimeout(boot, 120)
    return () => { cancelled = true; clearTimeout(t) }
  }, [containerReady, registerDni])

  const startScanner = async () => { if (scannerRef.current) await stopScanner(); setContainerReady(true) }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); await scannerRef.current.clear() } catch (_) {}
      scannerRef.current = null
    }
    setScanning(false); setContainerReady(false)
  }

  const handleManual = (e) => { e.preventDefault(); if (manualDni.trim()) { registerDni(manualDni); setManualDni('') } }

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    const q = searchTerm.toLowerCase()
    return roster.filter(s => s.nombre.toLowerCase().includes(q) || String(s.dni).includes(q)).slice(0, 8)
  }, [roster, searchTerm])

  const today = todayISO()
  const todayList = useMemo(() => records.filter(r => normalizeDate(r.date) === today), [records, today])
  const pct = totalRoster > 0 ? Math.round((todayCount / totalRoster) * 100) : 0

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Counters */}
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

      {/* Scanner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-indigo-400" /> Escáner QR
          </h2>
          {scanning && (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Escaneando
            </span>
          )}
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
          <button type="submit" className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 text-sm font-bold text-white transition-all">
            Registrar
          </button>
        </form>
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md">
        <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <Search className="h-4 w-4 text-indigo-400" /> Buscar alumno
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
              const present = records.some(r => r.dni === s.dni && r.date === today)
              return (
                <div key={s.dni} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-white">{s.nombre}</span>
                    <span className="text-[11px] text-slate-500 ml-2 font-mono">DNI: {s.dni}</span>
                  </div>
                  {present ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">PRESENTE</span>
                  ) : (
                    <button onClick={() => registerDni(s.dni)}
                      className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded hover:bg-indigo-500/20 transition-colors">
                      REGISTRAR
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Today's list */}
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

  const allDates = useMemo(() => Array.from(new Set(records.map(r => normalizeDate(r.date)).filter(Boolean))).sort(), [records])

  const matrix = useMemo(() => {
    const total = allDates.length
    return roster.map(s => {
      const sDni = String(s.dni).replace(/\D/g, '').trim()
      const attended = new Set(
        records
          .filter(r => String(r.dni).replace(/\D/g, '').trim() === sDni)
          .map(r => normalizeDate(r.date))
      )
      const cnt = attended.size
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0
      const perDate = {}
      allDates.forEach(d => { perDate[d] = attended.has(d) })
      return { ...s, total: cnt, pct, perDate }
    })
  }, [roster, records, allDates])

  const filtered = useMemo(() => {
    if (!search.trim()) return matrix
    const q = search.toLowerCase()
    return matrix.filter(s => s.nombre.toLowerCase().includes(q) || s.dni.includes(q))
  }, [matrix, search])

  const handleExport = () => {
    if (!allDates.length) { showToast('error', 'No hay datos para exportar.'); return }
    const header = ['DNI', 'Libreta', 'Nombre_Apellido', ...allDates, 'Total', 'Porcentaje']
    const rows = matrix.map(s => [s.dni, s.libreta || '', s.nombre, ...allDates.map(d => s.perDate[d] ? '1' : '0'), String(s.total), `${s.pct}%`])
    const csv = Papa.unparse({ fields: header, data: rows })
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `presentismo_${todayISO()}.csv`; a.click()
    URL.revokeObjectURL(url)
    showToast('ok', `Exportado: ${roster.length} alumnos × ${allDates.length} fechas.`)
  }

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-400" /> Matriz de Presentismo
            </h2>
            <p className="text-[11px] text-slate-500">
              {allDates.length} clase{allDates.length !== 1 ? 's' : ''} • {roster.length} alumnos •
              % = (clases asistidas / total clases) × 100
            </p>
          </div>
          <button onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all active:scale-[0.97]">
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por nombre o DNI..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
      </div>

      {allDates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
            <div className="text-lg font-extrabold text-white">{roster.length}</div>
            <div className="text-slate-500">Alumnos</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
            <div className="text-lg font-extrabold text-indigo-400">{allDates.length}</div>
            <div className="text-slate-500">Clases</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="text-lg font-extrabold text-emerald-400">
              {roster.length > 0 ? Math.round(matrix.reduce((a, s) => a + s.pct, 0) / roster.length) : 0}%
            </div>
            <div className="text-slate-400">Promedio gral.</div>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
            <div className="text-lg font-extrabold text-rose-400">{matrix.filter(s => s.pct < 60).length}</div>
            <div className="text-slate-400">&lt;60% asist.</div>
          </div>
        </div>
      )}

      {allDates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center text-slate-500 text-xs">
          No hay asistencias registradas. Escaneá códigos QR para generar datos.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 sticky left-0 bg-slate-950/90 z-10">Alumno</th>
                  <th className="py-3 px-3">DNI</th>
                  {allDates.map(d => <th key={d} className="py-3 px-2 text-center whitespace-nowrap">{d.slice(5)}</th>)}
                  <th className="py-3 px-3 text-center">Total</th>
                  <th className="py-3 px-3 text-center">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map(s => (
                  <tr key={s.dni} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap sticky left-0 bg-slate-900/90 z-10">{s.nombre}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{s.dni}</td>
                    {allDates.map(d => (
                      <td key={d} className="py-2.5 px-2 text-center">
                        {s.perDate[d]
                          ? <span className="inline-block h-5 w-5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold leading-5">✓</span>
                          : <span className="inline-block h-5 w-5 rounded bg-slate-800 text-slate-600 text-[10px] font-bold leading-5">—</span>}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-center font-bold text-white">{s.total}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.pct >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        s.pct >= 60 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}><Percent className="h-3 w-3" />{s.pct}</span>
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
