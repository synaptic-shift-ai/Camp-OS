import cron from 'node-cron';
import 'dotenv/config';

const baseUrl = process.env.APP_URL;

console.log(`[Cron] Using APP_URL=${baseUrl}`);

cron.schedule('* * * * *', async () => {
  try {
    const res = await fetch(`${baseUrl}/api/cron/update-housekeeping-status`, {
      method: 'POST', // or GET
      headers: { 'Content-Type': 'application/json' },
    });

    const body = await res.json();
    console.log('[Cron] update-housekeeping-status:', res.status, body);
  } catch (error) {
    console.error('[Cron] Failed to call housekeeping endpoint:', error);
  }
}, {
  timezone: 'UTC',
});