import { WeekType } from '@prisma/client'
import { z } from 'zod'

/**
 * Week Configuration Validation Schemas
 */

export const weekConfigSchema = z.object({
    weekType: z.nativeEnum(WeekType, {
        errorMap: () => ({ message: 'validation.invalidWeekType' }),
    }),
    feedbackRequested: z.boolean().default(false),
})

export const updateWeekSchema = weekConfigSchema.partial()

export type WeekConfigInput = z.infer<typeof weekConfigSchema>
export type UpdateWeekInput = z.infer<typeof updateWeekSchema>
