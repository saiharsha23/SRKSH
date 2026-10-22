import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anon && url.startsWith('http'))

// Only the public anon key is used in the browser. Authorisation is enforced by Postgres RLS.
export const supabase = createClient(
  isConfigured ? (url as string) : 'https://not-configured.invalid',
  isConfigured ? (anon as string) : 'not-configured',
)

export const BUCKET = 'srksh-media'
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function imageUrl(path?: string | null): string | null {
  if (!path || !isConfigured) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `"${file.name}" is not a JPG, PNG or WebP image.`
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" is larger than 5 MB.`
  return null
}

/** Upload a file to Storage under a folder; returns the storage path. Throws on failure. */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const err = validateImage(file)
  if (err) throw new Error(err)
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return path
}

export async function removeImage(path?: string | null) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}
