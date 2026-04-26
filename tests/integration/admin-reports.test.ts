import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAdminSession, mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        trainingProgram: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        exercise: { count: vi.fn() },
        exerciseFeedback: { count: vi.fn() },
        personalRecord: { count: vi.fn() },
        $queryRaw: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/admin/reports/global/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest() {
    return new NextRequest('http://localhost/api/admin/reports/global')
}

function mockAllCounts() {
    vi.mocked(prisma.user.count).mockResolvedValue(10)
    vi.mocked(prisma.trainingProgram.count).mockResolvedValue(5)
    vi.mocked(prisma.exercise.count).mockResolvedValue(20)
    vi.mocked(prisma.exerciseFeedback.count).mockResolvedValue(100)
    vi.mocked(prisma.personalRecord.count).mockResolvedValue(50)
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([])
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ total: BigInt(150000) }])
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
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        mockAllCounts()

        const res = await GET(makeRequest())
        const body = (await res.json()) as any

        expect(res.status).toBe(200)
        expect(body.data.users.total).toBe(10)
        expect(body.data.programs).toBeDefined()
        expect(body.data.volume.total).toBeDefined()
    })

    it('uses $queryRaw for volume (not findMany full table scan)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        mockAllCounts()

        await GET(makeRequest())

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
        // findMany should NOT be called for setPerformed (eliminated full table scan)
        // $queryRaw replaces it — verify it was called with a tagged template
        const call = vi.mocked(prisma.$queryRaw).mock.calls[0]
        // Tagged template literal produces a TemplateStringsArray as first arg
        expect(Array.isArray(call[0])).toBe(true)
    })

    it('returns correct totalVolume from $queryRaw result', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        mockAllCounts()
        vi.mocked(prisma.$queryRaw).mockResolvedValue([{ total: BigInt(250000) }])

        const res = await GET(makeRequest())
        const body = (await res.json()) as any

        expect(body.data.volume.total).toBe(250000)
    })

    it('handles zero volume when setPerformed is empty', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        mockAllCounts()
        vi.mocked(prisma.$queryRaw).mockResolvedValue([{ total: BigInt(0) }])

        const res = await GET(makeRequest())
        const body = (await res.json()) as any

        expect(body.data.volume.total).toBe(0)
    })
})
