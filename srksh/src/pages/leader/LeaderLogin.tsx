import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Users } from 'lucide-react'
import { useHpl } from '../../lib/data'
import { useLeaderAuth } from '../../lib/leaderAuth'
import { Logo } from '../../components/Layout'
import { ColourDot, Spinner } from '../../components/ui'
import { useTitle } from '../../lib/useTitle'

export default function LeaderLogin() {
  useTitle('Team Leader Login · SRKSH HPL')
  const { session, login } = useLeaderAuth()
  const { data, loading } = useHpl()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }

  const [teamId, setTeamId] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // If already logged in, redirect to portal
  if (session) {
    return <Navigate to={loc.state?.from ?? '/leader'} replace />
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!teamId) {
      setErr('Please select your team.')
      return
    }
    if (!pin.trim()) {
      setErr('Please enter your team passcode.')
      return
    }

    setErr('')
    setBusy(true)

    try {
      await login(teamId, pin.trim())
      nav(loc.state?.from ?? '/leader', { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invalid passcode. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const selectedTeam = data.teams.find(t => t.id === teamId)

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream/70 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <form onSubmit={submit} className="card border border-sand/80 shadow-md" noValidate>
          <div className="mb-6 flex justify-center">
            <Link to="/" aria-label="Home">
              <Logo />
            </Link>
          </div>

          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-bark">
              <KeyRound className="h-3.5 w-3.5 text-terracotta" /> Team Leader Portal
            </span>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Captain & Leader Sign In</h1>
            <p className="mt-1 text-xs text-bark-soft sm:text-sm">
              Enter your team access passcode to register for sports and select your match squad.
            </p>
          </div>

          {err && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {err}
            </div>
          )}

          {loading ? (
            <div className="py-8">
              <Spinner />
            </div>
          ) : data.teams.length === 0 ? (
            <div className="rounded-xl bg-sand/30 p-4 text-center text-sm text-bark-soft">
              No teams found for the current HPL edition. Please check with the administrator.
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="label" htmlFor="team-select">
                  Select your team *
                </label>
                <div className="relative">
                  <select
                    id="team-select"
                    className="input pr-8"
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    required
                  >
                    <option value="">— Choose your team —</option>
                    {data.teams.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Captain: {t.captain_name})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedTeam && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-bark-soft">
                    <ColourDot colour={selectedTeam.colour} />
                    <span>
                      Captain: <strong>{selectedTeam.captain_name}</strong> · {selectedTeam.team_members?.length ?? 0} roster members
                    </span>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <label className="label !mb-0" htmlFor="pin">
                    Leader Passcode / PIN *
                  </label>
                </div>
                <div className="relative mt-1">
                  <input
                    id="pin"
                    type={showPin ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter team passcode"
                    className="input pr-10 font-mono tracking-wider"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-bark-soft hover:text-bark"
                    onClick={() => setShowPin(s => !s)}
                    aria-label={showPin ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-bark-faint">
                  Passcodes are assigned by the HPL committee. Ask an admin if you don't have yours.
                </p>
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={busy || !teamId || !pin.trim()}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Enter Leader Portal
                  </>
                )}
              </button>
            </>
          )}

          <div className="mt-6 border-t border-sand pt-4 text-center text-xs text-bark-soft">
            <span>Are you a site administrator? </span>
            <Link to="/admin/login" className="font-semibold text-terracotta hover:underline">
              Admin Login
            </Link>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-bark-faint">
          <Link to="/" className="hover:text-bark hover:underline">
            ← Back to SRKSH Home
          </Link>
        </p>
      </div>
    </div>
  )
}
