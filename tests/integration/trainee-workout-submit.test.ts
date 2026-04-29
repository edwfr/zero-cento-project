import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        workout: { findFirst: vi.fn() },
        exerciseFeedback: { upsert: vi.fn() },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/trainee/workouts/[id]/submit/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const UUIDS = {
    workout: '11111111-1111-1111-1111-111111111111',
    wex1: '22222222-2222-2222-2222-222222222222',
    wex2: '33333333-3333-3333-3333-333333333333',
    feedback1: '44444444-4444-4444-4444-444444444444',
    feedback2: '55555555-5555-5555-5555-555555555555',
}

describe('POST /api/trainee/workouts/[id]/submit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
    })

    it('upserts feedback for all exercises in a single transaction', async () => {
        ;(prisma.workout.findFirst as any).mockResolvedValue({
            id: UUIDS.workout,
            workoutExercises: [{ id: UUIDS.wex1 }, { id: UUIDS.wex2 }],
        })
        ;(prisma.$transaction as any).mockResolvedValue([
            { id: UUIDS.feedback1, workoutExerciseId: UUIDS.wex1 },
            { id: UUIDS.feedback2, workoutExerciseId: UUIDS.wex2 },
        ])

        const body = {
            notes: 'great session',
            exercises: [
                {
                    workoutExerciseId: UUIDS.wex1,
                    actualRpe: 8,
                    sets: [{ setNumber: 1, completed: true, reps: 5, weight: 100 }],
                },
                {
                    workoutExerciseId: UUIDS.wex2,
                    actualRpe: 7.5,
                    sets: [{ setNumber: 1, completed: true, reps: 8, weight: 60 }],
                },
            ],
        }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.feedbacks).toHaveLength(2)
        expect(prisma.workout.findFirst).toHaveBeenCalledTimes(1)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('returns 404 when trainee does not own the workout', async () => {
        ;(prisma.workout.findFirst as any).mockResolvedValue(null)

        const body = {
            notes: null,
            exercises: [
                {
                    workoutExerciseId: UUIDS.wex1,
                    actualRpe: null,
                    sets: [{ setNumber: 1, completed: true, reps: 5, weight: 100 }],
                },
            ],
        }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        expect(res.status).toBe(404)
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('returns 400 when an exercise in body is not in the workout', async () => {
        ;(prisma.workout.findFirst as any).mockResolvedValue({
            id: UUIDS.workout,
            workoutExercises: [{ id: UUIDS.wex1 }],
        })

        const body = {
            notes: null,
            exercises: [
                {
                    workoutExerciseId: UUIDS.wex2,
                    actualRpe: null,
                    sets: [{ setNumber: 1, completed: true, reps: 5, weight: 100 }],
                },
            ],
        }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        expect(res.status).toBe(400)
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('returns 400 on schema validation error (empty exercises)', async () => {
        const body = { notes: null, exercises: [] }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        expect(res.status).toBe(400)
    })
})
