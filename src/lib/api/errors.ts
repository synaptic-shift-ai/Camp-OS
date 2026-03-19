/**
 * Standard API Error Codes
 *
 * Centralized error codes for consistent error handling across all APIs.
 * Each error code includes the code string, message, and default HTTP status.
 *
 * Error Code Format: {CATEGORY}_{NUMBER}
 * - AUTH: Authentication & Authorization errors
 * - RES: Reservation errors
 * - SITE: Site management errors
 * - PROP: Property errors
 * - GUEST: Guest management errors
 * - PAY: Payment errors
 * - VAL: Validation errors
 * - SYS: System errors
 *
 * @example
 * ```typescript
 * import { ErrorCodes } from '@/lib/api/errors'
 * import { error } from '@/lib/api/response'
 *
 * if (!site) {
 *   const err = ErrorCodes.SITE_001
 *   return error(err.code, err.message, err.status, request)
 * }
 * ```
 */

export type ErrorCodeDefinition = {
  code: string
  message: string
  status: number
}

export const ErrorCodes = {
  // ============================================================
  // Authentication & Authorization (AUTH_xxx)
  // ============================================================
  AUTH_001: {
    code: 'AUTH_001',
    message: 'Invalid or expired authentication token',
    status: 401,
  },
  AUTH_002: {
    code: 'AUTH_002',
    message: 'Insufficient permissions to perform this action',
    status: 403,
  },
  AUTH_003: {
    code: 'AUTH_003',
    message: 'Account not found or inactive',
    status: 404,
  },
  AUTH_004: {
    code: 'AUTH_004',
    message: 'Authentication required',
    status: 401,
  },
  AUTH_005: {
    code: 'AUTH_005',
    message: 'Invalid credentials',
    status: 401,
  },

  // ============================================================
  // Reservations (RES_xxx)
  // ============================================================
  RES_001: {
    code: 'RES_001',
    message: 'Reservation not found',
    status: 404,
  },
  RES_002: {
    code: 'RES_002',
    message: 'Site not available for selected dates',
    status: 409,
  },
  RES_003: {
    code: 'RES_003',
    message: 'Invalid date range',
    status: 400,
  },
  RES_004: {
    code: 'RES_004',
    message: 'Cannot modify confirmed reservation',
    status: 409,
  },
  RES_005: {
    code: 'RES_005',
    message: 'Check-out time expired',
    status: 410,
  },
  RES_006: {
    code: 'RES_006',
    message: 'Reservation already cancelled',
    status: 409,
  },
  RES_007: {
    code: 'RES_007',
    message: 'Cannot check in before check-in date',
    status: 400,
  },
  RES_008: {
    code: 'RES_008',
    message: 'Cannot check out before check-in',
    status: 400,
  },
  RES_009: {
    code: 'RES_009',
    message: 'Reservation conflicts with existing booking',
    status: 409,
  },
  RES_010: {
    code: 'RES_010',
    message: 'Cannot extend reservation - site unavailable',
    status: 409,
  },

  // ============================================================
  // Sites (SITE_xxx)
  // ============================================================
  SITE_001: {
    code: 'SITE_001',
    message: 'Site not found',
    status: 404,
  },
  SITE_002: {
    code: 'SITE_002',
    message: 'Site capacity exceeded',
    status: 400,
  },
  SITE_003: {
    code: 'SITE_003',
    message: 'Site not available',
    status: 409,
  },
  SITE_004: {
    code: 'SITE_004',
    message: 'Site number already exists',
    status: 409,
  },
  SITE_005: {
    code: 'SITE_005',
    message: 'Cannot delete site with active or future reservations',
    status: 409,
  },
  SITE_006: {
    code: 'SITE_006',
    message: 'Site requires housekeeping',
    status: 409,
  },

  // ============================================================
  // Properties (PROP_xxx)
  // ============================================================
  PROP_001: {
    code: 'PROP_001',
    message: 'Property not found',
    status: 404,
  },
  PROP_002: {
    code: 'PROP_002',
    message: 'Property not accepting bookings',
    status: 403,
  },
  PROP_003: {
    code: 'PROP_003',
    message: 'Property onboarding not completed',
    status: 403,
  },
  PROP_004: {
    code: 'PROP_004',
    message: 'Property slug already taken',
    status: 409,
  },
  PROP_005: {
    code: 'PROP_005',
    message: 'Stripe account not connected',
    status: 403,
  },
  PROP_006: {
    code: 'PROP_006',
    message: 'Cannot delete property with existing sites',
    status: 409,
  },

  // ============================================================
  // Guests (GUEST_xxx)
  // ============================================================
  GUEST_001: {
    code: 'GUEST_001',
    message: 'Guest not found',
    status: 404,
  },
  GUEST_002: {
    code: 'GUEST_002',
    message: 'Guest email already exists',
    status: 409,
  },
  GUEST_003: {
    code: 'GUEST_003',
    message: 'Cannot delete guest with active reservations',
    status: 409,
  },

  // ============================================================
  // Payments (PAY_xxx)
  // ============================================================
  PAY_001: {
    code: 'PAY_001',
    message: 'Payment failed',
    status: 402,
  },
  PAY_002: {
    code: 'PAY_002',
    message: 'Refund failed',
    status: 500,
  },
  PAY_003: {
    code: 'PAY_003',
    message: 'Invalid payment method',
    status: 400,
  },
  PAY_004: {
    code: 'PAY_004',
    message: 'Payment not found',
    status: 404,
  },
  PAY_005: {
    code: 'PAY_005',
    message: 'Payment already refunded',
    status: 409,
  },
  PAY_006: {
    code: 'PAY_006',
    message: 'Insufficient funds',
    status: 402,
  },
  PAY_007: {
    code: 'PAY_007',
    message: 'Payment intent creation failed',
    status: 500,
  },

  // ============================================================
  // Validation (VAL_xxx)
  // ============================================================
  VAL_001: {
    code: 'VAL_001',
    message: 'Invalid request data',
    status: 400,
  },
  VAL_002: {
    code: 'VAL_002',
    message: 'Required field missing',
    status: 400,
  },
  VAL_003: {
    code: 'VAL_003',
    message: 'Invalid email format',
    status: 400,
  },
  VAL_004: {
    code: 'VAL_004',
    message: 'Invalid phone number format',
    status: 400,
  },
  VAL_005: {
    code: 'VAL_005',
    message: 'Invalid date format',
    status: 400,
  },
  VAL_006: {
    code: 'VAL_006',
    message: 'Invalid UUID format',
    status: 400,
  },
  VAL_007: {
    code: 'VAL_007',
    message: 'Value out of allowed range',
    status: 400,
  },

  // ============================================================
  // System (SYS_xxx)
  // ============================================================
  SYS_001: {
    code: 'SYS_001',
    message: 'Internal server error',
    status: 500,
  },
  SYS_002: {
    code: 'SYS_002',
    message: 'Service temporarily unavailable',
    status: 503,
  },
  SYS_003: {
    code: 'SYS_003',
    message: 'Database connection error',
    status: 500,
  },
  SYS_004: {
    code: 'SYS_004',
    message: 'External service error',
    status: 502,
  },
  SYS_005: {
    code: 'SYS_005',
    message: 'Rate limit exceeded',
    status: 429,
  },
  SYS_006: {
    code: 'SYS_006',
    message: 'Request timeout',
    status: 408,
  },

  // ============================================================
  // Generic/Legacy Errors (for backward compatibility)
  // ============================================================
  RESOURCE_NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Resource not found',
    status: 404,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Validation error',
    status: 400,
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    status: 500,
  },

  // ============================================================
  // Additional Error Codes (v1 API compatibility)
  // ============================================================
  VALIDATION_001: {
    code: 'VAL_001',
    message: 'Request validation failed',
    status: 400,
  },
  VALIDATION_002: {
    code: 'VAL_002',
    message: 'Invalid field value',
    status: 400,
  },
  VALIDATION_003: {
    code: 'VAL_003',
    message: 'Constraint violation',
    status: 400,
  },
  RESOURCE_001: {
    code: 'RES_001',
    message: 'Resource not found',
    status: 404,
  },
  RESOURCE_004: {
    code: 'RES_004',
    message: 'Resource conflict',
    status: 409,
  },
  SERVER_001: {
    code: 'SYS_001',
    message: 'Internal server error',
    status: 500,
  },
  DUPLICATE_RESOURCE: {
    code: 'DUP_001',
    message: 'Resource already exists',
    status: 409,
  },
} as const

/**
 * Type for all error code keys
 */
export type ErrorCode = keyof typeof ErrorCodes

/**
 * Helper to get error definition by code string
 *
 * @example
 * ```typescript
 * const err = getErrorByCode('SITE_001')
 * if (err) {
 *   return error(err.code, err.message, err.status, request)
 * }
 * ```
 */
export function getErrorByCode(
  codeString: string
): ErrorCodeDefinition | undefined {
  const entry = Object.entries(ErrorCodes).find(
    ([_, value]) => value.code === codeString
  )
  return entry ? entry[1] : undefined
}

/**
 * Helper to create error response from error code
 *
 * @example
 * ```typescript
 * import { createErrorResponse } from '@/lib/api/errors'
 *
 * if (!site) {
 *   return NextResponse.json(
 *     createErrorResponse(ErrorCodes.SITE_001, request),
 *     { status: ErrorCodes.SITE_001.status }
 *   )
 * }
 * ```
 */
export function createErrorResponse(
  errorDef: ErrorCodeDefinition,
  request?: any,
  details?: unknown
) {
  return {
    success: false,
    error: {
      code: errorDef.code,
      message: errorDef.message,
      ...(details ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      requestId: request?.headers?.get('x-request-id') || crypto.randomUUID(),
    },
  }
}

/**
 * @deprecated Use createErrorResponse instead
 */
export function fromErrorCode(
  errorCode: ErrorCode,
  request?: any,
  details?: unknown
) {
  return createErrorResponse(ErrorCodes[errorCode], request, details)
}
