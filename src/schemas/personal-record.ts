import { z } from 'zod'

/**
 * Personal Record Validation Schemas
 */

export const personalRecordSchema = z.object({
    exerciseId: z.string().uuid('validation.invalidExerciseId'),
    reps: z
        .number()
        .int('validation.repsInteger')
        .min(1, 'validation.minOneRep')
        .max(100, 'validation.maxReps100'),
    weight: z
        .number()
        .positive('validation.weightPositive')
        .max(1000, 'validation.maxWeight1000'),
    recordDate: z
        .union([z.string(), z.date()])
        .transform((val) => {
            if (typeof val === 'string') {
                // Accept both date (YYYY-MM-DD) and datetime (ISO 8601) formats
                const date = new Date(val)
                if (isNaN(date.getTime())) {
                    throw new Error('validation.invalidDate')
                }
                return date
            }
            return val
        })
        .refine((date) => date <= new Date(), 'validation.dateCannotBeFuture'),
    notes: z.string().max(500).optional(),
})

export const updatePersonalRecordSchema = personalRecordSchema.partial()

export type PersonalRecordInput = z.infer<typeof personalRecordSchema>
export type UpdatePersonalRecordInput = z.infer<typeof updatePersonalRecordSchema>
