export const fmtPoints = (n: number | null | undefined) => {
  const v = Number(n ?? 0)
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '')
}
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
export const statusLabel: Record<string, string> = {
  upcoming: 'Upcoming', in_progress: 'In Progress', completed: 'Completed', pending: 'Pending', active: 'Active',
}
export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
export const isDeadlinePassed = (iso: string | null | undefined) => {
  if (!iso) return false
  return new Date(iso).getTime() < Date.now()
}
export const toLocalIso = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export const GALLERY_CATEGORIES = ['Student Life', 'Festivals', 'Sports', 'Cultural Activities', 'Events', 'Other']

