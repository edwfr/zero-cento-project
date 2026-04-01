import { z } from 'zod'

/**
 * Training Program Validation Schemas
 */

export const createProgramSchema = z.object({
    title: z
        .string()
        .min(3, 'Titolo troppo corto')
        .max(100, 'Titolo troppo lungo'),
    traineeId: z.string().uuid('ID trainee non valido'),
    durationWeeks: z
        .number()
        .int('Durata deve essere intero')
        .min(1, 'Minimo 1 settimana')
        .max(52, 'Massimo 52 settimane'),
    workoutsPerWeek: z
        .number()
        .int('Allenamenti per settimana deve essere intero')
        .min(1, 'Minimo 1 allenamento/settimana')
        .max(7, 'Massimo 7 allenamenti/settimana'),
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
                    throw new Error('Data di inizio non valida')
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
