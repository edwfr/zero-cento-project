import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockAdminSession, mockTraineeSession } from './fixtures'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

// ─── File-specific fixtures ───────────────────────────────────────────────────

const mockTraineeOtherSession = {
    user: {
        id: 'trainee-uuid-2',
        email: 'luigi@zerocento.it',
        firstName: 'Luigi',
        lastName: 'Atleta',
        role: 'trainee' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        exerciseFeedback: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        setPerformed: {
            deleteMany: vi.fn(),
        },
        workoutExercise: {
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

import { GET, POST } from '@/app/api/feedback/route'
import { GET as GET_ID, PUT } from '@/app/api/feedback/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    completed: true,
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
    return new NextRequest(url, safeOptions as any)
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns feedback list for trainee (own only)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const paginatedFeedback = [mockFeedback]
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue(paginatedFeedback as any)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)

        // Trainee filter should scope to their own traineeId
        const callArgs = vi.mocked(prisma.exerciseFeedback.findMany).mock.calls[0][0] as any
        expect(callArgs.where.workoutExercise.workout.week.program.traineeId).toBe('trainee-uuid-1')
    })

    it('returns feedback list for trainer (own trainees only)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([mockFeedback] as any)

        const req = makeRequest()
        const res = await GET(req)

        expect(res.status).toBe(200)

        // Trainer filter should scope to their trainerId
        const callArgs = vi.mocked(prisma.exerciseFeedback.findMany).mock.calls[0][0] as any
        expect(callArgs.where.workoutExercise.workout.week.program.trainerId).toBe('trainer-uuid-1')
    })

    it('admin sees all feedback without RBAC filter', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([mockFeedback] as any)

        const req = makeRequest()
        const res = await GET(req)

        expect(res.status).toBe(200)

        const callArgs = vi.mocked(prisma.exerciseFeedback.findMany).mock.calls[0][0] as any
        // Admin: no RBAC scoping on the where clause
        expect(callArgs.where.workoutExercise).toBeUndefined()
    })

    it('filters by traineeId query param', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([mockFeedback] as any)

        const req = makeRequest('http://localhost:3000/api/feedback?traineeId=trainee-uuid-1')
        await GET(req)

        const callArgs = vi.mocked(prisma.exerciseFeedback.findMany).mock.calls[0][0] as any
        expect(callArgs.where.workoutExercise.workout.week.program.traineeId).toBe('trainee-uuid-1')
    })

    it('filters by exerciseId query param', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([mockFeedback] as any)

        const req = makeRequest('http://localhost:3000/api/feedback?exerciseId=exercise-uuid-1')
        await GET(req)

        const callArgs = vi.mocked(prisma.exerciseFeedback.findMany).mock.calls[0][0] as any
        expect(callArgs.where.workoutExercise.exerciseId).toBe('exercise-uuid-1')
    })

    it('uses cursor pagination when cursor param provided', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([mockFeedback] as any)

        const cursor = UUIDS.feedbackPrev
        const req = makeRequest(`http://localhost:3000/api/feedback?cursor=${cursor}`)
        await GET(req)

        const callArgs = vi.mocked(prisma.exerciseFeedback.findMany).mock.calls[0][0] as any
        expect(callArgs.cursor).toEqual({ id: UUIDS.feedbackPrev })
        expect(callArgs.skip).toBe(1)
    })

    it('returns pagination.hasMore=true when more items exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        // Return limit+1 items to trigger hasMore
        const extraItems = Array.from({ length: 21 }, (_, i) => ({
            ...mockFeedback,
            id: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
        }))
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue(extraItems as any)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(body.data.pagination.hasMore).toBe(true)
        expect(body.data.items).toHaveLength(20)
        // nextCursor is the id of the last item in the sliced page (index 19)
        expect(body.data.pagination.nextCursor).toMatch(/^[0-9a-f-]{36}$/)
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback (CREATE)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/feedback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const validPayload = {
        workoutExerciseId: UUIDS.wex,
        completed: true,
        actualRpe: 8.0,
        notes: 'Felt strong today',
        sets: mockSets,
    }

    it('creates new feedback and returns 201 with calculated metrics', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue(mockWorkoutExercise as any)
        vi.mocked(prisma.exerciseFeedback.findFirst).mockResolvedValue(null) // no existing
        vi.mocked(prisma.exerciseFeedback.create).mockResolvedValue(mockFeedback as any)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.feedback).toBeDefined()
        // totalVolume = 3 sets * 5 reps * 100 kg = 1500
        expect(body.data.calculated.totalVolume).toBe(1500)
        expect(body.data.calculated.avgRPE).toBe(8.0)
    })

    it('updates existing feedback (idempotency) and returns 200', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue(mockWorkoutExercise as any)
        vi.mocked(prisma.exerciseFeedback.findFirst).mockResolvedValue(mockFeedback as any) // existing!
        vi.mocked(prisma.exerciseFeedback.update).mockResolvedValue({
            ...mockFeedback,
            notes: 'Updated notes',
        } as any)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, notes: 'Updated notes' }),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(prisma.exerciseFeedback.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: mockFeedback.id },
            data: expect.objectContaining({
                notes: 'Updated notes',
                completed: true,
                actualRpe: 8,
                setsPerformed: expect.objectContaining({
                    deleteMany: {},
                    create: expect.arrayContaining([
                        expect.objectContaining({
                            setNumber: 1,
                            reps: 5,
                            weight: 100,
                        }),
                    ]),
                }),
            }),
        }))
        expect(body.data.feedback).toBeDefined()
    })

    it('creates feedback with sets only (no notes, no RPE)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue(mockWorkoutExercise as any)
        vi.mocked(prisma.exerciseFeedback.findFirst).mockResolvedValue(null)
        const minFeedback = {
            ...mockFeedback,
            notes: undefined,
            actualRpe: null,
            setsPerformed: [{ id: 'set-1', feedbackId: UUIDS.feedback, setNumber: 1, reps: 10, weight: 60 }],
        }
        vi.mocked(prisma.exerciseFeedback.create).mockResolvedValue(minFeedback as any)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workoutExerciseId: UUIDS.wex,
                completed: false,
                sets: [{ setNumber: 1, reps: 10, weight: 60 }],
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(201)
    })

    it('returns totalVolume=0 when sets have zero weight', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue(mockWorkoutExercise as any)
        vi.mocked(prisma.exerciseFeedback.findFirst).mockResolvedValue(null)

        const zeroWeightFeedback = {
            ...mockFeedback,
            setsPerformed: [
                { id: 'set-1', feedbackId: UUIDS.feedback, setNumber: 1, reps: 10, weight: 0 },
            ],
        }
        vi.mocked(prisma.exerciseFeedback.create).mockResolvedValue(zeroWeightFeedback as any)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workoutExerciseId: UUIDS.wex,
                completed: true,
                sets: [{ setNumber: 1, reps: 10, weight: 0 }],
            }),
        })

        const res = await POST(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.calculated.totalVolume).toBe(0)
    })

    it('returns 403 when trainee submits feedback for another trainee workout', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeOtherSession) // different trainee!
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue(mockWorkoutExercise as any) // belongs to trainee-uuid-1

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })

        const res = await POST(req)
        expect(res.status).toBe(403)
    })

    it('returns 404 when workout exercise not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue(null)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })

        const res = await POST(req)
        expect(res.status).toBe(404)
    })

    it('returns 400 for missing required fields (no sets)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workoutExerciseId: 'wex-uuid-1',
                completed: true,
                sets: [], // empty sets → validation error
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for invalid UUID in workoutExerciseId', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workoutExerciseId: 'not-a-uuid',
                completed: true,
                sets: mockSets,
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })

    it('returns 400 when actualRpe is out of range (< 5.0)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validPayload,
                actualRpe: 4.5, // below minimum of 5.0
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })

    it('returns 400 when actualRpe is not a multiple of 0.5', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validPayload,
                actualRpe: 7.3, // not a multiple of 0.5
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })

    it('returns 400 when reps exceed max (> 50)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validPayload,
                sets: [{ setNumber: 1, reps: 51, weight: 100 }],
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })

    it('returns 400 when weight exceeds max (> 500)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validPayload,
                sets: [{ setNumber: 1, reps: 5, weight: 505 }],
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })

    it('returns 400 when notes exceed 1000 characters', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validPayload,
                notes: 'a'.repeat(1001),
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })

        const res = await POST(req)
        expect(res.status).toBe(401)
    })

    it('returns 403 when accessed by trainer (trainee-only endpoint)', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
        )

        const req = makeRequest('http://localhost:3000/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })

        const res = await POST(req)
        expect(res.status).toBe(403)
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
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(mockFeedback as any)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`);
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.feedback.id).toBe(UUIDS.feedback)
        expect(body.data.feedback.setsPerformed).toHaveLength(3)
    })

    it('returns feedback detail for the responsible trainer', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(mockFeedback as any)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(200)
    })

    it('returns feedback detail for admin', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(mockFeedback as any)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(200)
    })

    it('returns 403 when trainee requests feedback of another trainee', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeOtherSession) // different trainee
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(mockFeedback as any) // belongs to trainee-uuid-1

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(403)
    })

    it('returns 403 when trainer requests feedback of another trainer\'s trainee', async () => {
        const otherTrainerSession = {
            user: {
                id: 'trainer-uuid-999',
                email: 'other@zerocento.it',
                firstName: 'Other',
                lastName: 'Trainer',
                role: 'trainer' as const,
                isActive: true,
            },
            supabaseUser: {} as any,
        }
        vi.mocked(requireRole).mockResolvedValue(otherTrainerSession)
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(mockFeedback as any) // trainer-uuid-1 owns this

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(403)
    })

    it('returns 404 when feedback not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(null)

        const req = makeRequest(`http://localhost:3000/api/feedback/aaaaaaaa-0000-0000-0000-000000000000`)
        const res = await GET_ID(req, withIdParam('aaaaaaaa-0000-0000-0000-000000000000'))

        expect(res.status).toBe(404)
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`)
        const res = await GET_ID(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(401)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/feedback/[id] (UPDATE)
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/feedback/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const validUpdatePayload = {
        workoutExerciseId: UUIDS.wex,
        completed: true,
        actualRpe: 8.5,
        notes: 'Updated notes after reflection',
        sets: [
            { setNumber: 1, reps: 5, weight: 102.5 },
            { setNumber: 2, reps: 5, weight: 102.5 },
            { setNumber: 3, reps: 4, weight: 102.5 },
        ],
    }

    it('updates feedback within 24h window and returns 200', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const recentFeedback = {
            ...mockFeedback,
            createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        }
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(recentFeedback as any)
        vi.mocked(prisma.setPerformed.deleteMany).mockResolvedValue({ count: 3 } as any)
        vi.mocked(prisma.exerciseFeedback.update).mockResolvedValue({
            ...mockFeedback,
            notes: validUpdatePayload.notes,
            actualRpe: 8.5,
        } as any)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUpdatePayload),
        })

        const res = await PUT(req, withIdParam(UUIDS.feedback))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(prisma.setPerformed.deleteMany).toHaveBeenCalledWith({
            where: { feedbackId: UUIDS.feedback },
        })
        expect(prisma.exerciseFeedback.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: UUIDS.feedback },
                data: expect.objectContaining({
                    notes: validUpdatePayload.notes,
                    actualRpe: 8.5,
                }),
            })
        )
        expect(body.data.feedback).toBeDefined()
    })

    it('returns 403 when feedback is older than 24h', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const oldFeedback = {
            ...mockFeedback,
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25), // 25 hours ago
        }
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(oldFeedback as any)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUpdatePayload),
        })

        const res = await PUT(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.message).toContain('24')
    })

    it('returns 403 when trainee modifies another trainee\'s feedback', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeOtherSession) // different trainee

        const recentFeedback = {
            ...mockFeedback,
            createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
        }
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(recentFeedback as any) // belongs to trainee-uuid-1

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUpdatePayload),
        })

        const res = await PUT(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(403)
    })

    it('returns 404 when feedback to update does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(null)

        const req = makeRequest(`http://localhost:3000/api/feedback/aaaaaaaa-0000-0000-0000-000000000000`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUpdatePayload),
        })

        const res = await PUT(req, withIdParam('aaaaaaaa-0000-0000-0000-000000000000'))

        expect(res.status).toBe(404)
    })

    it('returns 400 for validation error in update payload (empty sets)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validUpdatePayload,
                sets: [],
            }),
        })

        const res = await PUT(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUpdatePayload),
        })

        const res = await PUT(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(401)
    })

    it('returns 403 when trainer tries to update feedback (trainee-only)', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
        )

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUpdatePayload),
        })

        const res = await PUT(req, withIdParam(UUIDS.feedback))

        expect(res.status).toBe(403)
    })

    it('replaces sets on update (old sets deleted, new sets created)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const recentFeedback = {
            ...mockFeedback,
            createdAt: new Date(Date.now() - 1000 * 60 * 10), // 10 min ago
        }
        vi.mocked(prisma.exerciseFeedback.findUnique).mockResolvedValue(recentFeedback as any)
        vi.mocked(prisma.setPerformed.deleteMany).mockResolvedValue({ count: 3 } as any)
        vi.mocked(prisma.exerciseFeedback.update).mockResolvedValue(mockFeedback as any)

        const req = makeRequest(`http://localhost:3000/api/feedback/${UUIDS.feedback}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validUpdatePayload),
        })

        await PUT(req, withIdParam(UUIDS.feedback))

        // Both delete-then-create operations must be called
        expect(prisma.setPerformed.deleteMany).toHaveBeenCalledWith({
            where: { feedbackId: UUIDS.feedback },
        })
        expect(prisma.exerciseFeedback.update).toHaveBeenCalled()
    })
})
