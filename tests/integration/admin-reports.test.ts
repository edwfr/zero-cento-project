import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/admin/reports/global/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asAdmin } from '../helpers/auth-mock'
import { requireRole } from '@/lib/auth'

function makeRequest() {
    return new NextRequest('http://localhost/api/admin/reports/global')
}

function mockAllCounts() {
    prismaMock.user.count.mockResolvedValue(10)
    prismaMock.trainingProgram.count.mockResolvedValue(5)
    prismaMock.exercise.count.mockResolvedValue(20)
    prismaMock.exerciseFeedback.count.mockResolvedValue(100)
    prismaMock.personalRecord.count.mockResolvedValue(50)
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.trainingProgram.findMany.mockResolvedValue([])
    prismaMock.$queryRaw.mockResolvedValue([{ total: BigInt(150000) }])
}

describe('GET /api/admin/reports/global', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 403 for non-admin', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Object.assign(new Response(null, { status: 403 }), {})
        )
        const res = await GET(makeRequest())
        expect(res.status).toBe(403)
    })

    it('returns 200 with all stats for admin', async () => {
        asAdmin()
        mockAllCounts()

        const res = await GET(makeRequest())
        const body = (await res.json()) as never

        expect(res.status).toBe(200)
        expect(body.data.users.total).toBe(10)
        expect(body.data.programs).toBeDefined()
        expect(body.data.volume.total).toBeDefined()
    })

    it('uses $queryRaw for volume (not findMany full table scan)', async () => {
        asAdmin()
        mockAllCounts()

        await GET(makeRequest())

        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
        // findMany should NOT be called for setPerformed (eliminated full table scan)
        // $queryRaw replaces it — verify it was called with a tagged template
        const call = prismaMock.$queryRaw.mock.calls[0]
        // Tagged template literal produces a TemplateStringsArray as first arg
        expect(Array.isArray(call[0])).toBe(true)
    })

    it('returns correct totalVolume from $queryRaw result', async () => {
        asAdmin()
        mockAllCounts()
        prismaMock.$queryRaw.mockResolvedValue([{ total: BigInt(250000) }])

        const res = await GET(makeRequest())
        const body = (await res.json()) as never

        expect(body.data.volume.total).toBe(250000)
    })

    it('handles zero volume when setPerformed is empty', async () => {
        asAdmin()
        mockAllCounts()
        prismaMock.$queryRaw.mockResolvedValue([{ total: BigInt(0) }])

        const res = await GET(makeRequest())
        const body = (await res.json()) as never

        expect(body.data.volume.total).toBe(0)
    })
})
