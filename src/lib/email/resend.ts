import { Resend } from 'resend'

// Initialize Resend client lazily to avoid build-time errors
let resendInstance: Resend | null = null

function getResendClient(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

const SENDER_NAME = 'CampOS'

function getFromEmail(): string {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL environment variable is not set')
  }
  return process.env.RESEND_FROM_EMAIL
}

export const resend = {
  get emails() {
    return getResendClient().emails
  }
}

export function getFrom(): string {
  return `${SENDER_NAME} <${getFromEmail()}>`
}
