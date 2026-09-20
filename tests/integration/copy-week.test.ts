import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}))

import { POST } from '@/app/api/programs/[id]/copy-week/route'
import { prismaMock } from '../helpers/prisma-mock'
import { makeTrainerSession } from '../helpers/sessions'
import { asTrainer } from '../helpers/auth-mock'

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
                            isJumpSet: false,
                            isSuperSet: false,
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

describe('POST /api/programs/[id]/copy-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer(makeTrainerSession({ id: 'trainer-1' }))
        prismaMock.trainingProgram.findUnique.mockResolvedValue(baseProgram as never)
        prismaMock.week.findUnique.mockResolvedValue({
            ...baseProgram.weeks[0],
            programId: 'prog-1',
        } as never)
        prismaMock.week.findFirst.mockResolvedValue({
            ...baseProgram.weeks[1],
            programId: 'prog-1',
        } as never)
        prismaMock.workout.count.mockResolvedValue(0 as never)
    })

    it('returns 400 when sourceWeekId is missing', async () => {
        const req = makeRequest({})
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when program not found', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(404)
    })

    it('returns 404 when sourceWeekId does not exist in program', async () => {
        prismaMock.week.findUnique.mockResolvedValue(null)
        const req = makeRequest({ sourceWeekId: 'week-nonexistent' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 when source is the last week (no following week)', async () => {
        prismaMock.week.findUnique.mockResolvedValue({
            ...baseProgram.weeks[1],
            programId: 'prog-1',
        } as never)
        prismaMock.week.findFirst.mockResolvedValue(null)
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
        prismaMock.trainingProgram.findUnique.mockResolvedValue(emptySourceProgram as never)
        prismaMock.week.findUnique.mockResolvedValue({
            ...emptySourceProgram.weeks[0],
            programId: 'prog-1',
        } as never)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 403 when trainer tries to copy another trainer\'s program', async () => {
        const otherProgram = { ...baseProgram, trainerId: 'other-trainer' }
        prismaMock.trainingProgram.findUnique.mockResolvedValue(otherProgram as never)
        prismaMock.week.findUnique.mockResolvedValue({
            ...otherProgram.weeks[0],
            programId: 'prog-1',
        } as never)
        // Reset to default mock so it doesn't interfere with ownership check
        asTrainer(makeTrainerSession({ id: 'trainer-1' }))
        
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(403)
    })

    it('returns 200 and copies exercises from source to target week matching by dayIndex', async () => {
        const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
        const createManyMock = vi.fn().mockResolvedValue({ count: 1 })

        prismaMock.week.findUnique.mockResolvedValue({
            ...baseProgram.weeks[0],
            programId: 'prog-1',
        } as never)
        prismaMock.week.findFirst.mockResolvedValue({
            ...baseProgram.weeks[1],
            programId: 'prog-1',
        } as never)

        prismaMock.$transaction.mockImplementation((async (ops: unknown) => {
            if (typeof ops === 'function') {
                return ops({
                    workoutExercise: {
                        deleteMany: deleteManyMock,
                        createMany: createManyMock,
                    },
                })
            }
            return Promise.all(ops as Promise<unknown>[])
        }) as never)

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
                    isJumpSet: false,
                    isSuperSet: false,
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
                                { exerciseId: 'ex-1', sets: 3, reps: '8', weightType: 'absolute', weight: 80, effectiveWeight: 80, restTime: 'm2', isWarmup: false, isJumpSet: false, isSuperSet: false, notes: null, order: 1, targetRpe: null, variant: null },
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
        prismaMock.trainingProgram.findUnique.mockResolvedValue(mismatchProgram as never)
        prismaMock.week.findUnique.mockResolvedValue({
            ...mismatchProgram.weeks[0],
            programId: 'prog-1',
        } as never)
        prismaMock.week.findFirst.mockResolvedValue({
            ...mismatchProgram.weeks[1],
            programId: 'prog-1',
        } as never)

        const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
        const createManyMock = vi.fn().mockResolvedValue({ count: 0 })
        prismaMock.$transaction.mockImplementation((async (ops: unknown) => {
            if (typeof ops === 'function') {
                return ops({
                    workoutExercise: { deleteMany: deleteManyMock, createMany: createManyMock },
                })
            }
            return Promise.all(ops as Promise<unknown>[])
        }) as never)

        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(200)
        // deleteMany is called but createMany is NOT called (no matching dayIndex)
        expect(deleteManyMock).toHaveBeenCalledWith({ where: { workoutId: 'workout-w2-d1' } })
        expect(createManyMock).not.toHaveBeenCalled()
    })

    it('returns 403 when target week contains completed workouts with exercises', async () => {
        prismaMock.workout.count.mockResolvedValue(1 as never)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.key).toBe('program.copyWeekTargetProtected')
    })

    it('allows copy on active program when target week has no completed workouts', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...baseProgram,
            status: 'active',
        } as never)
        prismaMock.workout.count.mockResolvedValue(0 as never)

        const deleteManyMock = vi.fn().mockResolvedValue({ count: 0 })
        const createManyMock = vi.fn().mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation((async (ops: unknown) => {
            if (typeof ops === 'function') {
                return ops({
                    workoutExercise: { deleteMany: deleteManyMock, createMany: createManyMock },
                })
            }
            return Promise.all(ops as Promise<unknown>[])
        }) as never)

        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(200)
    })

    it('returns 403 when program is completed (copy blocked)', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...baseProgram,
            status: 'completed',
        } as never)
        const req = makeRequest({ sourceWeekId: 'week-1' })
        const res = await POST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.key).toBe('program.cannotModifyNonDraft')
    })
})
