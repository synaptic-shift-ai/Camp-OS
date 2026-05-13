/**
 * Email Template Renderer
 *
 * Handles merge-field substitution in HTML email templates.
 * Paths use snake_case DB column names matching EventContext.
 * Computed fields are added by `enrichContext()` before substitution.
 */

import { getSampleData } from './variable-definitions'

// ============================================================================
// Email Layout Settings
// ============================================================================

export type EmailSettings = {
  width: string
  bgColor: string
  centered: boolean
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  width: '600',
  bgColor: '#ffffff',
  centered: true,
}

/** True when content starts with a full HTML document wrapper (DOCTYPE or root `html` element). */
export function isHtmlDocumentShell(html: string): boolean {
  const t = html.trimStart()
  return /^<!DOCTYPE\s+html/i.test(t) || /^<html[\s>]/i.test(t)
}

/**
 * Markup that must not be round-tripped through a browser contentEditable (rich text) editor.
 * - Full document shells are invalid inside a div and are edited in source mode.
 * - A merge tag as the first child of `tbody` is invalid HTML; the parser "foster parents"
 *   it outside the table and corrupts the template.
 */
export function requiresEmailTemplateSourceEditing(html: string): boolean {
  const t = html.trimStart()
  if (isHtmlDocumentShell(t)) return true
  if (/<tbody[^>]*>\s*\{\{[^}]+\}\}/i.test(t)) return true
  return false
}

/** True when template is already a complete HTML document (system / migration templates). */
export function isFullEmailDocument(html: string): boolean {
  const t = html.trimStart()
  // Full document
  if (/^<!DOCTYPE\s+html/i.test(t) || /^<html[\s>]/i.test(t)) return true

  // Some legacy/default templates are stored as "email-safe fragments":
  // they start with <meta>/<style> and include a full 100%-width presentation table.
  // Treat these as already-complete so we do not double-wrap them.
  const startsLikeEmailFragment = /^<(meta|style|table)\b/i.test(t)
  const hasViewportMeta = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(t)
  const hasEmailRootTable =
    /<table[^>]+role=["']presentation["'][^>]*>/i.test(t) &&
    /<table[^>]+(width=["']100%["']|style=["'][^"']*width:\s*100%)/i.test(t)

  return startsLikeEmailFragment && (hasViewportMeta || hasEmailRootTable)
}

/** Extract email settings from HTML comment stored by the rich editor */
export function extractEmailSettings(html: string): EmailSettings | null {
  const match = html.match(/<!--email-settings:(.*?)-->/)
  if (!match) return null
  const encoded = match[1]
  if (!encoded) return null
  try {
    const decoded = atob(encoded)
    return JSON.parse(decoded) as EmailSettings
  } catch {
    return null
  }
}

/** Strip the email-settings comment from HTML */
export function stripEmailSettings(html: string): string {
  return html.replace(/<!--email-settings:.*?-->/, '')
}

/**
 * Optional branding injected into the email layout.
 * When omitted, wrapWithEmailLayout renders exactly as before.
 */
export interface EmailBranding {
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  senderName?: string
  propertyName?: string
  propertyAddress?: string | null
  unsubscribeUrl?: string
}

function getStringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildEmailFooterHtml(branding: EmailBranding): string {
  const footerLink = branding.unsubscribeUrl
    ? `<a href="${branding.unsubscribeUrl}" target="_blank" style="color:#888888;">Unsubscribe</a>`
    : '<a href="{{unsubscribe_url}}" target="_blank" style="color:#888888;">Unsubscribe</a>'

  const footerParts = [
    getStringValue(branding.propertyName) ?? 'CampOS',
    getStringValue(branding.propertyAddress),
    footerLink,
  ].filter((part): part is string => part !== null)

  return `
<div style="border-top:1px solid #e0e0e0;margin-top:32px;padding-top:16px;text-align:center;font-size:12px;color:#888888;line-height:1.5;">
  ${footerParts.join(' &middot; ')}
</div>`
}

function appendEmailFooterToRenderedHtml(html: string, branding: EmailBranding): string {
  const footerHtml = buildEmailFooterHtml(branding)
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${footerHtml}</body>`)
  }
  return `${html}${footerHtml}`
}

/**
 * Wrap HTML content in an email-client-safe centered table layout.
 * Uses <table> centering (works in Gmail, Outlook, Yahoo, Apple Mail).
 *
 * When `branding` is provided, injects a logo header, primary-color accent bar,
 * and a CAN-SPAM compliant footer with unsubscribe link.
 * When omitted, renders exactly as before (backward compatible).
 */
export function wrapWithEmailLayout(content: string, settings: EmailSettings, branding?: EmailBranding): string {
  const width = settings.width === 'full' ? '100%' : `${settings.width}px`

  let bodyContent = content

  // ── Branding header: logo + accent bar ──────────────────────────────────
  if (branding) {
    const parts: string[] = []

    if (branding.logoUrl) {
      parts.push(`<a href="${branding.unsubscribeUrl ?? ''}" target="_blank" style="display:inline-block;margin-bottom:12px;"><img src="${branding.logoUrl}" alt="${branding.propertyName ?? ''}" style="max-height:60px;width:auto;" /></a>`)
    }

    if (branding.primaryColor) {
      parts.push(`<div style="height:3px;background-color:${branding.primaryColor};border-radius:2px;margin-bottom:20px;"></div>`)
    }

    bodyContent = parts.join('') + bodyContent
  }

  // ── CAN-SPAM footer ──────────────────────────────────────────────────────
  if (branding) {
    bodyContent += buildEmailFooterHtml(branding)
  }

  const centerHTML = settings.centered
    ? `<table role="presentation" align="center" width="${width}" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background-color:${settings.bgColor};max-width:${width};">
  <tr><td style="padding:24px;font-family:sans-serif;">${bodyContent}</td></tr>
</table>`
    : `<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="background-color:${settings.bgColor};max-width:${width};">
  <tr><td style="padding:24px;font-family:sans-serif;">${bodyContent}</td></tr>
</table>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>html,body{margin:0;padding:0;min-height:100%;background:${settings.bgColor};}img{max-width:100%;height:auto;}</style></head><body>${centerHTML}</body></html>`
}

/**
 * Legacy default templates may hardcode shell background colors (e.g. #f6f9fc).
 * When users change background in the editor settings, override those shell values
 * so preview/test-send stay consistent with the selected setting.
 */
function applyLegacyBackgroundOverride(html: string, settings: EmailSettings): string {
  const bg = settings.bgColor
  return html
    .replace(/background-color\s*:\s*#f6f9fc/gi, `background-color:${bg}`)
    .replace(/background\s*:\s*#f6f9fc/gi, `background:${bg}`)
    .replace(/bgcolor\s*=\s*["']#f6f9fc["']/gi, `bgcolor="${bg}"`)
}

// ============================================================================
// Context Enrichment
// ============================================================================

/**
 * Enrich a raw EventContext with computed fields that DB rows don't have.
 * This runs BEFORE replaceVariables so computed paths resolve correctly.
 *
 * Computed fields:
 * - guest.name          = first_name + ' ' + last_name
 * - reservation.num_nights = days between check_in_date and check_out_date
 * - reservation.formatted_total = total_amount / 100 as currency string
 * - property.address    = concatenated from address, city, state, zip_code
 * - payment.formatted_amount = amount / 100 as currency string
 */
export function enrichContext(raw: Record<string, unknown>): Record<string, unknown> {
  const data = JSON.parse(JSON.stringify(raw)) // deep clone

  // guest.name = first_name + last_name
  const guest = data.guest as Record<string, unknown> | undefined
  if (guest && typeof guest.first_name === 'string' && typeof guest.last_name === 'string') {
    guest.name = `${guest.first_name} ${guest.last_name}`
  }

  // reservation.num_nights
  const reservation = data.reservation as Record<string, unknown> | undefined
  if (reservation && reservation.check_in_date && reservation.check_out_date) {
    const inDate = new Date(String(reservation.check_in_date))
    const outDate = new Date(String(reservation.check_out_date))
    const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)))
    reservation.num_nights = nights
  }

  // reservation.formatted_total = total_amount / 100
  if (reservation && reservation.total_amount !== undefined && reservation.total_amount !== null) {
    reservation.formatted_total = `$${(Number(reservation.total_amount) / 100).toFixed(2)}`
  }

  // reservation.cancellation_date (alias for cancelled_at)
  if (reservation?.cancelled_at && !reservation.cancellation_date) {
    reservation.cancellation_date = new Date(String(reservation.cancelled_at)).toLocaleDateString()
  }

  // reservation.balance_due = total_amount - paid_amount
  if (reservation?.total_amount !== undefined && reservation?.paid_amount !== undefined) {
    const balanceCents = Number(reservation.total_amount) - Number(reservation.paid_amount)
    reservation.balance_due = `$${(balanceCents / 100).toFixed(2)}`
  }

  // property.address = concatenate available address fields
  const property = data.property as Record<string, unknown> | undefined
  if (property) {
    const parts = [
      property.address,
      property.city,
      property.state,
      property.zip_code,
    ]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (parts.length > 0) {
      property.address = parts.join(', ')
    }
  }

  // payment.formatted_amount — DB column is amount_cents, legacy may use amount
  const payment = data.payment as Record<string, unknown> | undefined
  const paymentAmount = payment?.amount_cents ?? payment?.amount
  if (payment !== undefined && payment !== null && paymentAmount !== undefined && paymentAmount !== null) {
    payment.formatted_amount = `$${(Number(paymentAmount) / 100).toFixed(2)}`
    // Also normalize the amount field for template access
    if (!payment.amount && payment.amount_cents) {
      payment.amount = payment.amount_cents
    }
  }

  // Normalize payment_status from status column
  if (payment?.status && !payment.payment_status) {
    payment.payment_status = payment.status
  }
  // Normalize payment_method from method column
  if (payment?.method && !payment.payment_method) {
    payment.payment_method = payment.method
  }

  return data
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Resolve a dotted path like "guest.first_name" against a nested object.
 */
export function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

// ============================================================================
// Variable Substitution
// ============================================================================

/**
 * Replace {{variable.path}} placeholders in a string with values from data.
 * Missing variables (undefined/null) are replaced with empty string to avoid
 * raw placeholders leaking into guest-facing emails.
 */
export function replaceVariables(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_match, path: string) => {
    const value = resolvePath(data, path)
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render template with sample data — for preview and test-send.
 * Wraps content with email layout (centered table, bg color, width).
 */
export function renderWithSampleData(subject: string, html: string): {
  subject: string
  html: string
} {
  const sample = getSampleData()
  const settings = extractEmailSettings(html) ?? DEFAULT_EMAIL_SETTINGS
  const content = stripEmailSettings(html)
  const renderedContent = replaceVariables(content, sample)
  const full = isFullEmailDocument(renderedContent)
  const property = sample.property as Record<string, unknown> | undefined
  const samplePropertyAddress = getStringValue(property?.address)
  const sampleBranding: EmailBranding = {
    propertyName: getStringValue(property?.name) ?? 'CampOS',
    ...(samplePropertyAddress !== null ? { propertyAddress: samplePropertyAddress } : {}),
  }
  return {
    subject: replaceVariables(subject, sample),
    html: full
      ? appendEmailFooterToRenderedHtml(
          applyLegacyBackgroundOverride(renderedContent, settings),
          sampleBranding,
        )
      : wrapWithEmailLayout(renderedContent, settings, sampleBranding),
  }
}

/**
 * Render template with real event context (enriched with computed fields).
 * Wraps content with email layout (centered table, bg color, width).
 * Returns plain-text fallback by stripping HTML tags.
 */
export function renderWithContext(
  subject: string,
  html: string,
  context: Record<string, unknown>,
  branding?: EmailBranding,
): {
  subject: string
  html: string
  text: string
} {
  const enriched = enrichContext(context)
  const settings = extractEmailSettings(html) ?? DEFAULT_EMAIL_SETTINGS
  const content = stripEmailSettings(html)
  const renderedContent = replaceVariables(content, enriched)
  const full = isFullEmailDocument(renderedContent)
  const property = enriched.property as Record<string, unknown> | undefined
  const contextPropertyName = getStringValue(property?.name)
  const contextPropertyAddress = getStringValue(property?.address)
  const propertyName = branding?.propertyName ?? contextPropertyName
  const propertyAddress = branding?.propertyAddress ?? contextPropertyAddress
  const effectiveBranding = branding
    ? {
        ...branding,
        ...(propertyName !== null ? { propertyName } : {}),
        ...(propertyAddress !== null ? { propertyAddress } : {}),
      }
    : contextPropertyName !== null
      ? {
          propertyName: contextPropertyName,
          ...(contextPropertyAddress !== null ? { propertyAddress: contextPropertyAddress } : {}),
        }
      : undefined
  const renderedHtml = full
    ? effectiveBranding
      ? appendEmailFooterToRenderedHtml(
          applyLegacyBackgroundOverride(renderedContent, settings),
          effectiveBranding,
        )
      : applyLegacyBackgroundOverride(renderedContent, settings)
    : wrapWithEmailLayout(renderedContent, settings, effectiveBranding)
  const renderedText = renderedContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { subject: replaceVariables(subject, enriched), html: renderedHtml, text: renderedText }
}
