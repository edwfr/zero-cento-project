import { z } from 'zod'

/**
 * Workout Exercise Validation Schemas
 */

// Base schema without refinements (for use with .partial())
const workoutExerciseBaseSchema = z.object({
    exerciseId: z.string().uuid('ID esercizio non valido'),
    variant: z.string().max(100, 'Variante massimo 100 caratteri').nullable().optional(),
    sets: z
        .number()
        .int('Numero di serie deve essere intero')
        .min(1, 'Minimo 1 serie')
        .max(20, 'Massimo 20 serie'),
    reps: z.union([
        z.number().int().min(1).max(50),
        z.string().regex(/^\d+$/, 'Numero singolo: "8"'),
        z.string().regex(/^\d+-\d+$/, 'Formato range: "8-10"'),
        z.string().regex(/^\d+\/\d+$/, 'Formato drop: "6/8"'),
        z.literal('max'),
    ]),
    targetRpe: z
        .number()
        .min(5.0, 'RPE minimo 5.0')
        .max(10.0, 'RPE massimo 10.0')
        .multipleOf(0.5, 'RPE deve essere multiplo di 0.5')
        .nullable()
        .optional(),
    weightType: z.enum(
        ['absolute', 'percentage_1rm', 'percentage_rm', 'percentage_previous'],
        {
            errorMap: () => ({ message: 'Tipo peso non valido' }),
        }
    ),
    weight: z.number().optional(),
    effectiveWeight: z.number().nullable().optional(),
    restTime: z.enum(['s30', 'm1', 'm2', 'm3', 'm5'], {
        errorMap: () => ({ message: 'Tempo recupero non valido' }),
    }),
    isWarmup: z.boolean().default(false),
    isSkeletonExercise: z.boolean().default(false),
    notes: z.string().max(500).nullable().optional(),
    order: z.number().int().min(1),
})

// Full schema with refinements
export const workoutExerciseSchema = workoutExerciseBaseSchema.superRefine(
    (data, ctx) => {
        // If weightType is percentage_*, weight is required
        if (data.weightType.startsWith('percentage') && data.weight === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'validation.weightRequiredForPercentage',
                path: ['weight'],
            })
        }
        // For absolute and percentage_1rm/percentage_rm, weight must be >= 0
        if (
            data.weight !== undefined &&
            data.weightType !== 'percentage_previous' &&
            data.weight < 0
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.too_small,
                minimum: 0,
                type: 'number',
                inclusive: true,
                message: 'validation.weightMinZero',
                path: ['weight'],
            })
        }

        if (
            data.effectiveWeight !== undefined &&
            data.effectiveWeight !== null &&
            data.effectiveWeight < 0
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.too_small,
                minimum: 0,
                type: 'number',
                inclusive: true,
                message: 'validation.effectiveWeightMinZero',
                path: ['effectiveWeight'],
            })
        }
    }
)

export const updateWorkoutExerciseSchema = workoutExerciseBaseSchema.partial().extend({
    id: z.string().uuid(),
})

export const bulkWorkoutExercisesSchema = z.object({
    workoutId: z.string().uuid(),
    exercises: z.array(workoutExerciseSchema).min(1, 'validation.atLeastOneExercise'),
})

export const bulkSaveWorkoutExercisesSchema = z.object({
    exercises: z
        .array(
            workoutExerciseBaseSchema
                .extend({ id: z.string().uuid().optional() })
                .superRefine((data, ctx) => {
                    if (data.weightType.startsWith('percentage') && data.weight === undefined) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: 'validation.weightRequiredForPercentage',
                            path: ['weight'],
                        })
                    }
                    if (
                        data.weight !== undefined &&
                        data.weightType !== 'percentage_previous' &&
                        data.weight < 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.too_small,
                            minimum: 0,
                            type: 'number',
                            inclusive: true,
                            message: 'validation.weightMinZero',
                            path: ['weight'],
                        })
                    }
                    if (
                        data.effectiveWeight !== undefined &&
                        data.effectiveWeight !== null &&
                        data.effectiveWeight < 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.too_small,
                            minimum: 0,
                            type: 'number',
                            inclusive: true,
                            message: 'validation.effectiveWeightMinZero',
                            path: ['effectiveWeight'],
                        })
                    }
                })
        )
        .min(1, 'validation.atLeastOneExercise'),
})

export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>
export type UpdateWorkoutExerciseInput = z.infer<typeof updateWorkoutExerciseSchema>
export type BulkWorkoutExercisesInput = z.infer<typeof bulkWorkoutExercisesSchema>
export type BulkSaveWorkoutExercisesInput = z.infer<typeof bulkSaveWorkoutExercisesSchema>
