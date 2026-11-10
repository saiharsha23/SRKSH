import { useState, useEffect } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Key,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Settings2,
  Share2,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react'
import type {
  Sport,
  Team,
  SiteSettings,
  WhatsAppRecipient,
  WhatsAppApiSettings,
  WhatsAppApiProvider,
} from '../types'
import {
  cleanWhatsAppPhone,
  createWhatsAppChatUrl,
  createWhatsAppShareUrl,
  formatSportWhatsAppMessage,
  getWhatsAppApiSettings,
  saveWhatsAppApiSettings,
  testWhatsAppApiConnection,
  getWhatsAppRecipients,
  saveWhatsAppRecipient,
  sendWhatsAppMessageViaApi,
} from '../lib/whatsapp'
import { ColourDot, Modal, useToast } from './ui'
import { isDeadlinePassed } from '../lib/format'

interface Props {
  sport: Sport
  teams: Team[]
  siteSettings?: Partial<SiteSettings>
  onClose: () => void
}

interface ApiStatus {
  status: 'sending' | 'sent' | 'failed'
  error?: string
}

export default function WhatsAppBroadcastModal({ sport, teams, siteSettings, onClose }: Props) {
  const toast = useToast()
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(true)
  const [customNote, setCustomNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [sentSet, setSentSet] = useState<Set<string>>(new Set())

  // WhatsApp API Settings & Status
  const [apiSettings, setApiSettings] = useState<WhatsAppApiSettings | null>(null)
  const [apiSendingAll, setApiSendingAll] = useState(false)
  const [apiProgress, setApiProgress] = useState<{ current: number; total: number } | null>(null)
  const [apiStatusMap, setApiStatusMap] = useState<Record<string, ApiStatus>>({})

  // Inline Quick Meta API Configuration Form state
  const [showApiConfig, setShowApiConfig] = useState(false)
  const [inlinePhoneId, setInlinePhoneId] = useState('')
  const [inlineToken, setInlineToken] = useState('')
  const [savingInlineApi, setSavingInlineApi] = useState(false)
  const [testingInlineApi, setTestingInlineApi] = useState(false)
  const [inlineTestResult, setInlineTestResult] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  // Inline add recipient
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState('Coordinator')
  const [savingNew, setSavingNew] = useState(false)

  // Load API settings & recipients on mount
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [recipList, settings] = await Promise.all([
          getWhatsAppRecipients(),
          getWhatsAppApiSettings(),
        ])
        if (active) {
          setRecipients(recipList)
          setApiSettings(settings)
          if (settings) {
            setInlinePhoneId(settings.phone_number_id || '')
            setInlineToken(settings.access_token || '')
          }
        }
      } catch (err) {
        console.error('Failed to load WhatsApp broadcast settings:', err)
      } finally {
        if (active) setLoadingRecipients(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  // Ask coordinator details on the page rather than hardcoding (pre-fills with +91 9019047149 or last entered)
  const [coordinatorPhone, setCoordinatorPhone] = useState(() => {
    try {
      return (
        localStorage.getItem('srksh_last_coordinator_phone') ||
        siteSettings?.whatsapp_sender_phone ||
        '+91 9019047149'
      )
    } catch {
      return '+91 9019047149'
    }
  })
  const [coordinatorName, setCoordinatorName] = useState(() => {
    try {
      return localStorage.getItem('srksh_last_coordinator_name') || ''
    } catch {
      return ''
    }
  })

  const message = formatSportWhatsAppMessage(sport, { customNote, coordinatorPhone, coordinatorName })

  function copyMessage() {
    navigator.clipboard.writeText(message)
    setCopied(true)
    toast('success', 'Announcement text copied to clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  // 1-Click WhatsApp Web / Desktop chat link
  function handleManualSend(id: string, phone: string) {
    setSentSet(prev => new Set(prev).add(id))
    const url = createWhatsAppChatUrl(phone, message)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleGeneralShare() {
    const url = createWhatsAppShareUrl(message)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Single recipient send via WhatsApp API (1-Tap)
  async function handleSendOneViaApi(id: string, phone: string, name: string) {
    if (!apiSettings || apiSettings.provider === 'none') {
      setShowApiConfig(true)
      toast('error', 'Please configure your WhatsApp API first to enable 1-tap sending.')
      return
    }

    setApiStatusMap(prev => ({ ...prev, [id]: { status: 'sending' } }))

    const result = await sendWhatsAppMessageViaApi(phone, message, apiSettings)

    if (result.success) {
      setApiStatusMap(prev => ({ ...prev, [id]: { status: 'sent' } }))
      toast('success', `Message sent via WhatsApp API to ${name}!`)
    } else {
      setApiStatusMap(prev => ({
        ...prev,
        [id]: { status: 'failed', error: result.error || 'Failed' },
      }))
      toast('error', `Failed sending to ${name}: ${result.error || 'API error'}`)
    }
  }

  // Batch send to all valid contacts via WhatsApp API (1-Tap for all!)
  async function handleSendAllViaApi() {
    if (!apiSettings || apiSettings.provider === 'none') {
      setShowApiConfig(true)
      toast('error', 'Please configure your WhatsApp API first to enable 1-tap sending.')
      return
    }

    // Collect all contacts with valid phones
    const targets: { id: string; name: string; phone: string }[] = []

    teams.forEach(t => {
      if (t.captain_phone?.trim()) {
        targets.push({
          id: `team-${t.id}`,
          name: `${t.captain_name} (${t.name})`,
          phone: t.captain_phone.trim(),
        })
      }
    })

    recipients.forEach(r => {
      if (r.phone?.trim()) {
        targets.push({
          id: `recip-${r.id}`,
          name: r.name,
          phone: r.phone.trim(),
        })
      }
    })

    if (targets.length === 0) {
      toast('error', 'No recipients with phone numbers found.')
      return
    }

    setApiSendingAll(true)
    setApiProgress({ current: 0, total: targets.length })

    let sentSuccess = 0
    let sentFailed = 0

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      setApiProgress({ current: i + 1, total: targets.length })
      setApiStatusMap(prev => ({ ...prev, [target.id]: { status: 'sending' } }))

      const result = await sendWhatsAppMessageViaApi(target.phone, message, apiSettings)

      if (result.success) {
        sentSuccess++
        setApiStatusMap(prev => ({ ...prev, [target.id]: { status: 'sent' } }))
      } else {
        sentFailed++
        setApiStatusMap(prev => ({
          ...prev,
          [target.id]: { status: 'failed', error: result.error || 'Failed' },
        }))
      }

      // Small delay between calls to respect rate-limits
      if (i < targets.length - 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    setApiSendingAll(false)

    if (sentFailed === 0) {
      toast('success', `Successfully sent to all ${sentSuccess} contacts via WhatsApp API!`)
    } else {
      toast(
        'error',
        `Dispatched via WhatsApp API: ${sentSuccess} succeeded, ${sentFailed} failed. Check individual statuses below.`
      )
    }
  }

  // Save inline Meta API configuration
  async function handleSaveInlineApi(e: React.FormEvent) {
    e.preventDefault()
    setSavingInlineApi(true)
    setInlineTestResult(null)
    try {
      const saved = await saveWhatsAppApiSettings({
        provider: 'meta',
        phone_number_id: inlinePhoneId.trim(),
        access_token: inlineToken.trim(),
      })
      setApiSettings(saved)
      setShowApiConfig(false)
      toast('success', 'Meta WhatsApp Cloud API activated! One-tap sending is now enabled.')
    } catch {
      toast('error', 'Failed to save Meta API settings.')
    } finally {
      setSavingInlineApi(false)
    }
  }

  // Test inline API connection with coordinator's number
  async function handleTestInlineApi() {
    setTestingInlineApi(true)
    setInlineTestResult(null)
    const target = coordinatorPhone || '+91 9019047149'

    try {
      const res = await testWhatsAppApiConnection(target, {
        provider: 'meta',
        phone_number_id: inlinePhoneId.trim(),
        access_token: inlineToken.trim(),
      })

      if (res.success) {
        setInlineTestResult({
          kind: 'success',
          msg: `Success! Test message delivered to ${target}. One-tap sending is ready.`,
        })
        toast('success', `Test message delivered to ${target}!`)
      } else {
        setInlineTestResult({
          kind: 'error',
          msg: res.error || 'Connection failed. Please check your Phone Number ID and Access Token.',
        })
        toast('error', `Connection test failed: ${res.error || 'Unknown error'}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setInlineTestResult({ kind: 'error', msg })
      toast('error', `Test error: ${msg}`)
    } finally {
      setTestingInlineApi(false)
    }
  }

  async function handleAddRecipient(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newPhone.trim()) {
      toast('error', 'Please enter both name and phone number.')
      return
    }
    setSavingNew(true)
    try {
      const added = await saveWhatsAppRecipient({
        name: newName.trim(),
        phone: newPhone.trim(),
        role: newRole.trim() || 'Coordinator',
      })
      setRecipients(prev => [...prev, added])
      setNewName('')
      setNewPhone('')
      setShowAddForm(false)
      toast('success', `Added ${added.name} to WhatsApp recipients.`)
    } catch {
      toast('error', 'Could not save recipient.')
    } finally {
      setSavingNew(false)
    }
  }

  // Filter captains with phone vs without
  const captainsWithPhone = teams.filter(t => Boolean(t.captain_phone?.trim()))
  const captainsWithoutPhone = teams.filter(t => !t.captain_phone?.trim())
  const totalEligible = captainsWithPhone.length + recipients.filter(r => Boolean(r.phone?.trim())).length
  const isApiConfigured = Boolean(apiSettings && apiSettings.provider !== 'none')

  return (
    <Modal open title="WhatsApp Announcement Broadcast" onClose={onClose} wide>
      <div className="space-y-6">
        {/* Banner with Sport info */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-soft">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-emerald-950">{sport.name}</h3>
                  <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                    {sport.category || 'Sport'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-emerald-800">
                  {sport.registration_deadline
                    ? `${isDeadlinePassed(sport.registration_deadline) ? '⚠️ Closed: ' : '⏰ Deadline: '} ${sport.registration_deadline}`
                    : '🟢 Open Registration (No deadline)'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyMessage}
                className="btn-outline btn-sm flex items-center gap-1.5 border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
              <button
                type="button"
                onClick={handleGeneralShare}
                className="btn-primary btn-sm flex items-center gap-1.5 !bg-emerald-700 !text-white hover:!bg-emerald-800"
                title="Open WhatsApp share picker"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share Link
              </button>
              {siteSettings?.whatsapp_group_url && (
                <a
                  href={siteSettings.whatsapp_group_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline btn-sm flex items-center gap-1.5 border-emerald-400 bg-white text-emerald-900 hover:bg-emerald-100"
                >
                  <Users className="h-3.5 w-3.5" />
                  HPL Group
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Meta WhatsApp Cloud API Automated 1-Tap Dispatch Banner */}
        <div className={`rounded-2xl border p-4 shadow-xs transition-all ${
          isApiConfigured
            ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50'
            : 'border-sand bg-cream/60'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-soft ${
                isApiConfigured ? 'bg-emerald-600' : 'bg-terracotta'
              }`}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-bark">
                    {isApiConfigured ? 'Meta WhatsApp Cloud API Active' : 'Automated 1-Tap WhatsApp Sending'}
                  </h4>
                  {isApiConfigured && (
                    <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                      ⚡ Meta Cloud API
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-bark-soft">
                  {isApiConfigured
                    ? `Click "One-Tap Send to All" to dispatch to all ${totalEligible} numbers automatically in the background.`
                    : 'Connect your Meta WhatsApp Cloud API credentials to enable 1-tap automated background sending.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowApiConfig(s => !s)}
                className="btn-outline btn-sm flex items-center gap-1.5 border-sand bg-white text-xs font-semibold text-bark hover:bg-cream"
              >
                <Settings2 className="h-3.5 w-3.5 text-emerald-700" />
                {showApiConfig ? 'Close Setup' : isApiConfigured ? 'Edit Meta Keys' : '⚡ Connect Meta API'}
                {showApiConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {isApiConfigured && (
                <button
                  type="button"
                  disabled={apiSendingAll || totalEligible === 0}
                  onClick={handleSendAllViaApi}
                  className="btn-primary flex items-center gap-2 !bg-emerald-700 hover:!bg-emerald-800 !py-2 !px-4 text-xs font-semibold shadow-soft disabled:opacity-50"
                >
                  {apiSendingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        Sending ({apiProgress?.current || 0}/{apiProgress?.total || totalEligible})…
                      </span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>⚡ One-Tap Send to All ({totalEligible})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar during automated sending */}
          {apiProgress && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{
                    width: `${Math.round((apiProgress.current / Math.max(apiProgress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] font-medium text-emerald-900">
                <span>{apiSendingAll ? 'Dispatched messages in background...' : 'Broadcast run completed'}</span>
                <span>
                  {apiProgress.current} / {apiProgress.total} processed
                </span>
              </div>
            </div>
          )}

          {/* Inline Meta API Quick Setup Drawer */}
          {showApiConfig && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between border-b border-sand pb-2">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-bark">
                    Meta WhatsApp Cloud API Configuration
                  </h4>
                </div>
                <span className="text-[11px] text-bark-faint">
                  1,000 free conversations/month via developers.facebook.com
                </span>
              </div>

              <form onSubmit={handleSaveInlineApi} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1 block text-xs font-medium text-bark-soft">
                      Meta Phone Number ID *
                    </span>
                    <input
                      className="input font-mono text-xs"
                      placeholder="e.g. 104829104829104"
                      value={inlinePhoneId}
                      onChange={e => setInlinePhoneId(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-bark-soft">
                      Permanent Access Token *
                    </span>
                    <input
                      className="input font-mono text-xs"
                      type="password"
                      placeholder="EAAG..."
                      value={inlineToken}
                      onChange={e => setInlineToken(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-sand/30 p-2.5 text-[11px] text-bark leading-relaxed">
                  💡 <strong>Permanent Token Tip:</strong> In{' '}
                  <a
                    href="https://business.facebook.com/settings/system-users"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-emerald-800 underline"
                  >
                    Meta Business Manager → System Users
                  </a>
                  , create an Admin user, click <strong>Generate New Token</strong>, and select{' '}
                  <code className="rounded bg-sand/60 px-1 text-[10px] text-bark">whatsapp_business_messaging</code>. This token never expires.
                </div>

                {/* Inline Test Section */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sand bg-cream/40 p-2.5">
                  <span className="text-xs text-bark-soft">
                    Test connection with coordinator: <strong>{coordinatorPhone || '+91 9019047149'}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={testingInlineApi || !inlinePhoneId.trim() || !inlineToken.trim()}
                    onClick={() => void handleTestInlineApi()}
                    className="btn-outline btn-sm flex items-center gap-1.5 text-xs text-emerald-900 border-emerald-300 bg-white hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {testingInlineApi ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send Test Message
                  </button>
                </div>

                {inlineTestResult && (
                  <p className={`text-xs font-medium ${
                    inlineTestResult.kind === 'success' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {inlineTestResult.kind === 'success' ? '✓ ' : '✗ '}
                    {inlineTestResult.msg}
                  </p>
                )}

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-sand">
                  <button
                    type="button"
                    onClick={() => setShowApiConfig(false)}
                    className="btn-outline btn-sm text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingInlineApi}
                    className="btn-primary btn-sm flex items-center gap-1.5 !bg-emerald-700 !text-white text-xs hover:!bg-emerald-800"
                  >
                    {savingInlineApi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save & Enable 1-Tap Sending
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Coordinator Contact Prompt */}
        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-bark">
              <Phone className="h-3.5 w-3.5 text-emerald-700" />
              Sport Coordinator Contact (For Queries)
            </label>
            <span className="text-[11px] text-bark-faint">
              Prompted here so each sport can specify who captains should contact
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-medium text-bark-soft">
                Coordinator WhatsApp Number
              </span>
              <input
                className="input text-xs"
                type="tel"
                placeholder="e.g. +91 9019047149"
                value={coordinatorPhone}
                onChange={e => {
                  setCoordinatorPhone(e.target.value)
                  try {
                    localStorage.setItem('srksh_last_coordinator_phone', e.target.value)
                  } catch {}
                }}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-bark-soft">
                Coordinator Name / Title (Optional)
              </span>
              <input
                className="input text-xs"
                placeholder="e.g. Sri Harsha / Sports Secretary"
                value={coordinatorName}
                onChange={e => {
                  setCoordinatorName(e.target.value)
                  try {
                    localStorage.setItem('srksh_last_coordinator_name', e.target.value)
                  } catch {}
                }}
              />
            </div>
          </div>
        </div>

        {/* Message Customizer & Preview */}
        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-bark-soft">
              Announcement Message Preview
            </label>
            <span className="text-[11px] text-bark-faint">Updates live as you type</span>
          </div>
          <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-sand/60 bg-cream/60 p-3 font-sans text-xs leading-relaxed text-bark">
            {message}
          </pre>

          <div className="mt-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-gold" />
            <input
              className="input text-xs"
              placeholder="Add optional note or rules (e.g. 'Captain meeting today at 5:00 PM at ground')"
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
            />
          </div>
        </div>

        {/* Recipients Grid */}
        <div className="space-y-4">
          {/* Section 1: Team Captains */}
          <div className="rounded-2xl border border-sand bg-white/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-sand pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-terracotta" />
                <h4 className="text-sm font-semibold text-bark">Team Captains ({teams.length})</h4>
              </div>
              <span className="text-xs text-bark-soft">
                {captainsWithPhone.length} with phone number · {captainsWithoutPhone.length} missing
              </span>
            </div>

            {teams.length === 0 ? (
              <p className="text-xs text-bark-faint">No teams configured yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {teams.map(t => {
                  const hasPhone = Boolean(t.captain_phone?.trim())
                  const key = `team-${t.id}`
                  const manualSent = sentSet.has(key)
                  const apiStatus = apiStatusMap[key]

                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-sand/70 bg-cream/40 p-2.5 transition hover:bg-cream"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <ColourDot colour={t.colour} />
                          <span className="truncate text-xs font-semibold text-bark">{t.name}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-bark-soft">
                          <User className="h-3 w-3 shrink-0 text-bark-faint" />
                          <span className="truncate">{t.captain_name}</span>
                          {hasPhone ? (
                            <span className="font-mono text-[10px] text-bark-faint">
                              ({t.captain_phone})
                            </span>
                          ) : (
                            <span className="font-medium text-[10px] text-red-600">
                              (No phone saved)
                            </span>
                          )}
                        </div>
                      </div>

                      {hasPhone ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* API Send Button (1-Tap Send) */}
                          {isApiConfigured && (
                            <button
                              type="button"
                              disabled={apiStatus?.status === 'sending'}
                              onClick={() =>
                                handleSendOneViaApi(key, t.captain_phone!, t.captain_name)
                              }
                              className={`btn-sm flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                                apiStatus?.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                  : apiStatus?.status === 'failed'
                                  ? 'bg-red-100 text-red-800 ring-1 ring-red-300'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                              title={
                                apiStatus?.status === 'failed'
                                  ? `Error: ${apiStatus.error}. Click to retry.`
                                  : `1-Tap Send via WhatsApp API`
                              }
                            >
                              {apiStatus?.status === 'sending' ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Sending…</span>
                                </>
                              ) : apiStatus?.status === 'sent' ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-700" />
                                  <span>API Sent ✓</span>
                                </>
                              ) : apiStatus?.status === 'failed' ? (
                                <>
                                  <AlertCircle className="h-3 w-3 text-red-600" />
                                  <span>Retry 1-Tap</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="h-3 w-3" />
                                  <span>1-Tap Send</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Manual wa.me Chat Link Button as Fallback */}
                          <button
                            type="button"
                            onClick={() => handleManualSend(key, t.captain_phone!)}
                            className={`btn-sm flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${
                              manualSent
                                ? 'bg-sand text-bark ring-1 ring-sand'
                                : isApiConfigured
                                ? 'border border-sand bg-white text-bark-soft hover:bg-sand/40 hover:text-bark'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                            title={`Open WhatsApp chat directly with ${t.captain_name}`}
                          >
                            {manualSent ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-700" />
                                <span>Opened</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3 w-3" />
                                <span>{isApiConfigured ? 'Manual' : 'Send'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="px-2 text-[10px] italic text-bark-faint">Set in Teams</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 2: Other Notification Numbers (Admins / Coordinators) */}
          <div className="rounded-2xl border border-sand bg-white/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-sand pb-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-700" />
                <h4 className="text-sm font-semibold text-bark">
                  Admins & Coordinators ({recipients.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(s => !s)}
                className="btn-outline btn-sm flex items-center gap-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                {showAddForm ? 'Cancel' : 'Add Number'}
              </button>
            </div>

            {/* Quick inline add form */}
            {showAddForm && (
              <form
                onSubmit={handleAddRecipient}
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"
              >
                <p className="mb-2 text-xs font-semibold text-emerald-950">Add Notification Recipient</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    className="input text-xs"
                    placeholder="Name (e.g. Sports Warden)"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                  />
                  <input
                    className="input text-xs"
                    type="tel"
                    placeholder="Phone (e.g. +91 9019047149)"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    required
                  />
                  <input
                    className="input text-xs"
                    placeholder="Role (e.g. Secretary / Warden)"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                  />
                </div>
                <div className="mt-2.5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="btn-outline btn-sm text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={savingNew} className="btn-primary btn-sm text-xs">
                    Save Recipient
                  </button>
                </div>
              </form>
            )}

            {loadingRecipients ? (
              <p className="text-xs text-bark-faint">Loading recipients…</p>
            ) : recipients.length === 0 ? (
              <p className="text-xs text-bark-faint">
                No extra notification numbers added yet. Click &quot;Add Number&quot; above to add
                committee members, hostel wardens, or coordinators.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {recipients.map(r => {
                  const key = `recip-${r.id}`
                  const manualSent = sentSet.has(key)
                  const apiStatus = apiStatusMap[key]

                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-sand/70 bg-cream/40 p-2.5 transition hover:bg-cream"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-bark">{r.name}</span>
                          {r.role && (
                            <span className="rounded-full bg-sand/60 px-2 py-0.2 text-[10px] text-bark-soft">
                              {r.role}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-bark-faint">{r.phone}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* API Send Button (1-Tap Send) */}
                        {isApiConfigured && (
                          <button
                            type="button"
                            disabled={apiStatus?.status === 'sending'}
                            onClick={() => handleSendOneViaApi(key, r.phone, r.name)}
                            className={`btn-sm flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                              apiStatus?.status === 'sent'
                                ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                : apiStatus?.status === 'failed'
                                ? 'bg-red-100 text-red-800 ring-1 ring-red-300'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                            title={
                              apiStatus?.status === 'failed'
                                ? `Error: ${apiStatus.error}. Click to retry.`
                                : `1-Tap Send via WhatsApp API`
                            }
                          >
                            {apiStatus?.status === 'sending' ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Sending…</span>
                              </>
                            ) : apiStatus?.status === 'sent' ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-700" />
                                <span>API Sent ✓</span>
                              </>
                            ) : apiStatus?.status === 'failed' ? (
                              <>
                                <AlertCircle className="h-3 w-3 text-red-600" />
                                <span>Retry 1-Tap</span>
                              </>
                            ) : (
                              <>
                                <Zap className="h-3 w-3" />
                                <span>1-Tap Send</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Manual wa.me Chat Link Button as Fallback */}
                        <button
                          type="button"
                          onClick={() => handleManualSend(key, r.phone)}
                          className={`btn-sm flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${
                            manualSent
                              ? 'bg-sand text-bark ring-1 ring-sand'
                              : isApiConfigured
                              ? 'border border-sand bg-white text-bark-soft hover:bg-sand/40 hover:text-bark'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                          title={`Open WhatsApp chat directly with ${r.name}`}
                        >
                          {manualSent ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-700" />
                              <span>Opened</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3" />
                              <span>{isApiConfigured ? 'Manual' : 'Send'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-sand pt-4">
          <p className="text-xs text-bark-faint">
            {isApiConfigured ? (
              <span>
                ⚡ <strong>1-Tap Send</strong> dispatches instantly in the background. <strong>Manual</strong> opens the WhatsApp chat window as a backup.
              </span>
            ) : (
              <span>
                Click <strong>⚡ Connect API</strong> above to enable 1-tap automated sending, or click <strong>Send</strong> to open WhatsApp directly.
              </span>
            )}
          </p>
          <button type="button" onClick={onClose} className="btn-outline">
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
