import { describe, it, expect } from 'vitest'
import { createRenewalSchema, updateRenewalSchema } from '@/schemas/subscription-renewal'

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const valid = { traineeId: TRAINEE_ID, startDate: '2026-11-01', durationMonths: 3 }

function messages(result: { success: boolean; error?: { errors: { message: string }[] } }) {
    return result.success ? [] : result.error!.errors.map((issue) => issue.message)
}

describe('createRenewalSchema', () => {
    it('normalises the start date to a UTC day', () => {
        const result = createRenewalSchema.parse({ ...valid, startDate: '2026-11-01T18:45:00.000Z' })

        expect(result.startDate).toEqual(new Date('2026-11-01T00:00:00.000Z'))
    })

    it('strips a client-supplied endDate', () => {
        const result = createRenewalSchema.parse({ ...valid, endDate: '2030-01-01' })

        expect(result).not.toHaveProperty('endDate')
    })

    it.each([0, 37, 1.5])('rejects duration %s', (durationMonths) => {
        const result = createRenewalSchema.safeParse({ ...valid, durationMonths })

        expect(messages(result)).toContain('validation.durationMonthsRange')
    })

    it('rejects an unparseable start date without throwing', () => {
        const result = createRenewalSchema.safeParse({ ...valid, startDate: 'not-a-date' })

        expect(messages(result)).toContain('validation.invalidDate')
    })

    it('rejects a non-uuid trainee id', () => {
        const result = createRenewalSchema.safeParse({ ...valid, traineeId: 'abc' })

        expect(messages(result)).toContain('validation.invalidTraineeId')
    })
})

describe('updateRenewalSchema', () => {
    it('accepts start date and duration without trainee id', () => {
        expect(updateRenewalSchema.safeParse({ startDate: '2026-11-01', durationMonths: 12 }).success).toBe(true)
    })

    it('requires the duration', () => {
        expect(updateRenewalSchema.safeParse({ startDate: '2026-11-01' }).success).toBe(false)
    })
})
