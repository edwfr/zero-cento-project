import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession, mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
    requireAuth: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findFirst: vi.fn() },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/trainee/active-program/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const makeRequest = () => new NextRequest('http://localhost:3000/api/trainee/active-program')

beforeEach(() => {
    vi.clearAllMocks()
})

describe('GET /api/trainee/active-program', () => {
    it('returns 200 with id when active program exists', async () => {
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue({ id: 'prog-1' })

        const res = await GET(makeRequest())
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toEqual({ programId: 'prog-1' })
        expect(prisma.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { traineeId: mockTraineeSession.user.id, status: 'active' },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })
    })

    it('returns 404 when no active program', async () => {
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue(null)

        const res = await GET(makeRequest())
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
    })

    it('rejects non-trainees', async () => {
        ;(requireRole as any).mockImplementation(async () => {
            throw new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })
        })

        const res = await GET(makeRequest())
        expect(res.status).toBe(403)
    })
})
