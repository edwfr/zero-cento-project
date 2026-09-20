import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}))

import { DELETE } from '@/app/api/programs/[id]/workouts/[workoutId]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { makeTrainerSession } from '../helpers/sessions'
import { asTrainer, asUnauthenticated } from '../helpers/auth-mock'

function makeRequest() {
    return new NextRequest(
        'http://localhost:3000/api/programs/prog-1/workouts/workout-1',
        { method: 'DELETE' }
    )
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
        asTrainer(makeTrainerSession({ id: 'trainer-1' }))
        prismaMock.trainingProgram.findUnique.mockResolvedValue(baseProgram as never)
        prismaMock.workout.findUnique.mockResolvedValue(baseWorkout as never)
        prismaMock.workout.delete.mockResolvedValue(baseWorkout as never)
    })

    it('returns 200 and deletes the workout', async () => {
        const req = makeRequest()
        const res = await DELETE(req, {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data).toBeDefined()
        expect(prismaMock.workout.delete).toHaveBeenCalledWith({
            where: { id: 'workout-1' },
        })
    })

    it('returns 404 when program not found', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 403 when trainer does not own the program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...baseProgram,
            trainerId: 'other-trainer',
        } as never)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 403 when program is not draft', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...baseProgram,
            status: 'active',
        } as never)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('returns 404 when workout not found', async () => {
        prismaMock.workout.findUnique.mockResolvedValue(null)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 when workout belongs to different program', async () => {
        prismaMock.workout.findUnique.mockResolvedValue({
            id: 'workout-1',
            week: { programId: 'other-prog' },
        } as never)
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 401 when unauthenticated', async () => {
        asUnauthenticated()
        const res = await DELETE(makeRequest(), {
            params: Promise.resolve({ id: 'prog-1', workoutId: 'workout-1' }),
        })
        expect(res.status).toBe(401)
    })
})
