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
        workoutExercise: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}))

import { POST } from '@/app/api/programs/[id]/copy-week/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest(body: object) {
    return new NextRequest('http://localhost:3000/api/programs/prog-1/copy-week', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    })
}

const baseProgram = {
    id: 'prog-1',
    trainerId: 'trainer-1',
    status: 'draft',
    weeks: [
        {
            id: 'week-1',
            weekNumber: 1,
            workouts: [
                {
                    id: 'workout-w1-d0',
                    dayIndex: 0,
                    workoutExercises: [
                        {
                            exerciseId: 'ex-1',
                            variant: null,
                            sets: 4,
                            reps: '5',
                            targetRpe: 8,
                            weightType: 'absolute',
                            weight: 100,
                            effectiveWeight: 100,
                            restTime: 'm3',
                            isWarmup: false,
                            notes: null,
                            order: 1,
                        },
                    ],
                },
            ],
        },
        {
            id: 'week-2',
            weekNumber: 2,
            workouts: [
                {
                    id: 'workout-w2-d0',
                    dayIndex: 0,
                    workoutExercises: [], // empty target week
                },
            ],
        },
    ],
}

const mockTrainerSession = {
    user: { id: 'trainer-1', role: 'TRAINER' },
}

describe('POST /api/programs/[id]/copy-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(baseProgram as any)
        vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
            if (typeof ops === 'function') return ops(prisma)
            return Promise.all(ops)
        })
    })

    it('returns 400 when sourceWeekId is missing', async () => {
        const req = makeRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(404)
    })

    it('returns 404 when sourceWeekId does not exist in program', async () => {
        const req = makeRequest({ sourceWeekId: 'week-nonexistent' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 when source is the last week (no following week)', async () => {
        const req = makeRequest({ sourceWeekId: 'week-2' }) // week-2 is last
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when source week has no exercises', async () => {
        const emptySourceProgram = {
            ...baseProgram,
            weeks: [
                {
                    id: 'week-1',
                    weekNumber: 1,
                    workouts: [{ id: 'workout-w1-d0', dayIndex: 0, workoutExercises: [] }],
                },
                {
                    id: 'week-2',
                    weekNumber: 2,
                    workouts: [{ id: 'workout-w2-d0', dayIndex: 0, workoutExercises: [] }],
                },
            ],
        }
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(emptySourceProgram as any)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 403 when trainer tries to copy another trainer\'s program', async () => {
        const otherProgram = { ...baseProgram, trainerId: 'other-trainer' }
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(otherProgram as any)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(403)
    })

    it('returns 200 and copies exercises from source to target week matching by dayIndex', async () => {
        const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
        const createManyMock = vi.fn().mockResolvedValue({ count: 1 })

        vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
            if (typeof ops === 'function') {
                return ops({
                    workoutExercise: {
                        deleteMany: deleteManyMock,
                        createMany: createManyMock,
                    },
                })
            }
            return Promise.all(ops)
        })

        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(200)

        const body = await res.json()
        expect(body.data.sourceWeek).toBe(1)
        expect(body.data.targetWeek).toBe(2)

        // Verify target workout exercises were deleted before copy
        expect(deleteManyMock).toHaveBeenCalledWith({
            where: { workoutId: 'workout-w2-d0' },
        })

        // Verify source exercises were created in target workout
        expect(createManyMock).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({
                    workoutId: 'workout-w2-d0',
                    exerciseId: 'ex-1',
                    sets: 4,
                    reps: '5',
                }),
            ]),
        })
    })

    it('skips target workouts with no matching dayIndex in source week', async () => {
        const mismatchProgram = {
            ...baseProgram,
            weeks: [
                {
                    id: 'week-1',
                    weekNumber: 1,
                    workouts: [
                        {
                            id: 'workout-w1-d0',
                            dayIndex: 0,
                            workoutExercises: [
                                { exerciseId: 'ex-1', sets: 3, reps: '8', weightType: 'absolute', weight: 80, effectiveWeight: 80, restTime: 'm2', isWarmup: false, notes: null, order: 1, targetRpe: null, variant: null },
                            ],
                        },
                    ],
                },
                {
                    id: 'week-2',
                    weekNumber: 2,
                    workouts: [
                        { id: 'workout-w2-d1', dayIndex: 1, workoutExercises: [] }, // different dayIndex
                    ],
                },
            ],
        }
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mismatchProgram as any)

        const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
        const createManyMock = vi.fn().mockResolvedValue({ count: 0 })
        vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
            if (typeof ops === 'function') {
                return ops({
                    workoutExercise: { deleteMany: deleteManyMock, createMany: createManyMock },
                })
            }
        })

        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(200)
        // deleteMany is called but createMany is NOT called (no matching dayIndex)
        expect(deleteManyMock).toHaveBeenCalledWith({ where: { workoutId: 'workout-w2-d1' } })
        expect(createManyMock).not.toHaveBeenCalled()
    })
})
