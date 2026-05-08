import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        workoutExercise: {
            findFirst: vi.fn(),
        },
        exerciseFeedback: {
            upsert: vi.fn(),
        },
        setPerformed: {
            upsert: vi.fn(),
            count: vi.fn(),
        },
    },
}))

vi.mock('@/lib/completion-service', () => ({
    cascadeCompletion: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { PATCH } from '@/app/api/trainee/workout-exercises/[id]/feedback/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cascadeCompletion } from '@/lib/completion-service'

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
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue({ id: UUIDS.workoutExercise } as any)
        vi.mocked(prisma.exerciseFeedback.upsert).mockResolvedValue({
            id: UUIDS.feedback,
            workoutExerciseId: UUIDS.workoutExercise,
            actualRpe: 8,
            notes: null,
            date: new Date('2026-04-29T00:00:00.000Z'),
            updatedAt: new Date('2026-04-29T12:00:00.000Z'),
        } as any)
        vi.mocked(prisma.setPerformed.upsert).mockResolvedValue({ setNumber: 1 } as any)
        vi.mocked(prisma.setPerformed.count)
            .mockResolvedValueOnce(1)  // total sets
            .mockResolvedValueOnce(0) // incomplete sets
        vi.mocked(cascadeCompletion).mockResolvedValue({
            workoutExercise: { id: UUIDS.workoutExercise, isCompleted: true },
            workout: { id: 'workout-1', isCompleted: true },
            week: { id: 'week-1', isCompleted: false, weekNumber: 2 },
            program: { id: 'program-1', status: 'active' },
        } as any)
    })

    it('upserts feedback and set, cascades completion when set is completed', async () => {
        const request = makeRequest({
            actualRpe: 8,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(prisma.workoutExercise.findFirst).toHaveBeenCalledTimes(1)
        expect(prisma.exerciseFeedback.upsert).toHaveBeenCalledTimes(1)
        expect(prisma.setPerformed.upsert).toHaveBeenCalledTimes(1)
        expect(cascadeCompletion).toHaveBeenCalledWith(UUIDS.workoutExercise, true)
        expect(json.data.feedback.id).toBe(UUIDS.feedback)
        expect(json.data.cascade.workoutExercise.isCompleted).toBe(true)
    })

    it('marks exercise incomplete when at least one set is not completed', async () => {
        vi.mocked(prisma.setPerformed.count)
            .mockReset()
            .mockResolvedValueOnce(2)  // total sets
            .mockResolvedValueOnce(1) // incomplete sets

        const request = makeRequest({
            actualRpe: 7.5,
            set: { setNumber: 2, completed: false, reps: 0, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(cascadeCompletion).toHaveBeenCalledWith(UUIDS.workoutExercise, false)
    })

    it('skips setPerformed upsert when no set provided', async () => {
        vi.mocked(prisma.setPerformed.count)
            .mockReset()
            .mockResolvedValueOnce(0)  // total sets
            .mockResolvedValueOnce(0) // incomplete sets

        const request = makeRequest({ actualRpe: 8, notes: 'Felt good' })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(prisma.setPerformed.upsert).not.toHaveBeenCalled()
        expect(cascadeCompletion).toHaveBeenCalledWith(UUIDS.workoutExercise, false)
    })

    it('returns 400 when validation fails', async () => {
        const request = makeRequest({ actualRpe: 11 })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
        expect(prisma.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns 404 when trainee does not own the workout exercise', async () => {
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null as any)

        const request = makeRequest({
            actualRpe: null,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
        expect(prisma.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns the auth response when unauthenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
        )

        const request = makeRequest({
            actualRpe: null,
            set: { setNumber: 1, completed: true, reps: 5, weight: 100 },
        })

        const res = await PATCH(request, withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(401)
    })
})
