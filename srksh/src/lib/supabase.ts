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
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  if (!isConfigured) return null
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

/** Resize and compress an image file to a lightweight data URL (avatar/portrait ready) */
export async function fileToOptimizedDataUrl(file: File, maxDim = 400, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(format, quality))
      }
      img.onerror = () => resolve(reader.result as string)
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Uploads to Storage if possible; falls back to compressed data URL if storage permission is restricted */
export async function uploadImageWithFallback(file: File, folder: string): Promise<string> {
  const err = validateImage(file)
  if (err) throw new Error(err)
  try {
    return await uploadImage(file, folder)
  } catch (storageErr: any) {
    console.warn('Storage bucket upload restricted, using compressed data URL:', storageErr?.message)
    return await fileToOptimizedDataUrl(file, 400, 0.85)
  }
}

export async function removeImage(path?: string | null) {
  if (!path || path.startsWith('data:')) return
  await supabase.storage.from(BUCKET).remove([path])
}
