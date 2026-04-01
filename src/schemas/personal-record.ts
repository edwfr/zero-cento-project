import { z } from 'zod'

/**
 * Personal Record Validation Schemas
 */

export const personalRecordSchema = z.object({
    exerciseId: z.string().uuid('ID esercizio non valido'),
    reps: z
        .number()
        .int('Ripetizioni deve essere intero')
        .min(1, 'Minimo 1 ripetizione')
        .max(100, 'Massimo 100 ripetizioni'),
    weight: z
        .number()
        .positive('Peso deve essere maggiore di 0')
        .max(1000, 'Peso massimo 1000 kg'),
    recordDate: z
        .union([z.string(), z.date()])
        .transform((val) => {
            if (typeof val === 'string') {
                // Accept both date (YYYY-MM-DD) and datetime (ISO 8601) formats
                const date = new Date(val)
                if (isNaN(date.getTime())) {
                    throw new Error('Data non valida')
                }
                return date
            }
            return val
        })
        .refine((date) => date <= new Date(), 'La data del record non può essere futura'),
    notes: z.string().max(500).optional(),
})

export const updatePersonalRecordSchema = personalRecordSchema.partial()

export type PersonalRecordInput = z.infer<typeof personalRecordSchema>
export type UpdatePersonalRecordInput = z.infer<typeof updatePersonalRecordSchema>
