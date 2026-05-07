import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
        },
        workout: {
            findUnique: vi.fn(),
            delete: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}))

import { DELETE } from '@/app/api/programs/[id]/workouts/[workoutId]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest() {
    return new NextRequest(
        'http://localhost:3000/api/programs/prog-1/workouts/workout-1',
        { method: 'DELETE' }
    )
}

const mockTrainerSession = {
    user: { id: 'trainer-1', role: 'trainer' },
}

const baseProgram = {
    id: 'prog-1',
    trainerId: 'trainer-1',
    status: 'draft',
}

const baseWorkout = {
    id: 'workout-1',
    week: { programId: 'prog-1' },
}

describe('DELETE /api/programs/[id]/workouts/[workoutId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(baseProgram as any)
        vi.mocked(prisma.workout.findUnique).mockResolvedValue(baseWorkout as any)
        vi.mocked(prisma.workout.delete).mockResolvedValue(baseWorkout as any)
    })

    it('returns 200 and deletes the workout', async () => {
        const req = makeRequest()
        const res = await DELETE(req, {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data).toBeDefined()
        expect(vi.mocked(prisma.workout.delete)).toHaveBeenCalledWith({
            where: { id: 'workout-1' },
        })
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 403 when trainer does not own the program', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...baseProgram,
            trainerId: 'other-trainer',
        } as any)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 403 when program is not draft', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...baseProgram,
            status: 'active',
        } as any)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 404 when workout not found', async () => {
        vi.mocked(prisma.workout.findUnique).mockResolvedValue(null)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 when workout belongs to different program', async () => {
        vi.mocked(prisma.workout.findUnique).mockResolvedValue({
            id: 'workout-1',
            week: { programId: 'other-prog' },
        } as any)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 401 when unauthenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
        )
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(401)
    })
})
