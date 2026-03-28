import { z } from 'zod'

/**
 * Muscle Group Validation Schemas
 */

export const muscleGroupSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome troppo corto')
    .max(50, 'Nome troppo lungo'),
  description: z.string().max(200).optional(),
})

export const updateMuscleGroupSchema = muscleGroupSchema.partial()

export type MuscleGroupInput = z.infer<typeof muscleGroupSchema>
export type UpdateMuscleGroupInput = z.infer<typeof updateMuscleGroupSchema>
