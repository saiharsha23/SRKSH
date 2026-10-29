import { useState, useEffect } from 'react'
import { Check, Copy, ExternalLink, MessageCircle, Phone, Plus, Send, Share2, Sparkles, User, Users } from 'lucide-react'
import type { Sport, Team, SiteSettings, WhatsAppRecipient } from '../types'
import {
  cleanWhatsAppPhone,
  createWhatsAppChatUrl,
  createWhatsAppShareUrl,
  formatSportWhatsAppMessage,
  getWhatsAppRecipients,
  saveWhatsAppRecipient,
} from '../lib/whatsapp'
import { ColourDot, Modal, useToast } from './ui'
import { isDeadlinePassed } from '../lib/format'

interface Props {
  sport: Sport
  teams: Team[]
  siteSettings?: Partial<SiteSettings>
  onClose: () => void
}

export default function WhatsAppBroadcastModal({ sport, teams, siteSettings, onClose }: Props) {
  const toast = useToast()
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(true)
  const [customNote, setCustomNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [sentSet, setSentSet] = useState<Set<string>>(new Set())

  // Inline add recipient
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState('Coordinator')
  const [savingNew, setSavingNew] = useState(false)

  // Load custom recipients from DB / LocalStorage
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const list = await getWhatsAppRecipients()
        if (active) setRecipients(list)
      } finally {
        if (active) setLoadingRecipients(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  // Ask coordinator details on the page rather than hardcoding
  const [coordinatorPhone, setCoordinatorPhone] = useState(() => {
    try {
      return localStorage.getItem('srksh_last_coordinator_phone') || siteSettings?.whatsapp_sender_phone || ''
    } catch {
      return ''
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

  function handleSend(id: string, phone: string) {
    setSentSet(prev => new Set(prev).add(id))
    const url = createWhatsAppChatUrl(phone, message)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleGeneralShare() {
    const url = createWhatsAppShareUrl(message)
    window.open(url, '_blank', 'noopener,noreferrer')
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

  return (
    <Modal open title="WhatsApp Announcement" onClose={onClose} wide>
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
              >
                <Share2 className="h-3.5 w-3.5" />
                Share on WhatsApp
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

        {/* Coordinator Contact Prompt */}
        <div className="rounded-2xl border border-sand bg-white p-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-bark">
              <Phone className="h-3.5 w-3.5 text-emerald-700" />
              Sport Coordinator Contact (Optional)
            </label>
            <span className="text-[11px] text-bark-faint">Enter the number captains can contact for queries</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-medium text-bark-soft">Coordinator WhatsApp Number</span>
              <input
                className="input text-xs"
                type="tel"
                placeholder="e.g. +91 9019047149"
                value={coordinatorPhone}
                onChange={e => {
                  setCoordinatorPhone(e.target.value)
                  try { localStorage.setItem('srksh_last_coordinator_phone', e.target.value) } catch {}
                }}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-bark-soft">Coordinator Name / Title (Optional)</span>
              <input
                className="input text-xs"
                placeholder="e.g. Sri Harsha / Sports Secretary"
                value={coordinatorName}
                onChange={e => {
                  setCoordinatorName(e.target.value)
                  try { localStorage.setItem('srksh_last_coordinator_name', e.target.value) } catch {}
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
            <span className="text-[11px] text-bark-faint">Updates live as you type above</span>
          </div>
          <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-cream/60 p-3 font-sans text-xs text-bark leading-relaxed border border-sand/60">
            {message}
          </pre>

          <div className="mt-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-gold" />
            <input
              className="input text-xs"
              placeholder="Add optional note or rules (e.g. 'Meeting today at 5:00 PM at ground')"
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
                <h4 className="font-semibold text-bark text-sm">Team Captains ({teams.length})</h4>
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
                  const isSent = sentSet.has(`team-${t.id}`)
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
                            <span className="font-mono text-[10px] text-bark-faint">({t.captain_phone})</span>
                          ) : (
                            <span className="text-[10px] text-red-600 font-medium">(No phone)</span>
                          )}
                        </div>
                      </div>

                      {hasPhone ? (
                        <button
                          type="button"
                          onClick={() => handleSend(`team-${t.id}`, t.captain_phone!)}
                          className={`btn-sm flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs transition ${
                            isSent
                              ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                          title={`Send WhatsApp message to ${t.captain_name}`}
                        >
                          {isSent ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-700" />
                              <span>Sent</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3" />
                              <span>Send</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[10px] text-bark-faint italic px-2">Set in Teams</span>
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
                <h4 className="font-semibold text-bark text-sm">
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
                    placeholder="Phone (e.g. +91 98765 43210)"
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
                  <button
                    type="submit"
                    disabled={savingNew}
                    className="btn-primary btn-sm text-xs"
                  >
                    Save Recipient
                  </button>
                </div>
              </form>
            )}

            {loadingRecipients ? (
              <p className="text-xs text-bark-faint">Loading recipients…</p>
            ) : recipients.length === 0 ? (
              <p className="text-xs text-bark-faint">
                No extra notification numbers added yet. Click &quot;Add Number&quot; above to add committee members, hostel wardens, or coordinators.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {recipients.map(r => {
                  const isSent = sentSet.has(`recip-${r.id}`)
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

                      <button
                        type="button"
                        onClick={() => handleSend(`recip-${r.id}`, r.phone)}
                        className={`btn-sm flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs transition ${
                          isSent
                            ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                        title={`Send WhatsApp message to ${r.name}`}
                      >
                        {isSent ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-700" />
                            <span>Sent</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3 w-3" />
                            <span>Send</span>
                          </>
                        )}
                      </button>
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
            Clicking <strong>Send</strong> opens WhatsApp directly with the message pre-filled.
          </p>
          <button type="button" onClick={onClose} className="btn-outline">
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
