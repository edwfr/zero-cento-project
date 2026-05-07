import { z } from 'zod'

export const skeletonRowSchema = z.object({
    dayIndex: z.number().int().min(0, 'dayIndex must be non-negative'),
    order: z.number().int().min(0, 'order must be non-negative'),
    exerciseId: z.string().uuid('exerciseId must be a valid UUID'),
})

export const putSkeletonSchema = z.object({
    rows: z.array(skeletonRowSchema).default([]),
})

export type SkeletonRowInput = z.infer<typeof skeletonRowSchema>
export type PutSkeletonInput = z.infer<typeof putSkeletonSchema>
