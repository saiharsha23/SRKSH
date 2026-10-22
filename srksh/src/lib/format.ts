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
export const GALLERY_CATEGORIES = ['Student Life', 'Festivals', 'Sports', 'Cultural Activities', 'Events', 'Other']
