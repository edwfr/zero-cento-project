import { z } from 'zod'

/**
 * Training Program Validation Schemas
 */

export const createProgramSchema = z.object({
    title: z
        .string()
        .min(3, 'validation.titleTooShort')
        .max(100, 'validation.titleTooLong'),
    traineeId: z.string().uuid('validation.invalidTraineeId'),
    isSbdProgram: z.boolean().default(false),
    durationWeeks: z
        .number()
        .int('validation.durationInteger')
        .min(1, 'validation.minWeeks')
        .max(52, 'validation.maxWeeks'),
    workoutsPerWeek: z
        .number()
        .int('validation.workoutsInteger')
        .min(1, 'validation.minWorkouts')
        .max(7, 'validation.maxWorkouts'),
})

export const updateProgramSchema = createProgramSchema.partial()

export const publishProgramSchema = z.object({
    week1StartDate: z
        .union([z.string(), z.date()])
        .transform((val) => {
            if (typeof val === 'string') {
                // Accept both date (YYYY-MM-DD) and datetime (ISO 8601) formats
                const date = new Date(val)
                if (isNaN(date.getTime())) {
                    throw new Error('validation.invalidStartDate')
                }
                return date
            }
            return val
        }),
})

export const programFilterSchema = z.object({
    traineeId: z.string().uuid().optional(),
    trainerId: z.string().uuid().optional(),
    status: z.enum(['draft', 'active', 'completed']).optional(),
    search: z.string().optional(),
})

export const completeProgramSchema = z.object({
    reason: z.string().max(500).optional(),
})

export type CreateProgramInput = z.infer<typeof createProgramSchema>
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>
export type PublishProgramInput = z.infer<typeof publishProgramSchema>
export type ProgramFilterInput = z.infer<typeof programFilterSchema>
export type CompleteProgramInput = z.infer<typeof completeProgramSchema>
