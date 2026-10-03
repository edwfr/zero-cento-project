import { describe, it, expect } from 'vitest'
import {
    EXPIRING_THRESHOLD_DAYS,
    addMonthsClamped,
    buildSubscriptionOverview,
    isValidDurationMonths,
    latestEndDate,
    needsAttention,
    nextRenewalStart,
    remainingLabel,
    toSubscriptionDay,
    toSubscriptionSummary,
} from '@/lib/subscriptions'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('toSubscriptionDay', () => {
    it('drops the time of day, keeping the UTC calendar day', () => {
        expect(toSubscriptionDay(new Date('2026-10-03T23:59:00.000Z'))).toEqual(day('2026-10-03'))
    })
})

describe('addMonthsClamped', () => {
    it('adds months on an ordinary day', () => {
        expect(addMonthsClamped(day('2026-11-01'), 3)).toEqual(day('2027-02-01'))
    })

    it('clamps to the last day of a shorter month', () => {
        expect(addMonthsClamped(day('2027-01-31'), 1)).toEqual(day('2027-02-28'))
    })

    it('clamps to 29 February in a leap year', () => {
        expect(addMonthsClamped(day('2028-01-31'), 1)).toEqual(day('2028-02-29'))
    })

    it('rolls over the year', () => {
        expect(addMonthsClamped(day('2026-12-15'), 12)).toEqual(day('2027-12-15'))
    })

    it('ignores the time of day of the start', () => {
        expect(addMonthsClamped(new Date('2026-10-03T22:30:00.000Z'), 1)).toEqual(day('2026-11-03'))
    })
})

describe('isValidDurationMonths', () => {
    it.each([
        [1, true],
        [36, true],
        [0, false],
        [37, false],
        [1.5, false],
        [Number.NaN, false],
    ])('%s → %s', (value, expected) => {
        expect(isValidDurationMonths(value)).toBe(expected)
    })
})

describe('toSubscriptionSummary', () => {
    const today = day('2026-10-03')

    it.each<[string, string, number]>([
        ['2026-10-18', 'active', 15],
        ['2026-10-17', 'expiring', EXPIRING_THRESHOLD_DAYS],
        ['2026-10-03', 'expiring', 0],
        ['2026-10-02', 'expired', -1],
    ])('end %s → %s with %i days left', (end, status, daysLeft) => {
        expect(toSubscriptionSummary(day(end), today)).toEqual({
            status,
            endDate: `${end}T00:00:00.000Z`,
            daysLeft,
        })
    })

    it('returns null without an end date', () => {
        expect(toSubscriptionSummary(null, today)).toBeNull()
    })

    it('accepts an ISO string end date', () => {
        expect(toSubscriptionSummary('2026-10-10T00:00:00.000Z', today)?.daysLeft).toBe(7)
    })
})

describe('needsAttention', () => {
    it('is true only for expiring and expired', () => {
        expect(needsAttention({ status: 'expiring', endDate: '', daysLeft: 3 })).toBe(true)
        expect(needsAttention({ status: 'expired', endDate: '', daysLeft: -3 })).toBe(true)
        expect(needsAttention({ status: 'active', endDate: '', daysLeft: 30 })).toBe(false)
        expect(needsAttention(null)).toBe(false)
    })
})

describe('latestEndDate', () => {
    it('returns the furthest end date, not the last row', () => {
        expect(
            latestEndDate([{ endDate: day('2026-12-01') }, { endDate: day('2027-03-01') }, { endDate: day('2026-06-01') }])
        ).toEqual(day('2027-03-01'))
    })

    it('returns null for no rows', () => {
        expect(latestEndDate([])).toBeNull()
    })
})

describe('nextRenewalStart', () => {
    it('proposes the day after the current expiry', () => {
        expect(nextRenewalStart('2026-10-31T00:00:00.000Z', '2026-10-03')).toBe('2026-11-01')
    })

    it('falls back to today without a subscription', () => {
        expect(nextRenewalStart(null, '2026-10-03')).toBe('2026-10-03')
    })
})

describe('remainingLabel', () => {
    it('counts days left', () => {
        expect(remainingLabel(9)).toEqual({ key: 'subscriptions.remaining.daysLeft', count: 9 })
    })

    it('says today on the last day', () => {
        expect(remainingLabel(0)).toEqual({ key: 'subscriptions.remaining.today', count: 0 })
    })

    it('counts days overdue as a positive number', () => {
        expect(remainingLabel(-4)).toEqual({ key: 'subscriptions.remaining.daysOverdue', count: 4 })
    })
})

describe('buildSubscriptionOverview', () => {
    const today = day('2026-10-03')
    const trainees = [
        { id: 'rossi', firstName: 'Anna', lastName: 'Rossi' },
        { id: 'bianchi', firstName: 'Luca', lastName: 'Bianchi' },
        { id: 'verdi', firstName: 'Sara', lastName: 'Verdi' },
        { id: 'neri', firstName: 'Paolo', lastName: 'Neri' },
        { id: 'ardito', firstName: 'Marco', lastName: 'Ardito' },
        { id: 'conti', firstName: 'Elena', lastName: 'Conti' },
    ]
    const endDates = new Map([
        ['rossi', day('2026-10-01')], // expired, -2
        ['bianchi', day('2026-12-01')], // active, 59
        ['verdi', day('2026-10-10')], // expiring, 7
        ['conti', day('2026-10-10')], // expiring, 7 — tie with Verdi, sorted by last name
    ])

    const overview = buildSubscriptionOverview(trainees, endDates, today)

    it('orders subscribed trainees by days left, overdue first, ties by last name', () => {
        expect(overview.withSubscription.map((item) => item.lastName)).toEqual(['Rossi', 'Conti', 'Verdi', 'Bianchi'])
    })

    it('lists trainees without a subscription by last name', () => {
        expect(overview.withoutSubscription.map((item) => item.lastName)).toEqual(['Ardito', 'Neri'])
        expect(overview.withoutSubscription[0].subscription).toBeNull()
    })

    it('counts each status', () => {
        expect(overview.counts).toEqual({ expired: 1, expiring: 2, active: 1, none: 2 })
    })
})
