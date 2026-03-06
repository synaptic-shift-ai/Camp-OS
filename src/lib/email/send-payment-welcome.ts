/**
 * Shared logic to send the payment confirmation + onboarding link email.
 * Used by the Stripe webhook and by the payment success page fallback API.
 */

import { render } from '@react-email/components'
import { sendEmail } from '@/lib/email/emailit'
import { PaymentWelcomeEmail } from '@/lib/email/templates/payment-welcome'

export type SendPaymentWelcomeResult =
  | { success: true; id: string }
  | { success: false; error: string }

export async function sendPaymentWelcomeEmail(
  to: string,
  planId: string,
  companyName: string,
  onboardingToken: string
): Promise<SendPaymentWelcomeResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  const onboardingUrl = `${baseUrl}/onboarding?token=${onboardingToken}`
  const planLabel = planId.charAt(0).toUpperCase() + planId.slice(1)

  const html = await render(
    PaymentWelcomeEmail({
      companyName,
      planLabel,
      onboardingUrl,
    })
  )

  const subject = `Payment confirmed – Welcome to CampOS, ${companyName}`
  const result = await sendEmail({ to, subject, html })
  return result.success
    ? { success: true, id: result.id }
    : { success: false, error: result.error }
}
