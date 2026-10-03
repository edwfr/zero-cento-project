import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('handleApiError', () => {
    it('returns a thrown Response unchanged without logging or capturing', () => {
        const guard = Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

        const result = handleApiError(guard, { logMessage: 'x', message: 'y' })

        expect(result).toBe(guard)
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('captures an Error, logs it under err with context, and returns a 500', async () => {
        const boom = new Error('db down')

        const result = handleApiError(boom, {
            logMessage: 'Error fetching global admin report',
            message: 'Failed to fetch global report',
            key: 'internal.globalReportFailed',
            context: { programId: 'p1' },
        })

        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        expect(Sentry.captureException).toHaveBeenCalledWith(boom, {
            tags: { area: 'api' },
            extra: { programId: 'p1' },
        })
        expect(logger.error).toHaveBeenCalledWith(
            { err: boom, programId: 'p1' },
            'Error fetching global admin report'
        )
        expect(result.status).toBe(500)
        expect(await result.json()).toEqual({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch global report',
                key: 'internal.globalReportFailed',
            },
        })
    })

    it('omits key from the body when none is given', async () => {
        const result = handleApiError(new Error('x'), { logMessage: 'l', message: 'm' })

        const body = await result.json()
        expect(body.error).not.toHaveProperty('key')
        expect(body.error.message).toBe('m')
    })

    it('logs but does not capture client-side upstream errors (status < 500)', async () => {
        const samePassword = { message: 'New password should be different', status: 422, code: 'same_password' }

        const result = handleApiError(samePassword, { logMessage: 'l', message: 'm', key: 'k' })

        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(logger.error).toHaveBeenCalledWith({ err: samePassword }, 'l')
        expect(result.status).toBe(500)
        expect((await result.json()).error.key).toBe('k')
    })

    it('captures upstream errors with status >= 500', () => {
        const upstream = { message: 'gateway', status: 502 }

        handleApiError(upstream, { logMessage: 'l', message: 'm' })

        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    })

    it('logs but does not capture malformed JSON bodies (SyntaxError)', () => {
        const badJson = new SyntaxError('Unexpected token } in JSON at position 10')

        const result = handleApiError(badJson, { logMessage: 'l', message: 'm' })

        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(logger.error).toHaveBeenCalledWith({ err: badJson }, 'l')
        expect(result.status).toBe(500)
    })

    it('captures non-Error throwables', () => {
        const supabaseError = { message: 'unexpected payload' }

        const result = handleApiError(supabaseError, { logMessage: 'l', message: 'm' })

        expect(Sentry.captureException).toHaveBeenCalledWith(supabaseError, {
            tags: { area: 'api' },
            extra: undefined,
        })
        expect(result.status).toBe(500)
    })
})
