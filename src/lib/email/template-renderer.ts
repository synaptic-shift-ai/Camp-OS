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

/** Extract email settings from HTML comment stored by the rich editor */
export function extractEmailSettings(html: string): EmailSettings | null {
  const match = html.match(/<!--email-settings:(.*?)-->/)
  if (!match) return null
  try {
    const decoded = atob(match[1])
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
 * Wrap HTML content in an email-client-safe centered table layout.
 * Uses <table> centering (works in Gmail, Outlook, Yahoo, Apple Mail).
 */
export function wrapWithEmailLayout(content: string, settings: EmailSettings): string {
  const width = settings.width === 'full' ? '100%' : `${settings.width}px`
  const centerHTML = settings.centered
    ? `<table role="presentation" align="center" width="${width}" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background-color:${settings.bgColor};max-width:${width};">
  <tr><td style="padding:24px;font-family:sans-serif;">${content}</td></tr>
</table>`
    : `<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="background-color:${settings.bgColor};max-width:${width};">
  <tr><td style="padding:24px;font-family:sans-serif;">${content}</td></tr>
</table>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{margin:0;padding:0;background:#f3f4f6;}img{max-width:100%;height:auto;}</style></head><body>${centerHTML}</body></html>`
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

  // payment.formatted_amount = amount / 100
  const payment = data.payment as Record<string, unknown> | undefined
  if (payment && payment.amount !== undefined && payment.amount !== null) {
    payment.formatted_amount = `$${(Number(payment.amount) / 100).toFixed(2)}`
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
 * Missing variables are left as-is (for debugging).
 */
export function replaceVariables(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (match, path: string) => {
    const value = resolvePath(data, path)
    if (value === undefined || value === null) return match
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
  return {
    subject: replaceVariables(subject, sample),
    html: wrapWithEmailLayout(renderedContent, settings),
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
): {
  subject: string
  html: string
  text: string
} {
  const enriched = enrichContext(context)
  const settings = extractEmailSettings(html) ?? DEFAULT_EMAIL_SETTINGS
  const content = stripEmailSettings(html)
  const renderedContent = replaceVariables(content, enriched)
  const renderedHtml = wrapWithEmailLayout(renderedContent, settings)
  const renderedText = renderedContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { subject: replaceVariables(subject, enriched), html: renderedHtml, text: renderedText }
}
