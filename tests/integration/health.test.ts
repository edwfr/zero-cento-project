import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted above const declarations, so the spies they
// close over have to be created with vi.hoisted.
const { getUser, createClient } = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn() }))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({ createClient }))

import { GET } from '@/app/api/health/route'
import { prismaMock } from '../helpers/prisma-mock'

beforeEach(() => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as never)
    getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError' } })
    createClient.mockResolvedValue({ auth: { getUser } })
})

describe('GET /api/health', () => {
    it('returns a healthy envelope when database and auth are reachable', async () => {
        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data).toMatchObject({
            status: 'healthy',
            services: { database: 'up', auth: 'up' },
        })
        expect(body.meta.timestamp).toEqual(expect.any(String))
    })

    it('reports degraded auth without failing the health check', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthUnavailable' } })

        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.services.auth).toBe('degraded')
    })

    it('returns service unavailable when the database check fails', async () => {
        prismaMock.$queryRaw.mockRejectedValue(new Error('db down'))

        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(503)
        expect(body.error).toMatchObject({ code: 'INTERNAL_ERROR' })
    })
})
