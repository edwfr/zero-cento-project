import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET } from '@/app/api/feedback/route'
import { GET as GET_ID } from '@/app/api/feedback/[id]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { makeTrainerSession, makeTraineeSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated } from '../helpers/auth-mock'
import { callArg } from '../helpers/call-args'

// ─── Fixture data ─────────────────────────────────────────────────────────────

// Valid UUIDs required by Zod schema validation
const UUIDS = {
    wex: '11111111-1111-1111-1111-111111111111',
    exercise: '22222222-2222-2222-2222-222222222222',
    workout: '33333333-3333-3333-3333-333333333333',
    week: '44444444-4444-4444-4444-444444444444',
    program: '55555555-5555-5555-5555-555555555555',
    feedback: '66666666-6666-6666-6666-666666666666',
    feedbackPrev: '77777777-7777-7777-7777-777777777777',
}

const mockWorkoutExercise = {
    id: UUIDS.wex,
    exerciseId: UUIDS.exercise,
    workout: {
        id: UUIDS.workout,
        week: {
            id: UUIDS.week,
            program: {
                id: UUIDS.program,
                title: 'Powerlifting Block 1',
                trainerId: 'trainer-uuid-1',
                traineeId: 'trainee-uuid-1',
            },
        },
    },
}

const mockSets = [
    { setNumber: 1, reps: 5, weight: 100 },
    { setNumber: 2, reps: 5, weight: 100 },
    { setNumber: 3, reps: 5, weight: 100 },
]

const mockFeedback = {
    id: UUIDS.feedback,
    workoutExerciseId: UUIDS.wex,
    traineeId: 'trainee-uuid-1',
    actualRpe: 8.0,
    notes: 'Felt strong today',
    createdAt: new Date('2026-03-30T10:00:00Z'),
    updatedAt: new Date('2026-03-30T10:00:00Z'),
    setsPerformed: mockSets.map((s) => ({ id: `set-${s.setNumber}`, feedbackId: UUIDS.feedback, ...s })),
    workoutExercise: {
        id: UUIDS.wex,
        exerciseId: UUIDS.exercise,
        exercise: {
            id: UUIDS.exercise,
            name: 'Squat',
        },
        workout: {
            id: UUIDS.workout,
            week: {
                id: UUIDS.week,
                programId: UUIDS.program,
                program: {
                    id: UUIDS.program,
                    title: 'Powerlifting Block 1',
                    trainerId: 'trainer-uuid-1',
                    traineeId: 'trainee-uuid-1',
                },
            },
        },
    },
}

// Helper to build a NextRequest without the problematic AbortSignal
function makeRequest(url = 'http://localhost:3000/api/feedback', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns feedback list for trainee (own only)', async () => {
        asTrainee()

        const paginatedFeedback = [mockFeedback]
        prismaMock.exerciseFeedback.findMany.mockResolvedValue(paginatedFeedback as never)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)

        // Trainee filter should scope to their own traineeId
        const callArgs = callArg(prismaMock.exerciseFeedback.findMany.mock.calls[0][0])
        expect(callArgs.where.workoutExercise.workout.week.program.traineeId).toBe('trainee-uuid-1')
    })

    it('returns feedback list for trainer (own trainees only)', async () => {
        asTrainer()
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([mockFeedback] as never)

        const req = makeRequest()
        const res = await GET(req)

        expect(res.status).toBe(200)

        // Trainer filter should scope to their trainerId
        const callArgs = callArg(prismaMock.exerciseFeedback.findMany.mock.calls[0][0])
        expect(callArgs.where.workoutExercise.workout.week.program.trainerId).toBe('trainer-uuid-1')
    })

    it('admin sees all feedback without RBAC filter', async () => {
        asAdmin()
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([mockFeedback] as never)

        const req = makeRequest()
        const res = await GET(req)

        expect(res.status).toBe(200)

        const callArgs = callArg(prismaMock.exerciseFeedback.findMany.mock.calls[0][0])
        // Admin: no RBAC scoping on the where clause
        expect(callArgs.where.workoutExercise).toBeUndefined()
    })

    it('filters by traineeId query param', async () => {
        asTrainer()
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([mockFeedback] as never)

        const req = makeRequest('http://localhost:3000/api/feedback?traineeId=trainee-uuid-1')
        await GET(req)

        const callArgs = callArg(prismaMock.exerciseFeedback.findMany.mock.calls[0][0])
        expect(callArgs.where.workoutExercise.workout.week.program.traineeId).toBe('trainee-uuid-1')
    })

    it('filters by exerciseId query param', async () => {
        asTrainer()
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([mockFeedback] as never)

        const req = makeRequest('http://localhost:3000/api/feedback?exerciseId=exercise-uuid-1')
        await GET(req)

        const callArgs = callArg(prismaMock.exerciseFeedback.findMany.mock.calls[0][0])
        expect(callArgs.where.workoutExercise.exerciseId).toBe('exercise-uuid-1')
    })

    it('uses cursor pagination when cursor param provided', async () => {
        asTrainee()
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([mockFeedback] as never)

        const cursor = UUIDS.feedbackPrev
        const req = makeRequest(`http://localhost:3000/api/feedback?cursor=${cursor}`)
        await GET(req)

        const callArgs = callArg(prismaMock.exerciseFeedback.findMany.mock.calls[0][0])
        expect(callArgs.cursor).toEqual({ id: UUIDS.feedbackPrev })
        expect(callArgs.skip).toBe(1)
    })

    it('returns pagination.hasMore=true when more items exist', async () => {
        asTrainee()
        // Return limit+1 items to trigger hasMore
        const extraItems = Array.from({ length: 21 }, (_, i) => ({
            ...mockFeedback,
            id: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
        }))
        prismaMock.exerciseFeedback.findMany.mockResolvedValue(extraItems as never)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(body.data.pagination.hasMore).toBe(true)
        expect(body.data.items).toHaveLength(20)
        // nextCursor is the id of the last item in the sliced page (index 19)
        expect(body.data.pagination.nextCursor).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('returns 401 when not authenticated', async () => {asUnauthenticated()

        const req = makeRequest()
        const res = await GET(req)
        expect(res.status).toBe(401)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback/[id]
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/feedback/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns feedback detail for the owning trainee', async () => {
        asTrainee()
        prismaMock.exerciseFeedback.findUnique.mockResolvedValue(mockFeedback as never)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`);
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.feedback.id).toBe(UUIDS.feedback)
        expect(body.data.feedback.setsPerformed).toHaveLength(3)
    })

    it('returns feedback detail for the responsible trainer', async () => {
        asTrainer()
        prismaMock.exerciseFeedback.findUnique.mockResolvedValue(mockFeedback as never)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(200)
    })

    it('returns feedback detail for admin', async () => {
        asAdmin()
        prismaMock.exerciseFeedback.findUnique.mockResolvedValue(mockFeedback as never)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(200)
    })

    it('returns 403 when trainee requests feedback of another trainee', async () => {
        asTrainee(makeTraineeSession({ id: 'trainee-uuid-2', email: 'luigi@zerocento.it', firstName: 'Luigi', lastName: 'Atleta' })) // different trainee
        prismaMock.exerciseFeedback.findUnique.mockResolvedValue(mockFeedback as never) // belongs to trainee-uuid-1

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(403)
    })

    it('returns 403 when trainer requests feedback of another trainer\'s trainee', async () => {
        asTrainer(makeTrainerSession({ id: 'trainer-uuid-999', email: 'other@zerocento.it', firstName: 'Other', lastName: 'Trainer' }))
        prismaMock.exerciseFeedback.findUnique.mockResolvedValue(mockFeedback as never) // trainer-uuid-1 owns this

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(403)
    })

    it('returns 404 when feedback not found', async () => {
        asTrainee()
        prismaMock.exerciseFeedback.findUnique.mockResolvedValue(null)

        const req = makeRequest(`http://localhost:3000/api/feedback/aaaaaaaa-0000-0000-0000-000000000000`)
        const res = await GET_ID(req, withIdParam('aaaaaaaa-0000-0000-0000-000000000000'))

        expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {asUnauthenticated()

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(401)
    })
})
