import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  QrCode, Camera, CameraOff, Upload, Download, Search, Users, UserCheck,
  FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Volume2,
  VolumeX, BarChart3, GraduationCap, ScanLine, X, Clock, Percent,
  Cloud, CloudOff, RefreshCw, LogOut, Lock, Eye, EyeOff, WifiOff, ArrowLeft,
  Undo2, Trash2, Filter, Check, RotateCcw, AlertTriangle, ShieldCheck
} from 'lucide-react'

// ─── Configuration ──────────────────────────────────────────────────
const SHEETS_URL = (import.meta.env.VITE_SHEETS_API_URL || '').trim()
const PROF_USER = (import.meta.env.VITE_PROF_USER || 'admin').trim()
const PROF_PASS = (import.meta.env.VITE_PROF_PASS || 'docente2026').trim()
const FETCH_TIMEOUT_MS = 9000

// ─── Network Helper with Timeout ────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

// ─── Brandmark Vector Icon ──────────────────────────────────────────
function BrandQrIcon({ className = 'h-6 w-6', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M5,15v2H3V15ZM3,21H5V19H3Zm2-4v2H7V17Zm4-6H7v2H5v2H9ZM3,11v2H5V11Zm6,8H7v2h5V19H11V17H9ZM13,4H11V6h2Zm-2,7h2V8H11ZM4,9A1,1,0,0,1,3,8V4A1,1,0,0,1,4,3H8A1,1,0,0,1,9,4V8A1,1,0,0,1,8,9ZM5,7H7V5H5ZM21,4v8H19V9H16a1,1,0,0,1-1-1V4a1,1,0,0,1,1-1h4A1,1,0,0,1,21,4ZM19,5H17V7h2Zm2,11v4a1,1,0,0,1-1,1H16a1,1,0,0,1-1-1V17H11V13h2v2h1V11h2v4h4A1,1,0,0,1,21,16Zm-2,1H17v2h2Z" />
    </svg>
  )
}

// ─── Web Audio + Haptic Feedback ───────────────────────────────────
function beep(type) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'ok') navigator.vibrate(80)
      else if (type === 'dup') navigator.vibrate([70, 50, 70])
      else navigator.vibrate([140, 50, 140])
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
  } catch (_) { /* silence audio errors */ }
}

// ─── LocalStorage Resilience Helpers ────────────────────────────────
const load = (key, fallback) => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : fallback
  } catch (e) {
    console.warn(`LocalStorage read error for key "${key}":`, e)
    return fallback
  }
}

const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`LocalStorage write error for key "${key}":`, e)
  }
}

// ─── Date & String Format Helpers ──────────────────────────────────
const todayISO = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const nowTime = () => {
  try {
    return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }
}

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

// Safe percentage calculation preventing NaN or division by zero
const safePct = (attended, total) => {
  const numTotal = Number(total)
  const numAttended = Number(attended)
  if (!numTotal || numTotal <= 0 || isNaN(numAttended)) return 0
  return Math.max(0, Math.min(100, Math.round((numAttended / numTotal) * 100)))
}

// Pluralization in Spanish
const pluralize = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`

// ─── Offline Queue for Resilient POSTs ──────────────────────────────
const QUEUE_KEY = 'qr_offline_queue'
const MAX_QUEUE_SIZE = 500

function enqueue(record) {
  try {
    const q = load(QUEUE_KEY, [])
    const cleanDni = String(record.dni || '').replace(/\D/g, '').trim()
    const cleanDate = normalizeDate(record.date)
    // Avoid exact duplicate queued items
    const exists = q.some(item => 
      String(item.dni || '').replace(/\D/g, '').trim() === cleanDni && 
      normalizeDate(item.date) === cleanDate
    )
    if (!exists) {
      if (q.length >= MAX_QUEUE_SIZE) q.shift() // Cap queue size
      q.push({ ...record, dni: cleanDni, date: cleanDate })
      save(QUEUE_KEY, q)
    }
  } catch (e) {
    console.warn('Queue enqueue error:', e)
  }
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
      const res = await fetchWithTimeout(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', ...rec })
      }, 7000)
      if (!res.ok) {
        remaining.push(rec)
        continue
      }
      const data = await res.json()
      if (data.status !== 'ok' && data.status !== 'duplicate') {
        remaining.push(rec)
      }
    } catch {
      remaining.push(rec)
    }
  }
  save(QUEUE_KEY, remaining)
}

// ═══════════════════════════════════════════════════════════════════
//  REACT ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled exception:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-zinc-100">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-7 shadow-2xl text-center space-y-5 backdrop-blur-xl">
            <div className="mx-auto h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400" aria-hidden="true">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-100">Ocurrió un error inesperado</h1>
              <p className="text-xs text-zinc-400 mt-1">
                La aplicación protegió los datos guardados localmente. Podés recargar para restablecer la vista.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="rounded-xl bg-zinc-950 border border-zinc-850 p-3 text-left">
                <p className="text-[11px] font-mono text-rose-300/90 break-words line-clamp-3">
                  {String(this.state.error.message)}
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Recargar Aplicación</span>
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ═══════════════════════════════════════════════════════════════════
//  APP ROOT
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

function AppContent() {
  const [role, setRole] = useState(() => load('qr_role', null))
  const [authed, setAuthed] = useState(() => load('qr_authed', false))

  // Core Data
  const [roster, setRoster] = useState(() => load('qr_roster', []))
  const [records, setRecords] = useState(() => load('qr_records', []))

  // UI States
  const [soundOn, setSoundOn] = useState(() => load('qr_sound', true))
  const [toast, setToast] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(() => getQueueLength())
  const toastTimer = useRef(null)

  // Persist State
  useEffect(() => { save('qr_role', role) }, [role])
  useEffect(() => { save('qr_authed', authed) }, [authed])
  useEffect(() => { save('qr_roster', roster) }, [roster])
  useEffect(() => { save('qr_records', records) }, [records])
  useEffect(() => { save('qr_sound', soundOn) }, [soundOn])

  // Online / Offline Detection
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      flushQueue().then(() => setPendingCount(getQueueLength()))
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const showToast = useCallback((type, text, ms = 3500) => {
    clearTimeout(toastTimer.current)
    setToast({ type, text })
    toastTimer.current = setTimeout(() => setToast(null), ms)
  }, [])

  // ── Pull from Sheets with Intelligent Merge ──────────────────────
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
      const res = await fetchWithTimeout(`${SHEETS_URL}${sep}_t=${Date.now()}`, { cache: 'no-store' }, 8000)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      if (data?.status === 'ok') {
        if (Array.isArray(data.padron) && data.padron.length > 0) {
          setRoster(data.padron)
        }
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
        if (!silent) {
          const countAlumnos = data.padron?.length || 0
          const countAsist = data.records?.length || 0
          showToast('ok', `Sincronizado: ${pluralize(countAlumnos, 'alumno', 'alumnos')}, ${pluralize(countAsist, 'asistencia', 'asistencias')}.`)
        }
      } else {
        throw new Error(data?.message || 'Respuesta no válida de Sheets')
      }
    } catch (err) {
      console.warn('Sync error:', err)
      if (!silent) showToast('error', 'Sin conexión con Google Sheets. Operando en modo local.')
    } finally {
      setIsSyncing(false)
      setPendingCount(getQueueLength())
    }
  }, [showToast])

  // Auto-sync on professor login
  useEffect(() => {
    if (role === 'profesor' && authed && SHEETS_URL) {
      pullFromSheets(true)
    }
  }, [role, authed, pullFromSheets])

  // Polling every 30s + visibilitychange / focus for multi-device sync
  useEffect(() => {
    if (role !== 'profesor' || !authed || !SHEETS_URL) return

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        pullFromSheets(true)
      }
    }, 30000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        pullFromSheets(true)
      }
    }
    const handleFocus = () => {
      if (navigator.onLine) pullFromSheets(true)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [role, authed, pullFromSheets])

  // ── Push single attendance to Sheets ─────────────────────────────
  const pushToSheets = useCallback(async (rec) => {
    if (!SHEETS_URL) return
    try {
      const res = await fetchWithTimeout(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', ...rec })
      }, 7000)

      if (!res.ok) {
        enqueue(rec)
        setPendingCount(getQueueLength())
        return
      }

      const data = await res.json()
      if (data.status === 'duplicate') {
        // Already recorded remotely
      } else if (data.status !== 'ok') {
        enqueue(rec)
        setPendingCount(getQueueLength())
      }
    } catch {
      enqueue(rec)
      setPendingCount(getQueueLength())
    }
  }, [])

  // ── Delete / Undo attendance ─────────────────────────────────────
  const deleteAttendance = useCallback(async (dni, date) => {
    const cleanDni = String(dni || '').replace(/\D/g, '').trim()
    const cleanDate = normalizeDate(date)

    // Optimistic local state removal
    setRecords(prev => prev.filter(r => !(String(r.dni).replace(/\D/g, '').trim() === cleanDni && normalizeDate(r.date) === cleanDate)))
    showToast('ok', 'Asistencia anulada correctamente.')

    if (!SHEETS_URL) return
    try {
      await fetchWithTimeout(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete_attendance', dni: cleanDni, date: cleanDate })
      }, 7000)
    } catch (err) {
      console.warn('Error deleting attendance remotely:', err)
    }
  }, [showToast])

  // ── Push roster to Sheets ────────────────────────────────────────
  const pushRosterToSheets = useCallback(async (newRoster) => {
    if (!SHEETS_URL) return
    setIsSyncing(true)
    try {
      const res = await fetchWithTimeout(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sync_padron', padron: newRoster })
      }, 10000)
      const data = await res.json()
      if (data?.status === 'ok') {
        showToast('ok', `Padrón (${pluralize(newRoster.length, 'alumno', 'alumnos')}) guardado en Sheets.`)
      }
    } catch (err) {
      console.warn('Roster push error:', err)
      showToast('error', 'Error al guardar el padrón en Google Sheets.')
    } finally {
      setIsSyncing(false)
    }
  }, [showToast])

  const logout = () => {
    setAuthed(false)
    setRole(null)
  }

  // ── Role Selection Screen ────────────────────────────────────────
  if (!role) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 overflow-x-hidden">
        <div className="w-full max-w-sm space-y-7 text-center">
          {/* Logo Brandmark */}
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl" aria-hidden="true">
            <BrandQrIcon className="h-8 w-8 text-emerald-400" />
          </div>

          <div>
            <h1 className="text-[2rem] leading-9 font-extrabold text-zinc-100 tracking-tight">finanzasQR</h1>
            <p className="text-xs text-zinc-400 mt-1">Control de asistencia universitario</p>
          </div>

          <div className="grid gap-3 pt-1">
            <button
              onClick={() => setRole('profesor')}
              aria-label="Ingresar como Docente para escanear QR y gestionar asistencia"
              className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0" aria-hidden="true">
                  <GraduationCap className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors truncate">Soy Docente</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 truncate">Escanear QR y gestionar asistencia</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-zinc-300 font-mono pl-2" aria-hidden="true">→</span>
            </button>

            <button
              onClick={() => setRole('alumno')}
              aria-label="Ingresar como Alumno/a para generar y descargar código QR"
              className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0" aria-hidden="true">
                  <BrandQrIcon className="h-5 w-5 text-zinc-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-zinc-100 group-hover:text-zinc-200 transition-colors truncate">Soy Alumno/a</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 truncate">Generar y descargar mi código QR</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-zinc-500 group-hover:text-zinc-300 font-mono pl-2" aria-hidden="true">→</span>
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

  if (role === 'alumno') {
    return <AlumnoView onBack={() => setRole(null)} />
  }

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
    const cleanUser = user.trim()
    if (cleanUser === PROF_USER && pass === PROF_PASS) {
      onSuccess()
    } else {
      setError('Credenciales incorrectas. Verificá tu usuario y contraseña.')
      setShake(true)
      beep('err')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 overflow-x-hidden">
      <div className={`w-full max-w-sm ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-7 shadow-2xl backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3" aria-hidden="true">
              <Lock className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100">Acceso Docente</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Ingresá para tomar asistencia y consultar métricas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                autoCapitalize="none"
                spellCheck="false"
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-base sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all font-sans"
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
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-base sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                  aria-pressed={showPass}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2" role="alert">
                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              Ingresar al Panel
            </button>
          </form>

          <button
            onClick={onBack}
            aria-label="Volver a la selección de roles"
            className="w-full mt-4 text-xs text-zinc-500 hover:text-zinc-300 text-center py-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded cursor-pointer"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  ALUMNO VIEW (PUBLIC CREDENTIAL & ACADEMIC SITUATION)
// ═══════════════════════════════════════════════════════════════════
function AlumnoView({ onBack }) {
  const [rawDni, setRawDni] = useState(() => load('qr_alumno_dni', ''))
  const [downloaded, setDownloaded] = useState(false)
  const [studentStatus, setStudentStatus] = useState(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [statusError, setStatusError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const qrRef = useRef(null)

  useEffect(() => { save('qr_alumno_dni', rawDni) }, [rawDni])

  // Fetch real-time student attendance status from Google Sheets
  const fetchStatus = useCallback(async (dniToFetch) => {
    const cleanDni = String(dniToFetch || '').replace(/\D/g, '').trim()
    if (cleanDni.length !== 8 || !SHEETS_URL) {
      setStudentStatus(null)
      setStatusError(null)
      return
    }

    setIsLoadingStatus(true)
    setStatusError(null)

    try {
      const sep = SHEETS_URL.includes('?') ? '&' : '?'
      const res = await fetchWithTimeout(`${SHEETS_URL}${sep}action=student_status&dni=${cleanDni}&_t=${Date.now()}`, { cache: 'no-store' }, 8000)
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      const data = await res.json()
      if (data.status === 'ok') {
        setStudentStatus(data)
      } else {
        setStudentStatus(null)
      }
    } catch (err) {
      console.warn('Error fetching student status:', err)
      setStatusError('No se pudo conectar con el servidor para consultar tu presentismo.')
    } finally {
      setIsLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStatus(rawDni)
    }, 400)
    return () => clearTimeout(timer)
  }, [rawDni, fetchStatus])

  const handleDownload = async () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const size = 800
    canvas.width = size
    canvas.height = size
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const img = new Image()

    img.onload = () => {
      ctx2d.fillStyle = '#ffffff'
      ctx2d.fillRect(0, 0, size, size)
      ctx2d.drawImage(img, 0, 0, size, size)

      const cleanDni = rawDni.replace(/\D/g, '').trim()
      const fileName = `QR_${cleanDni || 'credencial'}.png`

      canvas.toBlob(async (blob) => {
        if (!blob) return

        // 1. Mobile Share Sheet if available
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' })
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: `Credencial finanzasQR - DNI ${formatDniDisplay(cleanDni)}`
              })
              setDownloaded(true)
              setTimeout(() => setDownloaded(false), 2500)
              return
            }
          } catch (err) {
            if (err.name === 'AbortError') return
          }
        }

        // 2. Direct browser download fallback
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.download = fileName
        a.href = blobUrl
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500)
        setDownloaded(true)
        setTimeout(() => setDownloaded(false), 2500)
      }, 'image/png')
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleDniChange = (e) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 10)
    setRawDni(clean)
  }

  const cleanDni = rawDni.replace(/\D/g, '').trim()
  const isValidDni = cleanDni.length === 8

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100 overflow-x-hidden">
      {/* Minimal Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            aria-label="Volver a la selección de roles"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver</span>
          </button>
          <div className="text-xs font-bold text-zinc-200">Credencial Digital</div>
          <div className="w-12" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 safe-bottom">
        <div className="w-full max-w-sm space-y-4">
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
            <>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl space-y-5 text-center">
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
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-lg transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer ${
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
                      <span>Descargar o Guardar Pase</span>
                    </>
                  )}
                </button>
              </div>

              {/* Real-time Student Attendance Status Card */}
              {SHEETS_URL && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl space-y-3.5">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Mi Situación Académica</h2>
                    </div>
                    {isLoadingStatus && (
                      <span className="text-[10px] text-zinc-500 font-mono animate-pulse">Consultando...</span>
                    )}
                  </div>

                  {statusError ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
                      <p className="text-xs text-rose-300">{statusError}</p>
                      <button
                        onClick={() => fetchStatus(rawDni)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 underline hover:text-white"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        <span>Reintentar</span>
                      </button>
                    </div>
                  ) : studentStatus && studentStatus.totalClasses > 0 ? (
                    <div className="space-y-3">
                      {studentStatus.student && (
                        <div className="text-xs text-zinc-300 font-semibold truncate" title={studentStatus.student.nombre}>
                          {studentStatus.student.nombre}
                          {studentStatus.student.libreta && (
                            <span className="text-zinc-500 font-mono text-[11px] ml-2">({studentStatus.student.libreta})</span>
                          )}
                        </div>
                      )}

                      {/* 2 Big Stat Cards */}
                      <div className="grid grid-cols-2 gap-2.5 text-center">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                          <div className={`text-2xl font-extrabold font-mono ${studentStatus.isRegular ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {studentStatus.percentage}%
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">Presentismo</div>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                          <div className="text-2xl font-extrabold font-mono text-zinc-100">
                            {studentStatus.attendedClasses}
                            <span className="text-sm font-normal text-zinc-500">/{studentStatus.totalClasses}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">Clases Asistidas</div>
                        </div>
                      </div>

                      {/* Regularity Badge */}
                      <div className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${
                        studentStatus.isRegular
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      }`}>
                        {studentStatus.isRegular ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
                            <span>Condición: Regular (≥80% asistencia)</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" aria-hidden="true" />
                            <span>Condición: En riesgo (&lt;80% asistencia)</span>
                          </>
                        )}
                      </div>

                      {/* Expandable History Details */}
                      {Array.isArray(studentStatus.history) && studentStatus.history.length > 0 && (
                        <div className="pt-1">
                          <button
                            onClick={() => setShowHistory(!showHistory)}
                            aria-expanded={showHistory}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 font-semibold transition-colors cursor-pointer"
                          >
                            <span>Detalle por clase ({studentStatus.history.length})</span>
                            <span className="text-xs text-zinc-500 font-mono">{showHistory ? '▲' : '▼'}</span>
                          </button>

                          {showHistory && (
                            <div className="mt-2 space-y-1 max-h-[160px] overflow-y-auto pr-1">
                              {studentStatus.history.map((h, idx) => (
                                <div
                                  key={h.date || idx}
                                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-850 text-xs"
                                >
                                  <div className="font-mono text-zinc-300">
                                    <span className="text-zinc-500 font-bold mr-2">C{idx + 1}</span>
                                    <span>{h.date}</span>
                                  </div>
                                  {h.attended ? (
                                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      ✓ PRESENTE
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                                      — AUSENTE
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isLoadingStatus ? (
                    <div className="py-4 text-center text-xs text-zinc-500 font-mono">
                      Cargando datos de presentismo...
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-zinc-500">
                      {studentStatus?.inPadron === false
                        ? 'El DNI no figura en el padrón de la materia.'
                        : 'Aún no hay clases registradas en el sistema.'}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-2 text-zinc-500">
              <BrandQrIcon className="h-10 w-10 mx-auto opacity-30 text-zinc-500" aria-hidden="true" />
              <p className="text-xs">
                {cleanDni.length === 0
                  ? 'Ingresá los 8 dígitos de tu DNI para generar tu código QR y consultar tu presentismo.'
                  : cleanDni.length < 8
                    ? `Ingresá los 8 dígitos de tu DNI (llevás ${cleanDni.length} de 8).`
                    : `El DNI debe tener exactamente 8 dígitos (ingresaste ${cleanDni.length}).`}
              </p>
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
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!Array.isArray(res.data) || res.data.length === 0) {
          showToast('error', 'El archivo CSV está vacío.')
          return
        }
        const parsed = res.data.map(r => {
          const dni = String(r.DNI || r.dni || r.Documento || r.documento || '').replace(/\D/g, '').trim()
          const libreta = String(r.Libreta || r.libreta || r.Legajo || r.legajo || '').trim()
          const nombre = String(r.Nombre_Apellido || r.nombre_apellido || r.Nombre || r.nombre || r.Name || r.name || '').trim()
          if (!dni || !nombre) return null
          return { dni, libreta, nombre }
        }).filter(Boolean)

        if (!parsed.length) {
          showToast('error', 'CSV sin columnas válidas (se requiere DNI y Nombre_Apellido).')
          return
        }
        setRoster(parsed)
        showToast('ok', `Padrón cargado: ${pluralize(parsed.length, 'alumno', 'alumnos')}.`)
        onPushRoster(parsed)
      },
      error: (err) => {
        console.warn('CSV Parse error:', err)
        showToast('error', 'Error al procesar el archivo CSV.')
      }
    })
    e.target.value = ''
  }

  // Register attendance (instant optimistic update)
  const registerDni = useCallback((rawDni) => {
    const dni = String(rawDni || '').replace(/\D/g, '').trim()
    if (!dni) return
    const curRoster = rosterRef.current
    const curRecords = recordsRef.current
    const snd = soundRef.current

    const student = curRoster.find(s => String(s.dni).replace(/\D/g, '').trim() === dni)
    if (!student) {
      if (snd) beep('err')
      showToast('error', `DNI ${formatDniDisplay(dni)} no figura en el padrón.`)
      setLastScan({ type: 'error', text: `DNI ${formatDniDisplay(dni)} no está en el padrón`, dni })
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
    <div className="min-h-screen bg-zinc-950 flex flex-col text-zinc-100 overflow-x-hidden">
      {/* Top Header */}
      <header className="print-hidden sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0" aria-hidden="true">
              <BrandQrIcon className="h-4 w-4 text-emerald-400" />
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

            {/* Offline queue indicator & manual retry */}
            {pendingCount > 0 && (
              <button
                onClick={() => {
                  flushQueue().then(() => onPull(false))
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold font-mono text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 animate-pulse transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                title={`${pendingCount} asistencia(s) en cola local. Hacé clic para reintentar sincronizar.`}
                role="status"
                aria-label={`${pendingCount} asistencias pendientes de sincronización. Clic para forzar envío.`}
              >
                <CloudOff className="h-3 w-3" aria-hidden="true" />
                <span>{pendingCount}</span>
              </button>
            )}

            {/* Sync button */}
            {SHEETS_URL && (
              <button
                onClick={() => onPull(false)}
                disabled={isSyncing}
                aria-label="Sincronizar datos con Google Sheets"
                title="Sincronizar ahora"
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} aria-hidden="true" />
              </button>
            )}

            {/* Sound toggle */}
            <button
              onClick={() => setSoundOn(!soundOn)}
              aria-label={soundOn ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
              aria-pressed={soundOn}
              title={soundOn ? 'Silenciar' : 'Activar sonido'}
              className={`p-2 rounded-lg transition-colors border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer ${
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
              className="p-2 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-zinc-900 border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 cursor-pointer"
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
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer ${
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

      {/* Floating Toast Notification with A11y Live Region */}
      <div className="print-hidden fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md pointer-events-none" aria-live="polite">
        {toast && (
          <div className="pointer-events-auto" role="alert">
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl border text-xs font-semibold backdrop-blur-xl ${
              toast.type === 'ok'  ? 'bg-zinc-900/95 border-emerald-500/40 text-emerald-300' :
              toast.type === 'dup' ? 'bg-zinc-900/95 border-amber-500/40 text-amber-300' :
                                     'bg-zinc-900/95 border-rose-500/40 text-rose-300'
            }`}>
              {toast.type === 'ok'  && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />}
              {toast.type === 'dup' && <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />}
              {toast.type === 'error' && <XCircle    className="h-4 w-4 text-rose-400 shrink-0" aria-hidden="true" />}
              <span className="flex-1 truncate">{toast.text}</span>
              <button
                onClick={() => setToast(null)}
                aria-label="Cerrar notificación"
                className="shrink-0 text-zinc-500 hover:text-zinc-200 p-0.5 rounded cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-4 safe-bottom">
        {/* Roster Overview Bar */}
        <div className="print-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Users className="h-4 w-4 text-zinc-400" aria-hidden="true" />
              <span className="text-zinc-400">Padrón:</span>
              <span className="font-mono font-bold text-zinc-100">{roster.length}</span>
              <span className="text-zinc-500">{roster.length === 1 ? 'alumno' : 'alumnos'}</span>
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer disabled:opacity-50"
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

// ── Empty Roster Placeholder ─────────────────────────────────────
function EmptyRosterHint({ hasSheets, onPull }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center space-y-4">
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
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
        >
          <Cloud className="h-4 w-4" aria-hidden="true" />
          <span>Cargar desde Google Sheets</span>
        </button>
      )}

      <div className="inline-block rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-400 font-mono text-left max-w-full overflow-x-auto">
        DNI,Libreta,Nombre_Apellido<br/>
        44102931,LU-2024-01,Agustina Belén Morales<br/>
        43890123,LU-2024-02,Benjamín Ignacio Castro
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  SCAN TAB (CAMERA & MANUAL REGISTRATION)
// ═══════════════════════════════════════════════════════════════════
function ScanTab({ roster, records, registerDni, onDeleteAttendance, todayCount, totalRoster, lastScan, setLastScan }) {
  const [scanning, setScanning] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [manualDni, setManualDni] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const scannerRef = useRef(null)
  const searchInputRef = useRef(null)
  const containerId = 'qr-reader'
  const processingRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) scannerRef.current.stop()
          scannerRef.current.clear()
        } catch (_) {}
      }
    }
  }, [])

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
    setCameraError(null)

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
          registerDni(String(text).replace(/\D/g, '').trim())
          setTimeout(() => { processingRef.current = false }, 2500)
        }

        let started = false
        for (const c of [{ facingMode: 'environment' }, { facingMode: 'user' }, null]) {
          if (started || cancelled) break
          try {
            if (c) {
              await qr.start(c, cfg, onOk, () => {})
            } else {
              const cams = await Html5Qrcode.getCameras()
              if (cams && cams.length > 0) {
                await qr.start(cams[0].id, cfg, onOk, () => {})
              } else {
                throw new Error('No se detectaron cámaras en el dispositivo')
              }
            }
            started = true
          } catch (e) {
            console.warn('Cam retry step failed:', e)
          }
        }

        if (!started) throw new Error('No se pudo inicializar la cámara.')

        const vid = document.querySelector(`#${containerId} video`)
        if (vid) {
          vid.setAttribute('playsinline', 'true')
          vid.setAttribute('webkit-playsinline', 'true')
        }
        if (!cancelled) setScanning(true)
      } catch (err) {
        console.error('Camera startup error:', err)
        if (!cancelled) {
          setContainerReady(false)
          setCameraError('No se pudo acceder a la cámara. Verificá que los permisos estén habilitados en tu navegador.')
        }
      }
    }

    const t = setTimeout(boot, 150)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [containerReady, registerDni])

  const startScanner = async () => {
    if (scannerRef.current) await stopScanner()
    setCameraError(null)
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
    const clean = manualDni.replace(/\D/g, '').trim()
    if (clean) {
      registerDni(clean)
      setManualDni('')
    }
  }

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return []
    return roster
      .filter(s => s.nombre.toLowerCase().includes(q) || String(s.dni).includes(q) || String(s.libreta || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [roster, searchTerm])

  const today = todayISO()
  const todayList = useMemo(() => records.filter(r => normalizeDate(r.date) === today), [records, today])
  const pct = safePct(todayCount, totalRoster)

  return (
    <div className="space-y-4">
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
          <div key={todayCount} className="text-xl font-extrabold font-mono text-emerald-400">
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
                Iniciá la cámara para escanear continuamente los códigos QR de los estudiantes en el aula.
              </p>
              {cameraError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 max-w-xs">
                  {cameraError}
                </div>
              )}
              <button
                onClick={startScanner}
                aria-label="Iniciar cámara para escanear códigos QR"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
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
              className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer"
            >
              <CameraOff className="h-3 w-3" aria-hidden="true" />
              <span>Detener</span>
            </button>
          )}

          {/* ⚡ Live Scanned Overlay Banner with Undo Action */}
          {lastScan && (
            <div className="absolute inset-x-3 bottom-3 z-20" role="status" aria-live="assertive">
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
                      <p className="font-bold text-xs text-zinc-100 truncate" title={lastScan.student ? lastScan.student.nombre : `DNI ${lastScan.dni}`}>
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
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 cursor-pointer"
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
            aria-label="Número de DNI para registrar asistencia manual"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-base sm:text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all"
          />
          <button
            type="submit"
            aria-label="Registrar asistencia por DNI manual"
            className="rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer shrink-0"
          >
            Registrar
          </button>
        </form>
      </div>

      {/* Quick Search Student with '/' Shortcut */}
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
            type="search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Escribí nombre, DNI o libreta..."
            aria-label="Buscar alumno por nombre, DNI o libreta"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-8 py-2 text-base sm:text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {searchTerm.trim() && searchResults.length === 0 && (
          <div className="mt-3 p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-center text-xs text-zinc-500">
            No se encontraron alumnos para &ldquo;<span className="text-zinc-300 font-semibold">{searchTerm}</span>&rdquo;.
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-[220px] overflow-y-auto" role="listbox" aria-label="Resultados de búsqueda">
            {searchResults.map(s => {
              const present = records.some(r => String(r.dni).replace(/\D/g, '').trim() === String(s.dni).replace(/\D/g, '').trim() && normalizeDate(r.date) === today)
              return (
                <div
                  key={s.dni}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-zinc-100 truncate" title={s.nombre}>{s.nombre}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      DNI: {formatDniDisplay(s.dni)} {s.libreta && `• ${s.libreta}`}
                    </div>
                  </div>
                  {present ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded" role="status">
                        PRESENTE
                      </span>
                      <button
                        onClick={() => onDeleteAttendance(s.dni, today)}
                        aria-label={`Anular asistencia de ${s.nombre}`}
                        title="Anular asistencia de hoy"
                        className="p-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => registerDni(s.dni)}
                      aria-label={`Registrar asistencia de ${s.nombre}`}
                      className="text-[10px] font-bold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 cursor-pointer"
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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-100 mb-2.5 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          <span>Asistencias registradas hoy ({todayList.length})</span>
        </h3>
        {todayList.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3 text-center">
            Aún no hay asistencias registradas hoy. Iniciá la cámara o ingresá un DNI arriba.
          </p>
        ) : (
          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
            {todayList.slice().reverse().map((r, i) => (
              <div
                key={`${r.dni}_${r.time}_${i}`}
                className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-850 text-xs hover:border-zinc-750 transition-colors"
              >
                <div className="truncate pr-2 min-w-0" title={r.nombre}>
                  <span className="font-semibold text-zinc-200 truncate">{r.nombre}</span>
                  <span className="text-[10px] text-zinc-500 ml-2 font-mono">{formatDniDisplay(r.dni)}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[11px] text-zinc-400 font-mono">{r.time}</span>
                  <button
                    onClick={() => onDeleteAttendance(r.dni, r.date || today)}
                    aria-label={`Anular asistencia de ${r.nombre}`}
                    title="Anular esta asistencia"
                    className="p-1 rounded text-zinc-400 hover:text-rose-300 hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  REPORT TAB (CONSOLIDATED ATTENDANCE MATRIX & EXCEL EXPORT)
// ═══════════════════════════════════════════════════════════════════
function ReportTab({ roster, records, showToast }) {
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

  const allDates = useMemo(() => {
    const unique = Array.from(new Set(records.map(r => normalizeDate(r.date)).filter(Boolean)))
    return unique.sort()
  }, [records])

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
      const pct = safePct(cnt, total)
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
    return list.filter(s => s.nombre.toLowerCase().includes(q) || String(s.dni).includes(q) || String(s.libreta || '').toLowerCase().includes(q))
  }, [matrix, search, filterRiskOnly])

  const riskCount = useMemo(() => matrix.filter(s => s.pct < 80).length, [matrix])

  const handleExportXLSX = () => {
    if (!allDates.length) {
      showToast('error', 'No hay asistencias registradas para exportar.')
      return
    }
    const headers = [
      'DNI',
      'Libreta',
      'Nombre y Apellido',
      ...allDates.map((d, idx) => `Clase ${idx + 1} (${d})`),
      'Total Asistencias',
      '% Presentismo'
    ]
    const rows = matrix.map(s => [
      String(s.dni),
      String(s.libreta || ''),
      String(s.nombre || ''),
      ...allDates.map(d => s.perDate[d] ? 'PRESENTE' : 'AUSENTE'),
      Number(s.total),
      `${s.pct}%`
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Presentismo')
    XLSX.writeFile(wb, `presentismo_finanzasQR_${todayISO()}.xlsx`)
    showToast('ok', `Exportado archivo Excel (.xlsx) con ${pluralize(roster.length, 'alumno', 'alumnos')}.`)
  }

  return (
    <div className="space-y-4">
      {/* Header Card with Excel Export & Search */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>Matriz Consolidada de Presentismo</span>
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {pluralize(allDates.length, 'clase dictada', 'clases dictadas')} • {pluralize(roster.length, 'alumno inscripto', 'alumnos inscriptos')}
            </p>
          </div>

          <button
            onClick={handleExportXLSX}
            aria-label="Descargar matriz de asistencias en formato Excel"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer shrink-0"
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
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar matriz por nombre, DNI o libreta... (presioná /)"
            aria-label="Filtrar matriz de asistencias por nombre, DNI o libreta"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-8 py-2 text-base sm:text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/80 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Limpiar filtro de matriz"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Chips with Interactive <80% Risk Filter */}
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
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300" role="status">
          <span>Mostrando solo alumnos con regularidad en riesgo (&lt;80% asistencia).</span>
          <button
            onClick={() => setFilterRiskOnly(false)}
            aria-label="Quitar filtro y ver todos los alumnos"
            className="font-bold underline hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 rounded cursor-pointer"
          >
            Ver todos
          </button>
        </div>
      )}

      {/* Matrix Table */}
      {allDates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500 text-xs">
          No hay asistencias registradas aún. Escaneá códigos QR para poblar la matriz de asistencia.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500 text-xs space-y-2">
          <p>
            {filterRiskOnly
              ? 'No hay alumnos con asistencia menor al 80% en este momento.'
              : `No se encontraron alumnos para "${search}".`}
          </p>
          {(search || filterRiskOnly) && (
            <button
              onClick={() => { setSearch(''); setFilterRiskOnly(false) }}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 underline hover:text-emerald-300 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Restablecer filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Matriz consolidada de presentismo">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-3.5 sticky left-0 bg-zinc-950 z-10 min-w-[140px]">Alumno</th>
                  <th scope="col" className="py-3 px-3 font-mono whitespace-nowrap">DNI</th>
                  {allDates.map((d, idx) => (
                    <th scope="col" key={d} className="py-2.5 px-2.5 text-center whitespace-nowrap font-mono">
                      <div className="text-[10px] text-emerald-400 font-extrabold tracking-tight">C{idx + 1}</div>
                      <div className="text-[11px] text-zinc-300">{d.slice(5)}</div>
                    </th>
                  ))}
                  <th scope="col" className="py-3 px-3 text-center font-mono whitespace-nowrap">Total</th>
                  <th scope="col" className="py-3 px-3 text-center font-mono whitespace-nowrap">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filtered.map(s => (
                  <tr key={s.dni} className="hover:bg-zinc-800/40 transition-colors">
                    <th scope="row" className="py-2.5 px-3.5 font-semibold text-zinc-100 whitespace-nowrap sticky left-0 bg-zinc-900/95 z-10 text-left truncate max-w-[200px]" title={s.nombre}>
                      {s.nombre}
                    </th>
                    <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">{formatDniDisplay(s.dni)}</td>
                    {allDates.map(d => (
                      <td key={d} className="py-2.5 px-2 text-center whitespace-nowrap">
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
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-100 whitespace-nowrap">{s.total}</td>
                    <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
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
