import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/completion-service', () => ({
    cascadeCompletion: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { PATCH } from '@/app/api/trainee/workout-exercises/[id]/feedback/route'
import { cascadeCompletion } from '@/lib/completion-service'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainee, asUnauthenticated } from '../helpers/auth-mock'

const UUIDS = {
    workoutExercise: '11111111-1111-1111-1111-111111111111',
    feedback: '22222222-2222-2222-2222-222222222222',
}

const makeRequest = (body: Record<string, unknown>) =>
    new NextRequest(
        `http://localhost/api/trainee/workout-exercises/${UUIDS.workoutExercise}/feedback`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    )

describe('PATCH /api/trainee/workout-exercises/[id]/feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainee()
        prismaMock.workoutExercise.findFirst.mockResolvedValue({
            id: UUIDS.workoutExercise,
            sets: 1,
        } as never)
        prismaMock.exerciseFeedback.upsert.mockResolvedValue({
            id: UUIDS.feedback,
            workoutExerciseId: UUIDS.workoutExercise,
            actualRpe: 8,
            notes: null,
            date: new Date('2026-04-29T00:00:00.000Z'),
            updatedAt: new Date('2026-04-29T12:00:00.000Z'),
        } as never)
        prismaMock.setPerformed.upsert.mockResolvedValue({ setNumber: 1 } as never)
        prismaMock.setPerformed.count
            .mockResolvedValueOnce(1) // completed planned sets
            .mockResolvedValueOnce(0) // incomplete planned sets
        vi.mocked(cascadeCompletion).mockResolvedValue({
            workoutExercise: { id: UUIDS.workoutExercise, isCompleted: true },
            workout: { id: 'workout-1', isCompleted: true },
            week: { id: 'week-1', isCompleted: false, weekNumber: 2 },
            program: { id: 'program-1', status: 'active' },
        } as never)
    })

    it('upserts feedback and set, cascades completion when set is completed', async () => {
        const request = makeRequest({
            actualRpe: 8,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100, actualRpe: 8.5 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.findFirst).toHaveBeenCalledTimes(1)
        expect(prismaMock.exerciseFeedback.upsert).toHaveBeenCalledTimes(1)
        expect(prismaMock.setPerformed.upsert).toHaveBeenCalledTimes(1)
        expect(prismaMock.setPerformed.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({
                    feedbackId: UUIDS.feedback,
                    setNumber: 1,
                    reps: 5,
                    weight: 100,
                    completed: true,
                    actualRpe: 8.5,
                }),
                update: expect.objectContaining({
                    reps: 5,
                    weight: 100,
                    completed: true,
                    actualRpe: 8.5,
                }),
            })
        )
        expect(cascadeCompletion).toHaveBeenCalledWith(UUIDS.workoutExercise, true)
        expect(json.data.feedback.id).toBe(UUIDS.feedback)
        expect(json.data.cascade.workoutExercise.isCompleted).toBe(true)
    })

    it('stores set actualRpe as null when omitted', async () => {
        const request = makeRequest({
            actualRpe: 8,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(prismaMock.setPerformed.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ actualRpe: null }),
                update: expect.objectContaining({ actualRpe: null }),
            })
        )
    })

    it('marks exercise incomplete when at least one set is not completed', async () => {
        prismaMock.workoutExercise.findFirst.mockResolvedValue({
            id: UUIDS.workoutExercise,
            sets: 2,
        } as never)
        prismaMock.setPerformed.count
            .mockReset()
            .mockResolvedValueOnce(1) // completed planned sets
            .mockResolvedValueOnce(1) // incomplete planned sets

        const request = makeRequest({
            actualRpe: 7.5,
            set: { setNumber: 2, completed: false, reps: 0, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(cascadeCompletion).toHaveBeenCalledWith(UUIDS.workoutExercise, false)
    })

    it('keeps exercise incomplete when not all planned sets are saved yet', async () => {
        prismaMock.workoutExercise.findFirst.mockResolvedValue({
            id: UUIDS.workoutExercise,
            sets: 3,
        } as never)
        prismaMock.setPerformed.count
            .mockReset()
            .mockResolvedValueOnce(1) // completed planned sets
            .mockResolvedValueOnce(0) // incomplete planned sets

        const request = makeRequest({
            actualRpe: 8,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(cascadeCompletion).toHaveBeenCalledWith(UUIDS.workoutExercise, false)
    })

    it('skips setPerformed upsert when no set provided', async () => {
        prismaMock.setPerformed.count
            .mockReset()
            .mockResolvedValueOnce(0)  // total sets
            .mockResolvedValueOnce(0) // incomplete sets

        const request = makeRequest({ actualRpe: 8, notes: 'Felt good' })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(prismaMock.setPerformed.upsert).not.toHaveBeenCalled()
        expect(cascadeCompletion).toHaveBeenCalledWith(UUIDS.workoutExercise, false)
    })

    it('returns 400 when validation fails', async () => {
        const request = makeRequest({ actualRpe: 11 })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns 400 when set actualRpe is invalid', async () => {
        const request = makeRequest({
            actualRpe: 8,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100, actualRpe: 7.3 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns 404 when trainee does not own the workout exercise', async () => {
        prismaMock.workoutExercise.findFirst.mockResolvedValue(null as never)

        const request = makeRequest({
            actualRpe: null,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
        expect(prismaMock.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns the auth response when unauthenticated', async () => {asUnauthenticated()

        const request = makeRequest({
            actualRpe: null,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(401)
    })
})
