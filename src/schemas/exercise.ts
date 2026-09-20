import { z } from 'zod'
import { EXERCISE_TYPES } from '@/lib/exercise-type'

/**
 * Exercise Validation Schemas
 */

export const muscleGroupAssignmentSchema = z.object({
    muscleGroupId: z.string().uuid('validation.invalidMuscleGroupId'),
    coefficient: z
        .number()
        .min(0, 'validation.coefficientMin')
        .max(1, 'validation.coefficientMax'),
})

export const exerciseSchema = z.object({
    name: z
        .string()
        .min(3, 'validation.exerciseNameTooShort')
        .max(100, 'validation.exerciseNameTooLong'),
    description: z.string().max(500).optional(),
    youtubeUrl: z
        .string()
        .url('validation.invalidUrl')
        .regex(/(youtube\.com|youtu\.be)/, 'validation.mustBeYoutube')
        .optional(),
    type: z.enum(EXERCISE_TYPES, {
        errorMap: () => ({ message: 'validation.invalidExerciseType' }),
    }),
    movementPatternId: z.string().uuid('validation.invalidMovementPatternId'),
    muscleGroups: z.array(muscleGroupAssignmentSchema).default([]),
    notes: z.array(z.string().max(200)).optional(),
})

export const updateExerciseSchema = exerciseSchema.partial()

export const exerciseFilterSchema = z.object({
    type: z.enum(EXERCISE_TYPES).optional(),
    movementPatternId: z.string().uuid().optional(),
    muscleGroupId: z.string().uuid().optional(),
    search: z.string().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(500).default(20),
    sortBy: z.enum(['name', 'type', 'createdAt']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
})

export type ExerciseInput = z.infer<typeof exerciseSchema>
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>
export type ExerciseFilterInput = z.infer<typeof exerciseFilterSchema>
export type MuscleGroupAssignment = z.infer<typeof muscleGroupAssignmentSchema>
