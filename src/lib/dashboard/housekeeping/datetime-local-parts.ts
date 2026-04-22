/** Split a value from `<input type="datetime-local" />` into date and time parts (local). */
export function splitDatetimeLocalValue(value: string): { date: string; time: string } {
  const trimmed = value.trim()
  if (!trimmed) return { date: "", time: "" }
  const [datePart, rest] = trimmed.split("T")
  if (!rest) return { date: datePart ?? "", time: "" }
  return { date: datePart ?? "", time: rest.slice(0, 5) }
}

/** Join date (yyyy-mm-dd) and time (HH:mm) for `datetime-local` / `new Date(...)`. */
export function mergeDatetimeLocalValue(date: string, time: string): string {
  const d = date.trim()
  const t = time.trim()
  if (!d || !t) return ""
  const hm = t.length >= 5 ? t.slice(0, 5) : t
  return `${d}T${hm}`
}

/** Only returns a full datetime string when both parts are set (avoids half-filled state). */
export function buildDatetimeIfComplete(date: string, time: string): string {
  const d = date.trim()
  const t = time.trim()
  if (!d || !t) return ""
  return mergeDatetimeLocalValue(d, t)
}

export function formatLocalDateKey(from: Date): string {
  const y = from.getFullYear()
  const m = String(from.getMonth() + 1).padStart(2, "0")
  const day = String(from.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function formatLocalTimeHM(from: Date): string {
  const h = String(from.getHours()).padStart(2, "0")
  const min = String(from.getMinutes()).padStart(2, "0")
  return `${h}:${min}`
}
