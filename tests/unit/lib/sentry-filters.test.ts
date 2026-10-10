import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { shouldDropClientEvent } from '@/lib/sentry-filters'

function eventWith(type: string, value = 'msg', filenames: string[] = ['https://app.zerocento.it/_next/static/chunks/main.js']): ErrorEvent {
    return {
        type: undefined,
        exception: {
            values: [{
                type,
                value,
                stacktrace: { frames: filenames.map((filename) => ({ filename })) },
            }],
        },
    } as ErrorEvent
}

describe('shouldDropClientEvent', () => {
    it('drops AbortError (cancelled fetch / navigation)', () => {
        expect(shouldDropClientEvent(eventWith('AbortError'))).toBe(true)
    })

    it('drops ChunkLoadError (stale chunks after a deploy)', () => {
        expect(shouldDropClientEvent(eventWith('ChunkLoadError'))).toBe(true)
    })

    it('drops "Loading chunk N failed" reported as a plain Error', () => {
        expect(shouldDropClientEvent(eventWith('Error', 'Loading chunk 42 failed.'))).toBe(true)
    })

    it('drops errors whose frames all come from browser extensions', () => {
        const event = eventWith('TypeError', 'x', [
            'chrome-extension://abc/content.js',
            'moz-extension://def/inject.js',
        ])
        expect(shouldDropClientEvent(event)).toBe(true)
    })

    it('drops service worker registration "Rejected" (browser refused register)', () => {
        const event = {
            type: undefined,
            exception: {
                values: [{
                    type: 'Error',
                    value: 'Rejected',
                    stacktrace: { frames: [
                        { filename: 'https://app.zerocento.it/_next/static/chunks/a.js', function: 'o.register' },
                        { filename: '<anonymous>', function: 'ServiceWorkerContainer.register' },
                    ] },
                }],
            },
        } as ErrorEvent
        expect(shouldDropClientEvent(event)).toBe(true)
    })

    it('keeps "Rejected" errors that do not come from service worker registration', () => {
        expect(shouldDropClientEvent(eventWith('Error', 'Rejected'))).toBe(false)
    })

    it('drops supabase auth lock "stolen by another request"', () => {
        const value = 'Lock "lock:sb-abc-auth-token" was released because another request stole it'
        expect(shouldDropClientEvent(eventWith('Error', value))).toBe(true)
    })

    it('drops "Failed to fetch" on the trainee workout page', () => {
        const event = { ...eventWith('TypeError', 'Failed to fetch'), transaction: '/trainee/workouts/:id' } as ErrorEvent
        expect(shouldDropClientEvent(event)).toBe(true)
    })

    it('keeps "Failed to fetch" on other pages', () => {
        const event = { ...eventWith('TypeError', 'Failed to fetch'), transaction: '/trainer/programs/:id/edit' } as ErrorEvent
        expect(shouldDropClientEvent(event)).toBe(false)
    })

    it('keeps errors with at least one app frame', () => {
        const event = eventWith('TypeError', 'x', [
            'chrome-extension://abc/content.js',
            'https://app.zerocento.it/_next/static/chunks/page.js',
        ])
        expect(shouldDropClientEvent(event)).toBe(false)
    })

    it('keeps ordinary application errors', () => {
        expect(shouldDropClientEvent(eventWith('TypeError', 'Cannot read properties of undefined'))).toBe(false)
    })

    it('keeps events without exception data', () => {
        expect(shouldDropClientEvent({ type: undefined, message: 'hello' } as ErrorEvent)).toBe(false)
    })
})
