import { describe, it, expect, afterEach, vi } from 'vitest'
import {
    todayInRome,
    isProgramVisibleToTrainee,
    traineeVisibleProgramWhere,
    weekStartDate,
} from '@/lib/program-visibility'

describe('program-visibility', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    describe('todayInRome', () => {
        it('returns the Rome calendar day as UTC midnight', () => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-10-04T10:00:00Z'))
            expect(todayInRome()).toEqual(new Date('2026-10-04T00:00:00Z'))
        })

        it('is already the next day in Rome just after local midnight', () => {
            vi.useFakeTimers()
            // 23:30 UTC = 01:30 in Rome (CEST, UTC+2)
            vi.setSystemTime(new Date('2026-10-04T23:30:00Z'))
            expect(todayInRome()).toEqual(new Date('2026-10-05T00:00:00Z'))
        })
    })

    describe('isProgramVisibleToTrainee', () => {
        const now = new Date('2026-10-04T10:00:00Z')

        it('hides an active program that starts in the future', () => {
            expect(
                isProgramVisibleToTrainee({ status: 'active', startDate: new Date('2026-10-05T00:00:00Z') }, now)
            ).toBe(false)
        })

        it('shows an active program that starts today', () => {
            expect(
                isProgramVisibleToTrainee({ status: 'active', startDate: new Date('2026-10-04T00:00:00Z') }, now)
            ).toBe(true)
        })

        it('shows an active program that started in the past', () => {
            expect(
                isProgramVisibleToTrainee({ status: 'active', startDate: new Date('2026-09-01T00:00:00Z') }, now)
            ).toBe(true)
        })

        it('shows an active program without a start date', () => {
            expect(isProgramVisibleToTrainee({ status: 'active', startDate: null }, now)).toBe(true)
        })

        it('shows non-active programs regardless of start date', () => {
            const future = new Date('2026-12-01T00:00:00Z')
            expect(isProgramVisibleToTrainee({ status: 'completed', startDate: future }, now)).toBe(true)
            expect(isProgramVisibleToTrainee({ status: 'draft', startDate: future }, now)).toBe(true)
        })

        it('uses the Rome day around midnight', () => {
            const startsOct5 = { status: 'active' as const, startDate: new Date('2026-10-05T00:00:00Z') }
            // 21:59 UTC = 23:59 Rome on Oct 4 → still hidden
            expect(isProgramVisibleToTrainee(startsOct5, new Date('2026-10-04T21:59:00Z'))).toBe(false)
            // 22:00 UTC = 00:00 Rome on Oct 5 → visible
            expect(isProgramVisibleToTrainee(startsOct5, new Date('2026-10-04T22:00:00Z'))).toBe(true)
        })
    })

    describe('traineeVisibleProgramWhere', () => {
        it('builds a Prisma filter that hides future active programs', () => {
            expect(traineeVisibleProgramWhere(new Date('2026-10-04T10:00:00Z'))).toEqual({
                OR: [
                    { status: { not: 'active' } },
                    { startDate: null },
                    { startDate: { lte: new Date('2026-10-04T00:00:00Z') } },
                ],
            })
        })
    })

    describe('weekStartDate', () => {
        const start = new Date('2026-10-26T00:00:00Z')

        it('starts week 1 on the program start date', () => {
            expect(weekStartDate(start, 1)).toEqual(new Date('2026-10-26T00:00:00Z'))
        })

        it('adds seven days per week, across month ends', () => {
            expect(weekStartDate(start, 2)).toEqual(new Date('2026-11-02T00:00:00Z'))
        })

        it('does not mutate the program start date', () => {
            weekStartDate(start, 3)
            expect(start).toEqual(new Date('2026-10-26T00:00:00Z'))
        })
    })
})
