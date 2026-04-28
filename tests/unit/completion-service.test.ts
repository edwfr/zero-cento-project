import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cascadeCompletion } from '@/lib/completion-service'
import { prisma } from '@/lib/prisma'

// Mock the prisma module
vi.mock('@/lib/prisma')

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
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWeekId,
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

        vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx))

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
            select: { id: true, workoutId: true },
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
                count: vi.fn()
                    .mockResolvedValueOnce(0) // 0 incomplete workouts
                    .mockResolvedValueOnce(1), // 1 total
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
                    programId: mockProgramId,
                    isCompleted: false,
                }),
                count: vi.fn()
                    .mockResolvedValueOnce(0)
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

        vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx))

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
                    programId: mockProgramId,
                    isCompleted: true,
                }),
                update: vi.fn().mockResolvedValue({
                    id: mockWeekId,
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

        vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx))

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

        vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx))

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
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(1),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
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
            },
        }

        vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx))

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
                count: vi.fn()
                    .mockResolvedValueOnce(0)
                    .mockResolvedValueOnce(0),
            },
            week: {
                findUnique: vi.fn().mockResolvedValue({
                    id: mockWeekId,
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

        vi.mocked(prisma.$transaction).mockImplementation((fn: any) => fn(mockTx))

        const result = await cascadeCompletion(mockWorkoutExerciseId, true)

        // Workout cannot be complete if it has no exercises (guard check)
        expect(result.workout.isCompleted).toBe(false)
        expect(mockTx.workout.update).not.toHaveBeenCalled()
    })
})
