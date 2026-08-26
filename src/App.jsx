import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  QrCode, Camera, CameraOff, Upload, Download, Search, Users, UserCheck,
  FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Volume2,
  VolumeX, BarChart3, GraduationCap, ScanLine, X, Clock, Percent,
  Cloud, CloudOff, RefreshCw, LogOut, Lock, Eye, EyeOff, WifiOff, ArrowLeft,
  Undo2, Trash2, Filter, Check
} from 'lucide-react'

// ─── Config ────────────────────────────────────────────────────────
const SHEETS_URL = import.meta.env.VITE_SHEETS_API_URL || ''
const PROF_USER = import.meta.env.VITE_PROF_USER || 'admin'
const PROF_PASS = import.meta.env.VITE_PROF_PASS || 'docente2026'

// ─── Web Audio + Haptic feedback ───────────────────────────────────
function beep(type) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'ok') navigator.vibrate(80)
      else if (type === 'dup') navigator.vibrate([80, 50, 80])
      else navigator.vibrate([150, 50, 150])
    }
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
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.start(t); osc.stop(t + 0.25)
    } else if (type === 'dup') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, t)
      osc.frequency.setValueAtTime(340, t + 0.12)
      gain.gain.setValueAtTime(0.22, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t); osc.stop(t + 0.3)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, t)
      osc.frequency.setValueAtTime(150, t + 0.15)
      gain.gain.setValueAtTime(0.2, t)
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

// Helper to format DNI with dots for human readability (e.g. 46.102.693)
const formatDniDisplay = (raw) => {
  const clean = String(raw || '').replace(/\D/g, '')
  if (!clean) return ''
  if (clean.length <= 3) return clean
  if (clean.length <= 6) return `${clean.slice(0, -3)}.${clean.slice(-3)}`
  return `${clean.slice(0, -6)}.${clean.slice(-6, -3)}.${clean.slice(-3)}`
}

// ─── Offline queue for failed POSTs ───────────────────────────────
const QUEUE_KEY = 'qr_offline_queue'
function enqueue(record) {
  const q = load(QUEUE_KEY, [])
  q.push(record)
  save(QUEUE_KEY, q)
}
function getQueueLength() {
  return load(QUEUE_KEY, []).length
}
async function flushQueue() {
  if (!SHEETS_URL) return
  const q = load(QUEUE_KEY, [])
  if (q.length === 0) return
  const remaining = []
  for (const rec of q) {
    try {
      const res = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', ...rec })
      })
      if (!res.ok) {
        remaining.push(rec)
        continue
      }
      const data = await res.json()
      if (data.status !== 'ok' && data.status !== 'duplicate') {
        remaining.push(rec)
      }
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
  const [pendingCount, setPendingCount] = useState(() => getQueueLength())
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

  const showToast = useCallback((type, text, ms = 3500) => {
    clearTimeout(toastTimer.current)
    setToast({ type, text })
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  // ── Pull from Sheets (with intelligent merge) ─────────────────
  const pullFromSheets = useCallback(async (silent = false) => {
    if (!SHEETS_URL) {
      if (!silent) showToast('error', 'Falta configurar VITE_SHEETS_API_URL.')
      return
    }
    setIsSyncing(true)
    try {
      await flushQueue()
      setPendingCount(getQueueLength())
      const sep = SHEETS_URL.includes('?') ? '&' : '?'
      const res = await fetch(`${SHEETS_URL}${sep}_t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.status === 'ok') {
        if (data.padron?.length > 0) setRoster(data.padron)
        if (Array.isArray(data.records)) {
          const remoteClean = data.records.map(r => ({
            ...r,
            date: normalizeDate(r.date)
          }))

          const queue = load(QUEUE_KEY, [])
          const queuePending = queue.map(q => ({ ...q, date: normalizeDate(q.date) }))
          const remoteKeys = new Set(remoteClean.map(r => `${String(r.dni).replace(/\D/g, '').trim()}_${r.date}`))
          const unsentPending = queuePending.filter(p => !remoteKeys.has(`${String(p.dni).replace(/\D/g, '').trim()}_${p.date}`))

          setRecords([...remoteClean, ...unsentPending])
        }
        if (!silent) showToast('ok', `Sincronizado: ${data.padron?.length || 0} alumnos, ${data.records?.length || 0} asistencias.`)
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

  // ── Polling every 25s + visibilitychange / focus for multi-device sync ──
  useEffect(() => {
    if (role !== 'profesor' || !authed || !SHEETS_URL) return

    const interval = setInterval(() => {
      pullFromSheets(true)
    }, 25000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') pullFromSheets(true)
    }
    const handleFocus = () => pullFromSheets(true)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [role, authed, pullFromSheets])

  // ── Push single attendance to Sheets ──
  const pushToSheets = useCallback(async (rec) => {
    if (!SHEETS_URL) return
    try {
      const res = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', ...rec })
      })
      if (!res.ok) {
        enqueue(rec)
        setPendingCount(getQueueLength())
        return
      }
      const data = await res.json()
      if (data.status === 'duplicate') {
        console.log('Backend duplicate acknowledged')
      } else if (data.status !== 'ok') {
        enqueue(rec)
        setPendingCount(getQueueLength())
      }
    } catch {
      enqueue(rec)
      setPendingCount(getQueueLength())
    }
  }, [])

  // ── Delete / Undo attendance ──
  const deleteAttendance = useCallback(async (dni, date) => {
    const cleanDni = String(dni || '').replace(/\D/g, '').trim()
    const cleanDate = normalizeDate(date)

    // Optimistic local state removal
    setRecords(prev => prev.filter(r => !(String(r.dni).replace(/\D/g, '').trim() === cleanDni && normalizeDate(r.date) === cleanDate)))
    showToast('ok', 'Asistencia anulada.')

    if (!SHEETS_URL) return
    try {
      await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete_attendance', dni: cleanDni, date: cleanDate })
      })
    } catch (err) {
      console.warn('Error deleting attendance:', err)
    }
  }, [showToast])

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
      if (data?.status === 'ok') showToast('ok', `Padrón (${newRoster.length} alumnos) guardado en Sheets.`)
    } catch (err) {
      console.warn('Roster push error:', err)
      showToast('error', 'Error al guardar padrón en Sheets.')
    } finally { setIsSyncing(false) }
  }, [showToast])

  // Logout
  const logout = () => { setAuthed(false); setRole(null) }

  // ── Role selection ──────────────────────────────────────────────
  if (!role) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 selection:bg-emerald-500/20">
        <div className="w-full max-w-sm space-y-7 text-center animate-fade-in">
          {/* Logo Brandmark */}
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl" aria-hidden="true">
            <QrCode className="h-8 w-8 text-emerald-400" />
          </div>

          <div>
            <h1 className="text-[2rem] leading-9 font-extrabold text-zinc-100 tracking-tight">finanzasQR</h1>
          </div>

          <div className="grid gap-3 pt-1">
            <button
              onClick={() => setRole('profesor')}
              aria-label="Ingresar como Docente para escanear QR y gestionar asistencia"
              className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group"
            >
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0" aria-hidden="true">
                  <GraduationCap className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">Soy Docente</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Escanear QR y gestionar asistencia</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-zinc-300 font-mono" aria-hidden="true">→</span>
            </button>

            <button
              onClick={() => setRole('alumno')}
              aria-label="Ingresar como Alumno/a para generar y descargar código QR"
              className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 group"
            >
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0" aria-hidden="true">
                  <QrCode className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-100 group-hover:text-zinc-200 transition-colors">Soy Alumno/a</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Generar y descargar mi código QR</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-zinc-300 font-mono" aria-hidden="true">→</span>
            </button>
          </div>

          {!SHEETS_URL && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20" role="status">
              <CloudOff className="h-3 w-3" aria-hidden="true" />
              <span>Modo local (Sin Google Sheets)</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (role === 'alumno') return <AlumnoView onBack={() => setRole(null)} />

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
      pendingCount={pendingCount}
      onPull={pullFromSheets}
      onPushAttendance={pushToSheets}
      onDeleteAttendance={deleteAttendance}
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
      setError('Credenciales incorrectas.')
      setShake(true)
      beep('err')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className={`w-full max-w-sm ${shake ? 'animate-[shake_0.4s_ease-in-out]' : 'animate-fade-in'}`}>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-7 shadow-2xl backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3" aria-hidden="true">
              <Lock className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100">Acceso Docente</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Ingresá para tomar asistencia y consultar métricas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Usuario
              </label>
              <input
                id="login-username"
                type="text"
                value={user}
                onChange={e => { setUser(e.target.value); setError('') }}
                placeholder="docente"
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all font-sans"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => { setPass(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 animate-fade-in" role="alert">
                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Ingresar al Panel
            </button>
          </form>

          <button
            onClick={onBack}
            aria-label="Volver a la selección de roles"
            className="w-full mt-4 text-xs text-zinc-500 hover:text-zinc-300 text-center py-1 transition-colors"
          >
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
  const [rawDni, setRawDni] = useState(() => load('qr_alumno_dni', ''))
  const [downloaded, setDownloaded] = useState(false)
  const qrRef = useRef(null)

  useEffect(() => { save('qr_alumno_dni', rawDni) }, [rawDni])

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const size = 800
    canvas.width = size
    canvas.height = size
    const ctx2d = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx2d.fillStyle = '#ffffff'
      ctx2d.fillRect(0, 0, size, size)
      ctx2d.drawImage(img, 0, 0, size, size)
      const a = document.createElement('a')
      a.download = `QR_${rawDni || 'credencial'}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 2500)
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleDniChange = (e) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 8)
    setRawDni(clean)
  }

  const isValidDni = rawDni.length >= 7

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100">
      {/* Minimal Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            aria-label="Volver a la selección de roles"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver</span>
          </button>
          <div className="text-xs font-bold text-zinc-200">Credencial Digital</div>
          <div className="w-12" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 safe-bottom">
        <div className="w-full max-w-sm space-y-4 animate-fade-in">
          {/* DNI Input Card with Live Dot Mask */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl">
            <label htmlFor="student-dni-input" className="block text-xs font-semibold text-zinc-300 mb-1.5 text-center">
              Ingresá tu número de DNI
            </label>
            <input
              id="student-dni-input"
              type="text"
              inputMode="numeric"
              value={formatDniDisplay(rawDni)}
              onChange={handleDniChange}
              placeholder="Ej: 45.123.456"
              maxLength={10}
              autoFocus
              aria-describedby="dni-format-hint"
              aria-label="Número de Documento Nacional de Identidad"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xl font-mono font-bold text-zinc-100 placeholder-zinc-600 text-center tracking-wider focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all"
            />
            <p id="dni-format-hint" className="text-[10px] text-zinc-500 text-center mt-1.5">
              Sin puntos ni espacios • Se formatea automáticamente
            </p>
          </div>

          {/* Student Pass Card */}
          {isValidDni ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl space-y-5 animate-slide-up text-center">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[11px] text-zinc-400">
                <span className="font-semibold text-zinc-300 uppercase tracking-wider">Pase de Asistencia</span>
                <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-semibold" role="status">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  Activo
                </span>
              </div>

              {/* QR Container with High Contrast */}
              <div ref={qrRef} className="flex justify-center py-1">
                <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
                  <QRCodeSVG value={rawDni} size={200} level="H" includeMargin aria-label={`Código QR para DNI ${rawDni}`} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-zinc-400 uppercase tracking-widest font-semibold">Documento</div>
                <div className="text-xl font-mono font-extrabold text-zinc-100 tracking-wider">
                  {formatDniDisplay(rawDni)}
                </div>
              </div>

              <button
                onClick={handleDownload}
                aria-label={`Descargar credencial universitaria en formato PNG para DNI ${rawDni}`}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-lg transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  downloaded
                    ? 'bg-emerald-700 text-white shadow-emerald-700/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                }`}
              >
                {downloaded ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>¡Pase Descargado!</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Descargar Pase como Imagen</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-2 text-zinc-500">
              <QrCode className="h-10 w-10 mx-auto opacity-30" aria-hidden="true" />
              <p className="text-xs">Ingresá al menos 7 dígitos para generar tu código QR de asistencia.</p>
            </div>
          )}
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
  isSyncing, isOnline, pendingCount,
  onPull, onPushAttendance, onDeleteAttendance, onPushRoster, onLogout
}) {
  const [tab, setTab] = useState('scan')
  const [lastScan, setLastScan] = useState(null)
  const lastScanTimer = useRef(null)

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
        if (!parsed.length) { showToast('error', 'CSV sin columnas válidas (DNI / Nombre_Apellido).'); return }
        setRoster(parsed)
        showToast('ok', `Padrón cargado: ${parsed.length} alumnos.`)
        onPushRoster(parsed)
      },
      error: () => showToast('error', 'Error al leer el archivo CSV.')
    })
    e.target.value = ''
  }

  // Register attendance (instant optimistic update)
  const registerDni = useCallback((rawDni) => {
    const dni = rawDni.replace(/\D/g, '').trim()
    if (!dni) return
    const curRoster = rosterRef.current
    const curRecords = recordsRef.current
    const snd = soundRef.current

    const student = curRoster.find(s => String(s.dni).replace(/\D/g, '').trim() === dni)
    if (!student) {
      if (snd) beep('err')
      showToast('error', `DNI ${dni} no figura en el padrón.`)
      setLastScan({ type: 'error', text: `DNI ${dni} no está en el padrón`, dni })
      clearTimeout(lastScanTimer.current)
      lastScanTimer.current = setTimeout(() => setLastScan(null), 3500)
      return
    }

    const today = todayISO()
    const dup = curRecords.find(r => String(r.dni).replace(/\D/g, '').trim() === dni && normalizeDate(r.date) === today)
    if (dup) {
      if (snd) beep('dup')
      showToast('dup', `${student.nombre} ya tiene presente hoy (${dup.time}).`)
      setLastScan({ type: 'dup', student, text: `Ya registrado hoy (${dup.time})`, time: dup.time })
      clearTimeout(lastScanTimer.current)
      lastScanTimer.current = setTimeout(() => setLastScan(null), 3500)
      return
    }

    const rec = { dni, libreta: student.libreta || '', nombre: student.nombre, date: today, time: nowTime() }
    
    // Synchronous optimistic update
    setRecords(prev => [...prev, rec])
    if (snd) beep('ok')
    showToast('ok', `✓ ${student.nombre} — Presente`)

    const currentTodayCount = curRecords.filter(r => normalizeDate(r.date) === today).length + 1
    setLastScan({
      type: 'ok',
      student,
      count: currentTodayCount,
      total: curRoster.length,
      time: rec.time,
      dni: rec.dni,
      date: rec.date
    })
    clearTimeout(lastScanTimer.current)
    lastScanTimer.current = setTimeout(() => setLastScan(null), 4500)

    onPushAttendance(rec)
  }, [showToast, setRecords, onPushAttendance])

  const today = todayISO()
  const todayCount = useMemo(() => records.filter(r => normalizeDate(r.date) === today).length, [records, today])

  const tabs = [
    { id: 'scan', label: 'Escanear', icon: Camera },
    { id: 'report', label: 'Matriz de Reporte', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100">
      {/* Top Header */}
      <header className="print-hidden sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center" aria-hidden="true">
              <QrCode className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="font-extrabold text-sm text-zinc-100 tracking-tight hidden sm:inline">finanzasQR</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection status pill */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
              !SHEETS_URL
                ? 'text-zinc-500 bg-zinc-900 border-zinc-800'
                : isOnline
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            }`} role="status">
              {!SHEETS_URL ? (
                <CloudOff className="h-3 w-3" aria-hidden="true" />
              ) : isOnline ? (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="hidden xs:inline font-mono">
                {!SHEETS_URL ? 'Offline' : isOnline ? (isSyncing ? 'Sincronizando...' : 'Sheets ✓') : 'Sin red'}
              </span>
            </div>

            {/* Offline queue indicator */}
            {pendingCount > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 animate-pulse"
                title={`${pendingCount} asistencia(s) en cola`}
                role="status"
                aria-label={`${pendingCount} asistencias pendientes de sincronización`}
              >
                <CloudOff className="h-3 w-3" aria-hidden="true" />
                <span>{pendingCount}</span>
              </div>
            )}

            {/* Sync button */}
            {SHEETS_URL && (
              <button
                onClick={() => onPull(false)}
                disabled={isSyncing}
                aria-label="Sincronizar datos con Google Sheets"
                title="Sincronizar ahora"
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} aria-hidden="true" />
              </button>
            )}

            {/* Sound toggle */}
            <button
              onClick={() => setSoundOn(!soundOn)}
              aria-label={soundOn ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
              title={soundOn ? 'Silenciar' : 'Activar sonido'}
              className={`p-2 rounded-lg transition-colors border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 ${
                soundOn
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border-transparent'
              }`}
            >
              {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              aria-label="Cerrar sesión de docente"
              title="Cerrar sesión"
              className="p-2 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-zinc-900 border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Minimal Tab Bar */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1.5 pb-2" role="tablist" aria-label="Secciones del panel docente">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  active
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-750 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-zinc-500'}`} aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="print-hidden fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-fade-in" role="alert">
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl border text-xs font-semibold backdrop-blur-xl ${
            toast.type === 'ok'  ? 'bg-zinc-900/95 border-emerald-500/40 text-emerald-300' :
            toast.type === 'dup' ? 'bg-zinc-900/95 border-amber-500/40 text-amber-300' :
                                   'bg-zinc-900/95 border-rose-500/40 text-rose-300'
          }`}>
            {toast.type === 'ok'  && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />}
            {toast.type === 'dup' && <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />}
            {toast.type === 'error' && <XCircle    className="h-4 w-4 text-rose-400 shrink-0" aria-hidden="true" />}
            <span className="flex-1 truncate">{toast.text}</span>
            <button onClick={() => setToast(null)} aria-label="Cerrar notificación" className="shrink-0 text-zinc-500 hover:text-zinc-200">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-4 safe-bottom">
        {/* Roster Overview Bar */}
        <div className="print-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Users className="h-4 w-4 text-zinc-400" aria-hidden="true" />
              <span className="text-zinc-400">Padrón:</span>
              <span className="font-mono font-bold text-zinc-100">{roster.length}</span>
              <span className="text-zinc-500">alumnos</span>
              {roster.length > 0 && (
                <>
                  <span className="text-zinc-700" aria-hidden="true">|</span>
                  <UserCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span className="font-mono font-bold text-emerald-400">{todayCount}</span>
                  <span className="text-zinc-500">presentes hoy</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {SHEETS_URL && (
                <button
                  onClick={() => onPull(false)}
                  disabled={isSyncing}
                  aria-label="Sincronizar padrón y asistencias desde Sheets"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} aria-hidden="true" />
                  <span>Sincronizar</span>
                </button>
              )}

              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 hover:bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-950 transition-all active:scale-[0.98] focus-within:ring-2 focus-within:ring-emerald-500">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{roster.length ? 'Actualizar CSV' : 'Cargar Padrón'}</span>
                <input type="file" accept=".csv" onChange={handleCSV} className="hidden" aria-label="Subir archivo CSV con padrón de alumnos" />
              </label>
            </div>
          </div>
        </div>

        {roster.length === 0 ? (
          <EmptyRosterHint hasSheets={Boolean(SHEETS_URL)} onPull={() => onPull(false)} />
        ) : tab === 'scan' ? (
          <div id="tabpanel-scan" role="tabpanel" aria-label="Escáner y registro de asistencia">
            <ScanTab
              roster={roster}
              records={records}
              registerDni={registerDni}
              onDeleteAttendance={onDeleteAttendance}
              todayCount={todayCount}
              totalRoster={roster.length}
              lastScan={lastScan}
              setLastScan={setLastScan}
            />
          </div>
        ) : (
          <div id="tabpanel-report" role="tabpanel" aria-label="Matriz consolidada de presentismo">
            <ReportTab
              roster={roster}
              records={records}
              setRecords={setRecords}
              showToast={showToast}
            />
          </div>
        )}
      </main>

      <footer className="print-hidden border-t border-zinc-900 py-3 text-center text-[11px] text-zinc-600 font-mono">
        finanzasQR • Sistema de Control Universitario
      </footer>
    </div>
  )
}

// ── Empty roster placeholder ─────────────────────────────────────
function EmptyRosterHint({ hasSheets, onPull }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center space-y-4 animate-fade-in">
      <FileSpreadsheet className="h-10 w-10 mx-auto text-zinc-600" aria-hidden="true" />
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-zinc-200">Padrón no cargado</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          {hasSheets
            ? 'Cargá la nómina subiendo un archivo CSV o sincronizando desde Google Sheets.'
            : 'Subí un archivo CSV con las columnas DNI, Libreta y Nombre_Apellido.'}
        </p>
      </div>

      {hasSheets && (
        <button
          onClick={onPull}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Cloud className="h-4 w-4" aria-hidden="true" />
          <span>Cargar desde Google Sheets</span>
        </button>
      )}

      <div className="inline-block rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-400 font-mono text-left">
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
function ScanTab({ roster, records, registerDni, onDeleteAttendance, todayCount, totalRoster, lastScan, setLastScan }) {
  const [scanning, setScanning] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const [manualDni, setManualDni] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const scannerRef = useRef(null)
  const searchInputRef = useRef(null)
  const containerId = 'qr-reader'
  const processingRef = useRef(false)

  useEffect(() => { return () => { stopScanner() } }, [])

  // Keyboard shortcut: '/' focuses search, 'Escape' clears
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchTerm('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Boot camera when container becomes ready
  useEffect(() => {
    if (!containerReady) return
    let cancelled = false
    const boot = async () => {
      try {
        const qr = new Html5Qrcode(containerId)
        scannerRef.current = qr
        const qrbox = (vw, vh) => {
          const s = Math.floor(Math.max(160, Math.min(Math.min(vw, vh) * 0.72, 280)))
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
        if (!cancelled) { setContainerReady(false); alert('No se pudo acceder a la cámara. Verificá los permisos del navegador.') }
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

  const handleManual = (e) => {
    e.preventDefault()
    if (manualDni.trim()) {
      registerDni(manualDni)
      setManualDni('')
    }
  }

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    const q = searchTerm.toLowerCase()
    return roster.filter(s => s.nombre.toLowerCase().includes(q) || String(s.dni).includes(q)).slice(0, 6)
  }, [roster, searchTerm])

  const today = todayISO()
  const todayList = useMemo(() => records.filter(r => normalizeDate(r.date) === today), [records, today])
  const pct = totalRoster > 0 ? Math.round((todayCount / totalRoster) * 100) : 0

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 text-center shadow-sm">
          <div className="text-xl font-extrabold font-mono text-zinc-100">{totalRoster}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">En Padrón</div>
        </div>

        <div className={`rounded-2xl border transition-all duration-300 ${
          lastScan?.type === 'ok'
            ? 'border-emerald-500/50 bg-emerald-500/15 ring-2 ring-emerald-500/30 scale-[1.02]'
            : 'border-emerald-500/20 bg-emerald-500/5'
        } p-3.5 text-center shadow-sm`}>
          <div key={todayCount} className="text-xl font-extrabold font-mono text-emerald-400 animate-fade-in">
            {todayCount}
          </div>
          <div className="text-[11px] text-emerald-300/80 mt-0.5">Presentes Hoy</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 text-center shadow-sm">
          <div className="text-xl font-extrabold font-mono text-zinc-100">{pct}%</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Asistencia</div>
        </div>
      </div>

      {/* Camera Viewfinder Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Escáner de Asistencia</h2>
          </div>
          {scanning && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-semibold" role="status">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              Cámara activa
            </span>
          )}
        </div>

        {/* Viewport Box */}
        <div className="relative rounded-xl bg-black border border-zinc-850 min-h-[260px] flex items-center justify-center overflow-hidden">
          <div
            id={containerId}
            className={`w-full ${(scanning || containerReady) ? 'min-h-[260px]' : 'absolute inset-0 opacity-0 pointer-events-none'}`}
            style={(scanning || containerReady) ? undefined : { height: '1px', overflow: 'hidden' }}
          />

          {!scanning && !containerReady && (
            <div className="flex flex-col items-center p-8 text-center space-y-3">
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 shadow-inner" aria-hidden="true">
                <Camera className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-400 max-w-xs">
                Iniciá la cámara para escanear continuamente los códigos QR de los estudiantes.
              </p>
              <button
                onClick={startScanner}
                aria-label="Iniciar cámara para escanear códigos QR"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span>Iniciar Cámara</span>
              </button>
            </div>
          )}

          {scanning && (
            <button
              onClick={stopScanner}
              aria-label="Detener cámara de escaneo"
              className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
            >
              <CameraOff className="h-3 w-3" aria-hidden="true" />
              <span>Detener</span>
            </button>
          )}

          {/* ⚡ Live Scanned Overlay Banner with Undo action */}
          {lastScan && (
            <div className="absolute inset-x-3 bottom-3 z-20 animate-slide-up" role="status" aria-live="assertive">
              <div className={`p-3.5 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center justify-between gap-3 ${
                lastScan.type === 'ok'  ? 'bg-zinc-950/95 border-emerald-500/60 text-emerald-100 ring-1 ring-emerald-500/30' :
                lastScan.type === 'dup' ? 'bg-zinc-950/95 border-amber-500/60 text-amber-100 ring-1 ring-amber-500/30' :
                                          'bg-zinc-950/95 border-rose-500/60 text-rose-100 ring-1 ring-rose-500/30'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    lastScan.type === 'ok'  ? 'bg-emerald-500/20 text-emerald-400' :
                    lastScan.type === 'dup' ? 'bg-amber-500/20 text-amber-400' :
                                              'bg-rose-500/20 text-rose-400'
                  }`} aria-hidden="true">
                    {lastScan.type === 'ok'  && <CheckCircle2 className="h-5 w-5" />}
                    {lastScan.type === 'dup' && <AlertCircle className="h-5 w-5" />}
                    {lastScan.type === 'error' && <XCircle className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs text-zinc-100 truncate">
                        {lastScan.student ? lastScan.student.nombre : `DNI ${lastScan.dni}`}
                      </p>
                      {lastScan.type === 'ok' && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                          #{lastScan.count}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-90 truncate mt-0.5 font-mono">
                      {lastScan.type === 'ok'  ? `✓ Presente (${lastScan.time})` :
                       lastScan.type === 'dup' ? `⚠ ${lastScan.text}` :
                                                 `✕ ${lastScan.text}`}
                    </p>
                  </div>
                </div>

                {lastScan.type === 'ok' && (
                  <button
                    onClick={() => {
                      onDeleteAttendance(lastScan.dni, lastScan.date || todayISO())
                      setLastScan(null)
                    }}
                    aria-label={`Deshacer registro de asistencia de ${lastScan.student?.nombre || lastScan.dni}`}
                    title="Anular este registro"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
                  >
                    <Undo2 className="h-3 w-3" aria-hidden="true" />
                    <span>Deshacer</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Input Form */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
        <label htmlFor="manual-dni-input" className="text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          <span>Ingreso manual por DNI</span>
        </label>
        <form onSubmit={handleManual} className="flex gap-2">
          <input
            id="manual-dni-input"
            type="text"
            inputMode="numeric"
            value={manualDni}
            onChange={e => setManualDni(e.target.value.replace(/\D/g, ''))}
            placeholder="Número de DNI..."
            maxLength={10}
            aria-label="Número de DNI para registrar asistencia"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all"
          />
          <button
            type="submit"
            aria-label="Registrar asistencia por DNI manual"
            className="rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
          >
            Registrar
          </button>
        </form>
      </div>

      {/* Quick Search Student with '/' shortcut */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="roster-search-input" className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>Buscar alumno en padrón</span>
          </label>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-800 rounded">
            presioná /
          </kbd>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
          <input
            id="roster-search-input"
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Escribí nombre o DNI..."
            aria-label="Buscar alumno por nombre o número de DNI"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-[220px] overflow-y-auto" role="listbox" aria-label="Resultados de búsqueda">
            {searchResults.map(s => {
              const present = records.some(r => r.dni === s.dni && r.date === today)
              return (
                <div
                  key={s.dni}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-zinc-100 truncate">{s.nombre}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">DNI: {s.dni}</div>
                  </div>
                  {present ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded" role="status">
                        PRESENTE
                      </span>
                      <button
                        onClick={() => onDeleteAttendance(s.dni, today)}
                        aria-label={`Anular asistencia de ${s.nombre}`}
                        title="Anular asistencia de hoy"
                        className="p-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => registerDni(s.dni)}
                      aria-label={`Registrar asistencia de ${s.nombre}`}
                      className="text-[10px] font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
                    >
                      REGISTRAR
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Today's Attendance List with 1-click Delete/Undo */}
      {todayList.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-100 mb-2.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>Asistencias registradas hoy ({todayList.length})</span>
          </h3>
          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
            {todayList.slice().reverse().map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-850 text-xs hover:border-zinc-750 transition-colors"
              >
                <div className="truncate pr-2">
                  <span className="font-semibold text-zinc-200">{r.nombre}</span>
                  <span className="text-[10px] text-zinc-500 ml-2 font-mono">{r.dni}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[11px] text-zinc-400 font-mono">{r.time}</span>
                  <button
                    onClick={() => onDeleteAttendance(r.dni, r.date || today)}
                    aria-label={`Anular asistencia de ${r.nombre}`}
                    title="Anular esta asistencia"
                    className="p-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
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
  const [filterRiskOnly, setFilterRiskOnly] = useState(false)
  const matrixSearchRef = useRef(null)

  // Keyboard shortcut: '/' focuses search, 'Escape' clears
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        matrixSearchRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === matrixSearchRef.current) {
        setSearch('')
        matrixSearchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
    let list = matrix
    if (filterRiskOnly) {
      list = list.filter(s => s.pct < 80)
    }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(s => s.nombre.toLowerCase().includes(q) || s.dni.includes(q))
  }, [matrix, search, filterRiskOnly])

  const riskCount = useMemo(() => matrix.filter(s => s.pct < 80).length, [matrix])

  const handleExportXLSX = () => {
    if (!allDates.length) { showToast('error', 'No hay asistencias registradas para exportar.'); return }
    const headers = ['DNI', 'Libreta', 'Nombre y Apellido', ...allDates, 'Total Asistencias', '% Presentismo']
    const rows = matrix.map(s => [
      String(s.dni),
      String(s.libreta || ''),
      String(s.nombre || ''),
      ...allDates.map(d => s.perDate[d] ? '✓' : '—'),
      s.total,
      `${s.pct}%`
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Presentismo')
    XLSX.writeFile(wb, `presentismo_finanzasQR_${todayISO()}.xlsx`)
    showToast('ok', `Exportado archivo Excel (.xlsx) con ${roster.length} alumnos.`)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header card with Excel Export & search */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>Matriz Consolidada de Presentismo</span>
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {allDates.length} clase{allDates.length !== 1 ? 's' : ''} dictada{allDates.length !== 1 ? 's' : ''} • {roster.length} alumnos inscriptos
            </p>
          </div>

          <button
            onClick={handleExportXLSX}
            aria-label="Descargar matriz de asistencias en formato Excel"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Descargar Excel (.xlsx)</span>
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
          <input
            id="matrix-search-input"
            ref={matrixSearchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar matriz por nombre o DNI... (presioná /)"
            aria-label="Filtrar matriz de asistencias por nombre o DNI"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all"
          />
        </div>
      </div>

      {/* Summary chips with Interactive <80% Risk Filter */}
      {allDates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <div className="text-base font-extrabold font-mono text-zinc-100">{roster.length}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Alumnos</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
            <div className="text-base font-extrabold font-mono text-zinc-100">{allDates.length}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Clases</div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="text-base font-extrabold font-mono text-emerald-400">
              {roster.length > 0 ? Math.round(matrix.reduce((a, s) => a + s.pct, 0) / roster.length) : 0}%
            </div>
            <div className="text-[10px] text-emerald-300/80 mt-0.5">Promedio gral.</div>
          </div>

          {/* Interactive <80% Risk Filter Button */}
          <button
            onClick={() => setFilterRiskOnly(!filterRiskOnly)}
            aria-pressed={filterRiskOnly}
            aria-label="Filtrar únicamente alumnos en riesgo con asistencia menor al 80%"
            title="Filtrar solo alumnos en riesgo (<80% asistencia)"
            className={`rounded-xl border p-3 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              filterRiskOnly
                ? 'border-rose-500 bg-rose-500/20 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/20'
                : 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 hover:bg-rose-500/10'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <span className="text-base font-extrabold font-mono text-rose-400">{riskCount}</span>
              <Filter className={`h-3 w-3 ${filterRiskOnly ? 'text-rose-300' : 'text-rose-400/60'}`} aria-hidden="true" />
            </div>
            <div className="text-[10px] text-rose-300/80 mt-0.5">
              {filterRiskOnly ? 'Filtrando <80%' : '<80% (En riesgo)'}
            </div>
          </button>
        </div>
      )}

      {filterRiskOnly && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 animate-fade-in" role="status">
          <span>Mostrando solo alumnos con regularidad en riesgo (&lt;80% asistencia).</span>
          <button
            onClick={() => setFilterRiskOnly(false)}
            aria-label="Quitar filtro y ver todos los alumnos"
            className="font-bold underline hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 rounded"
          >
            Ver todos
          </button>
        </div>
      )}

      {/* Matrix Table */}
      {allDates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500 text-xs">
          No hay asistencias registradas aún. Escaneá códigos QR para poblar la matriz.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Matriz consolidada de presentismo">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-3.5 sticky left-0 bg-zinc-950 z-10">Alumno</th>
                  <th scope="col" className="py-3 px-3 font-mono">DNI</th>
                  {allDates.map(d => (
                    <th scope="col" key={d} className="py-3 px-2 text-center whitespace-nowrap font-mono">
                      {d.slice(5)}
                    </th>
                  ))}
                  <th scope="col" className="py-3 px-3 text-center font-mono">Total</th>
                  <th scope="col" className="py-3 px-3 text-center font-mono">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filtered.map(s => (
                  <tr key={s.dni} className="hover:bg-zinc-800/40 transition-colors">
                    <th scope="row" className="py-2.5 px-3.5 font-semibold text-zinc-100 whitespace-nowrap sticky left-0 bg-zinc-900/95 z-10 text-left font-normal">
                      {s.nombre}
                    </th>
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{s.dni}</td>
                    {allDates.map(d => (
                      <td key={d} className="py-2.5 px-2 text-center">
                        {s.perDate[d] ? (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-bold" aria-label={`Presente el ${d}`}>
                            ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-zinc-850 text-zinc-600 text-[11px]" aria-label={`Ausente el ${d}`}>
                            —
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-100">{s.total}</td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        s.pct >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-extrabold'
                      }`} aria-label={`Porcentaje de asistencia: ${s.pct}%`}>
                        <Percent className="h-2.5 w-2.5" aria-hidden="true" />
                        {s.pct}
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
