/**
 * Macro-period planning rules, shared by the API and the client.
 *
 * Every date here is a calendar day written `YYYY-MM-DD`. Day arithmetic runs in
 * UTC on purpose: a calendar day has no timezone, and doing it in local time
 * would shift a period by one day across a DST change.
 */

export type IsoDay = string

export interface DayRange {
    startDate: IsoDay
    endDate: IsoDay
}

export interface PeriodRange extends DayRange {
    id: string
}

export interface MacroPhaseTypeDto {
    id: string
    name: string
    description: string | null
    color: string
    sortOrder: number
    isActive: boolean
    usageCount: number
}

export interface MacroPeriodDto extends PeriodRange {
    note: string | null
    phaseType: { id: string; name: string; color: string; isActive: boolean }
}

export interface PlanProgramDto {
    id: string
    title: string
    status: string
    startDate: IsoDay
    durationWeeks: number
}

const DAY_MS = 86_400_000

export type TimelineView = 'weeks' | 'month'

export const WEEK_MS = 7 * DAY_MS

/** Visible span of each view of the planning timeline. */
export const VIEW_SPAN_MS: Record<TimelineView, number> = {
    weeks: 12 * WEEK_MS,
    month: 52 * WEEK_MS,
}

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

const toUtcMs = (day: IsoDay): number => Date.parse(`${day}T00:00:00.000Z`)
const fromUtcMs = (ms: number): IsoDay => new Date(ms).toISOString().slice(0, 10)

/** True for a real calendar day in `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isIsoDay(value: string): boolean {
    if (!ISO_DAY_PATTERN.test(value)) return false
    const ms = toUtcMs(value)
    return !Number.isNaN(ms) && fromUtcMs(ms) === value
}

export function addDays(day: IsoDay, amount: number): IsoDay {
    return fromUtcMs(toUtcMs(day) + amount * DAY_MS)
}

/** 0 = Monday … 6 = Sunday */
function weekdayIndex(day: IsoDay): number {
    return (new Date(toUtcMs(day)).getUTCDay() + 6) % 7
}

/** Monday of the week containing `day`. */
export function weekStartOf(day: IsoDay): IsoDay {
    return addDays(day, -weekdayIndex(day))
}

/** Sunday of the week containing `day`. */
export function weekEndOf(day: IsoDay): IsoDay {
    return addDays(weekStartOf(day), 6)
}

/** Nearest Monday. Monday–Thursday go back, Friday–Sunday go forward. */
export function snapToWeekStart(day: IsoDay): IsoDay {
    const index = weekdayIndex(day)
    return addDays(day, index <= 3 ? -index : 7 - index)
}

/** Nearest Sunday. */
export function snapToWeekEnd(day: IsoDay): IsoDay {
    return addDays(snapToWeekStart(addDays(day, 1)), -1)
}

export function isValidPeriodRange(startDate: string, endDate: string): boolean {
    if (!isIsoDay(startDate) || !isIsoDay(endDate)) return false
    return weekdayIndex(startDate) === 0 && weekdayIndex(endDate) === 6 && endDate > startDate
}

/** The period sharing at least one day with `candidate`, or null. */
export function findOverlap<T extends PeriodRange>(candidate: DayRange, periods: T[], ignoreId?: string): T | null {
    return (
        periods.find(
            (period) =>
                period.id !== ignoreId &&
                period.startDate <= candidate.endDate &&
                candidate.startDate <= period.endDate
        ) ?? null
    )
}

/**
 * Range drawn by dragging on empty weeks: from the anchor week towards the
 * pointer, stopping at the first occupied week. Null when the anchor week
 * itself is taken.
 */
export function clampRangeToFree(anchorDay: IsoDay, pointerDay: IsoDay, periods: PeriodRange[]): DayRange | null {
    const anchorStart = weekStartOf(anchorDay)
    const anchorEnd = addDays(anchorStart, 6)
    if (findOverlap({ startDate: anchorStart, endDate: anchorEnd }, periods)) return null

    if (pointerDay > anchorEnd) {
        let endDate = weekEndOf(pointerDay)
        for (const period of periods) {
            if (period.startDate > anchorEnd && period.startDate <= endDate) {
                endDate = addDays(period.startDate, -1)
            }
        }
        return { startDate: anchorStart, endDate }
    }

    if (pointerDay < anchorStart) {
        let startDate = weekStartOf(pointerDay)
        for (const period of periods) {
            if (period.endDate < anchorStart && period.endDate >= startDate) {
                startDate = addDays(period.endDate, 1)
            }
        }
        return { startDate, endDate: anchorEnd }
    }

    return { startDate: anchorStart, endDate: anchorEnd }
}

/** Same length, new start snapped to the nearest Monday. */
export function movePeriod(period: DayRange, newStartDay: IsoDay): DayRange {
    const lengthDays = Math.round((toUtcMs(period.endDate) - toUtcMs(period.startDate)) / DAY_MS)
    const startDate = snapToWeekStart(newStartDay)
    return { startDate, endDate: addDays(startDate, lengthDays) }
}

/**
 * Resize one edge. For the right edge `day` is the exclusive end the timeline
 * reports (the Monday after the last week). A period never gets shorter than one week.
 */
export function resizePeriod(period: DayRange, edge: 'left' | 'right', day: IsoDay): DayRange {
    if (edge === 'left') {
        const latestStart = weekStartOf(period.endDate)
        const startDate = snapToWeekStart(day)
        return { startDate: startDate > latestStart ? latestStart : startDate, endDate: period.endDate }
    }

    const earliestEnd = addDays(period.startDate, 6)
    const endDate = addDays(snapToWeekStart(day), -1)
    return { startDate: period.startDate, endDate: endDate < earliestEnd ? earliestEnd : endDate }
}

/** Date range covered by a program, for the read-only row. */
export function programToRange(startDate: IsoDay, durationWeeks: number): DayRange {
    const days = Math.max(durationWeeks, 0) * 7
    return { startDate, endDate: days === 0 ? startDate : addDays(startDate, days - 1) }
}

/** A `@db.Date` column read through Prisma is midnight UTC of that day. */
export function dbDateToIsoDay(date: Date): IsoDay {
    return date.toISOString().slice(0, 10)
}

export function isoDayToDbDate(day: IsoDay): Date {
    return new Date(toUtcMs(day))
}

/** Local midnight of a day — the unit the timeline library works in. */
export function dayToLocalMs(day: IsoDay): number {
    const [year, month, date] = day.split('-').map(Number)
    return new Date(year, month - 1, date).getTime()
}

export function localMsToDay(ms: number): IsoDay {
    const date = new Date(ms)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const dayOfMonth = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${dayOfMonth}`
}

/** Pointer x (relative to the visible canvas) → timestamp inside the visible range. */
export function xToMs(x: number, width: number, visibleStart: number, visibleEnd: number): number {
    if (width <= 0) return visibleStart
    const ratio = Math.min(Math.max(x / width, 0), 1)
    return visibleStart + ratio * (visibleEnd - visibleStart)
}

export const PHASE_COLOR_PALETTE: readonly string[] = [
    '#2563eb', // blue
    '#dc2626', // red
    '#16a34a', // green
    '#f59e0b', // amber
    '#7c3aed', // violet
    '#db2777', // pink
    '#0891b2', // cyan
    '#ea580c', // orange
    '#4d7c0f', // olive
    '#0f766e', // teal
    '#9333ea', // purple
    '#475569', // slate
]

export const DEFAULT_PHASE_NAMES: readonly string[] = ['Tipo fase 1', 'Tipo fase 2', 'Tipo fase 3']

/** First palette colour not in use; cycles once the palette is exhausted. */
export function nextUnusedColor(usedColors: string[]): string {
    const used = new Set(usedColors.map((color) => color.toLowerCase()))
    const free = PHASE_COLOR_PALETTE.find((color) => !used.has(color))
    return free ?? PHASE_COLOR_PALETTE[usedColors.length % PHASE_COLOR_PALETTE.length]
}

/** Text colour with enough contrast on `hex`. Anything that is not a 6-digit hex gets dark text. */
export function readableTextColor(hex: string): '#ffffff' | '#111827' {
    if (!HEX_COLOR_PATTERN.test(hex)) return '#111827'

    const [red, green, blue] = [1, 3, 5].map((offset) => {
        const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

    return luminance > 0.179 ? '#111827' : '#ffffff'
}

export type TimelineLabelStyle = 'monthYear' | 'month' | 'year'

const TIMELINE_LABEL_FORMATS: Record<TimelineLabelStyle, Intl.DateTimeFormatOptions> = {
    monthYear: { month: 'long', year: 'numeric' },
    month: { month: 'short' },
    year: { year: 'numeric' },
}

/** Timeline header text for a local-time instant, in the language of the app. */
export function formatTimelineLabel(ms: number, style: TimelineLabelStyle, locale: string): string {
    const options = TIMELINE_LABEL_FORMATS[style]
    try {
        return new Intl.DateTimeFormat(locale, options).format(ms)
    } catch {
        // an unknown language tag must not take the timeline down
        return new Intl.DateTimeFormat(undefined, options).format(ms)
    }
}
