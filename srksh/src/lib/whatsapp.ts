import { supabase } from './supabase'
import type { Sport, WhatsAppRecipient, WhatsAppApiSettings } from '../types'
import { fmtDateTime } from './format'

const STORAGE_KEY = 'srksh_whatsapp_recipients_v1'
const API_SETTINGS_STORAGE_KEY = 'srksh_whatsapp_api_settings_v1'

/**
 * Cleans phone numbers into the format expected by WhatsApp APIs and wa.me links
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

/** Direct 1-to-1 WhatsApp chat URL (wa.me link fallback) */
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

/* ---------- Recipients Management ---------- */
export async function getWhatsAppRecipients(): Promise<WhatsAppRecipient[]> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_recipients')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && Array.isArray(data)) {
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

/* ============================================================
   WhatsApp API Configuration & Background Delivery Service
============================================================ */

const defaultApiSettings: WhatsAppApiSettings = {
  provider: 'none',
  phone_number_id: '',
  access_token: '',
  webhook_url: '',
}

export async function getWhatsAppApiSettings(): Promise<WhatsAppApiSettings> {
  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from('whatsapp_api_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (!error && data) {
      const config: WhatsAppApiSettings = {
        provider: data.provider || 'none',
        phone_number_id: data.phone_number_id || '',
        access_token: data.access_token || '',
        webhook_url: data.webhook_url || '',
      }
      try {
        localStorage.setItem(API_SETTINGS_STORAGE_KEY, JSON.stringify(config))
      } catch {}
      return config
    }
  } catch {
    // Fall back to localStorage
  }

  // 2. Try localStorage
  try {
    const local = localStorage.getItem(API_SETTINGS_STORAGE_KEY)
    if (local) return JSON.parse(local)
  } catch {}

  return defaultApiSettings
}

export async function saveWhatsAppApiSettings(
  settings: WhatsAppApiSettings
): Promise<WhatsAppApiSettings> {
  const payload = {
    id: 1,
    provider: settings.provider,
    phone_number_id: settings.phone_number_id?.trim() || null,
    access_token: settings.access_token?.trim() || null,
    webhook_url: settings.webhook_url?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  // 1. Try saving to Supabase
  try {
    await supabase.from('whatsapp_api_settings').upsert(payload, { onConflict: 'id' })
  } catch {
    // Supabase table not migrated yet
  }

  // 2. Always persist locally
  try {
    localStorage.setItem(API_SETTINGS_STORAGE_KEY, JSON.stringify(payload))
  } catch {}

  return {
    provider: payload.provider,
    phone_number_id: payload.phone_number_id || '',
    access_token: payload.access_token || '',
    webhook_url: payload.webhook_url || '',
  }
}

export interface ApiSendResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Sends a WhatsApp message automatically via the configured API provider
 * (Meta WhatsApp Business Cloud API, UltraMsg Gateway, or Custom Webhook).
 */
export async function sendWhatsAppMessageViaApi(
  toPhone: string,
  messageText: string,
  config?: WhatsAppApiSettings
): Promise<ApiSendResult> {
  const settings = config || (await getWhatsAppApiSettings())
  const cleanPhone = cleanWhatsAppPhone(toPhone)

  if (!cleanPhone) {
    return { success: false, error: 'Recipient phone number is invalid.' }
  }

  if (!settings || settings.provider === 'none') {
    return {
      success: false,
      error: 'WhatsApp API is not configured. Go to Admin Settings → WhatsApp API to set it up.',
    }
  }

  try {
    // Meta WhatsApp Business Cloud API (Official Graph API — Permanent Provider)
    if (settings.provider === 'meta') {
      if (!settings.phone_number_id || !settings.access_token) {
        return { success: false, error: 'Meta Phone Number ID and Access Token are required.' }
      }

      const res = await fetch(`https://graph.facebook.com/v21.0/${settings.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: true,
            body: messageText,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        const errorMsg = data?.error?.message || data?.error?.error_user_msg || `Meta API HTTP ${res.status}`
        return { success: false, error: errorMsg }
      }

      const messageId = data?.messages?.[0]?.id
      return { success: true, messageId }
    }

    // Provider 2: UltraMsg WhatsApp Gateway
    if (settings.provider === 'ultramsg') {
      if (!settings.phone_number_id || !settings.access_token) {
        return { success: false, error: 'UltraMsg Instance ID and Token are required.' }
      }

      const res = await fetch(`https://api.ultramsg.com/${settings.phone_number_id}/messages/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: settings.access_token,
          to: cleanPhone,
          body: messageText,
        }),
      })

      const data = await res.json()
      if (!res.ok || data?.error) {
        return { success: false, error: data?.error || `UltraMsg HTTP ${res.status}` }
      }

      return { success: true, messageId: String(data?.id || '') }
    }

    // Provider 3: Green-API Gateway (Instance ID & API Token)
    if (settings.provider === 'green_api') {
      if (!settings.phone_number_id || !settings.access_token) {
        return { success: false, error: 'Green-API Instance ID and Token are required.' }
      }

      const res = await fetch(
        `https://api.green-api.com/waInstance${settings.phone_number_id}/sendMessage/${settings.access_token}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: `${cleanPhone}@c.us`,
            message: messageText,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok || data?.error) {
        return {
          success: false,
          error: data?.error || data?.message || `Green-API HTTP ${res.status}`,
        }
      }

      return { success: true, messageId: String(data?.idMessage || '') }
    }

    // Provider 4: Custom Generic Webhook (e.g. n8n, Make, Zapier, Express backend)
    if (settings.provider === 'generic_webhook') {
      if (!settings.webhook_url) {
        return { success: false, error: 'Webhook URL is not configured.' }
      }

      const res = await fetch(settings.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: messageText,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!res.ok) {
        return { success: false, error: `Webhook returned HTTP ${res.status}` }
      }

      return { success: true }
    }

    return { success: false, error: `Unsupported WhatsApp provider: ${settings.provider}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Network error sending WhatsApp: ${msg}` }
  }
}

/**
 * Tests connection to the configured WhatsApp API by sending a short test message
 */
export async function testWhatsAppApiConnection(
  targetPhone: string,
  settings: WhatsAppApiSettings
): Promise<ApiSendResult> {
  const testMsg = `🏆 *SRKSH HPL Notification Test*\n\nWhatsApp API is connected and working successfully!\nTime: ${new Date().toLocaleTimeString()}`
  return sendWhatsAppMessageViaApi(targetPhone, testMsg, settings)
}
