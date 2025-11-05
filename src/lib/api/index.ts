/**
 * API Utilities Index
 *
 * Central export point for all API utilities.
 */

// Response builders
export {
  success,
  error,
  deprecated,
  paginated,
  isErrorResponse,
} from './response'

export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiMeta,
  PaginationMeta,
} from './response'

// Error codes
export { ErrorCodes, getErrorByCode, fromErrorCode } from './errors'
export type { ErrorCodeDefinition, ErrorCode } from './errors'

// Types
export type {
  ApiResponse,
  PaginationParams,
  FilterParams,
  DateRangeFilter,
  TenantContext,
  Timestamps,
  ValidatedRequest,
} from './types'

// Validation (already exists)
export {
  validateApiResponse,
  createValidatedApiClient,
  createSuccessResponse,
  createErrorResponse,
  ApiValidationError,
} from './validate'
