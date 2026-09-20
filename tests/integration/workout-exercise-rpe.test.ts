import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/trainee/workout-exercises/[id]/feedback/rpe/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainee, asUnauthenticated } from '../helpers/auth-mock'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

const UUIDS = {
    workoutExercise: '11111111-1111-1111-1111-111111111111',
    feedback: '22222222-2222-2222-2222-222222222222',
}

const makeRequest = (body: Record<string, unknown>) =>
    new NextRequest(
        `http://localhost/api/trainee/workout-exercises/${UUIDS.workoutExercise}/feedback/rpe`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    )

describe('PATCH /api/trainee/workout-exercises/[id]/feedback/rpe', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainee()
        prismaMock.workoutExercise.findFirst.mockResolvedValue({ id: UUIDS.workoutExercise } as never)
        prismaMock.exerciseFeedback.upsert.mockResolvedValue({
            id: UUIDS.feedback,
            workoutExerciseId: UUIDS.workoutExercise,
            actualRpe: 7.5,
            date: new Date('2026-05-08T00:00:00.000Z'),
            updatedAt: new Date('2026-05-08T12:00:00.000Z'),
        } as never)
    })

    it('upserts only actualRpe without touching sets or cascade', async () => {
        const res = await PATCH(makeRequest({ actualRpe: 7.5 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.findFirst).toHaveBeenCalledTimes(1)
        expect(prismaMock.exerciseFeedback.upsert).toHaveBeenCalledTimes(1)
        expect(prismaMock.exerciseFeedback.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ actualRpe: 7.5 }),
                update: { actualRpe: 7.5 },
            })
        )
        expect(json.data.feedback.id).toBe(UUIDS.feedback)
        expect(json.data.feedback.actualRpe).toBe(7.5)
    })

    it('accepts null to clear RPE', async () => {
        prismaMock.exerciseFeedback.upsert.mockResolvedValue({
            id: UUIDS.feedback,
            workoutExerciseId: UUIDS.workoutExercise,
            actualRpe: null,
            date: new Date('2026-05-08T00:00:00.000Z'),
            updatedAt: new Date('2026-05-08T12:00:00.000Z'),
        } as never)

        const res = await PATCH(makeRequest({ actualRpe: null }), withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(prismaMock.exerciseFeedback.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: { actualRpe: null },
            })
        )
    })

    it('returns 400 when actualRpe is out of range', async () => {
        const res = await PATCH(makeRequest({ actualRpe: 11 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns 400 when actualRpe is not in 0.5 steps', async () => {
        const res = await PATCH(makeRequest({ actualRpe: 7.3 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when trainee does not own the workout exercise', async () => {
        prismaMock.workoutExercise.findFirst.mockResolvedValue(null as never)

        const res = await PATCH(makeRequest({ actualRpe: 7.5 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
        expect(prismaMock.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated', async () => {asUnauthenticated()

        const res = await PATCH(makeRequest({ actualRpe: 7.5 }), withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(401)
    })
})
