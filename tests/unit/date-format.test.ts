import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock i18next so getCurrentLocale() returns a predictable value
vi.mock('i18next', () => ({
    default: {
        language: 'en',
    },
}))

import {
    formatDate,
    formatDateTime,
    formatNumber,
    formatDateForInput,
    getTodayForInput,
    formatRelativeTime,
} from '@/lib/date-format'

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
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
})

// ─── formatDateTime ───────────────────────────────────────────────────────────

describe('formatDateTime', () => {
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
})

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber', () => {
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
    it('returns a string in YYYY-MM-DD format', () => {
        const result = getTodayForInput()
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns today\'s date', () => {
        const today = new Date().toISOString().split('T')[0]
        expect(getTodayForInput()).toBe(today)
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
})
