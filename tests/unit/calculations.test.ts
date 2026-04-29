import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    CALCULATION_ERROR_KEYS,
    calculateVolume,
    calculateTrainingSets,
    parseReps,
    estimateOneRM,
    estimateOneRMFromRpeTable,
    calculateEffectiveWeight as calculateEffectiveWeightRaw,
} from '@/lib/calculations'
import { prisma } from '@/lib/prisma'
import type { RestTime, WorkoutExercise as PrismaWorkoutExercise } from '@prisma/client'

type WorkoutExercise = Omit<
    PrismaWorkoutExercise,
    'variant' | 'targetRpe' | 'restTime' | 'isWarmup' | 'effectiveWeight' | 'isSkeletonExercise' | 'isCompleted'
> & {
    variant?: string | null
    targetRpe?: number | null
    restTime?: RestTime
    isWarmup?: boolean
    effectiveWeight?: number | null
    isSkeletonExercise?: boolean
    isCompleted?: boolean
    rpe?: number | null
    restSeconds?: number
    createdAt?: Date
    updatedAt?: Date
}

const normalizeWorkoutExercise = (exercise: WorkoutExercise): PrismaWorkoutExercise => ({
    id: exercise.id,
    workoutId: exercise.workoutId,
    exerciseId: exercise.exerciseId,
    variant: exercise.variant ?? null,
    sets: exercise.sets,
    reps: exercise.reps,
    targetRpe: exercise.targetRpe ?? exercise.rpe ?? null,
    weightType: exercise.weightType,
    weight: exercise.weight,
    restTime: exercise.restTime ?? 'm2',
    isWarmup: exercise.isWarmup ?? false,
    isSkeletonExercise: exercise.isSkeletonExercise ?? false,
    isCompleted: exercise.isCompleted ?? false,
    effectiveWeight: exercise.effectiveWeight ?? null,
    notes: exercise.notes,
    order: exercise.order,
})

const normalizeWorkoutExerciseNullable = (
    exercise: WorkoutExercise | null
): PrismaWorkoutExercise | null =>
    exercise ? normalizeWorkoutExercise(exercise) : null

const calculateEffectiveWeight = (workoutExercise: WorkoutExercise, traineeId: string) =>
    calculateEffectiveWeightRaw(normalizeWorkoutExercise(workoutExercise), traineeId)

describe('calculateVolume', () => {
    it('returns sets × reps × weight × coefficient', () => {
        expect(calculateVolume(3, 8, 100, 1)).toBe(2400)
    })

    it('applies fractional coefficient correctly', () => {
        expect(calculateVolume(4, 10, 80, 0.5)).toBe(1600)
    })

    it('returns 0 when weight is 0', () => {
        expect(calculateVolume(3, 8, 0, 1)).toBe(0)
    })

    it('returns 0 when coefficient is 0', () => {
        expect(calculateVolume(3, 8, 100, 0)).toBe(0)
    })
})

describe('calculateTrainingSets', () => {
    it('returns 0 for warmup sets', () => {
        expect(calculateTrainingSets(3, 1, true)).toBe(0)
    })

    it('returns sets × coefficient for non-warmup', () => {
        expect(calculateTrainingSets(4, 0.75, false)).toBe(3)
    })

    it('returns sets × 1 for full-contribution exercise', () => {
        expect(calculateTrainingSets(5, 1, false)).toBe(5)
    })

    it('still returns 0 for warmup even with coefficient', () => {
        expect(calculateTrainingSets(3, 0.5, true)).toBe(0)
    })
})

describe('parseReps', () => {
    it('parses simple integer string', () => {
        expect(parseReps('8')).toBe(8)
    })

    it('parses range "8-10" and returns first number', () => {
        expect(parseReps('8-10')).toBe(8)
    })

    it('parses slash format "6/8" and returns first number', () => {
        expect(parseReps('6/8')).toBe(6)
    })

    it('returns 0 for empty string', () => {
        expect(parseReps('')).toBe(0)
    })

    it('returns 0 for non-numeric string', () => {
        expect(parseReps('AMRAP')).toBe(0)
    })

    it('parses "12" correctly', () => {
        expect(parseReps('12')).toBe(12)
    })
})

describe('estimateOneRM', () => {
    it('returns weight directly when reps = 1', () => {
        expect(estimateOneRM(100, 1)).toBe(100)
    })

    it('uses Epley formula: weight × (1 + reps/30)', () => {
        // 100 × (1 + 10/30) = 100 × 1.333... ≈ 133.33
        expect(estimateOneRM(100, 10)).toBeCloseTo(133.33, 1)
    })

    it('handles reps = 5 correctly', () => {
        // 80 × (1 + 5/30) = 80 × 1.1667 ≈ 93.33
        expect(estimateOneRM(80, 5)).toBeCloseTo(93.33, 1)
    })

    it('returns higher estimate for more reps at same weight', () => {
        const light = estimateOneRM(100, 3)
        const heavy = estimateOneRM(100, 12)
        expect(heavy).toBeGreaterThan(light)
    })
})

describe('estimateOneRMFromRpeTable', () => {
    it('returns input weight for 1 rep at RPE 10', () => {
        expect(estimateOneRMFromRpeTable(100, 1, 10)).toBe(100)
    })

    it('normalizes 5 reps @ RPE 10 using Mike T chart', () => {
        // 100 / 0.863 = 115.87...
        expect(estimateOneRMFromRpeTable(100, 5, 10)).toBeCloseTo(115.87, 2)
    })

    it('supports lower RPE values from the same chart', () => {
        // 100 / 0.837 = 119.47...
        expect(estimateOneRMFromRpeTable(100, 5, 9)).toBeCloseTo(119.47, 2)
    })

    it('matches chart values for high-rep rows', () => {
        // 100 / 0.68 = 147.05...
        expect(estimateOneRMFromRpeTable(100, 12, 10)).toBeCloseTo(147.06, 2)
    })

    it('falls back to Epley when reps are outside chart range', () => {
        expect(estimateOneRMFromRpeTable(100, 15, 10)).toBeCloseTo(estimateOneRM(100, 15), 5)
    })
})

describe('calculateEffectiveWeight', () => {
    const mockTraineeId = 'trainee-123'
    const mockExerciseId = 'exercise-456'
    const mockWorkoutId = 'workout-789'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('absolute weight type', () => {
        it('returns the weight directly', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'absolute',
                weight: 100,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            expect(result).toBe(100)
        })

        it('handles zero weight', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'absolute',
                weight: 0,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            expect(result).toBe(0)
        })
    })

    describe('percentage_1rm weight type', () => {
        it('calculates weight based on 1RM personal record', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'percentage_1rm',
                weight: 80, // 80% of 1RM
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const mockRecord = {
                id: 'pr-1',
                traineeId: mockTraineeId,
                exerciseId: mockExerciseId,
                weight: 150,
                reps: 1,
                notes: null,
                recordDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(mockRecord)

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            // 150 * 80 / 100 = 120
            expect(result).toBe(120)

            // Verify the query
            expect(prisma.personalRecord.findFirst).toHaveBeenCalledWith({
                where: {
                    traineeId: mockTraineeId,
                    exerciseId: mockExerciseId,
                    reps: 1,
                },
                orderBy: {
                    recordDate: 'desc',
                },
            })
        })

        it('returns null when 1RM record not found', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'percentage_1rm',
                weight: 80,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(null)

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            expect(result).toBeNull()
        })
    })

    describe('percentage_rm weight type', () => {
        it('calculates weight based on nRM personal record', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8', // Will look for 8RM
                weightType: 'percentage_rm',
                weight: 90, // 90% of 8RM
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const mockRecord = {
                id: 'pr-1',
                traineeId: mockTraineeId,
                exerciseId: mockExerciseId,
                weight: 100,
                reps: 8,
                notes: null,
                recordDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(mockRecord)

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            // 100 * 90 / 100 = 90
            expect(result).toBe(90)

            expect(prisma.personalRecord.findFirst).toHaveBeenCalledWith({
                where: {
                    traineeId: mockTraineeId,
                    exerciseId: mockExerciseId,
                    reps: 8,
                },
                orderBy: {
                    recordDate: 'desc',
                },
            })
        })

        it('handles reps range "8-10"', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8-10', // Will look for 8RM
                weightType: 'percentage_rm',
                weight: 85,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const mockRecord = {
                id: 'pr-1',
                traineeId: mockTraineeId,
                exerciseId: mockExerciseId,
                weight: 120,
                reps: 8,
                notes: null,
                recordDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(mockRecord)

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            // 120 * 85 / 100 = 102
            expect(result).toBe(102)
        })

        it('returns null when nRM record not found', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '10',
                weightType: 'percentage_rm',
                weight: 85,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(null)

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            expect(result).toBeNull()
        })

        it('returns null for invalid reps format', async () => {
            const workoutExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: 'AMRAP', // Invalid format
                weightType: 'percentage_rm',
                weight: 85,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const result = await calculateEffectiveWeight(workoutExercise, mockTraineeId)
            expect(result).toBeNull()
        })
    })

    describe('percentage_previous weight type', () => {
        it('calculates weight based on previous occurrence (simple chain)', async () => {
            // Current exercise (order 2, percentage_previous, +10%)
            const currentExercise: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 10, // +10% from previous
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            // Previous exercise (order 1, absolute 100kg)
            const previousExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'absolute',
                weight: 100,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(
                normalizeWorkoutExerciseNullable(previousExercise)
            )

            const result = await calculateEffectiveWeight(currentExercise, mockTraineeId)
            // 100 * (1 + 10/100) = 100 * 1.1 = 110
            expect(result).toBeCloseTo(110, 5)

            expect(prisma.workoutExercise.findFirst).toHaveBeenCalledWith({
                where: {
                    workoutId: mockWorkoutId,
                    exerciseId: mockExerciseId,
                    order: {
                        lt: 2,
                    },
                },
                orderBy: {
                    order: 'asc',
                },
            })
        })

        it('handles 2-level percentage_previous chain', async () => {
            // Exercise 3: percentage_previous +5% of Exercise 2
            const exercise3: WorkoutExercise = {
                id: 'we-3',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 3,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 5, // +5%
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            // Exercise 2: percentage_previous +10% of Exercise 1
            const exercise2: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 10, // +10%
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            // Exercise 1: absolute 100kg
            const exercise1: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'absolute',
                weight: 100,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            // First call: find exercise 2
            // Second call: find exercise 1
            vi.mocked(prisma.workoutExercise.findFirst)
                .mockResolvedValueOnce(normalizeWorkoutExerciseNullable(exercise2))
                .mockResolvedValueOnce(normalizeWorkoutExerciseNullable(exercise1))

            const result = await calculateEffectiveWeight(exercise3, mockTraineeId)
            // Exercise 1: 100kg
            // Exercise 2: 100 * 1.1 = 110kg
            // Exercise 3: 110 * 1.05 = 115.5kg
            expect(result).toBeCloseTo(115.5, 5)
        })

        it('handles 3-level percentage_previous chain', async () => {
            // Exercise 4: +3% of Exercise 3
            const exercise4: WorkoutExercise = {
                id: 'we-4',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 4,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 3,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const exercise3: WorkoutExercise = {
                id: 'we-3',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 3,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 5,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const exercise2: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 10,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const exercise1: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'absolute',
                weight: 100,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst)
                .mockResolvedValueOnce(normalizeWorkoutExerciseNullable(exercise3))
                .mockResolvedValueOnce(normalizeWorkoutExerciseNullable(exercise2))
                .mockResolvedValueOnce(normalizeWorkoutExerciseNullable(exercise1))

            const result = await calculateEffectiveWeight(exercise4, mockTraineeId)
            // Exercise 1: 100kg
            // Exercise 2: 100 * 1.1 = 110kg
            // Exercise 3: 110 * 1.05 = 115.5kg
            // Exercise 4: 115.5 * 1.03 = 118.965kg
            expect(result).toBeCloseTo(118.965, 2)
        })

        it('handles negative percentage (weight reduction)', async () => {
            const currentExercise: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: -10, // -10% (drop set)
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const previousExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'absolute',
                weight: 100,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(
                normalizeWorkoutExerciseNullable(previousExercise)
            )

            const result = await calculateEffectiveWeight(currentExercise, mockTraineeId)
            // 100 * (1 + (-10)/100) = 100 * 0.9 = 90
            expect(result).toBe(90)
        })

        it('returns null when base weight is null (missing personal record in chain)', async () => {
            const currentExercise: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 10,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            // Previous exercise uses percentage_1rm but record is missing
            const previousExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'percentage_1rm',
                weight: 80,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(
                normalizeWorkoutExerciseNullable(previousExercise)
            )
            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(null)

            const result = await calculateEffectiveWeight(currentExercise, mockTraineeId)
            expect(result).toBeNull()
        })

        it('throws error when no previous occurrence found', async () => {
            const currentExercise: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1, // First exercise, can't use percentage_previous
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 10,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null)

            await expect(
                calculateEffectiveWeight(currentExercise, mockTraineeId)
            ).rejects.toThrow(CALCULATION_ERROR_KEYS.noPreviousOccurrenceFound)
        })

        it('throws error when recursion depth exceeds limit', async () => {
            const currentExercise: WorkoutExercise = {
                id: 'we-12',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 12,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 5,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            // Mock a long chain of percentage_previous
            const createChainExercise = (order: number): WorkoutExercise => ({
                id: `we-${order}`,
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 5,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            })

            // Mock 11 calls, all returning percentage_previous exercises
            for (let i = 11; i >= 1; i--) {
                vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValueOnce(
                    normalizeWorkoutExerciseNullable(createChainExercise(i))
                )
            }

            await expect(
                calculateEffectiveWeight(currentExercise, mockTraineeId)
            ).rejects.toThrow(CALCULATION_ERROR_KEYS.maxRecursionDepthExceeded)
        })
    })

    describe('mixed weight type chains', () => {
        it('handles chain: absolute → percentage_previous → percentage_previous', async () => {
            // This is already tested above, but documenting the pattern
            const exercise3: WorkoutExercise = {
                id: 'we-3',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 3,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 5,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const exercise2: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 10,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const exercise1: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'absolute',
                weight: 100,
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst)
                .mockResolvedValueOnce(normalizeWorkoutExerciseNullable(exercise2))
                .mockResolvedValueOnce(normalizeWorkoutExerciseNullable(exercise1))

            const result = await calculateEffectiveWeight(exercise3, mockTraineeId)
            expect(result).toBeCloseTo(115.5, 5)
        })

        it('handles chain: percentage_1rm → percentage_previous', async () => {
            const exercise2: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: 10, // +10%
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const exercise1: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'percentage_1rm',
                weight: 80, // 80% of 1RM
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const mockRecord = {
                id: 'pr-1',
                traineeId: mockTraineeId,
                exerciseId: mockExerciseId,
                weight: 150,
                reps: 1,
                notes: null,
                recordDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(
                normalizeWorkoutExerciseNullable(exercise1)
            )
            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(mockRecord)

            const result = await calculateEffectiveWeight(exercise2, mockTraineeId)
            // Exercise 1: 150 * 0.8 = 120kg
            // Exercise 2: 120 * 1.1 = 132kg
            expect(result).toBe(132)
        })

        it('handles chain: percentage_rm → percentage_previous', async () => {
            const exercise2: WorkoutExercise = {
                id: 'we-2',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 2,
                sets: 3,
                reps: '8',
                weightType: 'percentage_previous',
                weight: -10, // -10% drop set
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const exercise1: WorkoutExercise = {
                id: 'we-1',
                workoutId: mockWorkoutId,
                exerciseId: mockExerciseId,
                order: 1,
                sets: 3,
                reps: '8',
                weightType: 'percentage_rm',
                weight: 90, // 90% of 8RM
                rpe: null,
                restSeconds: 120,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const mockRecord = {
                id: 'pr-1',
                traineeId: mockTraineeId,
                exerciseId: mockExerciseId,
                weight: 100,
                reps: 8,
                notes: null,
                recordDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(
                normalizeWorkoutExerciseNullable(exercise1)
            )
            vi.mocked(prisma.personalRecord.findFirst).mockResolvedValue(mockRecord)

            const result = await calculateEffectiveWeight(exercise2, mockTraineeId)
            // Exercise 1: 100 * 0.9 = 90kg
            // Exercise 2: 90 * 0.9 = 81kg
            expect(result).toBe(81)
        })
    })
})
