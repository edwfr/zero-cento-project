import * as Sentry from '@sentry/nextjs'
import { apiError } from './api-response'
import { logger } from './logger'

export interface HandleApiErrorOptions {
    /** pino message, kept verbatim from the route's previous logger.error call */
    logMessage: string
    /** client-facing message returned in the 500 body */
    message: string
    /** i18n key for the client-side error message */
    key?: string
    /** ids useful for debugging (programId, workoutId, ...) — sent to logs and Sentry extra */
    context?: Record<string, unknown>
}

/**
 * Shared catch tail for API route handlers.
 *
 * Guards (requireAuth/requireRole/ownership) throw a Response — those pass through
 * untouched. Anything else is an unexpected failure: log it, report it to Sentry,
 * and answer with a generic 500. Sentry is never called for 4xx.
 */
export function handleApiError(error: unknown, opts: HandleApiErrorOptions): Response {
    if (error instanceof Response) return error

    logger.error({ err: error, ...opts.context }, opts.logMessage)
    Sentry.captureException(error, { tags: { area: 'api' }, extra: opts.context })

    return apiError('INTERNAL_ERROR', opts.message, 500, undefined, opts.key)
}
