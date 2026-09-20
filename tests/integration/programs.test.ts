import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

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
import type { User } from '@prisma/client'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated, asForbidden } from '../helpers/auth-mock'

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
    return new NextRequest(url, safeOptions as never)
}

describe('GET /api/programs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMock.trainingProgram.findMany.mockResolvedValue([] as never)
        prismaMock.trainingProgram.count.mockResolvedValue(0)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
        prismaMock.$queryRaw.mockResolvedValue([] as never)
    })

    it('returns programs for trainer with RBAC filter', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue(mockPrograms as never)
        prismaMock.trainingProgram.count.mockResolvedValue(1)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        // Trainer's own programs filter should be applied
        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ trainerId: 'trainer-uuid-1' }),
            })
        )
    })

    it('filters by status when query param provided', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue(mockPrograms as never)
        prismaMock.trainingProgram.count.mockResolvedValue(1)

        const req = makeRequest('http://localhost:3000/api/programs?status=active')
        await GET(req)

        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ status: 'active' }),
            })
        )
    })

    it('applies traineeId + status + search + pagination together for trainer', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue(mockPrograms as never)
        prismaMock.trainingProgram.count
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)

        const traineeId = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
        const req = makeRequest(`http://localhost:3000/api/programs?traineeId=${traineeId}&status=active&search=Mario&page=1&limit=20`)
        const res = await GET(req)

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    trainerId: 'trainer-uuid-1',
                    traineeId,
                    status: 'active',
                    OR: expect.any(Array),
                }),
                skip: 0,
                take: 21,
            })
        )
    })

    it('applies filters before pagination and returns numeric pagination metadata', async () => {
        asTrainer()

        const pagedPrograms = Array.from({ length: 11 }, (_, idx) => ({
            ...mockPrograms[0],
            id: `prog-${idx + 1}`,
            status: 'active',
        }))

        prismaMock.trainingProgram.findMany.mockResolvedValue(pagedPrograms as never)
        prismaMock.trainingProgram.count
            .mockResolvedValueOnce(21)
            .mockResolvedValueOnce(7)
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(2)

        const req = makeRequest('http://localhost:3000/api/programs?status=active&search=Mario&page=2&limit=10')
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        const findManyArgs = prismaMock.trainingProgram.findMany.mock.calls[0][0] as never
        expect(findManyArgs.where).toEqual(
            expect.objectContaining({
                trainerId: 'trainer-uuid-1',
                status: 'active',
            })
        )
        expect(findManyArgs.skip).toEqual(expect.any(Number))
        expect(findManyArgs.take).toBe(11)
        expect(body.data.items).toHaveLength(10)
        expect(body.data.pagination.currentPage).toEqual(expect.any(Number))
        expect(body.data.pagination.totalPages).toEqual(expect.any(Number))
        expect(body.data.pagination.totalItems).toEqual(expect.any(Number))
        expect(body.data.pagination.hasMore).toEqual(expect.any(Boolean))
        expect(body.data.statusCounts).toEqual({
            draft: 7,
            active: 12,
            completed: 2,
        })
    })

    it('returns 400 for invalid page filter', async () => {
        asTrainer()

        const req = makeRequest('http://localhost:3000/api/programs?page=0')
        const res = await GET(req)

        expect(res.status).toBe(400)
    })

    it('marks testsCompleted true when all test weeks are completed', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                ...mockPrograms[0],
                id: 'prog-tests-complete',
                weeks: [
                    { id: 'w-1', weekNumber: 1, weekType: 'test', isCompleted: true },
                    { id: 'w-2', weekNumber: 2, weekType: 'test', isCompleted: true },
                    { id: 'w-3', weekNumber: 3, weekType: 'volume', isCompleted: false },
                ],
            },
        ] as never)
        prismaMock.trainingProgram.count.mockResolvedValue(1)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].hasTestWeeks).toBe(true)
        expect(body.data.items[0].testsCompleted).toBe(true)
        expect(body.data.items[0].plannedTestsCount).toBe(2)
        expect(body.data.items[0].completedTestsCount).toBe(2)
        expect(body.data.items[0].testWeeks).toEqual([1, 2])
        expect(body.data.items[0].testWeekSummaries).toEqual([
            {
                weekNumber: 1,
                plannedTestsCount: 1,
                completedTestsCount: 1,
                completed: true,
            },
            {
                weekNumber: 2,
                plannedTestsCount: 1,
                completedTestsCount: 1,
                completed: true,
            },
        ])
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('marks testsCompleted false when at least one test week is incomplete', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                ...mockPrograms[0],
                id: 'prog-tests-incomplete',
                weeks: [
                    { id: 'w-1', weekNumber: 1, weekType: 'test', isCompleted: true },
                    { id: 'w-2', weekNumber: 2, weekType: 'test', isCompleted: false },
                ],
            },
        ] as never)
        prismaMock.trainingProgram.count.mockResolvedValue(1)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items[0].hasTestWeeks).toBe(true)
        expect(body.data.items[0].testsCompleted).toBe(false)
        expect(body.data.items[0].plannedTestsCount).toBe(2)
        expect(body.data.items[0].completedTestsCount).toBe(1)
    })

    it('keeps testsCompleted false when no test week exists', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                ...mockPrograms[0],
                id: 'prog-no-tests',
                weeks: [{ id: 'w-1', weekNumber: 1, weekType: 'volume', isCompleted: true }],
            },
        ] as never)
        prismaMock.trainingProgram.count.mockResolvedValue(1)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items[0].hasTestWeeks).toBe(false)
        expect(body.data.items[0].testsCompleted).toBe(false)
        expect(body.data.items[0].plannedTestsCount).toBe(0)
        expect(body.data.items[0].completedTestsCount).toBe(0)
        expect(body.data.items[0].testWeekSummaries).toEqual([])
    })

    it('keeps the stored active status in the response even when all workouts are complete', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue([
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
                weeks: [{ id: 'week-1', weekNumber: 1, weekType: 'volume', isCompleted: false }],
            },
        ] as never)
        prismaMock.$queryRaw.mockResolvedValueOnce([
            {
                programId: 'prog-complete',
                totalWorkouts: 1,
                completedWorkouts: 1,
                lastCompletedWorkoutAt: new Date('2026-03-20T10:00:00.000Z'),
                lastFeedbackAt: new Date('2026-03-20T10:00:00.000Z'),
            },
        ] as never)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].status).toBe('active')
        expect(body.data.items[0].completedAt).toBeNull()
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('keeps active programs in the active filter even when workouts are all complete', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue([
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
                weeks: [{ id: 'week-1', weekNumber: 1, weekType: 'volume', isCompleted: false }],
            },
        ] as never)
        prismaMock.$queryRaw.mockResolvedValueOnce([
            {
                programId: 'prog-complete',
                totalWorkouts: 1,
                completedWorkouts: 1,
                lastCompletedWorkoutAt: new Date('2026-03-20T10:00:00.000Z'),
                lastFeedbackAt: new Date('2026-03-20T10:00:00.000Z'),
            },
        ] as never)

        const res = await GET(makeRequest('http://localhost:3000/api/programs?status=active'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].status).toBe('active')
    })

    it('does not include active programs in the completed filter just because workouts are complete', async () => {
        asTrainer()
        prismaMock.trainingProgram.findMany.mockResolvedValue([] as never)
        prismaMock.$queryRaw.mockResolvedValueOnce([
            {
                programId: 'prog-complete',
                totalWorkouts: 1,
                completedWorkouts: 1,
                lastCompletedWorkoutAt: new Date('2026-03-20T10:00:00.000Z'),
                lastFeedbackAt: new Date('2026-03-20T10:00:00.000Z'),
            },
        ] as never)

        const res = await GET(makeRequest('http://localhost:3000/api/programs?status=completed'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith(
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
        asAdmin()
        prismaMock.trainingProgram.findMany.mockResolvedValue(mockPrograms as never)
        prismaMock.trainingProgram.count.mockResolvedValue(5)

        const req = makeRequest()
        const res = await GET(req)

        expect(res.status).toBe(200)
        // Admin should NOT have trainerId filter applied
        const callArgs = prismaMock.trainingProgram.findMany.mock.calls[0][0] as never
        expect(callArgs.where?.trainerId).toBeUndefined()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

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
        asTrainer()

        const traineeId = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
        prismaMock.user.findUnique.mockResolvedValue({
            id: traineeId,
            role: 'trainee',
        } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId,
        } as never)

        const newProgram = {
            ...mockPrograms[0],
            id: 'new-prog-id',
            status: 'draft',
            trainingWeeks: [],
        }
        prismaMock.trainingProgram.create.mockResolvedValue(newProgram as never)

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
        asTrainer()

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
    weekType: 'volume',
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
                    isJumpSet: false,
                    isSuperSet: false,
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
    weekType: 'volume',
    workouts: [{ id: 'workout-tgt-1', dayIndex: 1 }],
}

const mockUpdatedWeek = {
    id: 'week-2',
    programId: 'prog-1',
    weekNumber: 2,
    weekType: 'volume',
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
                    isJumpSet: false,
                    isSuperSet: false,
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
        asTrainer()
        const req = new NextRequest('http://localhost/api/programs/prog-1/copy-week', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
        })
        const res = await copyWeekPOST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 404 when program not found', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)
        prismaMock.week.findUnique.mockResolvedValue(mockSourceWeek as never)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-missing', 'week-1'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 404 when source week not found', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(mockProgramMeta as never)
        prismaMock.week.findUnique.mockResolvedValue(null)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-missing'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer does not own the program', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...mockProgramMeta,
            trainerId: 'other-trainer',
        } as never)
        prismaMock.week.findUnique.mockResolvedValue(mockSourceWeek as never)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 403 when program is completed (not draft)', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...mockProgramMeta,
            status: 'completed',
        } as never)
        prismaMock.week.findUnique.mockResolvedValue(mockSourceWeek as never)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 400 when source week has no exercises', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(mockProgramMeta as never)
        prismaMock.week.findUnique.mockResolvedValue({
            ...mockSourceWeek,
            workouts: [{ id: 'w1', dayIndex: 1, workoutExercises: [] }],
        } as never)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when no following week exists', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(mockProgramMeta as never)
        prismaMock.week.findUnique.mockResolvedValue(mockSourceWeek as never)
        prismaMock.week.findFirst.mockResolvedValue(null)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 200 with updatedWeek on success', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(mockProgramMeta as never)
        prismaMock.workout.count.mockResolvedValue(0)
        prismaMock.week.findUnique
            .mockResolvedValueOnce(mockSourceWeek as never)   // source week
            .mockResolvedValueOnce(mockUpdatedWeek as never)  // updatedWeek after transaction
        prismaMock.week.findFirst.mockResolvedValue(mockTargetWeek as never)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )

        expect(res.status).toBe(200)
        const body = (await res.json()) as never
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
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)
        prismaMock.week.findFirst.mockResolvedValue(mockSourceWeek as never)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-missing'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 200 with 0 when program has only one week (no target weeks)', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(mockProgramMeta as never)
        prismaMock.week.findFirst.mockResolvedValue(mockSourceWeek as never)
        prismaMock.week.findMany.mockResolvedValue([])

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const body = (await res.json()) as never
        expect(res.status).toBe(200)
        expect(body.data.updatedWeeks).toBe(0)
    })

    it('returns 403 when trainer does not own the program', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...mockProgramMeta,
            trainerId: 'other-trainer',
        } as never)
        prismaMock.week.findFirst.mockResolvedValue(mockSourceWeek as never)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 200 with updatedWeeks count on success', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(mockProgramMeta as never)
        prismaMock.week.findFirst.mockResolvedValue(mockSourceWeek as never)
        prismaMock.week.findMany.mockResolvedValue([
            { id: 'week-2', weekNumber: 2, workouts: [{ id: 'wo-2', dayIndex: 1 }] },
            { id: 'week-3', weekNumber: 3, workouts: [{ id: 'wo-3', dayIndex: 1 }] },
        ] as never)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const body = (await res.json()) as never
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
        asTrainer()
        const req = new NextRequest('http://localhost/api/programs/prog-1/publish', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
        })
        const res = await publishPOST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 404 when program not found', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)
        const res = await publishPOST(
            makePublishRequest('prog-missing'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer does not own program', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...mockPublishProgram,
            trainerId: 'other-trainer',
        } as never)
        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 400 when program is not draft', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...mockPublishProgram,
            status: 'active',
        } as never)
        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when a workout has no exercises', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...mockPublishProgram,
            weeks: [
                {
                    id: 'week-1',
                    weekNumber: 1,
                    workouts: [{ id: 'wo-empty', workoutExercises: [] }],
                },
            ],
        } as never)
        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('parallelizes week.update calls and returns 200 on success', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique
            .mockResolvedValueOnce(mockPublishProgram as never)
            .mockResolvedValueOnce(mockUpdatedPublishedProgram as never)
        prismaMock.trainingProgram.update.mockResolvedValue(mockUpdatedPublishedProgram as never)
        prismaMock.week.update.mockResolvedValue({} as never)

        const res = await publishPOST(
            makePublishRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )

        expect(res.status).toBe(200)
        // Both weeks updated (2 week.update calls, one per week)
        expect(prismaMock.week.update).toHaveBeenCalledTimes(2)
        // Correct startDate assigned to week 1 (weekNumber 1 → offset 0 days)
        expect(prismaMock.week.update.mock.calls[0][0]).toMatchObject({
            where: { id: 'week-1' },
            data: { startDate: new Date('2026-05-01') },
        })
        // Week 2 → offset 7 days
        expect(prismaMock.week.update.mock.calls[1][0]).toMatchObject({
            where: { id: 'week-2' },
            data: { startDate: new Date('2026-05-08') },
        })
    })
})
