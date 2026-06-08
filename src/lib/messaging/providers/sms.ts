/**
 * SMS Provider
 *
 * Sends SMS via AWS SNS (Publish, Transactional type).
 *
 * Contract: sendSMS NEVER throws — all failures (missing env, invalid phone,
 * SNS errors) return { success: false, error }. The campaign send loop in
 * ../send.ts has no try/catch around this call; a throw would abort the
 * remaining recipients and strand the campaign in 'sending'.
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import type { SendResult } from '../messaging-types'

const SNS_SEND_MAX_ATTEMPTS = 4
const SNS_RETRY_BASE_DELAY_MS = 500

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

interface SnsConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
}

/**
 * Read SNS config from env. Returns null when incomplete — callers map this
 * to an error result rather than throwing (see contract above).
 * Read lazily on every send so env changes (and tests) take effect.
 */
function getSnsConfig(): SnsConfig | null {
  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (!region || !accessKeyId || !secretAccessKey) {
    return null
  }
  return { region, accessKeyId, secretAccessKey }
}

let client: SNSClient | null = null
let clientRegion: string | null = null

function getClient(config: SnsConfig): SNSClient {
  if (!client || clientRegion !== config.region) {
    client = new SNSClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
    clientRegion = config.region
  }
  return client
}

/**
 * Best-effort E.164 normalisation: strips spaces/dashes/dots/parentheses.
 * Returns null when the result is not a plausible E.164 number
 * (+ followed by 8–15 digits).
 */
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/[\s\-().]/g, '')
  if (!/^\+\d{8,15}$/.test(cleaned)) return null
  return cleaned
}

/**
 * Send an SMS message to a single recipient via AWS SNS.
 * Returns the SNS MessageId as providerMessageId on success.
 */
export async function sendSMS(
  to: string,
  body: string,
): Promise<SendResult> {
  const config = getSnsConfig()
  if (!config) {
    const error =
      'SNS not configured: AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set'
    console.error(`[messaging/sms] ${error}`)
    return { success: false, error }
  }

  const phone = normalisePhone(to)
  if (!phone) {
    const error = `Invalid phone number (expected E.164): ${String(to)}`
    console.error(`[messaging/sms] ${error}`)
    return { success: false, error }
  }

  const command = new PublishCommand({
    PhoneNumber: phone,
    Message: body,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional',
      },
    },
  })

  let lastError = 'Unknown SNS error'
  for (let attempt = 1; attempt <= SNS_SEND_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await getClient(config).send(command)
      console.log(
        `[messaging/sms] Sent SMS to ${phone} (id: ${result.MessageId}, attempt: ${attempt}, length: ${body.length})`,
      )
      return {
        success: true,
        ...(result.MessageId ? { providerMessageId: result.MessageId } : {}),
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error(
        `[messaging/sms] Send to ${phone} failed (attempt ${attempt}/${SNS_SEND_MAX_ATTEMPTS}): ${lastError}`,
      )
      if (attempt < SNS_SEND_MAX_ATTEMPTS) {
        await delay(SNS_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
      }
    }
  }

  return { success: false, error: lastError }
}
