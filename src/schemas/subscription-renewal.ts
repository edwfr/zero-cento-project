import { z } from 'zod'
import { MAX_DURATION_MONTHS, MAX_PROGRAM_COUNT, MIN_DURATION_MONTHS, MIN_PROGRAM_COUNT, toSubscriptionDay } from '@/lib/subscriptions'

/**
 * Subscription Renewal Validation Schemas
 *
 * A renewal is either a period (start + months) or a package of programs
 * (purchase date + count); `kind` discriminates.
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

const programCountSchema = z
    .number({ invalid_type_error: 'validation.programCountRange', required_error: 'validation.programCountRange' })
    .int('validation.programCountRange')
    .min(MIN_PROGRAM_COUNT, 'validation.programCountRange')
    .max(MAX_PROGRAM_COUNT, 'validation.programCountRange')

const periodFields = {
    kind: z.literal('period'),
    startDate: startDateSchema,
    durationMonths: durationMonthsSchema,
}

const programsFields = {
    kind: z.literal('programs'),
    // Purchase date of the package
    startDate: startDateSchema,
    programCount: programCountSchema,
}

/** Clients written before packages existed send no kind: they mean a period renewal. */
function defaultKind(value: unknown): unknown {
    if (value !== null && typeof value === 'object' && !('kind' in value)) return { ...value, kind: 'period' }
    return value
}

export const updateRenewalSchema = z.preprocess(
    defaultKind,
    z.discriminatedUnion('kind', [z.object(periodFields), z.object(programsFields)])
)

const traineeIdSchema = z.string().uuid('validation.invalidTraineeId')

export const createRenewalSchema = z.preprocess(
    defaultKind,
    z.discriminatedUnion('kind', [
        z.object({ ...periodFields, traineeId: traineeIdSchema }),
        z.object({ ...programsFields, traineeId: traineeIdSchema }),
    ])
)

export type CreateRenewalInput = z.infer<typeof createRenewalSchema>
export type UpdateRenewalInput = z.infer<typeof updateRenewalSchema>

