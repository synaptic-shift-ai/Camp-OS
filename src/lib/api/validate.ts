/**
 * API Validation Utilities
 *
 * Provides runtime validation for API requests and responses using Zod schemas.
 * This prevents silent failures from API contract mismatches (see: API_CONTRACT_SAFETY.md)
 */

import { type z } from "zod"

/**
 * Custom error class for API validation failures.
 *
 * Thrown when an API response doesn't match its expected schema.
 * This indicates a contract violation that needs immediate attention.
 */
export class ApiValidationError extends Error {
  constructor(
    public path: string,
    public errors: z.ZodError,
    public data: unknown
  ) {
    super(`API validation failed for ${path}`)
    this.name = "ApiValidationError"
  }
}

/**
 * Validate API response against a Zod schema.
 *
 * This is the core validation function that:
 * 1. Validates data against the schema at runtime
 * 2. Logs validation failures for observability
 * 3. Throws ApiValidationError if validation fails
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate (usually from API response)
 * @param endpoint - API endpoint for logging/debugging
 * @returns Validated data with proper typing
 * @throws ApiValidationError if validation fails
 *
 * @example
 * const validated = validateApiResponse(PropertySchema, rawData, '/api/v1/properties')
 */
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  endpoint: string
): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    // Log validation failure with full context
    console.error("[API Validation Failed]", {
      endpoint,
      errors: result.error.errors,
      receivedData: data,
      timestamp: new Date().toISOString()
    })

    // In production, send to monitoring system
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry/monitoring service
      // trackApiValidationFailure(endpoint, result.error, data)
    }

    throw new ApiValidationError(endpoint, result.error, data)
  }

  return result.data
}

/**
 * Create a type-safe API client with automatic validation.
 *
 * This factory function creates an API client that:
 * 1. Automatically validates all responses
 * 2. Provides type-safe access to data
 * 3. Handles errors consistently
 * 4. Works with React Query/SWR
 *
 * @param endpoint - Base API endpoint
 * @param schema - Zod schema for response validation
 * @returns Type-safe API client with get/post/patch/delete methods
 *
 * @example
 * const propertiesApi = createValidatedApiClient(
 *   '/api/v1/properties',
 *   PropertyListResponseSchema
 * )
 *
 * const properties = await propertiesApi.get()  // Type-safe and validated!
 */
export function createValidatedApiClient<TResponse>(
  endpoint: string,
  schema: z.ZodSchema<TResponse>
) {
  return {
    async get(params?: Record<string, string>): Promise<TResponse> {
      const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

      if (params) {
        Object.entries(params).forEach(([key, value]) =>
          url.searchParams.set(key, value)
        )
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`HTTP ${response.status}: ${error.error || response.statusText}`)
      }

      const data = await response.json()

      // Runtime validation - catches contract violations
      return validateApiResponse(schema, data, endpoint)
    },

    async post(body: unknown): Promise<TResponse> {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`HTTP ${response.status}: ${error.error || response.statusText}`)
      }

      const data = await response.json()
      return validateApiResponse(schema, data, endpoint)
    },

    async patch(body: unknown): Promise<TResponse> {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`HTTP ${response.status}: ${error.error || response.statusText}`)
      }

      const data = await response.json()
      return validateApiResponse(schema, data, endpoint)
    },

    async delete(): Promise<TResponse> {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`HTTP ${response.status}: ${error.error || response.statusText}`)
      }

      const data = await response.json()
      return validateApiResponse(schema, data, endpoint)
    }
  }
}

/**
 * Validation middleware for Next.js API routes.
 *
 * Use this to validate incoming request bodies before processing.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const body = await validateRequest(request, CreateSiteRequestSchema)
 *   // body is now type-safe and validated
 * }
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await request.json()
  return schema.parse(body) // Will throw ZodError if invalid
}

/**
 * Standard API response envelope.
 *
 * All APIs should return responses in this format for consistency.
 */
export type ApiSuccessResponse<T> = {
  success: true
  data: T
  meta: {
    timestamp: string
    version: string
    requestId: string
  }
}

export type ApiErrorResponse = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: {
    timestamp: string
    version: string
    requestId: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Helper to create standardized success responses.
 *
 * @example
 * return NextResponse.json(createSuccessResponse(site, "1.0"))
 */
export function createSuccessResponse<T>(
  data: T,
  version: string = "1.0",
  requestId?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version,
      requestId: requestId || ''
    }
  }
}

/**
 * Helper to create standardized error responses.
 *
 * @example
 * return NextResponse.json(
 *   createErrorResponse("VALIDATION_ERROR", "Invalid site number", details),
 *   { status: 400 }
 * )
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  version: string = "1.0",
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    meta: {
      timestamp: new Date().toISOString(),
      version,
      requestId: requestId || ''
    }
  }
}
