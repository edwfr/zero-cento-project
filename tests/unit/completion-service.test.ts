import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cascadeCompletion, cascadeWorkoutCompletion } from '@/lib/completion-service'
import { prismaMock } from '../helpers/prisma-mock'

describe('cascadeCompletion', () => {
    const mockWorkoutExerciseId = 'we-1'
    const mockWorkoutId = 'wo-1'
    const mockWeekId = 'wk-1'
    const mockProgramId = 'prog-1'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should mark exercise as completed and return cascade result', async () => {
        const mockTx = {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutExerciseId,
                    workoutId: mockWorkoutId,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0) // incomplete count
                    .mockResolvedValueOnce(1), // total count
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: true,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0) // incomplete workout count
                    .mockResolvedValueOnce(1), // total workout count
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 1,
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 1,
                    programId: mockProgramId,
                    isCompleted: true,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0) // incomplete week count
                    .mockResolvedValueOnce(1), // total week count
            },
            trainingProgram: {
                findUnique: vi.fn()
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'active',
                    })
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'active',
                    }),
                update: vi.fn().mockResolvedValue({
                    id: mockProgramId,
                    status: 'completed',
                }),
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(mockWorkoutExerciseId, true)

        expect(result).toEqual({
            workoutExercise: {
                id: mockWorkoutExerciseId,
                isCompleted: true,
            },
            workout: {
                id: mockWorkoutId,
                isCompleted: true,
            },
            week: {
                id: mockWeekId,
                weekNumber: 1,
                isCompleted: true,
            },
            program: {
                id: mockProgramId,
                status: 'completed',
            },
        })

        expect(mockTx.workoutExercise.update).toHaveBeenCalledWith({
            where: { id: mockWorkoutExerciseId },
            data: { isCompleted: true },
            select: { id: true, workoutId: true, isWarmup: true },
        })
    })

    it('should handle partial completion without cascading', async () => {
        const mockTx = {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutExerciseId,
                    workoutId: mockWorkoutId,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(1) // 1 incomplete exercise
                    .mockResolvedValueOnce(2), // 2 total
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: false,
                }),
                update: vi.fn(),
                count: vi.fn()
                    .mockResolvedValueOnce(1) // 1 incomplete workout
                    .mockResolvedValueOnce(1), // 1 total
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 1,
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                update: vi.fn(),
                count: vi.fn()
                    .mockResolvedValueOnce(1)
                    .mockResolvedValueOnce(1),
            },
            trainingProgram: {
                findUnique: vi.fn()
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'active',
                    })
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'active',
                    }),
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(mockWorkoutExerciseId, true)

        // Workout should NOT be updated because there are still incomplete exercises
        expect(mockTx.workout.update).not.toHaveBeenCalled()

        expect(result.workout.isCompleted).toBe(false)
        expect(result.week.isCompleted).toBe(false)
    })

    it('should revert completion on de-completion (reverse cascade)', async () => {
        const mockTx = {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutExerciseId,
                    workoutId: mockWorkoutId,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(1) // 1 incomplete
                    .mockResolvedValueOnce(2), // 2 total
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: true, // Was completed
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: false, // Now reverted
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(1) // 1 incomplete workout
                    .mockResolvedValueOnce(2), // 2 total
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 1,
                    programId: mockProgramId,
                    isCompleted: true,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 1,
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(1)
                    .mockResolvedValueOnce(2),
            },
            trainingProgram: {
                findUnique: vi.fn()
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'completed',
                    })
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'completed',
                    }),
                update: vi.fn().mockResolvedValue({
                    id: mockProgramId,
                    status: 'active',
                }),
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(mockWorkoutExerciseId, false)

        // Should revert all the way up
        expect(mockTx.workout.update).toHaveBeenCalled()
        expect(mockTx.week.update).toHaveBeenCalled()
        expect(mockTx.trainingProgram.update).toHaveBeenCalled()

        expect(result.workout.isCompleted).toBe(false)
        expect(result.week.isCompleted).toBe(false)
        expect(result.program.status).toBe('active')
    })

    it('should throw error if workout not found', async () => {
        const mockTx = {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutExerciseId,
                    workoutId: mockWorkoutId,
                }),
                count: vi.fn().mockResolvedValue(0),
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue(null), // Not found
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        await expect(cascadeCompletion(mockWorkoutExerciseId, true)).rejects.toThrow(
            'Workout not found'
        )
    })

    it('should not update workout if state has not changed', async () => {
        const mockTx = {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutExerciseId,
                    workoutId: mockWorkoutId,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: true, // Already completed
                }),
                update: vi.fn(),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 1,
                    programId: mockProgramId,
                    isCompleted: true,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            trainingProgram: {
                findUnique: vi.fn()
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'completed',
                    })
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'completed',
                    }),
                update: vi.fn().mockResolvedValue({
                    id: mockProgramId,
                    status: 'completed',
                }),
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(mockWorkoutExerciseId, true)

        // Workout is already completed, so no update call
        expect(mockTx.workout.update).not.toHaveBeenCalled()
        expect(result.workout.isCompleted).toBe(true)
    })

    it('should handle empty workout (no exercises)', async () => {
        const mockTx = {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutExerciseId,
                    workoutId: mockWorkoutId,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0) // 0 incomplete
                    .mockResolvedValueOnce(0), // 0 total (empty)
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: false,
                }),
                update: vi.fn(),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(0),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 1,
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(0),
            },
            trainingProgram: {
                findUnique: vi.fn()
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'active',
                    })
                    .mockResolvedValueOnce({
                        id: mockProgramId,
                        status: 'active',
                    }),
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(mockWorkoutExerciseId, true)

        // Workout cannot be complete if it has no exercises (guard check)
        expect(result.workout.isCompleted).toBe(false)
        expect(mockTx.workout.update).not.toHaveBeenCalled()
    })

    it('should mark week as completed when only non-empty workouts are completed', async () => {
        const mockTx = {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutExerciseId,
                    workoutId: mockWorkoutId,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: true,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 2,
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 2,
                    programId: mockProgramId,
                    isCompleted: true,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            trainingProgram: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockProgramId,
                    status: 'active',
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockProgramId,
                    status: 'completed',
                }),
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(mockWorkoutExerciseId, true)

        expect(mockTx.workout.count).toHaveBeenNthCalledWith(1, {
            where: {
                weekId: mockWeekId,
                isCompleted: false,
                workoutExercises: { some: {} },
            },
        })
        expect(mockTx.workout.count).toHaveBeenNthCalledWith(2, {
            where: {
                weekId: mockWeekId,
                workoutExercises: { some: {} },
            },
        })
        expect(result.week).toEqual({
            id: mockWeekId,
            weekNumber: 2,
            isCompleted: true,
        })
    })

    it('should mark a submitted workout as completed and cascade week and program without touching exercises', async () => {
        const mockTx = {
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWorkoutId,
                    weekId: mockWeekId,
                    isCompleted: true,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 4,
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    weekNumber: 4,
                    programId: mockProgramId,
                    isCompleted: true,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            trainingProgram: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockProgramId,
                    status: 'active',
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockProgramId,
                    status: 'completed',
                }),
            },
        }

        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeWorkoutCompletion(mockWorkoutId, true)

        expect(mockTx.workout.update).toHaveBeenCalledWith({
            where: { id: mockWorkoutId },
            data: { isCompleted: true },
            select: { id: true, weekId: true, isCompleted: true },
        })
        expect(result).toEqual({
            workout: {
                id: mockWorkoutId,
                isCompleted: true,
            },
            week: {
                id: mockWeekId,
                weekNumber: 4,
                isCompleted: true,
            },
            program: {
                id: mockProgramId,
                status: 'completed',
            },
        })
    })
})

describe('cascadeCompletion - warm-up exercises', () => {
    const workoutExerciseId = 'we-1'
    const workoutId = 'wo-1'
    const weekId = 'wk-1'
    const programId = 'prog-1'

    function buildTx(incomplete: number, total: number) {
        return {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({ id: workoutExerciseId, workoutId }),
                count: vi.fn()
                    .mockResolvedValueOnce(incomplete)
                    .mockResolvedValueOnce(total),
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({ id: workoutId, weekId, isCompleted: false }),
                update: vi.fn().mockResolvedValue({ id: workoutId, weekId, isCompleted: true }),
                count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: weekId, weekNumber: 1, programId, isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: weekId, weekNumber: 1, programId, isCompleted: true,
                }),
                count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
            },
            trainingProgram: {
                findUnique: vi.fn().mockResolvedValue({ id: programId, status: 'active' }),
                update: vi.fn().mockResolvedValue({ id: programId, status: 'completed' }),
            },
        }
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('completes the workout when all non-warm-up exercises are done', async () => {
        const mockTx = buildTx(0, 2)
        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        await cascadeCompletion(workoutExerciseId, true)

        expect(mockTx.workout.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { isCompleted: true } })
        )
        expect(mockTx.workoutExercise.count).toHaveBeenCalledTimes(2)
        for (const call of mockTx.workoutExercise.count.mock.calls) {
            expect(call[0].where).toMatchObject({ isWarmup: false })
        }
    })

    it('keeps the workout incomplete when a non-warm-up exercise is incomplete', async () => {
        const mockTx = buildTx(1, 2)
        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(workoutExerciseId, true)

        expect(result.workout.isCompleted).toBe(false)
        expect(mockTx.workout.update).not.toHaveBeenCalled()
    })

    it('does not complete a workout made only of warm-up exercises (no fallback)', async () => {
        const mockTx = buildTx(0, 0)
        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(workoutExerciseId, true)

        expect(result.workout.isCompleted).toBe(false)
        expect(mockTx.workout.update).not.toHaveBeenCalled()
        expect(mockTx.workoutExercise.count).toHaveBeenCalledTimes(2)
    })
})

describe('cascadeCompletion - warm-up exercise never changes the workout state', () => {
    const workoutExerciseId = 'we-warmup'
    const workoutId = 'wo-1'
    const weekId = 'wk-1'
    const programId = 'prog-1'

    // Counts are set so that a recompute would reopen the workout.
    function buildTx(counts: { incomplete: number; total: number }) {
        return {
            workoutExercise: {
                update: vi.fn().mockResolvedValue({ id: workoutExerciseId, workoutId, isWarmup: true }),
                count: vi.fn()
                    .mockResolvedValueOnce(counts.incomplete)
                    .mockResolvedValueOnce(counts.total),
            },
            workout: {
                findUnique: vi.fn().mockResolvedValue({
                    id: workoutId,
                    weekId,
                    isCompleted: true,
                    week: {
                        id: weekId,
                        weekNumber: 3,
                        programId,
                        isCompleted: true,
                        program: { id: programId, status: 'completed' },
                    },
                }),
                update: vi.fn().mockResolvedValue({ id: workoutId, weekId, isCompleted: false }),
                count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: weekId, weekNumber: 3, programId, isCompleted: true,
                }),
                update: vi.fn().mockResolvedValue({
                    id: weekId, weekNumber: 3, programId, isCompleted: false,
                }),
                count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
            },
            trainingProgram: {
                findUnique: vi.fn().mockResolvedValue({ id: programId, status: 'completed' }),
                update: vi.fn().mockResolvedValue({ id: programId, status: 'active' }),
            },
        }
    }

    const expectedState = {
        workout: { id: workoutId, isCompleted: true },
        week: { id: weekId, weekNumber: 3, isCompleted: true },
        program: { id: programId, status: 'completed' },
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('completing a warm-up does not reopen a force-completed workout', async () => {
        const mockTx = buildTx({ incomplete: 1, total: 2 })
        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(workoutExerciseId, true)

        expect(result).toEqual({
            workoutExercise: { id: workoutExerciseId, isCompleted: true },
            ...expectedState,
        })
        expect(mockTx.workout.update).not.toHaveBeenCalled()
        expect(mockTx.week.update).not.toHaveBeenCalled()
        expect(mockTx.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('un-completing a warm-up does not reopen a completed workout', async () => {
        const mockTx = buildTx({ incomplete: 1, total: 2 })
        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(workoutExerciseId, false)

        expect(result).toEqual({
            workoutExercise: { id: workoutExerciseId, isCompleted: false },
            ...expectedState,
        })
        expect(mockTx.workoutExercise.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { isCompleted: false } })
        )
        expect(mockTx.workout.update).not.toHaveBeenCalled()
        expect(mockTx.week.update).not.toHaveBeenCalled()
        expect(mockTx.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('a warm-up tick does not reopen a submitted all-warm-up workout', async () => {
        const mockTx = buildTx({ incomplete: 0, total: 0 })
        prismaMock.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(mockTx)) as never)

        const result = await cascadeCompletion(workoutExerciseId, true)

        expect(result.workout.isCompleted).toBe(true)
        expect(mockTx.workout.update).not.toHaveBeenCalled()
    })
})
