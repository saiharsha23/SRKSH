import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase, isConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Logo } from '../../components/Layout'
import { useTitle } from '../../lib/useTitle'

export default function Login() {
  useTitle('Admin login · SRKSH')
  const { session, isAdmin } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (session && isAdmin) return <Navigate to={loc.state?.from ?? '/admin'} replace />

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr('Sign-in failed. Check your email and password.')
    else nav(loc.state?.from ?? '/admin', { replace: true })
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream/70 p-5">
      <form onSubmit={submit} className="card w-full max-w-sm" noValidate>
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="mb-1 text-center text-3xl font-semibold">Admin sign in</h1>
        <p className="mb-6 text-center text-sm text-bark-soft">Authorised administrators only.</p>
        {!isConfigured && <p className="mb-4 rounded-xl bg-saffron-soft/60 p-3 text-sm">Backend not configured — see README.</p>}
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" required className="input mb-4" value={email} onChange={e => setEmail(e.target.value)} />
        <label className="label" htmlFor="pw">Password</label>
        <input id="pw" type="password" autoComplete="current-password" required className="input mb-4" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <p role="alert" className="mb-4 text-sm text-red-700">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || !isConfigured || !email || !password}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in</button>
        {session && !isAdmin && <p className="mt-4 text-center text-xs text-red-700">This account is not an admin.</p>}
      </form>
    </div>
  )
}
