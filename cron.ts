import cron from 'node-cron'
import 'dotenv/config'

const baseUrl = process.env.APP_URL
const cronSecret = process.env.CRON_SECRET

/** Secured cron routes expect `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set on the server. */
function cronHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cronSecret) {
    headers.Authorization = `Bearer ${cronSecret}`
  }
  return headers
}

console.log(`[Cron] Using APP_URL=${baseUrl}`)
if (!cronSecret) {
  console.warn(
    '[Cron] CRON_SECRET is unset — secured /api/cron/* routes return 401 if the Next.js server has CRON_SECRET set.',
  )
}

// cron.schedule(
//   '* * * * *',
//   async () => {
//     try {
//       const res = await fetch(`${baseUrl}/api/cron/update-housekeeping-status`, {
//         method: 'POST', // or GET
//         headers: cronHeaders(),
//       })

//       const body = await res.json()
//       console.log('[Cron] update-housekeeping-status:', res.status, body)
//     } catch (error) {
//       console.error('[Cron] Failed to call housekeeping endpoint:', error)
//     }
//   },
//   {
//     timezone: 'UTC',
//   },
// )

cron.schedule(
  '* * * * *',
  async () => {
    try {
      const res = await fetch(`${baseUrl}/api/cron/automation-pre-arrival-reminder`, {
        method: 'POST',
        headers: cronHeaders(),
      })

      const body = await res.json()
      console.log('[Cron] automation-pre-arrival-reminder:', res.status, body)
    } catch (error) {
      console.error('[Cron] Failed to call automation-pre-arrival-reminder endpoint:', error)
    }
  },
  {
    timezone: 'UTC',
  },
)
