import { z } from 'zod'

/**
 * Movement Pattern Validation Schemas
 */

export const movementPatternSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome troppo corto')
    .max(50, 'Nome troppo lungo'),
  description: z.string().max(200).optional(),
})

export const updateMovementPatternSchema = movementPatternSchema.partial()

export const movementPatternColorSchema = z.object({
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Colore deve essere in formato hex (#RRGGBB)'),
})

export type MovementPatternInput = z.infer<typeof movementPatternSchema>
export type UpdateMovementPatternInput = z.infer<typeof updateMovementPatternSchema>
export type MovementPatternColorInput = z.infer<typeof movementPatternColorSchema>
