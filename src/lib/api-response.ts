/**
 * API Response Helpers
 * Standardized response format for all API routes
 */

export interface ApiSuccessResponse<T = unknown> {
    data: T
    meta: {
        timestamp: string
    }
}

export interface ApiErrorResponse {
    error: {
        code: string
        message: string
        details?: unknown
        key?: string
    }
}

export type ApiErrorCode =
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'RATE_LIMIT_EXCEEDED'
    | 'INTERNAL_ERROR'

/**
 * Creates a standardized success response
 */
export function apiSuccess<T>(data: T, status = 200): Response {
    const response: ApiSuccessResponse<T> = {
        data,
        meta: {
            timestamp: new Date().toISOString(),
        },
    }
    return Response.json(response, { status })
}

/**
 * Creates a standardized error response
 */
export function apiError(
    code: ApiErrorCode,
    message: string,
    status: number,
    details?: unknown,
    key?: string
): Response {
    const response: ApiErrorResponse = {
        error: {
            code,
            message,
            details,
            ...(key !== undefined && { key }),
        },
    }
    return Response.json(response, { status })
}
