/**
 * Format a time string from HH:mm (24-hour) to h:mm AM/PM (12-hour).
 *
 * @param time - Time in HH:mm format (e.g. "15:00"), or undefined/null/empty
 * @returns Formatted time string (e.g. "3:00 PM"), or empty string for falsy input
 */
export function formatTime(time: string | undefined | null): string {
  if (!time) return ''
  const parts = time.split(':')
  const hours = parts[0]
  const minutes = parts[1]
  if (!hours || !minutes) return ''
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}
