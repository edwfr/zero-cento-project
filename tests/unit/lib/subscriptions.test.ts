import { describe, it, expect } from 'vitest'
import {
    EXPIRING_THRESHOLD_DAYS,
    addMonthsClamped,
    buildSubscriptionOverview,
    isValidDurationMonths,
    isValidProgramCount,
    needsAttention,
    nextRenewalStart,
    programsLabel,
    remainingLabel,
    resolveSummary,
    summarizeRenewals,
    summaryLabel,
    toProgramsSummary,
    toSubscriptionDay,
    toSubscriptionSummary,
    uncoveredReason,
    type SubscriptionSummary,
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
            kind: 'period',
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
        expect(needsAttention({ kind: 'period', status: 'expiring', endDate: '', daysLeft: 3 })).toBe(true)
        expect(needsAttention({ kind: 'period', status: 'expired', endDate: '', daysLeft: -3 })).toBe(true)
        expect(needsAttention({ kind: 'period', status: 'active', endDate: '', daysLeft: 30 })).toBe(false)
        expect(needsAttention(null)).toBe(false)
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
    const summariesOf = (endDates: Map<string, Date>, today: Date) => {
        const summaries = new Map<string, SubscriptionSummary>()
        for (const [id, end] of endDates) summaries.set(id, toSubscriptionSummary(end, today)!)
        return summaries
    }
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

    const overview = buildSubscriptionOverview(trainees, summariesOf(endDates, today))

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

describe('toProgramsSummary', () => {
    it.each([
        [5, 'active'],
        [2, 'active'],
        [1, 'expiring'],
        [0, 'expired'],
        [-2, 'expired'],
    ] as const)('balance %i is %s', (remaining, status) => {
        expect(toProgramsSummary(remaining)).toEqual({ kind: 'programs', status, remaining })
    })
})

describe('isValidProgramCount', () => {
    it.each([1, 50])('accepts %i', (value) => expect(isValidProgramCount(value)).toBe(true))
    it.each([0, 51, 2.5, NaN])('rejects %s', (value) => expect(isValidProgramCount(value)).toBe(false))
})

describe('resolveSummary', () => {
    const today = day('2026-10-03')

    it('returns null without a mode', () => {
        expect(resolveSummary({ mode: null, endDate: null, purchased: 0, used: 0 }, today)).toBeNull()
    })

    it('uses the balance in programs mode, ignoring any end date', () => {
        expect(resolveSummary({ mode: 'programs', endDate: day('2027-01-01'), purchased: 5, used: 4 }, today)).toEqual({
            kind: 'programs',
            status: 'expiring',
            remaining: 1,
        })
    })

    it('uses the end date in period mode, ignoring a leftover balance', () => {
        const summary = resolveSummary({ mode: 'period', endDate: day('2026-12-01'), purchased: 5, used: 2 }, today)

        expect(summary).toMatchObject({ kind: 'period', status: 'active' })
    })
})

describe('uncoveredReason', () => {
    it('is none without any renewal', () => expect(uncoveredReason(null)).toBe('none'))
    it('is periodExpired for an expired period', () =>
        expect(uncoveredReason({ kind: 'period', status: 'expired', endDate: '2026-09-01T00:00:00.000Z', daysLeft: -3 })).toBe('periodExpired'))
    it('is programsExhausted at balance 0', () => expect(uncoveredReason(toProgramsSummary(0))).toBe('programsExhausted'))
    it('is null when covered', () => {
        expect(uncoveredReason(toProgramsSummary(1))).toBeNull()
        expect(uncoveredReason({ kind: 'period', status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 })).toBeNull()
    })
})

describe('programsLabel', () => {
    it.each([
        [3, 'subscriptions.programs.available', 3],
        [1, 'subscriptions.programs.last', 1],
        [0, 'subscriptions.programs.exhausted', 0],
        [-2, 'subscriptions.programs.debt', 2],
    ] as const)('balance %i → %s', (remaining, key, count) => {
        expect(programsLabel(remaining)).toEqual({ key, count })
    })
})

describe('summaryLabel', () => {
    it('keeps the period badge key, date and days', () => {
        expect(summaryLabel({ kind: 'period', status: 'expired', endDate: '2026-09-01T00:00:00.000Z', daysLeft: -3 })).toEqual({
            key: 'subscriptions.badge.expired',
            count: -3,
            date: '2026-09-01T00:00:00.000Z',
        })
    })

    it('delegates programs to programsLabel', () => {
        expect(summaryLabel(toProgramsSummary(0))).toEqual({ key: 'subscriptions.programs.exhausted', count: 0 })
    })
})

describe('buildSubscriptionOverview with mixed kinds', () => {
    const trainees = [
        { id: 'a', firstName: 'Ada', lastName: 'Alfa' },
        { id: 'b', firstName: 'Bea', lastName: 'Beta' },
        { id: 'c', firstName: 'Cia', lastName: 'Gamma' },
        { id: 'd', firstName: 'Dea', lastName: 'Delta' },
        { id: 'e', firstName: 'Eva', lastName: 'Epsilon' },
    ]
    const period = (daysLeft: number): SubscriptionSummary => ({
        kind: 'period',
        status: daysLeft < 0 ? 'expired' : daysLeft <= 14 ? 'expiring' : 'active',
        endDate: '2026-10-10T00:00:00.000Z',
        daysLeft,
    })

    it('orders red, then amber, then active; period before programs inside a status', () => {
        const overview = buildSubscriptionOverview(
            trainees,
            new Map<string, SubscriptionSummary>([
                ['a', toProgramsSummary(4)],
                ['b', toProgramsSummary(1)],
                ['c', period(-2)],
                ['d', toProgramsSummary(-1)],
                ['e', period(5)],
            ])
        )

        expect(overview.withSubscription.map((item) => item.traineeId)).toEqual(['c', 'd', 'e', 'b', 'a'])
        expect(overview.counts).toEqual({ expired: 2, expiring: 2, active: 1, none: 0 })
    })
})

describe('summarizeRenewals', () => {
    const at = (iso: string) => new Date(iso)

    it('has no mode without renewals', () => {
        expect(summarizeRenewals([], 0)).toEqual({ mode: null, endDate: null, purchased: 0, used: 0 })
    })

    it('takes the mode from the latest registered row, whatever the row order', () => {
        const rows = [
            { kind: 'period' as const, endDate: day('2026-12-01'), programCount: null, createdAt: at('2026-09-01T10:00:00Z') },
            { kind: 'programs' as const, endDate: null, programCount: 5, createdAt: at('2026-10-01T10:00:00Z') },
            { kind: 'programs' as const, endDate: null, programCount: 3, createdAt: at('2026-08-01T10:00:00Z') },
        ]

        expect(summarizeRenewals(rows, 2)).toEqual({ mode: 'programs', endDate: day('2026-12-01'), purchased: 8, used: 2 })
    })

    it('keeps the furthest end date across period rows', () => {
        const rows = [
            { kind: 'period' as const, endDate: day('2026-10-10'), programCount: null, createdAt: at('2026-10-02T10:00:00Z') },
            { kind: 'period' as const, endDate: day('2026-11-10'), programCount: null, createdAt: at('2026-09-02T10:00:00Z') },
        ]

        expect(summarizeRenewals(rows, 0)).toMatchObject({ mode: 'period', endDate: day('2026-11-10') })
    })
})
