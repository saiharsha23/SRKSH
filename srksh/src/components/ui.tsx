import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ImageOff, Loader2, X, XCircle } from 'lucide-react'
import { isConfigured } from '../lib/supabase'

/* ---------- Toasts ---------- */
type Toast = { id: number; kind: 'success' | 'error'; msg: string }
const ToastCtx = createContext<(kind: Toast['kind'], msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], msg: string) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, kind, msg }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} role="status" className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-soft ring-1 ${t.kind === 'success' ? 'bg-white text-bark ring-emerald-300' : 'bg-white text-bark ring-red-300'}`}>
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Confirm dialog ---------- */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, busy }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) ref.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-bark/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cd-title">
      <div className="w-full max-w-md rounded-3xl bg-ivory p-6 shadow-soft">
        <div className="mb-3 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-terracotta" />
          <h2 id="cd-title" className="text-2xl font-semibold">{title}</h2>
        </div>
        <div className="mb-6 text-sm text-bark-soft">{message}</div>
        <div className="flex justify-end gap-3">
          <button ref={ref} className="btn-outline btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-danger btn-sm" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Modal ---------- */
export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-bark/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-3xl bg-ivory p-6 shadow-soft`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-sand"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Small pieces ---------- */
export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-bark-soft" role="status">
    <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">{label}</span>
  </div>
)

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
    <p>Something went wrong: {message}</p>
    {onRetry && <button onClick={onRetry} className="mt-2 font-semibold underline">Try again</button>}
  </div>
)

export const EmptyState = ({ title, text, action }: { title: string; text?: string; action?: ReactNode }) => (
  <div className="rounded-3xl border border-dashed border-gold/60 bg-cream/60 px-6 py-14 text-center">
    <h3 className="text-2xl font-semibold">{title}</h3>
    {text && <p className="mx-auto mt-2 max-w-md text-sm text-bark-soft">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
)

export function SetupNotice() {
  if (isConfigured) return null
  return (
    <div className="border-b border-saffron/40 bg-saffron-soft/60 px-5 py-3 text-center text-sm text-bark">
      <strong>Backend not configured.</strong> Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README) — until then no data can be loaded or saved.
    </div>
  )
}

export function Img({ src, alt, className = '', ratio }: { src: string | null; alt: string; className?: string; ratio?: string }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) {
    return (
      <div className={`flex items-center justify-center bg-sand/60 text-bark-faint ${className}`} style={ratio ? { aspectRatio: ratio } : undefined} role="img" aria-label={alt}>
        <ImageOff className="h-8 w-8" />
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBad(true)} className={className} style={ratio ? { aspectRatio: ratio } : undefined} />
}

export const Badge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-800', in_progress: 'bg-saffron-soft text-saffron-deep',
    upcoming: 'bg-sand text-bark-soft', pending: 'bg-sand text-bark-soft', active: 'bg-emerald-100 text-emerald-800',
  }
  const label: Record<string, string> = { in_progress: 'In Progress' }
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${map[status] ?? 'bg-sand'}`}>{label[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

export const SectionHead = ({ eyebrow, title, text, center }: { eyebrow?: string; title: string; text?: string; center?: boolean }) => (
  <div className={`mb-10 max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h2 className="h2">{title}</h2>
    {text && <p className="mt-4 text-bark-soft">{text}</p>}
  </div>
)

export const ColourDot = ({ colour }: { colour?: string | null }) => (
  <span className="inline-block h-3 w-3 rounded-full ring-1 ring-bark/20" style={{ background: colour || '#C2A15A' }} aria-hidden />
)
