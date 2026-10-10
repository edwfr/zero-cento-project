import { describe, it, expect } from 'vitest'
import {
    formatTimelineLabel,
    DEFAULT_PHASE_NAMES,
    PHASE_COLOR_PALETTE,
    VIEW_SPAN_MS,
    WEEK_MS,
    addDays,
    clampRangeToFree,
    dayToLocalMs,
    dbDateToIsoDay,
    findOverlap,
    isIsoDay,
    isValidPeriodRange,
    isoDayToDbDate,
    localMsToDay,
    movePeriod,
    nextUnusedColor,
    programToRange,
    readableTextColor,
    resizePeriod,
    snapToWeekEnd,
    snapToWeekStart,
    weekEndOf,
    weekStartOf,
    xToMs,
} from '@/lib/macro-periods'

// 2026-10-05 is a Monday, 2026-10-11 a Sunday.
const MON = '2026-10-05'
const SUN = '2026-10-11'

describe('isIsoDay', () => {
    it('accepts a real calendar day', () => {
        expect(isIsoDay('2026-10-05')).toBe(true)
        expect(isIsoDay('2028-02-29')).toBe(true)
    })

    it.each(['2026-02-30', '2026-13-01', '2026-1-5', '05/10/2026', '', '2026-10-05T00:00:00Z'])(
        'rejects %s',
        (value) => {
            expect(isIsoDay(value)).toBe(false)
        }
    )
})

describe('addDays', () => {
    it('crosses month and year boundaries', () => {
        expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    })

    it('is not shifted by a DST change', () => {
        // Europe/Rome leaves DST on 2026-10-25: day arithmetic must stay calendar-based
        expect(addDays('2026-10-19', 7)).toBe('2026-10-26')
    })
})

describe('weekStartOf / weekEndOf', () => {
    it('returns the Monday and Sunday of the containing week', () => {
        for (const day of ['2026-10-05', '2026-10-07', '2026-10-11']) {
            expect(weekStartOf(day)).toBe(MON)
            expect(weekEndOf(day)).toBe(SUN)
        }
    })

    it('handles a week that straddles a year', () => {
        expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
        expect(weekEndOf('2026-12-28')).toBe('2027-01-03')
    })
})

describe('snapToWeekStart', () => {
    it.each([
        ['2026-10-05', '2026-10-05'], // Monday stays
        ['2026-10-06', '2026-10-05'], // Tuesday → back
        ['2026-10-08', '2026-10-05'], // Thursday → back
        ['2026-10-09', '2026-10-12'], // Friday → forward
        ['2026-10-11', '2026-10-12'], // Sunday → forward
    ])('snaps %s to the nearest Monday %s', (day, expected) => {
        expect(snapToWeekStart(day)).toBe(expected)
    })
})

describe('snapToWeekEnd', () => {
    it.each([
        ['2026-10-11', '2026-10-11'], // Sunday stays
        ['2026-10-12', '2026-10-11'], // Monday → back
        ['2026-10-14', '2026-10-11'], // Wednesday → back
        ['2026-10-15', '2026-10-18'], // Thursday → forward
        ['2026-10-17', '2026-10-18'], // Saturday → forward
    ])('snaps %s to the nearest Sunday %s', (day, expected) => {
        expect(snapToWeekEnd(day)).toBe(expected)
    })
})

describe('isValidPeriodRange', () => {
    it('accepts Monday → Sunday, one week or more', () => {
        expect(isValidPeriodRange(MON, SUN)).toBe(true)
        expect(isValidPeriodRange(MON, '2026-11-01')).toBe(true)
    })

    it.each([
        ['2026-10-06', SUN], // start not Monday
        [MON, '2026-10-10'], // end not Sunday
        ['2026-10-12', SUN], // end before start
        [MON, MON], // same day
        ['nope', SUN],
    ])('rejects %s → %s', (start, end) => {
        expect(isValidPeriodRange(start, end)).toBe(false)
    })
})

const periods = [
    { id: 'p1', startDate: '2026-10-05', endDate: '2026-10-18' }, // weeks 1-2
    { id: 'p2', startDate: '2026-11-02', endDate: '2026-11-08' }, // week 5
]

describe('findOverlap', () => {
    it('returns the period sharing at least one day', () => {
        expect(findOverlap({ startDate: '2026-10-12', endDate: '2026-10-25' }, periods)?.id).toBe('p1')
    })

    it('treats adjacent weeks as free', () => {
        expect(findOverlap({ startDate: '2026-10-19', endDate: '2026-11-01' }, periods)).toBeNull()
    })

    it('ignores the period being edited', () => {
        expect(findOverlap({ startDate: '2026-10-05', endDate: '2026-10-25' }, periods, 'p1')).toBeNull()
        expect(findOverlap({ startDate: '2026-10-05', endDate: '2026-11-08' }, periods, 'p1')?.id).toBe('p2')
    })

    it('returns null for an empty plan', () => {
        expect(findOverlap({ startDate: MON, endDate: SUN }, [])).toBeNull()
    })
})

describe('clampRangeToFree', () => {
    it('returns the anchor week for a press without movement', () => {
        expect(clampRangeToFree('2026-10-21', '2026-10-21', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-10-25',
        })
    })

    it('grows to the right up to the pointer week', () => {
        expect(clampRangeToFree('2026-10-21', '2026-10-28', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
    })

    it('stops at the next period when dragging right', () => {
        expect(clampRangeToFree('2026-10-21', '2026-12-01', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
    })

    it('grows to the left and stops at the previous period', () => {
        expect(clampRangeToFree('2026-10-28', '2026-09-01', periods)).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
    })

    it('grows freely to the left when nothing is in the way', () => {
        expect(clampRangeToFree('2026-09-23', '2026-09-08', periods)).toEqual({
            startDate: '2026-09-07',
            endDate: '2026-09-27',
        })
    })

    it('returns null when the anchor week is occupied', () => {
        expect(clampRangeToFree('2026-10-07', '2026-10-30', periods)).toBeNull()
    })
})

describe('movePeriod', () => {
    it('keeps the length and snaps the start to the nearest Monday', () => {
        expect(movePeriod({ startDate: MON, endDate: '2026-10-18' }, '2026-10-21')).toEqual({
            startDate: '2026-10-19',
            endDate: '2026-11-01',
        })
        expect(movePeriod({ startDate: MON, endDate: SUN }, '2026-10-13')).toEqual({
            startDate: '2026-10-12',
            endDate: '2026-10-18',
        })
    })
})

describe('resizePeriod', () => {
    const period = { startDate: '2026-10-05', endDate: '2026-10-25' } // 3 weeks

    it('moves the left edge to the nearest Monday', () => {
        expect(resizePeriod(period, 'left', '2026-10-13')).toEqual({ startDate: '2026-10-12', endDate: '2026-10-25' })
    })

    it('moves the right edge; the day is the exclusive end the library reports', () => {
        // library reports Monday 2026-11-02 00:00 as the new end → last day is Sunday 2026-11-01
        expect(resizePeriod(period, 'right', '2026-11-02')).toEqual({ startDate: '2026-10-05', endDate: '2026-11-01' })
    })

    it('keeps one week when the left edge is dragged past the right edge', () => {
        expect(resizePeriod(period, 'left', '2026-12-01')).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' })
    })

    it('keeps one week when the right edge is dragged past the left edge', () => {
        expect(resizePeriod(period, 'right', '2026-09-01')).toEqual({ startDate: '2026-10-05', endDate: '2026-10-11' })
    })
})

describe('programToRange', () => {
    it('spans durationWeeks from the start date, whatever weekday it is', () => {
        expect(programToRange('2026-10-07', 4)).toEqual({ startDate: '2026-10-07', endDate: '2026-11-03' })
    })

    it('renders a zero or negative duration as a single day', () => {
        expect(programToRange('2026-10-07', 0)).toEqual({ startDate: '2026-10-07', endDate: '2026-10-07' })
        expect(programToRange('2026-10-07', -3)).toEqual({ startDate: '2026-10-07', endDate: '2026-10-07' })
    })
})

describe('conversions', () => {
    it('round-trips a database date', () => {
        expect(dbDateToIsoDay(new Date('2026-10-05T00:00:00.000Z'))).toBe(MON)
        expect(isoDayToDbDate(MON).toISOString()).toBe('2026-10-05T00:00:00.000Z')
    })

    it('round-trips a local timestamp', () => {
        expect(localMsToDay(dayToLocalMs(MON))).toBe(MON)
        expect(localMsToDay(dayToLocalMs(MON) + 23 * 3_600_000)).toBe(MON)
    })

    it('maps an x position onto the visible range', () => {
        expect(xToMs(0, 1000, 100, 200)).toBe(100)
        expect(xToMs(500, 1000, 100, 200)).toBe(150)
        expect(xToMs(1000, 1000, 100, 200)).toBe(200)
    })

    it('clamps an x outside the canvas and survives a zero width', () => {
        expect(xToMs(-50, 1000, 100, 200)).toBe(100)
        expect(xToMs(5000, 1000, 100, 200)).toBe(200)
        expect(xToMs(10, 0, 100, 200)).toBe(100)
    })
})

describe('timeline scale', () => {
    it('shows 12 weeks in the weeks view and 52 in the month view', () => {
        expect(WEEK_MS).toBe(7 * 86_400_000)
        expect(VIEW_SPAN_MS).toEqual({ weeks: 12 * WEEK_MS, month: 52 * WEEK_MS })
    })
})

describe('colours', () => {
    it('has 12 distinct valid palette colours and 3 default names', () => {
        expect(PHASE_COLOR_PALETTE).toHaveLength(12)
        expect(new Set(PHASE_COLOR_PALETTE).size).toBe(12)
        for (const color of PHASE_COLOR_PALETTE) expect(color).toMatch(/^#[0-9a-f]{6}$/)
        expect(DEFAULT_PHASE_NAMES).toEqual(['Tipo fase 1', 'Tipo fase 2', 'Tipo fase 3'])
    })

    it('proposes the first palette colour not in use, case-insensitively', () => {
        expect(nextUnusedColor([])).toBe(PHASE_COLOR_PALETTE[0])
        expect(nextUnusedColor([PHASE_COLOR_PALETTE[0].toUpperCase(), PHASE_COLOR_PALETTE[1]])).toBe(
            PHASE_COLOR_PALETTE[2]
        )
    })

    it('cycles the palette when every colour is taken', () => {
        expect(nextUnusedColor([...PHASE_COLOR_PALETTE])).toBe(PHASE_COLOR_PALETTE[0])
        expect(nextUnusedColor([...PHASE_COLOR_PALETTE, '#000000'])).toBe(PHASE_COLOR_PALETTE[1])
    })

    it('picks white on dark and dark on light', () => {
        expect(readableTextColor('#1e3a8a')).toBe('#ffffff')
        expect(readableTextColor('#000000')).toBe('#ffffff')
        expect(readableTextColor('#fde047')).toBe('#111827')
        expect(readableTextColor('#FFFFFF')).toBe('#111827')
    })

    it.each(['#FFF', 'red', '', '#12345g'])('falls back to dark text for %s', (value) => {
        expect(readableTextColor(value)).toBe('#111827')
    })
})

describe('formatTimelineLabel', () => {
    const october = dayToLocalMs('2026-10-05')

    it('writes the month in the language of the app', () => {
        expect(formatTimelineLabel(october, 'monthYear', 'it')).toBe('ottobre 2026')
        expect(formatTimelineLabel(october, 'monthYear', 'en')).toBe('October 2026')
    })

    it('has a short month and a year form for the month view', () => {
        expect(formatTimelineLabel(october, 'month', 'it')).toBe('ott')
        expect(formatTimelineLabel(october, 'year', 'it')).toBe('2026')
    })

    it('falls back to the default language on an unknown locale tag', () => {
        expect(formatTimelineLabel(october, 'year', 'not a locale')).toBe('2026')
    })
})
