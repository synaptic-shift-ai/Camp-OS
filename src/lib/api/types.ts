/**
 * Common API Types
 *
 * Shared TypeScript types for API contracts.
 * These complement the Zod schemas in src/types/api/v1/schemas/
 */

import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiMeta,
  PaginationMeta,
} from './response'

/**
 * Generic API response (could be success or error)
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Pagination parameters for list endpoints
 */
export type PaginationParams = {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

/**
 * Common filter parameters
 */
export type FilterParams = {
  search?: string
  status?: string
  created_after?: string
  created_before?: string
  updated_after?: string
  updated_before?: string
}

/**
 * Date range filter
 */
export type DateRangeFilter = {
  start_date: string // ISO 8601
  end_date: string // ISO 8601
}

/**
 * Tenant context for multi-tenant operations
 */
export type TenantContext = {
  company_id?: string
  property_id?: string
  user_id?: string
}

/**
 * Standard timestamps present on all database entities
 */
export type Timestamps = {
  created_at: string
  updated_at: string
}

/**
 * API request with validated body
 */
export type ValidatedRequest<TBody = unknown, TParams = unknown> = {
  body: TBody
  params: TParams
  headers: Record<string, string>
  tenant: TenantContext
}

/**
 * Export response types for convenience
 */
export type { ApiSuccessResponse, ApiErrorResponse, ApiMeta, PaginationMeta }
