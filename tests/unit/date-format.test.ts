import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock i18next so getCurrentLocale() returns a predictable value
vi.mock('i18next', () => ({
    default: {
        language: 'en',
    },
}))

import i18nMock from 'i18next'
import {
    formatDate,
    formatDateTime,
    formatNumber,
    formatDateForInput,
    getTodayForInput,
    getTodayDateKey,
    formatRelativeTime,
} from '@/lib/date-format'

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
    afterEach(() => {
        i18nMock.language = 'en'
    })

    it('returns "-" for null', () => {
        expect(formatDate(null)).toBe('-')
    })

    it('returns "-" for undefined', () => {
        expect(formatDate(undefined)).toBe('-')
    })

    it('returns "-" for invalid date string', () => {
        expect(formatDate('not-a-date')).toBe('-')
    })

    it('formats a valid date string (short format)', () => {
        const result = formatDate('2024-03-30')
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('formats a Date object', () => {
        const result = formatDate(new Date('2024-03-30'))
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('formats a timestamp (number)', () => {
        const ts = new Date('2024-03-30').getTime()
        const result = formatDate(ts)
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('formats with medium format', () => {
        const result = formatDate('2024-03-30', 'medium')
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('formats with long format', () => {
        const result = formatDate('2024-03-30', 'long')
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('falls back to the raw locale when it is not it/en', () => {
        i18nMock.language = 'fr'
        const result = formatDate('2024-03-30')
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('falls back to it-IT when i18n has no language set', () => {
        i18nMock.language = ''
        const result = formatDate('2024-03-30')
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('returns "-" when Intl throws for a malformed locale tag', () => {
        i18nMock.language = '!!!invalid!!!'
        expect(formatDate('2024-03-30')).toBe('-')
    })
})

// ─── formatDateTime ───────────────────────────────────────────────────────────

describe('formatDateTime', () => {
    afterEach(() => {
        i18nMock.language = 'en'
    })

    it('returns "-" for null', () => {
        expect(formatDateTime(null)).toBe('-')
    })

    it('returns "-" for undefined', () => {
        expect(formatDateTime(undefined)).toBe('-')
    })

    it('returns "-" for invalid date', () => {
        expect(formatDateTime('bad-date')).toBe('-')
    })

    it('formats a valid datetime string (short)', () => {
        const result = formatDateTime('2024-03-30T14:30:00')
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('formats a valid datetime string (medium)', () => {
        const result = formatDateTime('2024-03-30T14:30:00', 'medium')
        expect(result).not.toBe('-')
        expect(result).toContain('2024')
    })

    it('formats a Date object', () => {
        const result = formatDateTime(new Date('2024-03-30T14:30:00'))
        expect(result).not.toBe('-')
    })

    it('formats a timestamp', () => {
        const ts = new Date('2024-03-30T14:30:00').getTime()
        const result = formatDateTime(ts)
        expect(result).not.toBe('-')
    })

    it('returns "-" when Intl throws for a malformed locale tag', () => {
        i18nMock.language = '!!!invalid!!!'
        expect(formatDateTime('2024-03-30T14:30:00')).toBe('-')
    })
})

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber', () => {
    afterEach(() => {
        i18nMock.language = 'en'
    })

    it('returns "0" for null', () => {
        expect(formatNumber(null)).toBe('0')
    })

    it('returns "0" for undefined', () => {
        expect(formatNumber(undefined)).toBe('0')
    })

    it('formats an integer', () => {
        const result = formatNumber(1234)
        expect(result).toBeTruthy()
        expect(result).toContain('1')
    })

    it('formats with decimal places', () => {
        const result = formatNumber(1234.5, 2)
        expect(result).toContain('1')
        expect(result).toContain('5')
    })

    it('formats zero', () => {
        const result = formatNumber(0)
        expect(result).toBe('0')
    })

    it('formats negative number', () => {
        const result = formatNumber(-42)
        expect(result).toContain('42')
    })

    it('returns the raw value as a string when Intl throws for a malformed locale tag', () => {
        i18nMock.language = '!!!invalid!!!'
        expect(formatNumber(1234)).toBe('1234')
    })
})

// ─── formatDateForInput ───────────────────────────────────────────────────────

describe('formatDateForInput', () => {
    it('returns "" for null', () => {
        expect(formatDateForInput(null)).toBe('')
    })

    it('returns "" for undefined', () => {
        expect(formatDateForInput(undefined)).toBe('')
    })

    it('returns "" for invalid date', () => {
        expect(formatDateForInput('bad-date')).toBe('')
    })

    it('returns "" for an invalid Date object', () => {
        expect(formatDateForInput(new Date('nope'))).toBe('')
    })

    it('formats a date string to YYYY-MM-DD', () => {
        const result = formatDateForInput('2024-03-30')
        expect(result).toBe('2024-03-30')
    })

    it('formats a Date object to YYYY-MM-DD', () => {
        const result = formatDateForInput(new Date('2024-06-15'))
        expect(result).toBe('2024-06-15')
    })

    it('formats a timestamp to YYYY-MM-DD', () => {
        const ts = Date.UTC(2024, 2, 30) // March 30, 2024
        const result = formatDateForInput(ts)
        expect(result).toBe('2024-03-30')
    })
})

// ─── getTodayForInput ─────────────────────────────────────────────────────────

describe('getTodayForInput', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
    })

    it('returns a string in YYYY-MM-DD format', () => {
        const result = getTodayForInput()
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns today\'s date', () => {
        const today = new Date().toISOString().split('T')[0]
        expect(getTodayForInput()).toBe(today)
    })

    it('returns the local calendar day, not the UTC one', () => {
        vi.stubEnv('TZ', 'Europe/Rome')
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-10T23:30:00Z'))

        // 23:30 UTC is already 00:30 of March 11th in Rome
        expect(getTodayForInput()).toBe('2026-03-11')
    })

    it('returns the same day when local time and UTC agree', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-10T10:00:00Z'))

        expect(getTodayForInput()).toBe('2026-03-10')
    })
})

// ─── getTodayDateKey ──────────────────────────────────────────────────────────

describe('getTodayDateKey', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns a Date set to midnight UTC of the current day', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-29T18:45:30.500Z'))

        const result = getTodayDateKey()

        expect(result.getUTCFullYear()).toBe(2026)
        expect(result.getUTCMonth()).toBe(3) // April, zero-indexed
        expect(result.getUTCDate()).toBe(29)
        expect(result.getUTCHours()).toBe(0)
        expect(result.getUTCMinutes()).toBe(0)
        expect(result.getUTCSeconds()).toBe(0)
        expect(result.getUTCMilliseconds()).toBe(0)
    })
})

// ─── formatRelativeTime ───────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
    it('returns "-" for null', () => {
        expect(formatRelativeTime(null)).toBe('-')
    })

    it('returns "-" for undefined', () => {
        expect(formatRelativeTime(undefined)).toBe('-')
    })

    it('returns "-" for invalid date', () => {
        expect(formatRelativeTime('bad-date')).toBe('-')
    })

    it('returns "just now" for very recent dates', () => {
        const recent = new Date(Date.now() - 5000) // 5 seconds ago
        const result = formatRelativeTime(recent)
        expect(result).toBeTruthy()
        // In 'en' locale: 'just now'
        expect(result).not.toBe('-')
    })

    it('returns minutes ago for dates a few minutes ago', () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const result = formatRelativeTime(fiveMinutesAgo)
        expect(result).toContain('5')
    })

    it('returns hours ago for dates a few hours ago', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
        const result = formatRelativeTime(twoHoursAgo)
        expect(result).toContain('2')
    })

    it('returns days ago for dates a few days ago', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        const result = formatRelativeTime(threeDaysAgo)
        expect(result).toContain('3')
    })

    it('returns weeks ago for dates weeks ago', () => {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        const result = formatRelativeTime(twoWeeksAgo)
        expect(result).not.toBe('-')
    })

    it('returns months ago for dates months ago', () => {
        const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
        const result = formatRelativeTime(twoMonthsAgo)
        expect(result).not.toBe('-')
    })

    it('returns years ago for dates years ago', () => {
        const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
        const result = formatRelativeTime(twoYearsAgo)
        expect(result).not.toBe('-')
    })

    // Fixed timers pin "now" so the singular/plural and it/en boundaries are
    // exercised deterministically, at exact unit distances.
    describe('with fixed timers', () => {
        const NOW = new Date('2026-03-15T12:00:00.000Z')

        afterEach(() => {
            vi.useRealTimers()
            i18nMock.language = 'en'
        })

        it('returns "poco fa" in it locale for very recent dates', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const recent = new Date(NOW.getTime() - 5000)
            expect(formatRelativeTime(recent)).toBe('poco fa')
        })

        it('uses the singular form for 1 minute ago (en)', () => {
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneMinuteAgo = new Date(NOW.getTime() - 60 * 1000)
            expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minute ago')
        })

        it('uses the singular form for 1 minuto ago (it)', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneMinuteAgo = new Date(NOW.getTime() - 60 * 1000)
            expect(formatRelativeTime(oneMinuteAgo)).toBe('1 minuto fa')
        })

        it('uses the plural form for 2 minuti ago (it)', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const twoMinutesAgo = new Date(NOW.getTime() - 2 * 60 * 1000)
            expect(formatRelativeTime(twoMinutesAgo)).toBe('2 minuti fa')
        })

        it('uses the singular form for 1 hour ago (en)', () => {
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000)
            expect(formatRelativeTime(oneHourAgo)).toBe('1 hour ago')
        })

        it('uses the singular form for 1 ora ago (it)', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000)
            expect(formatRelativeTime(oneHourAgo)).toBe('1 ora fa')
        })

        it('uses the singular form for 1 day ago (en)', () => {
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneDayAgo = new Date(NOW.getTime() - 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneDayAgo)).toBe('1 day ago')
        })

        it('uses the singular form for 1 giorno ago (it)', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneDayAgo = new Date(NOW.getTime() - 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneDayAgo)).toBe('1 giorno fa')
        })

        it('uses the singular form for 1 week ago (en)', () => {
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneWeekAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneWeekAgo)).toBe('1 week ago')
        })

        it('uses the singular form for 1 settimana ago (it)', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneWeekAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneWeekAgo)).toBe('1 settimana fa')
        })

        it('uses the singular form for 1 month ago (en)', () => {
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneMonthAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneMonthAgo)).toBe('1 month ago')
        })

        it('uses the singular form for 1 mese ago (it)', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneMonthAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneMonthAgo)).toBe('1 mese fa')
        })

        it('uses the singular form for 1 year ago (en)', () => {
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneYearAgo = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneYearAgo)).toBe('1 year ago')
        })

        it('uses the singular form for 1 anno ago (it)', () => {
            i18nMock.language = 'it'
            vi.useFakeTimers()
            vi.setSystemTime(NOW)

            const oneYearAgo = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000)
            expect(formatRelativeTime(oneYearAgo)).toBe('1 anno fa')
        })
    })
})
