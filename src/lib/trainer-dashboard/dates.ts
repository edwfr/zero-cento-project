import { RECENT_WINDOW_DAYS } from './constants'

/**
 * Every dashboard date is a UTC calendar day, matching ExerciseFeedback.date
 * (written as getTodayDateKey(), midnight UTC). Weeks are ISO weeks, Monday first.
 */
export const DAY_MS = 24 * 60 * 60 * 1000

export function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS)
}

export function startOfUtcWeek(date: Date): Date {
    const dayStart = startOfUtcDay(date)
    const daysSinceMonday = (dayStart.getUTCDay() + 6) % 7
    return addDays(dayStart, -daysSinceMonday)
}

export function utcDayKey(date: Date): string {
    return startOfUtcDay(date).toISOString().slice(0, 10)
}

export function wholeDaysBetween(from: Date, to: Date): number {
    return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS)
}

export function programEndDate(startDate: Date, durationWeeks: number): Date {
    return addDays(startOfUtcDay(startDate), durationWeeks * 7)
}

/** First day of the "last 7 days" window shared by every recent-activity widget. */
export function recentWindowStart(now: Date): Date {
    return addDays(startOfUtcDay(now), -RECENT_WINDOW_DAYS)
}
