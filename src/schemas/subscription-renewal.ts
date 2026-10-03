import { z } from 'zod'
import { MAX_DURATION_MONTHS, MIN_DURATION_MONTHS, toSubscriptionDay } from '@/lib/subscriptions'

/**
 * Subscription Renewal Validation Schemas
 *
 * endDate is never accepted from the client: the route computes it. Zod strips
 * unknown keys, so a client endDate is silently dropped.
 * Messages are i18n keys (project convention), resolved client-side.
 */

const startDateSchema = z.union([z.string(), z.date()]).transform((val, ctx) => {
    const date = typeof val === 'string' ? new Date(val) : val
    if (isNaN(date.getTime())) {
        // An issue, not a throw: a throw escapes safeParse and surfaces as a 500
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.invalidDate' })
        return z.NEVER
    }
    return toSubscriptionDay(date)
})

const durationMonthsSchema = z
    .number()
    .int('validation.durationMonthsRange')
    .min(MIN_DURATION_MONTHS, 'validation.durationMonthsRange')
    .max(MAX_DURATION_MONTHS, 'validation.durationMonthsRange')

export const updateRenewalSchema = z.object({
    startDate: startDateSchema,
    durationMonths: durationMonthsSchema,
})

export const createRenewalSchema = updateRenewalSchema.extend({
    traineeId: z.string().uuid('validation.invalidTraineeId'),
})

export type CreateRenewalInput = z.infer<typeof createRenewalSchema>
export type UpdateRenewalInput = z.infer<typeof updateRenewalSchema>
