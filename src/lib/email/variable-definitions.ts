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
      { path: 'reservation.paid_amount', label: 'Paid Amount (cents)', description: 'Amount paid in cents', sampleValue: 30000 },
      { path: 'reservation.cancellation_date', label: 'Cancellation Date', description: 'Date reservation was cancelled (computed from cancelled_at)', sampleValue: 'Jun 15, 2026', computed: true },
      { path: 'reservation.balance_due', label: 'Balance Due', description: 'Remaining balance (computed: total - paid)', sampleValue: '$150.00', computed: true },
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
      { path: 'payment.amount_cents', label: 'Amount (cents)', description: 'Payment amount in cents (DB column)', sampleValue: 45000 },
      { path: 'payment.formatted_amount', label: 'Amount', description: 'Formatted payment amount (computed)', sampleValue: '$450.00', computed: true },
      { path: 'payment.payment_method', label: 'Method', description: 'Payment method used', sampleValue: 'card' },
      { path: 'payment.payment_status', label: 'Status', description: 'Payment status', sampleValue: 'succeeded' },
      { path: 'payment.refund_status', label: 'Refund Status', description: 'Status of refund (computed)', sampleValue: 'processing', computed: true },
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

