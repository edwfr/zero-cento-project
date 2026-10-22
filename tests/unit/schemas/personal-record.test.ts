import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { personalRecordSchema } from '@/schemas/personal-record'

const base = {
    exerciseId: '00000000-0000-4000-8000-000000000000',
    reps: 5,
    weight: 100,
}

describe('personalRecordSchema recordDate', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("accepts the client's local today when UTC is still on the previous day", () => {
        // 01:00 in Italy (CEST, UTC+2) on 22/10 = 23:00 UTC on 21/10
        vi.setSystemTime(new Date('2026-10-21T23:00:00Z'))
        const result = personalRecordSchema.safeParse({ ...base, recordDate: '2026-10-22' })
        expect(result.success).toBe(true)
    })

    it('accepts today and past dates', () => {
        vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
        expect(personalRecordSchema.safeParse({ ...base, recordDate: '2026-10-22' }).success).toBe(true)
        expect(personalRecordSchema.safeParse({ ...base, recordDate: '2026-01-01' }).success).toBe(true)
    })

    it('rejects a date two UTC days ahead', () => {
        vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
        const result = personalRecordSchema.safeParse({ ...base, recordDate: '2026-10-24' })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toBe('validation.dateCannotBeFuture')
    })
})
