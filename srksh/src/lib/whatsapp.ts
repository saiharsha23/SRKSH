import { supabase } from './supabase'
import type { Sport, WhatsAppRecipient } from '../types'
import { fmtDateTime } from './format'

const STORAGE_KEY = 'srksh_whatsapp_recipients_v1'

/**
 * Cleans phone numbers into the format expected by WhatsApp wa.me links
 * (e.g. "919876543210" without "+", spaces, hyphens or parentheses).
 * If a 10-digit Indian number is entered without country code, "91" is prepended by default.
 */
export function cleanWhatsAppPhone(phone: string, defaultCountry = '91'): string {
  if (!phone) return ''
  let digits = phone.replace(/\D/g, '')
  // If user entered with leading zero (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  // If 10 digits, prepend default country code (India = 91)
  if (digits.length === 10) {
    digits = `${defaultCountry}${digits}`
  }
  return digits
}

/**
 * Generates an announcement message formatted for WhatsApp
 */
export function formatSportWhatsAppMessage(
  sport: Sport,
  options?: {
    customNote?: string
    portalUrl?: string
    coordinatorPhone?: string
    coordinatorName?: string
  }
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://srksh.org'
  const portalUrl = options?.portalUrl || `${origin}/leader`
  const coordinatorPhone = options?.coordinatorPhone?.trim()
  const coordinatorName = options?.coordinatorName?.trim()

  let deadlineText = 'Open (No deadline set)'
  if (sport.registration_deadline) {
    try {
      deadlineText = fmtDateTime(sport.registration_deadline)
    } catch {
      deadlineText = sport.registration_deadline
    }
  }

  const lines: string[] = [
    '🏆 *SRKSH HPL — NEW SPORT ANNOUNCED!* 🏆',
    '',
    `⚽ *Sport:* ${sport.name}`,
    `📁 *Category:* ${sport.category || 'Tournament Event'}`,
    `⏰ *Registration Deadline:* ${deadlineText}`,
  ]

  if (sport.description && sport.description.trim()) {
    lines.push('', '📝 *Description / Rules:*', sport.description.trim())
  }

  if (options?.customNote && options.customNote.trim()) {
    lines.push('', `📢 *Notice:* ${options.customNote.trim()}`)
  }

  lines.push(
    '',
    '👉 *Captains & Team Leaders:*',
    `Please log in to the Leader Portal to register your team squad before the deadline:`,
    `🔗 ${portalUrl}`
  )

  if (coordinatorPhone) {
    const label = coordinatorName ? `${coordinatorName} (${coordinatorPhone})` : coordinatorPhone
    lines.push('', `📞 *Coordinator / Queries:* ${label}`)
  } else if (coordinatorName) {
    lines.push('', `📞 *Coordinator:* ${coordinatorName}`)
  }

  lines.push(
    '',
    '— _Sri Ramakrishna Students Home (SRKSH)_'
  )

  return lines.join('\n')
}

/** Direct 1-to-1 WhatsApp chat URL */
export function createWhatsAppChatUrl(phone: string, message: string): string {
  const clean = cleanWhatsAppPhone(phone)
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

/** General WhatsApp share URL (opens WhatsApp contact / group selector) */
export function createWhatsAppShareUrl(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
}

/* ---------- LocalStorage Helpers (fallback for offline / before SQL migration) ---------- */
function getLocalRecipients(): WhatsAppRecipient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalRecipients(items: WhatsAppRecipient[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/* ---------- Supabase + LocalStorage unified fetch ---------- */
export async function getWhatsAppRecipients(): Promise<WhatsAppRecipient[]> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_recipients')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && Array.isArray(data)) {
      // Sync local cache
      saveLocalRecipients(data as WhatsAppRecipient[])
      return data as WhatsAppRecipient[]
    }
  } catch {
    // Fall back to localStorage if table does not exist in Supabase yet
  }

  return getLocalRecipients()
}

export async function saveWhatsAppRecipient(
  recipient: { id?: string; name: string; phone: string; role?: string }
): Promise<WhatsAppRecipient> {
  const localList = getLocalRecipients()
  const payload = {
    name: recipient.name.trim(),
    phone: recipient.phone.trim(),
    role: recipient.role?.trim() || 'Coordinator',
  }

  let savedItem: WhatsAppRecipient | null = null

  try {
    if (recipient.id) {
      const { data, error } = await supabase
        .from('whatsapp_recipients')
        .update(payload)
        .eq('id', recipient.id)
        .select('*')
        .single()
      if (!error && data) savedItem = data as WhatsAppRecipient
    } else {
      const { data, error } = await supabase
        .from('whatsapp_recipients')
        .insert(payload)
        .select('*')
        .single()
      if (!error && data) savedItem = data as WhatsAppRecipient
    }
  } catch {
    // Supabase unavailable or table not created yet
  }

  if (!savedItem) {
    // LocalStorage fallback
    if (recipient.id) {
      const idx = localList.findIndex(r => r.id === recipient.id)
      savedItem = {
        id: recipient.id,
        ...payload,
        created_at: localList[idx]?.created_at || new Date().toISOString(),
      }
      if (idx >= 0) localList[idx] = savedItem
      else localList.push(savedItem)
    } else {
      savedItem = {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString(),
      }
      localList.push(savedItem)
    }
  } else {
    // Update local cache
    const idx = localList.findIndex(r => r.id === savedItem!.id)
    if (idx >= 0) localList[idx] = savedItem
    else localList.push(savedItem)
  }

  saveLocalRecipients(localList)
  return savedItem
}

export async function deleteWhatsAppRecipient(id: string): Promise<void> {
  try {
    await supabase.from('whatsapp_recipients').delete().eq('id', id)
  } catch {
    // Ignore error if table doesn't exist
  }
  const localList = getLocalRecipients().filter(r => r.id !== id)
  saveLocalRecipients(localList)
}
