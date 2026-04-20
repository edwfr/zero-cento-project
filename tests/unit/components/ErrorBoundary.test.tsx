import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'

// Mock Sentry before importing component
vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
}))

// Mock i18n
vi.mock('@/lib/i18n/client', () => ({
    default: {
        t: (key: string) => key,
    },
}))

// Mock Button
vi.mock('@/components/Button', () => ({
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
        React.createElement('button', { onClick }, children),
}))

import * as Sentry from '@sentry/nextjs'
import ErrorBoundary from '@/components/ErrorBoundary'

const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) throw new Error('test render error')
    return React.createElement('div', null, 'ok')
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // suppress console.error noise from React error boundary internals
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('calls Sentry.captureException with the error and componentStack when a child throws', () => {
        render(
            React.createElement(
                ErrorBoundary,
                null,
                React.createElement(ThrowingChild, { shouldThrow: true })
            )
        )

        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        const [capturedError, capturedHint] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(capturedError).toBeInstanceOf(Error)
        expect(capturedError.message).toBe('test render error')
        expect(capturedHint).toMatchObject({
            contexts: {
                react: {
                    componentStack: expect.any(String),
                },
            },
        })
    })

    it('does not call Sentry.captureException when no error occurs', () => {
        render(
            React.createElement(
                ErrorBoundary,
                null,
                React.createElement(ThrowingChild, { shouldThrow: false })
            )
        )

        expect(Sentry.captureException).not.toHaveBeenCalled()
    })
})
