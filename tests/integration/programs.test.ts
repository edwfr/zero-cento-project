import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockTrainerSession = {
    user: {
        id: 'trainer-uuid-1',
        email: 'trainer@zerocento.it',
        firstName: 'Marco',
        lastName: 'Trainer',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockAdminSession = {
    user: {
        id: 'admin-uuid-1',
        email: 'admin@zerocento.it',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
        trainingWeek: {
            createMany: vi.fn(),
        },
        workout: {
            createMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        trainerTrainee: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET, POST } from '@/app/api/programs/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { User } from '@prisma/client'

const mockPrograms = [
    {
        id: 'prog-1',
        title: 'Powerlifting Block 1',
        status: 'active',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-05-01'),
        durationWeeks: 8,
        workoutsPerWeek: 4,
        trainerId: 'trainer-uuid-1',
        traineeId: 'trainee-uuid-1',
        createdAt: new Date('2026-02-25'),
        trainer: { id: 'trainer-uuid-1', firstName: 'Marco', lastName: 'Trainer' },
        trainee: { id: 'trainee-uuid-1', firstName: 'Mario', lastName: 'Atleta' },
        _count: { trainingWeeks: 8, feedbacks: 12 },
    },
]

function makeRequest(url = 'http://localhost:3000/api/programs', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

describe('GET /api/programs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns programs for trainer with RBAC filter', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue(mockPrograms as any)
        vi.mocked(prisma.trainingProgram.count).mockResolvedValue(1)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        // Trainer's own programs filter should be applied
        expect(prisma.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ trainerId: 'trainer-uuid-1' }),
            })
        )
    })

    it('filters by status when query param provided', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue(mockPrograms as any)
        vi.mocked(prisma.trainingProgram.count).mockResolvedValue(1)

        const req = makeRequest('http://localhost:3000/api/programs?status=active')
        await GET(req)

        expect(prisma.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ status: 'active' }),
            })
        )
    })

    it('admin sees all programs without trainer filter', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue(mockPrograms as any)
        vi.mocked(prisma.trainingProgram.count).mockResolvedValue(5)

        const req = makeRequest()
        const res = await GET(req)

        expect(res.status).toBe(200)
        // Admin should NOT have trainerId filter applied
        const callArgs = vi.mocked(prisma.trainingProgram.findMany).mock.calls[0][0] as any
        expect(callArgs.where?.trainerId).toBeUndefined()
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeRequest()
        const res = await GET(req)
        expect(res.status).toBe(401)
    })
})

describe('POST /api/programs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates a new program as trainer', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const traineeId = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: traineeId,
            role: 'trainee',
        } as any)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId,
        } as any)

        const newProgram = {
            ...mockPrograms[0],
            id: 'new-prog-id',
            status: 'draft',
            trainingWeeks: [],
        }
        vi.mocked(prisma.trainingProgram.create).mockResolvedValue(newProgram as any)

        const req = makeRequest('http://localhost:3000/api/programs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Powerlifting Block 1',
                traineeId,
                durationWeeks: 8,
                workoutsPerWeek: 4,
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(201)
    })

    it('returns 400 for validation error (title too short)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const req = makeRequest('http://localhost:3000/api/programs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'PB', // ← too short (< 3 chars)
                traineeId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
                durationWeeks: 8,
                workoutsPerWeek: 4,
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })
})
