import { beforeEach, describe, expect, it, vi } from 'vitest'
import { keepaliveFetch } from '@/lib/keepalive-fetch'

describe('keepaliveFetch', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('passes keepalive: true to the underlying fetch', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
        vi.stubGlobal('fetch', fetchSpy)

        await keepaliveFetch('/api/x', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ a: 1 }),
        })

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const init = fetchSpy.mock.calls[0][1] as RequestInit
        expect(init.keepalive).toBe(true)
        expect(init.method).toBe('PATCH')
    })

    it('does not override an explicit keepalive: false', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetchSpy)

        await keepaliveFetch('/api/x', { method: 'POST', keepalive: false })

        const init = fetchSpy.mock.calls[0][1] as RequestInit
        expect(init.keepalive).toBe(false)
    })

    it('does not attach a signal by default', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetchSpy)

        await keepaliveFetch('/api/x', { method: 'PATCH' })

        const init = fetchSpy.mock.calls[0][1] as RequestInit
        expect(init.signal).toBeUndefined()
    })

    it('attaches AbortSignal.timeout when timeoutMs is provided and no signal exists', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetchSpy)

        await keepaliveFetch('/api/x', { method: 'PATCH', timeoutMs: 10_000 })

        const init = fetchSpy.mock.calls[0][1] as RequestInit
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })

    it('respects a caller-provided AbortSignal', async () => {
        const fetchSpy = vi.fn().mockResolvedValue(new Response('{}'))
        vi.stubGlobal('fetch', fetchSpy)

        const controller = new AbortController()
        await keepaliveFetch('/api/x', { method: 'PATCH', signal: controller.signal })

        const init = fetchSpy.mock.calls[0][1] as RequestInit
        expect(init.signal).toBe(controller.signal)
    })
})
