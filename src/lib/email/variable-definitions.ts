/**
 * Email Template Variable Definitions
 *
 * Catalog of merge fields available for use in email templates.
 * Paths use actual snake_case DB column names (matching EventContext enrichment).
 * Computed variables are resolved by `enrichContext()` in template-renderer.ts.
 */

// ============================================================================
// Types
// ============================================================================

export type VariableDefinition = {
  path: string
  label: string
  description: string
  sampleValue: string | number
  computed?: boolean
}

export type VariableGroup = {
  label: string
  prefix: string
  variables: VariableDefinition[]
}

// ============================================================================
// Variable Catalog
// ============================================================================

export const VARIABLE_GROUPS: VariableGroup[] = [
  {
    label: 'Guest',
    prefix: 'guest',
    variables: [
      { path: 'guest.name', label: 'Guest Name', description: 'Full name (first + last)', sampleValue: 'John Smith', computed: true },
      { path: 'guest.first_name', label: 'First Name', description: 'Guest first name', sampleValue: 'John' },
      { path: 'guest.last_name', label: 'Last Name', description: 'Guest last name', sampleValue: 'Smith' },
      { path: 'guest.email', label: 'Email', description: 'Email address', sampleValue: 'john@example.com' },
      { path: 'guest.phone', label: 'Phone', description: 'Phone number', sampleValue: '(555) 123-4567' },
    ],
  },
  {
    label: 'Reservation',
    prefix: 'reservation',
    variables: [
      { path: 'reservation.confirmation_number', label: 'Confirmation #', description: 'Unique booking ID', sampleValue: 'RES-2026-001' },
      { path: 'reservation.check_in_date', label: 'Check-in Date', description: 'Arrival date', sampleValue: '2026-06-15' },
      { path: 'reservation.check_out_date', label: 'Check-out Date', description: 'Departure date', sampleValue: '2026-06-18' },
      { path: 'reservation.num_nights', label: 'Nights', description: 'Number of nights (computed)', sampleValue: 3, computed: true },
      { path: 'reservation.total_amount', label: 'Total (cents)', description: 'Total amount in cents', sampleValue: 45000 },
      { path: 'reservation.formatted_total', label: 'Total', description: 'Formatted total (computed)', sampleValue: '$450.00', computed: true },
      { path: 'reservation.num_adults', label: 'Adults', description: 'Number of adults', sampleValue: 2 },
      { path: 'reservation.num_children', label: 'Children', description: 'Number of children', sampleValue: 1 },
      { path: 'reservation.status', label: 'Status', description: 'Reservation status', sampleValue: 'confirmed' },
    ],
  },
  {
    label: 'Site',
    prefix: 'site',
    variables: [
      { path: 'site.site_number', label: 'Site Number', description: 'Site identifier', sampleValue: 'A-12' },
      { path: 'site.site_name', label: 'Site Name', description: 'Site name', sampleValue: 'Lake View' },
      { path: 'site.site_type', label: 'Site Type', description: 'Type of site', sampleValue: 'rv' },
    ],
  },
  {
    label: 'Property',
    prefix: 'property',
    variables: [
      { path: 'property.name', label: 'Property Name', description: 'Campground name', sampleValue: 'Pine Ridge Campground' },
      { path: 'property.phone', label: 'Phone', description: 'Main phone number', sampleValue: '(555) 987-6543' },
      { path: 'property.email', label: 'Email', description: 'Contact email', sampleValue: 'info@pineridge.com' },
      { path: 'property.address', label: 'Address', description: 'Full address (computed)', sampleValue: '123 Camp Road, Lakeview, TX 75001', computed: true },
      { path: 'property.check_in_time', label: 'Check-in Time', description: 'Default check-in time', sampleValue: '15:00' },
      { path: 'property.check_out_time', label: 'Check-out Time', description: 'Default check-out time', sampleValue: '11:00' },
    ],
  },
  {
    label: 'Payment',
    prefix: 'payment',
    variables: [
      { path: 'payment.amount', label: 'Amount (cents)', description: 'Payment amount in cents', sampleValue: 45000 },
      { path: 'payment.formatted_amount', label: 'Amount', description: 'Formatted payment amount (computed)', sampleValue: '$450.00', computed: true },
      { path: 'payment.payment_method', label: 'Method', description: 'Payment method used', sampleValue: 'card' },
      { path: 'payment.payment_status', label: 'Status', description: 'Payment status', sampleValue: 'succeeded' },
      { path: 'payment.processed_at', label: 'Processed At', description: 'When payment was processed', sampleValue: '2026-06-15T14:30:00Z' },
    ],
  },
]

// ============================================================================
// Sample Data
// ============================================================================

/**
 * Build sample data for preview and test-send.
 * Includes both raw DB-style fields and computed fields.
 */
export function getSampleData(): Record<string, unknown> {
  return {
    guest: {
      first_name: 'John',
      last_name: 'Smith',
      name: 'John Smith',
      email: 'john@example.com',
      phone: '(555) 123-4567',
    },
    reservation: {
      confirmation_number: 'RES-2026-001',
      check_in_date: '2026-06-15',
      check_out_date: '2026-06-18',
      num_nights: 3,
      total_amount: 45000,
      formatted_total: '$450.00',
      num_adults: 2,
      num_children: 1,
      status: 'confirmed',
    },
    site: {
      site_number: 'A-12',
      site_name: 'Lake View',
      site_type: 'rv',
    },
    property: {
      name: 'Pine Ridge Campground',
      phone: '(555) 987-6543',
      email: 'info@pineridge.com',
      address: '123 Camp Road, Lakeview, TX 75001',
      check_in_time: '15:00',
      check_out_time: '11:00',
    },
    payment: {
      amount: 45000,
      formatted_amount: '$450.00',
      payment_method: 'card',
      payment_status: 'succeeded',
      processed_at: '2026-06-15T14:30:00Z',
    },
  }
}

// ============================================================================
// Seed Data
// ============================================================================

export type SeedTemplate = {
  slug: string
  name: string
  description: string
  category: string
  subject_template: string
  html_template: string
}

export const SYSTEM_EMAIL_TEMPLATES: SeedTemplate[] = [
  {
    slug: 'welcome_email',
    name: 'Welcome Email',
    description: 'Sent when a reservation is confirmed',
    category: 'welcome',
    subject_template: 'Welcome to {{property.name}}, {{guest.first_name}}!',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a;">Welcome to {{property.name}}!</h1>
  <p>Hi {{guest.first_name}},</p>
  <p>Thank you for your reservation! We're excited to host you.</p>
  <h2 style="color: #333;">Your Reservation Details</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; font-weight: bold;">Confirmation #</td><td>{{reservation.confirmation_number}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Site</td><td>{{site.site_number}} - {{site.site_name}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Check-in</td><td>{{reservation.check_in_date}} at {{property.check_in_time}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Check-out</td><td>{{reservation.check_out_date}} by {{property.check_out_time}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Duration</td><td>{{reservation.num_nights}} night(s)</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Total</td><td>{{reservation.formatted_total}}</td></tr>
  </table>
  <p>If you have any questions, contact us at {{property.email}} or {{property.phone}}.</p>
  <p>We look forward to seeing you!</p>
  <p>The {{property.name}} Team</p>
</div>`,
  },
  {
    slug: 'check_in_reminder',
    name: 'Check-in Reminder',
    description: 'Sent on check-in day',
    category: 'reservation',
    subject_template: 'Check-in Reminder — {{property.name}}',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a;">Check-in Today!</h1>
  <p>Hi {{guest.first_name}},</p>
  <p>This is a reminder that your check-in is today at <strong>{{property.check_in_time}}</strong>.</p>
  <h2 style="color: #333;">Reservation Details</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; font-weight: bold;">Confirmation #</td><td>{{reservation.confirmation_number}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Site</td><td>{{site.site_number}} - {{site.site_name}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Check-in</td><td>{{reservation.check_in_date}} at {{property.check_in_time}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Check-out</td><td>{{reservation.check_out_date}} by {{property.check_out_time}}</td></tr>
  </table>
  <p>{{property.address}}</p>
  <p>Questions? Call us at {{property.phone}}.</p>
  <p>See you soon!<br>The {{property.name}} Team</p>
</div>`,
  },
  {
    slug: 'thank_you_email',
    name: 'Thank You Email',
    description: 'Sent after checkout',
    category: 'review',
    subject_template: 'Thank You for Staying with Us!',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a;">Thank You, {{guest.first_name}}!</h1>
  <p>We hope you enjoyed your stay at {{property.name}}.</p>
  <p>You stayed {{reservation.num_nights}} night(s) at {{site.site_number}} - {{site.site_name}} ({{reservation.check_in_date}} to {{reservation.check_out_date}}).</p>
  <p>We'd love to hear about your experience. If you have a moment, please consider leaving us a review!</p>
  <p>Have a great day!<br>The {{property.name}} Team</p>
</div>`,
  },
  {
    slug: 'review_request',
    name: 'Review Request',
    description: 'Sent after checkout to request a review',
    category: 'review',
    subject_template: 'How Was Your Stay at {{property.name}}?',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a;">How Was Your Stay?</h1>
  <p>Hi {{guest.first_name}},</p>
  <p>You recently stayed with us at {{property.name}} ({{reservation.check_in_date}} to {{reservation.check_out_date}}).</p>
  <p>We strive to provide the best experience for our guests. Would you mind taking a moment to share your feedback?</p>
  <p>Your review helps other campers and helps us improve.</p>
  <p>Thank you for choosing {{property.name}}!</p>
  <p>Warm regards,<br>The {{property.name}} Team</p>
</div>`,
  },
  {
    slug: 'payment_receipt',
    name: 'Payment Receipt',
    description: 'Sent when a payment is received',
    category: 'payment',
    subject_template: 'Payment Confirmation — {{reservation.confirmation_number}}',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a;">Payment Confirmation</h1>
  <p>Hi {{guest.first_name}},</p>
  <p>We've received your payment for reservation <strong>{{reservation.confirmation_number}}</strong>.</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; font-weight: bold;">Amount</td><td>{{payment.formatted_amount}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Method</td><td>{{payment.payment_method}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Status</td><td>{{payment.payment_status}}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: bold;">Processed</td><td>{{payment.processed_at}}</td></tr>
  </table>
  <p>Reservation total: {{reservation.formatted_total}}</p>
  <p>Thank you!<br>The {{property.name}} Team</p>
</div>`,
  },
  {
    slug: 'payment_failed',
    name: 'Payment Failed',
    description: 'Sent when a payment attempt fails',
    category: 'payment',
    subject_template: 'Payment Issue — {{reservation.confirmation_number}}',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #c0392b;">Payment Issue</h1>
  <p>Hi {{guest.first_name}},</p>
  <p>We were unable to process your payment for reservation <strong>{{reservation.confirmation_number}}</strong>.</p>
  <p>Please update your payment method and try again, or contact us at {{property.phone}} for assistance.</p>
  <p>Your reservation is still pending until payment is received.</p>
  <p>Thank you for your patience.<br>The {{property.name}} Team</p>
</div>`,
  },
  {
    slug: 'pre_arrival',
    name: 'Pre-Arrival Email',
    description: 'Sent 2 days before check-in',
    category: 'reservation',
    subject_template: 'Getting Ready for Your Visit!',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a;">Getting Ready for Your Visit!</h1>
  <p>Hi {{guest.first_name}},</p>
  <p>Your stay at {{property.name}} is coming up on <strong>{{reservation.check_in_date}}</strong>!</p>
  <h2 style="color: #333;">Before You Arrive</h2>
  <ul>
    <li>Check-in time: <strong>{{property.check_in_time}}</strong></li>
    <li>Check-out time: <strong>{{property.check_out_time}}</strong></li>
    <li>Your site: <strong>{{site.site_number}} - {{site.site_name}}</strong></li>
  </ul>
  <p>{{property.address}}</p>
  <p>If you need to make any changes, please contact us at {{property.email}} or {{property.phone}}.</p>
  <p>See you soon!<br>The {{property.name}} Team</p>
</div>`,
  },
  {
    slug: 'lead_time_rejection',
    name: 'Lead Time Rejection',
    description: 'Sent when a reservation is blocked due to minimum lead time',
    category: 'notification',
    subject_template: 'Reservation Cannot Be Processed',
    html_template: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #c0392b;">Reservation Cannot Be Processed</h1>
  <p>Hi {{guest.first_name}},</p>
  <p>We're sorry, but we were unable to process your reservation at {{property.name}}.</p>
  <p>This reservation requires advance notice that was not met. Please try booking with a later check-in date.</p>
  <p>If you believe this is an error, please contact us at {{property.phone}} or {{property.email}}.</p>
  <p>We apologize for the inconvenience.<br>The {{property.name}} Team</p>
</div>`,
  },
]
