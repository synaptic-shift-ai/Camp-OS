/**
 * Standard API Response Utilities
 *
 * Provides consistent response formatting across all v1 APIs.
 * All responses follow the standard envelope pattern defined in API_STANDARDS.md
 *
 * @example
 * ```typescript
 * // Success response
 * return success({ site: siteData }, request)
 *
 * // Error response
 * return error('SITE_001', 'Site not found', 404, request)
 *
 * // Paginated response
 * return success(
 *   { sites: sitesData },
 *   request,
 *   { page: 1, limit: 25, total: 100, totalPages: 4 }
 * )
 * ```
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

/**
 * Metadata included in all API responses
 */
export type ApiMeta = {
  timestamp: string
  version: string
  requestId: string
  pagination?: PaginationMeta
}

/**
 * Pagination metadata for list endpoints
 */
export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Standard success response envelope
 */
export type ApiSuccessResponse<T = unknown> = {
  success: true
  data: T
  meta: ApiMeta
}

/**
 * Standard error response envelope
 */
export type ApiErrorResponse = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: Omit<ApiMeta, 'pagination'>
}

/** Minimal `{ success: false, message }` shape for specific endpoints (e.g. invite-staff duplicate email). */
export type ApiFlatErrorResponse = {
  success: false
  message: string
}

/**
 * Create a successful API response
 *
 * @param data - The response data
 * @param request - The Next.js request (optional, for extracting request ID)
 * @param pagination - Pagination metadata (optional, for list endpoints)
 * @param version - API version (defaults to '1.0')
 * @returns NextResponse with standard success envelope
 *
 * @example
 * ```typescript
 * const site = await getSite(id)
 * return success({ site }, request)
 * ```
 */
export function success<T>(
  data: T,
  request?: NextRequest,
  pagination?: PaginationMeta,
  version: string = '1.0'
): NextResponse<ApiSuccessResponse<T>> {
  const requestId = request?.headers.get('x-request-id') || randomUUID()

  const meta: ApiMeta = {
    timestamp: new Date().toISOString(),
    version,
    requestId,
  }

  if (pagination) {
    meta.pagination = pagination
  }

  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta,
  }

  const nextResponse = NextResponse.json(response)

  // Add standard headers
  nextResponse.headers.set('X-API-Version', version)
  nextResponse.headers.set('X-Request-ID', requestId)

  return nextResponse
}

/**
 * Create an error API response
 *
 * Supports both ErrorCodeDefinition objects and individual parameters for backward compatibility.
 *
 * @param codeOrDef - Error code string OR ErrorCodeDefinition object
 * @param messageOrRequest - Message string OR NextRequest (when using ErrorCodeDefinition)
 * @param statusOrDetails - HTTP status OR details object (when using ErrorCodeDefinition)
 * @param requestOrVersion - NextRequest OR version string
 * @param detailsOrUndefined - Additional error details
 * @param versionOrUndefined - API version
 * @returns NextResponse with standard error envelope
 *
 * @example
 * ```typescript
 * // New style with ErrorCodeDefinition
 * return error(ErrorCodes.SITE_001, request)
 *
 * // Old style with individual params
 * return error('SITE_001', 'Site not found', 404, request)
 * ```
 */
export function error(
  codeOrDef: string | { code: string; message: string; status: number },
  messageOrRequest?: string | NextRequest,
  statusOrDetails?: number | unknown,
  requestOrVersion?: NextRequest | string,
  detailsOrUndefined?: unknown,
  versionOrUndefined?: string
): NextResponse<ApiErrorResponse> {
  // Determine if first param is ErrorCodeDefinition
  const isErrorCodeDef = typeof codeOrDef === 'object' && 'code' in codeOrDef

  let code: string
  let message: string
  let status: number
  let request: NextRequest | undefined
  let details: unknown
  let version: string

  if (isErrorCodeDef) {
    // New style: error(ErrorCodes.XXX, request?, details?)
    code = codeOrDef.code
    message = codeOrDef.message
    status = codeOrDef.status
    request = typeof messageOrRequest === 'object' ? messageOrRequest : undefined
    details = statusOrDetails
    version = typeof requestOrVersion === 'string' ? requestOrVersion : '1.0'
  } else {
    // Old style: error(code, message, status, request?, details?, version?)
    code = codeOrDef
    message = messageOrRequest as string
    status = statusOrDetails as number
    request = requestOrVersion as NextRequest | undefined
    details = detailsOrUndefined
    version = versionOrUndefined || '1.0'
  }
  const requestId = request?.headers.get('x-request-id') || randomUUID()

  const errorObj: { code: string; message: string; details?: unknown } = {
    code,
    message,
  }

  if (details !== undefined) {
    errorObj.details = details
  }

  const response: ApiErrorResponse = {
    success: false,
    error: errorObj,
    meta: {
      timestamp: new Date().toISOString(),
      version,
      requestId,
    },
  }

  const nextResponse = NextResponse.json(response, { status })

  // Add standard headers
  nextResponse.headers.set('X-API-Version', version)
  nextResponse.headers.set('X-Request-ID', requestId)

  return nextResponse
}

/**
 * Error response with only `success` and `message` (no `error` / `meta` envelope).
 */
export function errorFlatMessage(
  message: string,
  status: number,
  request?: NextRequest
): NextResponse<ApiFlatErrorResponse> {
  const nextResponse = NextResponse.json(
    { success: false as const, message },
    { status },
  )
  const requestId = request?.headers.get('x-request-id') || randomUUID()
  nextResponse.headers.set('X-Request-ID', requestId)
  return nextResponse
}

/**
 * Create a deprecated endpoint response
 *
 * Wraps the actual response with deprecation headers.
 * Use for old endpoints during migration period.
 *
 * @param response - The actual response to return
 * @param sunsetDate - ISO 8601 date when endpoint will be removed
 * @param newEndpoint - URL of the new endpoint to use
 * @returns Response with deprecation headers
 *
 * @example
 * ```typescript
 * const actualResponse = success({ sites }, request)
 * return deprecated(
 *   actualResponse,
 *   '2025-06-01',
 *   '/api/v1/properties/123/sites'
 * )
 * ```
 */
export function deprecated<T>(
  response: NextResponse<T>,
  sunsetDate: string,
  newEndpoint: string
): NextResponse<T> {
  response.headers.set('Deprecation', 'true')
  response.headers.set('Sunset', sunsetDate)
  response.headers.set('Link', `<${newEndpoint}>; rel="successor-version"`)
  response.headers.set(
    'Warning',
    `299 - "This endpoint is deprecated and will be removed on ${sunsetDate}. Please use ${newEndpoint} instead."`
  )

  return response
}

/**
 * Helper to create paginated list response
 *
 * @param items - The list items
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param total - Total number of items
 * @param request - The Next.js request
 * @returns NextResponse with pagination metadata
 *
 * @example
 * ```typescript
 * const { data: sites, count } = await getSites(page, limit)
 * return paginated(
 *   { sites },
 *   page,
 *   limit,
 *   count,
 *   request
 * )
 * ```
 */
export function paginated<T>(
  items: T,
  page: number,
  limit: number,
  total: number,
  request?: NextRequest
): NextResponse<ApiSuccessResponse<T>> {
  const totalPages = Math.ceil(total / limit)

  return success(
    items,
    request,
    {
      page,
      limit,
      total,
      totalPages,
    }
  )
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(
  response: ApiSuccessResponse | ApiErrorResponse
): response is ApiErrorResponse {
  return response.success === false
}
