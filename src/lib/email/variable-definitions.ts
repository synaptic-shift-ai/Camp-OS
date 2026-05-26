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
      { path: 'reservation.formatted_paid_amount', label: 'Paid Amount', description: 'Formatted paid amount (computed)', sampleValue: '$300.00', computed: true },
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
  {
    label: 'Staff Invitation',
    prefix: 'staff',
    variables: [
      { path: 'invite_url', label: 'Invite URL', description: 'Registration link with secure token', sampleValue: 'https://example.campos.app/staff-invite?token=abc123' },
      { path: 'inviter_name', label: 'Inviter Name', description: 'Name of the admin who sent the invitation', sampleValue: 'John Admin' },
      { path: 'expiry_days', label: 'Expiry Days', description: 'Number of days before the invite link expires', sampleValue: '7' },
      { path: 'staff.email', label: 'Staff Email', description: "Invited staff member's email address", sampleValue: 'newstaff@example.com' },
      { path: 'staff.name', label: 'Staff Name', description: "Invited staff member's name", sampleValue: 'Jane Staff' },
    ],
  },
  {
    label: 'Vendor / Work Order',
    prefix: 'vendor',
    variables: [
      { path: 'vendor_name', label: 'Vendor Name', description: 'Vendor company or contact name', sampleValue: 'ABC Plumbing' },
      { path: 'vendor.email', label: 'Vendor Email', description: 'Vendor email address', sampleValue: 'vendor@example.com' },
      { path: 'work_order_number', label: 'Work Order #', description: 'Work order number (e.g. WO-PROP-26-00001)', sampleValue: 'WO-CAMP-26-00001' },
      { path: 'task_title', label: 'Task Title', description: 'Work order title', sampleValue: 'Fix water leak at Site 42' },
      { path: 'category', label: 'Category', description: 'Maintenance category', sampleValue: 'Plumbing' },
      { path: 'priority', label: 'Priority', description: 'Priority level (Emergency, High, Medium, Low)', sampleValue: 'High' },
      { path: 'site_label', label: 'Site Label', description: 'Site or location where the issue is', sampleValue: 'Site 42' },
      { path: 'description', label: 'Description', description: 'Work order description', sampleValue: 'Guest reported water leak at hookup connection' },
      { path: 'estimated_labor_cost', label: 'Est. Labor Cost', description: 'Estimated labor cost', sampleValue: '$150.00' },
      { path: 'property_email', label: 'Property Email', description: 'Property contact email', sampleValue: 'maintenance@campground.com' },
    ],
  },
  {
    label: 'Payment Receipt',
    prefix: 'receipt',
    variables: [
      { path: 'guest_name', label: 'Guest Name', description: 'Guest full name', sampleValue: 'John Smith' },
      { path: 'receipt_number', label: 'Receipt #', description: 'Generated receipt number', sampleValue: 'RCT-CAMP-26-00001' },
      { path: 'confirmation_number', label: 'Confirmation #', description: 'Reservation confirmation number', sampleValue: 'CONF-12345' },
      { path: 'receipt_date', label: 'Receipt Date', description: 'Date the receipt was generated', sampleValue: 'May 11, 2026' },
      { path: 'line_items_html', label: 'Line Items HTML', description: 'Pre-rendered HTML table rows for line items', sampleValue: '<tr><td>1</td><td>Site Stay (2 nights)</td><td>$75.00</td><td>$150.00</td></tr>' },
      { path: 'subtotal', label: 'Subtotal', description: 'Charges subtotal (formatted)', sampleValue: '$150.00' },
      { path: 'amount_paid', label: 'Amount Paid', description: 'Payment amount (formatted)', sampleValue: '$150.00' },
      { path: 'remaining_balance', label: 'Remaining Balance', description: 'Remaining balance due (formatted)', sampleValue: '$0.00' },
      { path: 'payment_method_label', label: 'Payment Method', description: 'Payment method display name', sampleValue: 'Credit Card' },
      { path: 'payment_source_label', label: 'Payment Source', description: 'Payment source (e.g. Stripe, cash)', sampleValue: 'Stripe' },
      { path: 'document_title', label: 'Document Title', description: 'Document title (e.g. PAYMENT RECEIPT)', sampleValue: 'PAYMENT RECEIPT' },
      { path: 'billed_to', label: 'Billed To', description: 'Guest address block', sampleValue: 'John Smith\n123 Main St\nAnytown, US 12345' },
      { path: 'property_name', label: 'Property Name', description: 'Property name', sampleValue: 'Happy Campground' },
      { path: 'property_address', label: 'Property Address', description: 'Property formatted address', sampleValue: '456 Camp Rd, Outdoors, US 67890' },
      { path: 'property_address_lines_html', label: 'Property address (HTML lines)', description: 'Property address as formatted HTML lines', sampleValue: '<p style="margin:0;font-size:13px;line-height:20px;color:#555;">123 Camp Rd<br>Lakeview, TX 75001</p>' },
      { path: 'reservation_totals_note', label: 'Reservation totals note (HTML)', description: 'Reservation totals breakdown as HTML', sampleValue: '<p style="margin:0;color:#777;font-size:12px;line-height:18px;">Reservation total: $450.00 (3 nights @ $150.00/night)</p>' },
      { path: 'property_contact_info', label: 'Property contact info suffix', description: 'Property contact info suffix (e.g. phone number)', sampleValue: ' at (555) 987-6543' },
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
      paid_amount: 30000,
      formatted_paid_amount: '$300.00',
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
    invite_url: 'https://example.campos.app/staff-invite?token=abc123',
    inviter_name: 'John Admin',
    expiry_days: '7',
    staff: {
      email: 'newstaff@example.com',
      name: 'Jane Staff',
    },
    vendor_name: 'ABC Plumbing',
    vendor: {
      email: 'vendor@example.com',
    },
    work_order_number: 'WO-CAMP-26-00001',
    task_title: 'Fix water leak at Site 42',
    category: 'Plumbing',
    priority: 'High',
    site_label: 'Site 42',
    description: 'Guest reported water leak at hookup connection',
    estimated_labor_cost: '$150.00',
    property_email: 'maintenance@campground.com',
    guest_name: 'John Smith',
    receipt_number: 'RCT-CAMP-26-00001',
    confirmation_number: 'CONF-12345',
    receipt_date: 'May 11, 2026',
    line_items_html: '<tr><td>1</td><td>Site Stay (2 nights)</td><td>$75.00</td><td>$150.00</td></tr>',
    subtotal: '$150.00',
    amount_paid: '$150.00',
    remaining_balance: '$0.00',
    payment_method_label: 'Credit Card',
    payment_source_label: 'Stripe',
    document_title: 'PAYMENT RECEIPT',
    billed_to: 'John Smith\n123 Main St\nAnytown, US 12345',
    property_name: 'Happy Campground',
    property_address: '456 Camp Rd, Outdoors, US 67890',
    property_address_lines_html: '<p style="margin:0;font-size:13px;line-height:20px;color:#555;">123 Camp Rd<br>Lakeview, TX 75001</p>',
    reservation_totals_note: '<p style="margin:0;color:#777;font-size:12px;line-height:18px;">Reservation total: $450.00 (3 nights @ $150.00/night)</p>',
    property_contact_info: ' at (555) 987-6543',
  }
}

