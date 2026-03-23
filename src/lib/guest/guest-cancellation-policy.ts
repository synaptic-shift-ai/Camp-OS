/**
 * Guest-facing cancellation policy copy and structured rules derived from
 * `properties.cancellation_policy`, `properties.cancellation_policy_config`, and (for legacy policy text only)
 * `properties.settings.cancellationPolicy` when the dedicated column is empty.
 */

export const GUEST_CANCELLATION_POLICY_FALLBACK =
  'All bookings for this property are non‑refundable. Cancellations at any time after booking will not receive a refund.'

export type GuestCancellationPolicyApiData = {
  policy_display_text: string
  refund_tiers: Array<{ refund_percentage: number; days_before_reservation: number }>
}

type PropertyRow = {
  cancellation_policy: string | null
  cancellation_policy_config: unknown
  settings: unknown
}

export function buildGuestCancellationPolicyData(property: PropertyRow): GuestCancellationPolicyApiData {
  const settings = property.settings as Record<string, unknown> | null

  const columnPolicy =
    typeof property.cancellation_policy === 'string' ? property.cancellation_policy.trim() : ''
  const settingsPolicyText =
    typeof settings?.cancellationPolicy === 'string' ? settings.cancellationPolicy.trim() : ''

  const mergedPolicyText =
    columnPolicy.length > 0 ? columnPolicy : settingsPolicyText.length > 0 ? settingsPolicyText : null

  const policy_display_text = mergedPolicyText ?? GUEST_CANCELLATION_POLICY_FALLBACK

  const config = property.cancellation_policy_config as {
    refund_tiers?: Array<{ refund_percentage?: unknown; days_before_reservation?: unknown }>
  } | null

  const refund_tiers = (config?.refund_tiers ?? [])
    .map((t) => ({
      refund_percentage: typeof t.refund_percentage === 'number' ? t.refund_percentage : null,
      days_before_reservation:
        typeof t.days_before_reservation === 'number' ? t.days_before_reservation : null,
    }))
    .filter(
      (t): t is { refund_percentage: number; days_before_reservation: number } =>
        t.refund_percentage !== null && t.days_before_reservation !== null
    )

  return { policy_display_text, refund_tiers }
}

export function guestHasStructuredCancellationRules(data: GuestCancellationPolicyApiData): boolean {
  return data.refund_tiers.length > 0
}

/**
 * If the last bullet line ends with a period and is followed by a closing sentence
 * (e.g. "All cancellation requests…"), keep that sentence out of the list so it
 * aligns with the intro instead of under the bullet indent.
 */
function detachTrailingFooterFromLastBullet(bullets: string[]): {
  bullets: string[]
  footer: string | null
} {
  if (bullets.length === 0) {
    return { bullets: [], footer: null }
  }

  const last = bullets[bullets.length - 1]!
  const m = last.match(/^(.*)(\.\s+)(All cancellation requests[\s\S]*)$/i)
  if (!m || m[1] == null || m[2] == null || m[3] == null) {
    return { bullets, footer: null }
  }

  const bulletLine = (m[1] + m[2]).trim()
  const footer = m[3].trim()

  return {
    bullets: [...bullets.slice(0, -1), bulletLine],
    footer,
  }
}

/**
 * Split free-form policy text that uses ● or • inline bullets into an intro
 * paragraph and list items for readable guest UI.
 */
export function parseCancellationPolicyDisplayBlocks(text: string): {
  intro: string
  bullets: string[]
  footer: string | null
} {
  const trimmed = text.trim()
  if (!trimmed) {
    return { intro: '', bullets: [], footer: null }
  }

  const parts = trimmed
    .split(/\s*[●•]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (parts.length <= 1) {
    return { intro: trimmed, bullets: [], footer: null }
  }

  const first = parts[0]
  const rest = parts.slice(1)
  if (!first) {
    return { intro: trimmed, bullets: [], footer: null }
  }
  return { intro: first, ...detachTrailingFooterFromLastBullet(rest) }
}

export function formatGuestCancellationRulesLines(data: GuestCancellationPolicyApiData): string[] {
  const sortedTiers = [...data.refund_tiers].sort(
    (a, b) => b.days_before_reservation - a.days_before_reservation
  )
  return sortedTiers.map(
    (t) =>
      `${t.refund_percentage}% refund if you cancel at least ${t.days_before_reservation} day(s) before check-in.`
  )
}
