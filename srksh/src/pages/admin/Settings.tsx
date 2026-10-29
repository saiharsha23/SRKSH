import { useEffect, useState } from 'react'
import { Loader2, MessageCircle, Phone, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getEditions, getSettings, useQuery } from '../../lib/data'
import type { Edition, EditionStatus, SiteSettings, WhatsAppRecipient } from '../../types'
import { Badge, ConfirmDialog, ErrorBox, Spinner, useToast } from '../../components/ui'
import { Field, PageTitle, errMsg } from './common'
import { cleanWhatsAppPhone, getWhatsAppRecipients, saveWhatsAppRecipient, deleteWhatsAppRecipient } from '../../lib/whatsapp'

function EditionCard({ ed, onSaved }: { ed: Edition; onSaved: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(ed.name)
  const [status, setStatus] = useState<EditionStatus>(ed.status)
  const [tie, setTie] = useState(ed.tie_break)
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!name.trim()) { toast('error', 'Edition name is required.'); return }
    setBusy(true)
    const { error } = await supabase.from('hpl_editions').update({ name: name.trim(), status, tie_break: tie }).eq('id', ed.id)
    setBusy(false)
    if (error) toast('error', error.message); else { toast('success', 'Edition saved.'); onSaved() }
  }
  return (
    <div className="card">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Edition / season name"><input className="input" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Status"><select className="input" value={status} onChange={e => setStatus(e.target.value as EditionStatus)}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></Field>
        <Field label="Tie-break rule" hint="Equal points always share a rank unless you choose a rule.">
          <select className="input" value={tie} onChange={e => setTie(e.target.value as 'none' | 'wins')}><option value="none">None — tied teams share a rank</option><option value="wins">Number of sports won</option></select></Field>
      </div>
      <div className="mt-4 flex justify-end"><button className="btn-primary btn-sm" onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="h-3 w-3 animate-spin" />}Save edition</button></div>
    </div>
  )
}

export default function Settings() {
  const toast = useToast()
  const eds = useQuery(getEditions, [] as Edition[], [])
  const st = useQuery(getSettings, {} as Partial<SiteSettings>, [])
  const [newName, setNewName] = useState('')
  const [confirmNew, setConfirmNew] = useState(false)
  const [switchTo, setSwitchTo] = useState<Edition | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Partial<SiteSettings>>({})
  useEffect(() => {
    setForm({
      ...st.data,
      whatsapp_sender_phone: st.data.whatsapp_sender_phone || '+91 9019047149',
    })
  }, [st.data])
  const current = eds.data.find(e => e.is_current)

  async function makeCurrent(name: string | null, existing?: Edition) {
    setBusy(true)
    try {
      if (current) { const { error } = await supabase.from('hpl_editions').update({ is_current: false }).eq('id', current.id); if (error) throw error }
      let r
      if (existing) r = await supabase.from('hpl_editions').update({ is_current: true }).eq('id', existing.id)
      else r = await supabase.from('hpl_editions').insert({ name: name!.trim(), status: 'upcoming', is_current: true })
      if (r.error) {
        if (current) await supabase.from('hpl_editions').update({ is_current: true }).eq('id', current.id) // roll back
        throw r.error
      }
      toast('success', existing ? `${existing.name} is now the current edition.` : 'New edition created. Previous results are kept.')
      setNewName(''); setConfirmNew(false); setSwitchTo(null); void eds.reload()
    } catch (e) { toast('error', errMsg(e)) } finally { setBusy(false) }
  }
  async function saveContact() {
    setBusy(true)
    const clean = (v?: string | null) => (v?.trim() ? v.trim() : null)
    const { error } = await supabase.from('site_settings').update({
      contact_email: clean(form.contact_email), contact_phone: clean(form.contact_phone), contact_address: clean(form.contact_address),
      facebook_url: clean(form.facebook_url), instagram_url: clean(form.instagram_url), youtube_url: clean(form.youtube_url),
      whatsapp_group_url: clean(form.whatsapp_group_url),
      whatsapp_sender_phone: clean(form.whatsapp_sender_phone) || '+91 9019047149',
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setBusy(false)
    if (error) toast('error', error.message); else { toast('success', 'Contact details saved.'); void st.reload() }
  }
  const f = (k: keyof SiteSettings) => ({ className: 'input', value: form[k] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(s => ({ ...s, [k]: e.target.value })) })

  /* ---------- WhatsApp Broadcast Recipients state ---------- */
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(true)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientRole, setRecipientRole] = useState('Sports Coordinator')
  const [addingRecipient, setAddingRecipient] = useState(false)
  const [recipientBusy, setRecipientBusy] = useState(false)

  async function loadRecipients() {
    try {
      const list = await getWhatsAppRecipients()
      setRecipients(list)
    } finally {
      setLoadingRecipients(false)
    }
  }

  useEffect(() => { void loadRecipients() }, [])

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault()
    if (!recipientName.trim() || !recipientPhone.trim()) {
      toast('error', 'Name and phone number are required.')
      return
    }
    setRecipientBusy(true)
    try {
      const saved = await saveWhatsAppRecipient({
        name: recipientName.trim(),
        phone: recipientPhone.trim(),
        role: recipientRole.trim() || 'Coordinator',
      })
      setRecipients(prev => [...prev, saved])
      setRecipientName('')
      setRecipientPhone('')
      setAddingRecipient(false)
      toast('success', `Added ${saved.name} to WhatsApp recipients.`)
    } catch (err) {
      toast('error', `Could not add recipient: ${errMsg(err)}`)
    } finally {
      setRecipientBusy(false)
    }
  }

  async function removeRecipient(id: string, name: string) {
    try {
      await deleteWhatsAppRecipient(id)
      setRecipients(prev => prev.filter(r => r.id !== id))
      toast('success', `Removed ${name} from WhatsApp recipients.`)
    } catch (err) {
      toast('error', `Could not delete: ${errMsg(err)}`)
    }
  }

  if (eds.loading || st.loading) return <Spinner />
  if (eds.error) return <ErrorBox message={eds.error} onRetry={eds.reload} />
  return (
    <>
      <PageTitle title="Settings" />
      <section className="mb-10">
        <h2 className="mb-1 text-2xl font-semibold">HPL edition</h2>
        <p className="mb-4 text-sm text-bark-soft">{current ? `Current edition: ${current.name}.` : 'No edition exists yet — create the first one below.'} Teams, sports and results belong to an edition, so past editions stay intact.</p>
        {current && <EditionCard key={current.id + current.name} ed={current} onSaved={eds.reload} />}
        <div className="card mt-5">
          <h3 className="text-xl font-semibold">{current ? 'Start a new edition' : 'Create the first edition'}</h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1"><Field label="Edition name"><input className="input" placeholder="e.g. HPL 2026" value={newName} onChange={e => setNewName(e.target.value)} /></Field></div>
            <button className="btn-accent" disabled={!newName.trim() || busy} onClick={() => (current ? setConfirmNew(true) : void makeCurrent(newName))}>{current ? 'Start new edition' : 'Create edition'}</button>
          </div>
          {current && <p className="mt-2 text-xs text-bark-faint">The new edition starts with no teams or sports. {current.name} and all its results are retained and can be made current again.</p>}
        </div>
        {eds.data.filter(e => !e.is_current).length > 0 && (
          <div className="card mt-5"><h3 className="mb-3 text-xl font-semibold">Past editions</h3>
            <ul className="divide-y divide-sand">{eds.data.filter(e => !e.is_current).map(e => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2"><span className="font-medium">{e.name} <Badge status={e.status} /></span><button className="btn-outline btn-sm" onClick={() => setSwitchTo(e)}>Make current</button></li>))}</ul></div>
        )}
      </section>

      {/* WhatsApp Broadcast Recipients & Group */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <MessageCircle className="h-6 w-6 text-emerald-600" />
              WhatsApp Notification Numbers
            </h2>
            <p className="text-sm text-bark-soft">
              Numbers configured here, along with Team Captain numbers, receive 1-click WhatsApp announcement links whenever a new sport is added.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary btn-sm flex items-center gap-1.5 !bg-emerald-700 !text-white hover:!bg-emerald-800"
            onClick={() => setAddingRecipient(s => !s)}
          >
            <Plus className="h-4 w-4" />
            {addingRecipient ? 'Cancel' : 'Add Notification Number'}
          </button>
        </div>

        {addingRecipient && (
          <form
            onSubmit={addRecipient}
            className="card mb-5 border-2 border-emerald-300 bg-emerald-50/50"
          >
            <h3 className="mb-3 text-base font-semibold text-emerald-950">Add WhatsApp Notification Recipient</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Contact name *">
                <input
                  className="input"
                  placeholder="e.g. Sports Warden / Sri Ram"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  required
                />
              </Field>
              <Field label="WhatsApp phone number *" hint="e.g. +91 9876543210">
                <input
                  className="input"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={recipientPhone}
                  onChange={e => setRecipientPhone(e.target.value)}
                  required
                />
              </Field>
              <Field label="Role or designation">
                <input
                  className="input"
                  placeholder="e.g. Warden / Coordinator / Admin"
                  value={recipientRole}
                  onChange={e => setRecipientRole(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => setAddingRecipient(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recipientBusy}
                className="btn-primary btn-sm !bg-emerald-700 !text-white hover:!bg-emerald-800"
              >
                {recipientBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                Save Number
              </button>
            </div>
          </form>
        )}

        <div className="card">
          {loadingRecipients ? (
            <Spinner label="Loading notification numbers…" />
          ) : recipients.length === 0 ? (
            <div className="py-6 text-center text-sm text-bark-soft">
              <Phone className="mx-auto mb-2 h-8 w-8 text-sand" />
              <p className="font-medium">No custom notification numbers added yet.</p>
              <p className="mt-1 text-xs text-bark-faint">
                Click &quot;Add Notification Number&quot; above to register coordinators, wardens, or sports secretaries.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-sand">
              {recipients.map(r => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-bark">{r.name}</span>
                      {r.role && (
                        <span className="rounded-full bg-sand/60 px-2.5 py-0.5 text-xs text-bark-soft">
                          {r.role}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-bark-soft">{r.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/${cleanWhatsAppPhone(r.phone)}?text=${encodeURIComponent('SRKSH HPL Notification Test')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline btn-sm text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1"
                      title="Test WhatsApp connection"
                    >
                      <MessageCircle className="h-3 w-3 text-emerald-600" />
                      Test Link
                    </a>
                    <button
                      type="button"
                      className="rounded-full p-2 text-bark-faint hover:bg-red-50 hover:text-red-700"
                      onClick={() => void removeRecipient(r.id, r.name)}
                      aria-label={`Remove ${r.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-semibold">Footer contact & WhatsApp group</h2>
        <p className="mb-4 text-sm text-bark-soft">Optional. Anything left blank is simply not shown on the website.</p>
        <div className="card grid gap-4 sm:grid-cols-2">
          <Field label="Email"><input type="email" {...f('contact_email')} /></Field>
          <Field label="Phone"><input type="tel" {...f('contact_phone')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Official HPL WhatsApp Announcements Group / Channel Link" hint="e.g. https://chat.whatsapp.com/... (Used in 1-click broadcast)">
              <input type="url" placeholder="https://chat.whatsapp.com/..." {...f('whatsapp_group_url')} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Default WhatsApp Sender / Coordinator Phone Number" hint="Displayed on announcements for queries (Default: +91 9019047149)">
              <input type="tel" placeholder="+91 9019047149" {...f('whatsapp_sender_phone')} />
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label="Postal address"><textarea rows={3} {...f('contact_address')} /></Field></div>
          <Field label="Facebook URL"><input type="url" placeholder="https://" {...f('facebook_url')} /></Field>
          <Field label="Instagram URL"><input type="url" placeholder="https://" {...f('instagram_url')} /></Field>
          <Field label="YouTube URL"><input type="url" placeholder="https://" {...f('youtube_url')} /></Field>
          <div className="flex items-end justify-end sm:col-span-2"><button className="btn-primary" onClick={() => void saveContact()} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save contact details</button></div>
        </div>
      </section>
      <ConfirmDialog open={confirmNew} busy={busy} confirmLabel="Start new edition" title="Start a new edition?" message={`“${newName.trim()}” becomes the current edition shown on the public site. ${current?.name} is kept with all its teams, sports and results.`} onCancel={() => setConfirmNew(false)} onConfirm={() => void makeCurrent(newName)} />
      <ConfirmDialog open={!!switchTo} busy={busy} confirmLabel="Make current" title="Switch current edition?" message={`The public site will show ${switchTo?.name}.`} onCancel={() => setSwitchTo(null)} onConfirm={() => switchTo && void makeCurrent(null, switchTo)} />
    </>
  )
}
