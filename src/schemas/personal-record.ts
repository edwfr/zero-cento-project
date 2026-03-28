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
    .max(20, 'Massimo 20 ripetizioni'),
  weight: z
    .number()
    .min(0, 'Peso minimo 0 kg')
    .max(1000, 'Peso massimo 1000 kg'),
  recordDate: z
    .string()
    .datetime('Data non valida')
    .or(z.date()),
  notes: z.string().max(500).optional(),
})

export const updatePersonalRecordSchema = personalRecordSchema.partial()

export type PersonalRecordInput = z.infer<typeof personalRecordSchema>
export type UpdatePersonalRecordInput = z.infer<typeof updatePersonalRecordSchema>
