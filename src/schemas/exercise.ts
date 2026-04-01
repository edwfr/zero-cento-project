import { z } from 'zod'

/**
 * Exercise Validation Schemas
 */

export const muscleGroupAssignmentSchema = z.object({
    muscleGroupId: z.string().uuid('ID gruppo muscolare non valido'),
    coefficient: z
        .number()
        .min(0, 'Coefficiente minimo 0.0')
        .max(1, 'Coefficiente massimo 1.0'),
})

export const exerciseSchema = z.object({
    name: z
        .string()
        .min(3, 'Nome troppo corto')
        .max(100, 'Nome troppo lungo'),
    description: z.string().max(500).optional(),
    youtubeUrl: z
        .string()
        .url('URL non valido')
        .regex(/(youtube\.com|youtu\.be)/, 'Deve essere un link YouTube'),
    type: z.enum(['fundamental', 'accessory'], {
        errorMap: () => ({ message: 'Tipo esercizio non valido' }),
    }),
    movementPatternId: z.string().uuid('ID schema motorio non valido'),
    muscleGroups: z
        .array(muscleGroupAssignmentSchema)
        .min(0)
        .max(5, 'Massimo 5 gruppi muscolari'),
    notes: z.array(z.string().max(200)).optional(),
})

export const updateExerciseSchema = exerciseSchema.partial()

export const exerciseFilterSchema = z.object({
    type: z.enum(['fundamental', 'accessory']).optional(),
    movementPatternId: z.string().uuid().optional(),
    muscleGroupId: z.string().uuid().optional(),
    search: z.string().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(20),
})

export type ExerciseInput = z.infer<typeof exerciseSchema>
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>
export type ExerciseFilterInput = z.infer<typeof exerciseFilterSchema>
export type MuscleGroupAssignment = z.infer<typeof muscleGroupAssignmentSchema>
