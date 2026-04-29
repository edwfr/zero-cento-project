import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockAdminSession } from './fixtures'

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
        exerciseFeedback: {
            findMany: vi.fn(),
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
        week: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        workoutExercise: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
            const tx = {
                workoutExercise: {
                    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
                    createMany: vi.fn().mockResolvedValue({ count: 1 }),
                },
            }
            return fn(tx)
        }),
        $queryRaw: vi.fn().mockResolvedValue([]),
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
import { POST as copyWeekPOST } from '@/app/api/programs/[id]/copy-week/route'
import { POST as copyFirstWeekPOST } from '@/app/api/programs/[id]/copy-first-week/route'
import { POST as publishPOST } from '@/app/api/programs/[id]/publish/route'
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
        weeks: [],
    },
]

function makeRequest(url = 'http://localhost:3000/api/programs', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

describe('GET /api/programs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([] as any)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([] as any)
        vi.mocked(prisma.$queryRaw).mockResolvedValue([] as any)
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

    it('keeps the stored active status in the response even when all workouts are complete', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([
            {
                id: 'prog-complete',
                title: 'Completed Block',
                status: 'active',
                startDate: new Date('2026-03-01'),
                durationWeeks: 1,
                workoutsPerWeek: 1,
                trainerId: 'trainer-uuid-1',
                traineeId: 'trainee-uuid-1',
                createdAt: new Date('2026-02-25'),
                completedAt: null,
                trainer: { id: 'trainer-uuid-1', firstName: 'Marco', lastName: 'Trainer' },
                trainee: { id: 'trainee-uuid-1', firstName: 'Mario', lastName: 'Atleta' },
                weeks: [{ id: 'week-1', weekNumber: 1, weekType: 'normal' }],
            },
        ] as any)
        // First $queryRaw: completion stats aggregate. Second: empty test-week aggregate.
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([
                {
                    programId: 'prog-complete',
                    totalWorkouts: 1,
                    completedWorkouts: 1,
                    lastCompletedWorkoutAt: new Date('2026-03-20T10:00:00.000Z'),
                    lastFeedbackAt: new Date('2026-03-20T10:00:00.000Z'),
                },
            ] as any)
            .mockResolvedValueOnce([] as any)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].status).toBe('active')
        expect(body.data.items[0].completedAt).toBeNull()
        expect(prisma.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('keeps active programs in the active filter even when workouts are all complete', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([
            {
                id: 'prog-complete',
                title: 'Completed Block',
                status: 'active',
                startDate: new Date('2026-03-01'),
                durationWeeks: 1,
                workoutsPerWeek: 1,
                trainerId: 'trainer-uuid-1',
                traineeId: 'trainee-uuid-1',
                createdAt: new Date('2026-02-25'),
                completedAt: null,
                trainer: { id: 'trainer-uuid-1', firstName: 'Marco', lastName: 'Trainer' },
                trainee: { id: 'trainee-uuid-1', firstName: 'Mario', lastName: 'Atleta' },
                weeks: [{ id: 'week-1', weekNumber: 1, weekType: 'normal' }],
            },
        ] as any)
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([
                {
                    programId: 'prog-complete',
                    totalWorkouts: 1,
                    completedWorkouts: 1,
                    lastCompletedWorkoutAt: new Date('2026-03-20T10:00:00.000Z'),
                    lastFeedbackAt: new Date('2026-03-20T10:00:00.000Z'),
                },
            ] as any)
            .mockResolvedValueOnce([] as any)

        const res = await GET(makeRequest('http://localhost:3000/api/programs?status=active'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].status).toBe('active')
    })

    it('does not include active programs in the completed filter just because workouts are complete', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([] as any)
        vi.mocked(prisma.$queryRaw)
            .mockResolvedValueOnce([
                {
                    programId: 'prog-complete',
                    totalWorkouts: 1,
                    completedWorkouts: 1,
                    lastCompletedWorkoutAt: new Date('2026-03-20T10:00:00.000Z'),
                    lastFeedbackAt: new Date('2026-03-20T10:00:00.000Z'),
                },
            ] as any)
            .mockResolvedValueOnce([] as any)

        const res = await GET(makeRequest('http://localhost:3000/api/programs?status=completed'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(prisma.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    trainerId: 'trainer-uuid-1',
                    status: 'completed',
                }),
            })
        )
        expect(body.data.items).toHaveLength(0)
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

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures for copy-week / copy-first-week
// ═══════════════════════════════════════════════════════════════════════════

const mockProgramMeta = {
    id: 'prog-1',
    trainerId: 'trainer-uuid-1',
    status: 'draft',
}

const mockSourceWeek = {
    id: 'week-1',
    programId: 'prog-1',
    weekNumber: 1,
    weekType: 'normal',
    workouts: [
        {
            id: 'workout-src-1',
            dayIndex: 1,
            workoutExercises: [
                {
                    id: 'we-src-1',
                    exerciseId: 'ex-1',
                    variant: null,
                    sets: 5,
                    reps: '5',
                    targetRpe: 8,
                    weightType: 'absolute',
                    weight: 100,
                    effectiveWeight: 100,
                    restTime: 'm3',
                    isWarmup: false,
                    notes: null,
                    order: 0,
                },
            ],
        },
    ],
}

const mockTargetWeek = {
    id: 'week-2',
    programId: 'prog-1',
    weekNumber: 2,
    weekType: 'normal',
    workouts: [{ id: 'workout-tgt-1', dayIndex: 1 }],
}

const mockUpdatedWeek = {
    id: 'week-2',
    programId: 'prog-1',
    weekNumber: 2,
    weekType: 'normal',
    workouts: [
        {
            id: 'workout-tgt-1',
            dayIndex: 1,
            workoutExercises: [
                {
                    id: 'we-new-1',
                    exerciseId: 'ex-1',
                    variant: null,
                    sets: 5,
                    reps: '5',
                    targetRpe: 8,
                    weightType: 'absolute',
                    weight: 100,
                    effectiveWeight: 100,
                    restTime: 'm3',
                    isWarmup: false,
                    notes: null,
                    order: 0,
                    exercise: {
                        id: 'ex-1',
                        name: 'Squat',
                        type: 'fundamental',
                        notes: [],
                        movementPattern: null,
                        exerciseMuscleGroups: [],
                    },
                },
            ],
        },
    ],
}

function makeCopyWeekRequest(programId: string, sourceWeekId: string): NextRequest {
    return new NextRequest(`http://localhost/api/programs/${programId}/copy-week`, {
        method: 'POST',
        body: JSON.stringify({ sourceWeekId }),
        headers: { 'Content-Type': 'application/json' },
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/programs/[id]/copy-week
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/programs/[id]/copy-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 400 when sourceWeekId is missing', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        const req = new NextRequest('http://localhost/api/programs/prog-1/copy-week', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
        })
        const res = await copyWeekPOST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-missing', 'week-1'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 404 when source week not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(null)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-missing'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer does not own the program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockProgramMeta,
            trainerId: 'other-trainer',
        } as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 403 when program is not draft', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockProgramMeta,
            status: 'active',
        } as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 400 when source week has no exercises', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue({
            ...mockSourceWeek,
            workouts: [{ id: 'w1', dayIndex: 1, workoutExercises: [] }],
        } as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when no following week exists', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(null)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 200 with updatedWeek on success', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique)
            .mockResolvedValueOnce(mockSourceWeek as any)   // source week
            .mockResolvedValueOnce(mockUpdatedWeek as any)  // updatedWeek after transaction
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockTargetWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )

        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.data.updatedWeek).toBeDefined()
        expect(body.data.updatedWeek.id).toBe('week-2')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/programs/[id]/copy-first-week
// ═══════════════════════════════════════════════════════════════════════════

function makeCopyFirstWeekRequest(programId: string): NextRequest {
    return new NextRequest(`http://localhost/api/programs/${programId}/copy-first-week`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('POST /api/programs/[id]/copy-first-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockSourceWeek as any)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-missing'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 200 with 0 when program has only one week (no target weeks)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockSourceWeek as any)
        vi.mocked(prisma.week.findMany).mockResolvedValue([])

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const body = (await res.json()) as any
        expect(res.status).toBe(200)
        expect(body.data.updatedWeeks).toBe(0)
    })

    it('returns 403 when trainer does not own the program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockProgramMeta,
            trainerId: 'other-trainer',
        } as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockSourceWeek as any)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 200 with updatedWeeks count on success', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockSourceWeek as any)
        vi.mocked(prisma.week.findMany).mockResolvedValue([
            { id: 'week-2', weekNumber: 2, workouts: [{ id: 'wo-2', dayIndex: 1 }] },
            { id: 'week-3', weekNumber: 3, workouts: [{ id: 'wo-3', dayIndex: 1 }] },
        ] as any)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const body = (await res.json()) as any
        expect(res.status).toBe(200)
        expect(body.data.updatedWeeks).toBe(2)
    })
})

// ── Fixtures for publish ──────────────────────────────────────────────────────

const mockPublishProgram = {
    id: 'prog-1',
    trainerId: 'trainer-uuid-1',
    traineeId: 'trainee-uuid-1',
    status: 'draft',
    durationWeeks: 2,
    workoutsPerWeek: 3,
    weeks: [
        {
            id: 'week-1',
            weekNumber: 1,
            workouts: [
                { id: 'wo-1', workoutExercises: [{ id: 'we-1' }] },
            ],
        },
        {
            id: 'week-2',
            weekNumber: 2,
            workouts: [
                { id: 'wo-2', workoutExercises: [{ id: 'we-2' }] },
            ],
        },
    ],
}

const mockUpdatedPublishedProgram = {
    ...mockPublishProgram,
    status: 'active',
    startDate: new Date('2026-05-01'),
    trainer: { id: 'trainer-uuid-1', firstName: 'Marco', lastName: 'Trainer' },
    trainee: { id: 'trainee-uuid-1', firstName: 'Mario', lastName: 'Atleta' },
}

function makePublishRequest(programId: string, startDate = '2026-05-01'): NextRequest {
    return new NextRequest(`http://localhost/api/programs/${programId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ startDate }),
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('POST /api/programs/[id]/publish', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 400 when startDate is missing', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        const req = new NextRequest('http://localhost/api/programs/prog-1/publish', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
        })
        const res = await publishPOST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        const res = await publishPOST(
            makePublishRequest('prog-missing'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer does not own program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockPublishProgram,
            trainerId: 'other-trainer',
        } as any)
        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 400 when program is not draft', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockPublishProgram,
            status: 'active',
        } as any)
        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when a workout has no exercises', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockPublishProgram,
            weeks: [
                {
                    id: 'week-1',
                    weekNumber: 1,
                    workouts: [{ id: 'wo-empty', workoutExercises: [] }],
                },
            ],
        } as any)
        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('parallelizes week.update calls and returns 200 on success', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique)
            .mockResolvedValueOnce(mockPublishProgram as any)
            .mockResolvedValueOnce(mockUpdatedPublishedProgram as any)
        vi.mocked(prisma.trainingProgram.update).mockResolvedValue(mockUpdatedPublishedProgram as any)
        vi.mocked(prisma.week.update).mockResolvedValue({} as any)

        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )

        expect(res.status).toBe(200)
        // Both weeks updated (2 week.update calls, one per week)
        expect(prisma.week.update).toHaveBeenCalledTimes(2)
        // Correct startDate assigned to week 1 (weekNumber 1 → offset 0 days)
        expect(vi.mocked(prisma.week.update).mock.calls[0][0]).toMatchObject({
            where: { id: 'week-1' },
            data: { startDate: new Date('2026-05-01') },
        })
        // Week 2 → offset 7 days
        expect(vi.mocked(prisma.week.update).mock.calls[1][0]).toMatchObject({
            where: { id: 'week-2' },
            data: { startDate: new Date('2026-05-08') },
        })
    })
})
