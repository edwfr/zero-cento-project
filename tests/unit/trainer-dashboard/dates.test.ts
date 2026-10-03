import { describe, it, expect } from 'vitest'
import {
    addDays,
    programEndDate,
    recentWindowStart,
    startOfUtcDay,
    startOfUtcWeek,
    utcDayKey,
    wholeDaysBetween,
} from '@/lib/trainer-dashboard/dates'
import { NOW, day, at } from './fixtures'

describe('trainer-dashboard dates', () => {
    it('startOfUtcDay drops the time of day', () => {
        expect(startOfUtcDay(at('2026-10-03T23:59:59'))).toEqual(day('2026-10-03'))
    })

    it('addDays moves by whole days in both directions', () => {
        expect(addDays(day('2026-10-03'), 2)).toEqual(day('2026-10-05'))
        expect(addDays(day('2026-10-03'), -7)).toEqual(day('2026-09-26'))
    })

    it('startOfUtcWeek returns the Monday of the ISO week', () => {
        expect(startOfUtcWeek(NOW)).toEqual(day('2026-09-28'))
        expect(startOfUtcWeek(day('2026-09-28'))).toEqual(day('2026-09-28'))
        expect(startOfUtcWeek(at('2026-10-04T23:00:00'))).toEqual(day('2026-09-28'))
    })

    it('utcDayKey formats YYYY-MM-DD', () => {
        expect(utcDayKey(at('2026-10-03T22:30:00'))).toBe('2026-10-03')
    })

    it('wholeDaysBetween counts calendar days, ignoring time of day', () => {
        expect(wholeDaysBetween(day('2026-09-26'), NOW)).toBe(7)
        expect(wholeDaysBetween(NOW, day('2026-10-01'))).toBe(-2)
    })

    it('programEndDate is start + durationWeeks × 7 days', () => {
        expect(programEndDate(at('2026-09-01T08:00:00'), 4)).toEqual(day('2026-09-29'))
    })

    it('recentWindowStart is 7 calendar days before today', () => {
        expect(recentWindowStart(NOW)).toEqual(day('2026-09-26'))
    })
})
