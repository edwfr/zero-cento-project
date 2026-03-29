import { z } from 'zod'

/**
 * Workout Exercise Validation Schemas
 */

// Base schema without refinements (for use with .partial())
const workoutExerciseBaseSchema = z.object({
    exerciseId: z.string().uuid('ID esercizio non valido'),
    sets: z
        .number()
        .int('Numero di serie deve essere intero')
        .min(1, 'Minimo 1 serie')
        .max(20, 'Massimo 20 serie'),
    reps: z.union([
        z.number().int().min(1).max(50),
        z.string().regex(/^\d+-\d+$/, 'Formato range: "8-10"'),
        z.string().regex(/^\d+\/\d+$/, 'Formato drop: "6/8"'),
    ]),
    targetRpe: z
        .number()
        .min(5.0, 'RPE minimo 5.0')
        .max(10.0, 'RPE massimo 10.0')
        .multipleOf(0.5, 'RPE deve essere multiplo di 0.5')
        .optional(),
    weightType: z.enum(
        ['absolute', 'percentage_1rm', 'percentage_rm', 'percentage_previous'],
        {
            errorMap: () => ({ message: 'Tipo peso non valido' }),
        }
    ),
    weight: z.number().min(0).optional(),
    restTime: z.enum(['s30', 'm1', 'm2', 'm3', 'm5'], {
        errorMap: () => ({ message: 'Tempo recupero non valido' }),
    }),
    isWarmup: z.boolean().default(false),
    notes: z.string().max(500).optional(),
    order: z.number().int().min(1),
})

// Full schema with refinements
export const workoutExerciseSchema = workoutExerciseBaseSchema.refine(
    (data) => {
        // If weightType is percentage_*, weight is required
        if (data.weightType.startsWith('percentage') && !data.weight) {
            return false
        }
        return true
    },
    {
        message: 'Peso è obbligatorio per i tipi percentuale',
        path: ['weight'],
    }
)

export const updateWorkoutExerciseSchema = workoutExerciseBaseSchema.partial().extend({
    id: z.string().uuid(),
})

export const bulkWorkoutExercisesSchema = z.object({
    workoutId: z.string().uuid(),
    exercises: z.array(workoutExerciseSchema).min(1, 'Almeno un esercizio richiesto'),
})

export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>
export type UpdateWorkoutExerciseInput = z.infer<typeof updateWorkoutExerciseSchema>
export type BulkWorkoutExercisesInput = z.infer<typeof bulkWorkoutExercisesSchema>
