/**
 * Default Automation Templates
 *
 * Static TypeScript constants for automation templates.
 * Templates are not stored in DB; they are predefined configurations
 * users can use to quickly create automations.
 *
 * Total: 31 templates across 5 categories
 * - Availability: 6 (GUARD phase)
 * - Pricing: 8 (PRICE phase)
 * - Documents: 4 (ENFORCE phase)
 * - Guest Comms: 8 (COMMUNICATE phase)
 * - Operations: 5 (OPERATE phase)
 */

import type {
  AutomationPhase,
  TriggerType,
  ActionType,
  ConditionOperator,
} from './types'

// ============================================================================
// Template Types
// ============================================================================

export type TemplateCategory =
  | 'Availability'
  | 'Pricing'
  | 'Documents'
  | 'Guest Comms'
  | 'Operations'

export type AutomationTemplate = {
  id: string
  name: string
  description: string
  phase: AutomationPhase
  triggerType: TriggerType
  category: TemplateCategory
  conditionGroups?: Array<{
    logicOperator: 'AND' | 'OR'
    conditions: Array<{
      variable: string
      operator: ConditionOperator
      value: unknown
    }>
  }>
  actions: Array<{
    actionType: ActionType
    actionConfig?: Record<string, unknown>
    delayValue?: number
    delayUnit?: 'minutes' | 'hours' | 'days'
  }>
}

// ============================================================================
// Constants
// ============================================================================

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Availability',
  'Pricing',
  'Documents',
  'Guest Comms',
  'Operations',
]

export const PHASE_COLORS: Record<AutomationPhase, string> = {
  GUARD: 'bg-red-500/10 text-red-600 border-red-500/20',
  PRICE: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  ENFORCE: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  OPERATE: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  COMMUNICATE: 'bg-green-500/10 text-green-600 border-green-500/20',
  LOG: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
}

export const CATEGORY_ICONS: Record<TemplateCategory, string> = {
  Availability: 'shield',
  Pricing: 'dollar-sign',
  Documents: 'file-text',
  'Guest Comms': 'mail',
  Operations: 'settings',
}

// ============================================================================
// Default Templates (31 total)
// ============================================================================

export const DEFAULT_AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // ==========================================================================
  // AVAILABILITY (6 templates, GUARD phase)
  // ==========================================================================

  // 1. Block High-Risk Reservations
  {
    id: 'block-high-risk-reservations',
    name: 'Block High-Risk Reservations',
    description:
      'Automatically block reservations flagged as high-risk by fraud detection systems.',
    phase: 'GUARD',
    triggerType: 'reservation.created',
    category: 'Availability',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.risk_score',
            operator: 'GTE',
            value: 80,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'block_reservation',
        actionConfig: {
          reason: 'High-risk reservation blocked for review',
        },
      },
      {
        actionType: 'send_notification',
        actionConfig: {
          channel: 'staff',
          priority: 'high',
          message: 'High-risk reservation blocked and pending review.',
        },
      },
    ],
  },

  // 2. Flag Suspicious Bookings
  {
    id: 'flag-suspicious-bookings',
    name: 'Flag Suspicious Bookings',
    description:
      'Flag reservations with suspicious patterns (short notice, high value, new guest) for manual review.',
    phase: 'GUARD',
    triggerType: 'reservation.created',
    category: 'Availability',
    conditionGroups: [
      {
        logicOperator: 'OR',
        conditions: [
          {
            variable: 'reservation.is_new_guest',
            operator: 'IS_TRUE',
            value: true,
          },
          {
            variable: 'reservation.total_value',
            operator: 'GTE',
            value: 1000,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'flag_for_review',
        actionConfig: {
          reason: 'Suspicious booking pattern detected - manual review required',
        },
      },
    ],
  },

  // 3. Require Minimum Lead Time
  {
    id: 'require-minimum-lead-time',
    name: 'Require Minimum Lead Time',
    description:
      'Block reservations made with less than 24 hours notice to allow adequate preparation time.',
    phase: 'GUARD',
    triggerType: 'reservation.created',
    category: 'Availability',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.lead_time_hours',
            operator: 'LT',
            value: 24,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'block_reservation',
        actionConfig: {
          reason: 'Insufficient lead time - minimum 24 hours required',
        },
      },
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'lead_time_rejection',
        },
      },
    ],
  },

  // 4. Block Overlapping Reservations
  {
    id: 'block-overlapping-reservations',
    name: 'Block Overlapping Reservations',
    description:
      'Prevent double bookings by blocking reservations that overlap with existing confirmed bookings.',
    phase: 'GUARD',
    triggerType: 'reservation.created',
    category: 'Availability',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.has_overlap',
            operator: 'IS_TRUE',
            value: true,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'block_reservation',
        actionConfig: {
          reason: 'Overlapping reservation detected - site already booked',
        },
      },
    ],
  },

  // 5. Maximum Stay Duration Check
  {
    id: 'maximum-stay-duration-check',
    name: 'Maximum Stay Duration Check',
    description:
      'Block reservations exceeding the maximum allowed stay duration (14 nights) for property management purposes.',
    phase: 'GUARD',
    triggerType: 'reservation.created',
    category: 'Availability',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.duration_nights',
            operator: 'GT',
            value: 14,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'block_reservation',
        actionConfig: {
          reason: 'Stay duration exceeds maximum of 14 nights',
        },
      },
    ],
  },

  // 6. Blacklist Guest Check
  {
    id: 'blacklist-guest-check',
    name: 'Blacklist Guest Check',
    description:
      'Block reservations from blacklisted guests who have previously violated property policies.',
    phase: 'GUARD',
    triggerType: 'reservation.created',
    category: 'Availability',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'guest.is_blacklisted',
            operator: 'IS_TRUE',
            value: true,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'block_reservation',
        actionConfig: {
          reason: 'Guest is on blacklist - reservation blocked',
        },
      },
      {
        actionType: 'send_notification',
        actionConfig: {
          channel: 'staff',
          message: 'Blacklisted guest attempted booking.',
        },
      },
    ],
  },

  // ==========================================================================
  // PRICING (8 templates, PRICE phase)
  // ==========================================================================

  // 7. Early Bird Discount
  {
    id: 'early-bird-discount',
    name: 'Early Bird Discount',
    description:
      'Apply a 10% discount for reservations made at least 30 days in advance.',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.lead_time_days',
            operator: 'GTE',
            value: 30,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_discount',
        actionConfig: {
          type: 'percentage',
          value: 10,
          reason: 'Early bird discount - 30+ days advance booking',
        },
      },
    ],
  },

  // 8. Last-Minute Surcharge
  {
    id: 'last-minute-surcharge',
    name: 'Last-Minute Surcharge',
    description:
      'Apply a 15% surcharge for reservations made within 48 hours of arrival.',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.lead_time_hours',
            operator: 'LTE',
            value: 48,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_surcharge',
        actionConfig: {
          type: 'percentage',
          value: 15,
          reason: 'Last-minute booking surcharge',
        },
      },
    ],
  },

  // 9. Weekend Price Modifier
  {
    id: 'weekend-price-modifier',
    name: 'Weekend Price Modifier',
    description:
      'Apply a 20% price increase for reservations that include Friday or Saturday nights.',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'OR',
        conditions: [
          {
            variable: 'reservation.includes_friday',
            operator: 'IS_TRUE',
            value: true,
          },
          {
            variable: 'reservation.includes_saturday',
            operator: 'IS_TRUE',
            value: true,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_price_modifier',
        actionConfig: {
          type: 'percentage',
          value: 20,
          reason: 'Weekend premium pricing',
        },
      },
    ],
  },

  // 10. Holiday Surcharge
  {
    id: 'holiday-surcharge',
    name: 'Holiday Surcharge',
    description:
      'Apply a 25% surcharge for reservations during holiday periods (Memorial Day, July 4th, Labor Day, etc.).',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.is_holiday_period',
            operator: 'IS_TRUE',
            value: true,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_surcharge',
        actionConfig: {
          type: 'percentage',
          value: 25,
          reason: 'Holiday period surcharge',
        },
      },
    ],
  },

  // 11. Loyalty Discount
  {
    id: 'loyalty-discount',
    name: 'Loyalty Discount',
    description:
      'Apply a 15% discount for returning guests who have previously stayed at the property.',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'guest.is_returning',
            operator: 'IS_TRUE',
            value: true,
          },
          {
            variable: 'guest.previous_stays',
            operator: 'GTE',
            value: 1,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_discount',
        actionConfig: {
          type: 'percentage',
          value: 15,
          reason: 'Loyalty discount for returning guest',
        },
      },
    ],
  },

  // 12. Long-Stay Discount
  {
    id: 'long-stay-discount',
    name: 'Long-Stay Discount',
    description:
      'Apply a 20% discount for stays of 7 nights or longer to encourage extended bookings.',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.duration_nights',
            operator: 'GTE',
            value: 7,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_discount',
        actionConfig: {
          type: 'percentage',
          value: 20,
          reason: 'Long-stay discount - 7+ nights',
        },
      },
    ],
  },

  // 13. Group Booking Discount
  {
    id: 'group-booking-discount',
    name: 'Group Booking Discount',
    description:
      'Apply a 15% discount for group bookings with 3 or more sites reserved.',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.site_count',
            operator: 'GTE',
            value: 3,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_discount',
        actionConfig: {
          type: 'percentage',
          value: 15,
          reason: 'Group booking discount - 3+ sites',
        },
      },
    ],
  },

  // 14. Peak Season Pricing
  {
    id: 'peak-season-pricing',
    name: 'Peak Season Pricing',
    description:
      'Apply a 30% price modifier during peak summer season (June 15 - August 15).',
    phase: 'PRICE',
    triggerType: 'reservation.created',
    category: 'Pricing',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.is_peak_season',
            operator: 'IS_TRUE',
            value: true,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'apply_price_modifier',
        actionConfig: {
          type: 'percentage',
          value: 30,
          reason: 'Peak season pricing - summer premium',
        },
      },
    ],
  },

  // ==========================================================================
  // DOCUMENTS (4 templates, ENFORCE phase)
  // ==========================================================================

  // 15. Require ID Verification
  {
    id: 'require-id-verification',
    name: 'Require ID Verification',
    description:
      'Require guests to upload a valid government ID before check-in for security purposes.',
    phase: 'ENFORCE',
    triggerType: 'reservation.confirmed',
    category: 'Documents',
    actions: [
      {
        actionType: 'require_document',
        actionConfig: {
          document_type: 'government_id',
          deadline: 'check_in',
          message: 'Please upload a valid government-issued ID before check-in.',
        },
      },
    ],
  },

  // 16. Require Pet Agreement
  {
    id: 'require-pet-agreement',
    name: 'Require Pet Agreement',
    description:
      'Require guests with pets to sign a pet liability waiver and agreement before arrival.',
    phase: 'ENFORCE',
    triggerType: 'reservation.confirmed',
    category: 'Documents',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.has_pets',
            operator: 'IS_TRUE',
            value: true,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'require_document',
        actionConfig: {
          document_type: 'pet_agreement',
          deadline: 'check_in',
          message: 'Pet agreement required for guests bringing pets.',
        },
      },
    ],
  },

  // 17. Require Waiver Signature
  {
    id: 'require-waiver-signature',
    name: 'Require Waiver Signature',
    description:
      'Require all guests to sign a liability waiver before check-in for high-activity properties.',
    phase: 'ENFORCE',
    triggerType: 'reservation.confirmed',
    category: 'Documents',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'property.requires_waiver',
            operator: 'IS_TRUE',
            value: true,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'require_document',
        actionConfig: {
          document_type: 'liability_waiver',
          deadline: 'check_in',
          message: 'Liability waiver signature required before check-in.',
        },
      },
    ],
  },

  // 18. Require Deposit for High-Value
  {
    id: 'require-deposit-high-value',
    name: 'Require Deposit for High-Value',
    description:
      'Require a security deposit for reservations with a total value exceeding $500.',
    phase: 'ENFORCE',
    triggerType: 'reservation.confirmed',
    category: 'Documents',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'reservation.total_value',
            operator: 'GTE',
            value: 500,
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'require_deposit',
        actionConfig: {
          type: 'security_deposit',
          amount: 100,
          reason: 'Security deposit required for high-value reservations',
        },
      },
    ],
  },

  // ==========================================================================
  // GUEST COMMS (8 templates, COMMUNICATE phase)
  // ==========================================================================

  // 19. Welcome Email
  {
    id: 'welcome-email',
    name: 'Welcome Email',
    description:
      'Send a welcome email to guests when their reservation is confirmed with check-in instructions.',
    phase: 'COMMUNICATE',
    triggerType: 'reservation.confirmed',
    category: 'Guest Comms',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'welcome_email',
        },
      },
    ],
  },

  // 20. Check-in Reminder
  {
    id: 'check-in-reminder',
    name: 'Check-in Reminder',
    description:
      'Send guests a reminder email on the day of check-in with arrival instructions and access codes.',
    phase: 'COMMUNICATE',
    triggerType: 'reservation.checked_in',
    category: 'Guest Comms',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'check_in_reminder',
        },
      },
    ],
  },

  // 21. Check-out Thank You
  {
    id: 'checkout-thank-you',
    name: 'Check-out Thank You',
    description:
      'Send a thank you email to guests after they check out, expressing appreciation for their stay.',
    phase: 'COMMUNICATE',
    triggerType: 'reservation.checked_out',
    category: 'Guest Comms',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'thank_you_email',
        },
      },
    ],
  },

  // 22. Review Request
  {
    id: 'review-request',
    name: 'Review Request',
    description:
      'Send guests a review request email 3 days after check-out to encourage feedback.',
    phase: 'COMMUNICATE',
    triggerType: 'reservation.checked_out',
    category: 'Guest Comms',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'review_request',
        },
        delayValue: 3,
        delayUnit: 'days',
      },
    ],
  },

  // 23. Payment Confirmation
  {
    id: 'payment-confirmation',
    name: 'Payment Confirmation',
    description:
      'Send guests a payment receipt confirmation when a payment is successfully received.',
    phase: 'COMMUNICATE',
    triggerType: 'payment.received',
    category: 'Guest Comms',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'payment_receipt',
        },
      },
    ],
  },

  // 24. Payment Failed Alert
  {
    id: 'payment-failed-alert',
    name: 'Payment Failed Alert',
    description:
      'Notify both the guest and staff when a payment fails, allowing for quick resolution.',
    phase: 'COMMUNICATE',
    triggerType: 'payment.failed',
    category: 'Guest Comms',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'payment_failed',
        },
      },
      {
        actionType: 'send_notification',
        actionConfig: {
          channel: 'staff',
          message: 'Payment failed for reservation. Please follow up with guest.',
        },
      },
    ],
  },

  // 25. Pre-Arrival Email
  {
    id: 'pre-arrival-email',
    name: 'Pre-Arrival Email',
    description:
      'Send guests a pre-arrival email 2 days before check-in with packing tips and property details.',
    phase: 'COMMUNICATE',
    triggerType: 'reservation.confirmed',
    category: 'Guest Comms',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'pre_arrival',
        },
        delayValue: 2,
        delayUnit: 'days',
      },
    ],
  },

  // 26. VIP Guest Alert
  {
    id: 'vip-guest-alert',
    name: 'VIP Guest Alert',
    description:
      'Alert staff when a VIP guest makes a reservation, ensuring premium service preparation.',
    phase: 'COMMUNICATE',
    triggerType: 'reservation.created',
    category: 'Guest Comms',
    conditionGroups: [
      {
        logicOperator: 'AND',
        conditions: [
          {
            variable: 'guest.tier',
            operator: 'IS',
            value: 'vip',
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'send_notification',
        actionConfig: {
          channel: 'staff',
          priority: 'high',
          message: 'VIP guest reservation created. Prepare premium amenities.',
        },
      },
    ],
  },

  // ==========================================================================
  // OPERATIONS (5 templates, OPERATE phase)
  // ==========================================================================

  // 27. Housekeeping Trigger
  {
    id: 'housekeeping-trigger',
    name: 'Housekeeping Trigger',
    description:
      'Automatically create a housekeeping work order when guests check out.',
    phase: 'OPERATE',
    triggerType: 'reservation.checked_out',
    category: 'Operations',
    actions: [
      {
        actionType: 'create_work_order',
        actionConfig: {
          type: 'housekeeping',
          priority: 'high',
          assign_to: 'housekeeping_queue',
        },
      },
    ],
  },

  // 28. Maintenance Alert
  {
    id: 'maintenance-alert',
    name: 'Maintenance Alert',
    description:
      'Create a maintenance work order when a site maintenance event is detected.',
    phase: 'OPERATE',
    triggerType: 'site.maintenance_started',
    category: 'Operations',
    actions: [
      {
        actionType: 'create_work_order',
        actionConfig: {
          type: 'maintenance',
          priority: 'medium',
          assign_to: 'maintenance_queue',
        },
      },
      {
        actionType: 'update_site_status',
        actionConfig: {
          status: 'maintenance',
        },
      },
    ],
  },

  // 29. Site Status Update
  {
    id: 'site-status-update',
    name: 'Site Status Update',
    description:
      'Update site status to available after maintenance is completed.',
    phase: 'OPERATE',
    triggerType: 'site.maintenance_completed',
    category: 'Operations',
    actions: [
      {
        actionType: 'update_site_status',
        actionConfig: {
          status: 'available',
        },
      },
    ],
  },

  // 30. Staff Assignment
  {
    id: 'staff-assignment',
    name: 'Staff Assignment',
    description:
      'Automatically assign staff to work orders based on site location and staff availability.',
    phase: 'OPERATE',
    triggerType: 'maintenance.task_created',
    category: 'Operations',
    actions: [
      {
        actionType: 'assign_staff',
        actionConfig: {
          method: 'auto',
          based_on: 'availability',
        },
      },
    ],
  },

  // 31. Post-Checkout Inspection
  {
    id: 'post-checkout-inspection',
    name: 'Post-Checkout Inspection',
    description:
      'Create an inspection work order after guest checkout for quality assurance.',
    phase: 'OPERATE',
    triggerType: 'reservation.checked_out',
    category: 'Operations',
    actions: [
      {
        actionType: 'create_work_order',
        actionConfig: {
          type: 'inspection',
          priority: 'low',
          assign_to: 'inspection_queue',
        },
      },
    ],
  },

  // 32. High Priority Housekeeping Alert
  {
    id: 'housekeeping-high-priority-alert',
    name: 'High Priority Housekeeping Alert',
    description:
      'Notify staff when a high or urgent priority housekeeping task is created, ensuring immediate attention.',
    phase: 'OPERATE',
    triggerType: 'housekeeping.task_created',
    category: 'Operations',
    conditionGroups: [
      {
        logicOperator: 'OR',
        conditions: [
          {
            variable: 'housekeeping.priority',
            operator: 'IS',
            value: 'high',
          },
          {
            variable: 'housekeeping.priority',
            operator: 'IS',
            value: 'urgent',
          },
        ],
      },
    ],
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'housekeeping_high_priority',
        },
      },
      {
        actionType: 'send_notification',
        actionConfig: {
          channel: 'staff',
          priority: 'high',
          message: 'A high priority housekeeping task has been created. Immediate attention may be required.',
        },
      },
    ],
  },

  // 33. Housekeeping Task Completed
  {
    id: 'housekeeping-task-completed',
    name: 'Housekeeping Task Completed',
    description:
      'Notify staff and optionally the guest when a housekeeping task is completed, confirming site readiness.',
    phase: 'OPERATE',
    triggerType: 'housekeeping.task_completed',
    category: 'Operations',
    actions: [
      {
        actionType: 'send_email',
        actionConfig: {
          template: 'housekeeping_task_completed',
        },
      },
      {
        actionType: 'send_notification',
        actionConfig: {
          channel: 'staff',
          priority: 'low',
          message: 'A housekeeping task has been completed and the site is ready.',
        },
      },
    ],
  },
]
