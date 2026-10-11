import { z } from 'zod'

/**
 * Workout Template Validation Schemas
 * Messages are i18n keys. `order` is derived from array position when persisting.
 */

// Same accepted formats as workoutExerciseSchema.reps (string forms), plus range ordering.
const REPS_PATTERNS = [/^\d+$/, /^\d+-\d+$/, /^\d+\/\d+$/, /^\d+"$/]

const repsSchema = z.string().refine(
    (value) => {
        if (value === 'max') return true
        if (!REPS_PATTERNS.some((re) => re.test(value))) return false
        const range = /^(\d+)-(\d+)$/.exec(value)
        if (range && Number(range[1]) > Number(range[2])) return false
        return true
    },
    { message: 'validation.invalidReps' }
)

export const templateExerciseSchema = z.object({
    exerciseId: z.string().uuid(),
    sets: z.number().int().min(1).max(20),
    reps: repsSchema,
    restTime: z.enum(['s30', 'm1', 'm1s30', 'm2', 'm3', 'm5']),
})

export const templateWorkoutSchema = z.object({
    dayIndex: z.number().int().min(0),
    exercises: z.array(templateExerciseSchema),
})

export const workoutTemplateSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, 'validation.templateNameRequired')
            .max(100, 'validation.templateNameTooLong'),
        workoutsPerWeek: z.number().int().min(1).max(7),
        workouts: z.array(templateWorkoutSchema),
    })
    .superRefine((data, ctx) => {
        if (data.workouts.length !== data.workoutsPerWeek) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'validation.templateWorkoutsMismatch',
                path: ['workouts'],
            })
            return
        }
        const days = data.workouts.map((w) => w.dayIndex).sort((a, b) => a - b)
        if (days.some((d, i) => d !== i)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'validation.templateInvalidDayIndex',
                path: ['workouts'],
            })
        }
    })

export type WorkoutTemplateInput = z.infer<typeof workoutTemplateSchema>
