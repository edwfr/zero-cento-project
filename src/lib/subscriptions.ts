/**
 * Subscription renewals: pure domain logic and shared types. No Prisma, no React,
 * so the API routes, the Zod schema and the client components all share it.
 *
 * Every date is a UTC calendar day (midnight UTC), matching the @db.Date columns.
 * The end date is the last covered day: a subscription is expired when today > endDate.
 */

export const EXPIRING_THRESHOLD_DAYS = 14
export const MIN_DURATION_MONTHS = 1
export const MAX_DURATION_MONTHS = 36
export const DURATION_SHORTCUTS = [1, 3, 6, 12] as const

const DAY_MS = 24 * 60 * 60 * 1000

export type SubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired'

export interface SubscriptionSummary {
    status: Exclude<SubscriptionStatus, 'none'>
    /** ISO string of the current expiry day */
    endDate: string
    /** Negative when expired */
    daysLeft: number
}

/** A renewal as the API returns it (dates serialized to ISO strings). */
export interface RenewalRow {
    id: string
    traineeId: string
    startDate: string
    durationMonths: number
    endDate: string
    createdAt: string
}

export interface OverviewTrainee {
    id: string
    firstName: string
    lastName: string
}

export interface SubscriptionOverviewItem {
    traineeId: string
    firstName: string
    lastName: string
    subscription: SubscriptionSummary | null
}

export interface SubscribedOverviewItem extends SubscriptionOverviewItem {
    subscription: SubscriptionSummary
}

export interface SubscriptionOverview {
    withSubscription: SubscribedOverviewItem[]
    withoutSubscription: SubscriptionOverviewItem[]
    counts: Record<SubscriptionStatus, number>
}

export function toSubscriptionDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

/** start + months, with the day clamped to the target month's last day (31 Jan + 1 → 28 Feb). */
export function addMonthsClamped(start: Date, months: number): Date {
    const day = toSubscriptionDay(start)
    const year = day.getUTCFullYear()
    const month = day.getUTCMonth() + months
    // Day 0 of the following month is the last day of the target month; Date.UTC handles year rollover
    const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month, Math.min(day.getUTCDate(), lastDayOfTargetMonth)))
}

export function isValidDurationMonths(value: number): boolean {
    return Number.isInteger(value) && value >= MIN_DURATION_MONTHS && value <= MAX_DURATION_MONTHS
}

function daysBetween(from: Date, to: Date): number {
    return Math.round((toSubscriptionDay(to).getTime() - toSubscriptionDay(from).getTime()) / DAY_MS)
}

function statusFromDaysLeft(daysLeft: number): SubscriptionSummary['status'] {
    if (daysLeft < 0) return 'expired'
    if (daysLeft <= EXPIRING_THRESHOLD_DAYS) return 'expiring'
    return 'active'
}

/** null means "no subscription recorded". */
export function toSubscriptionSummary(endDate: Date | string | null, today: Date): SubscriptionSummary | null {
    if (!endDate) return null
    const end = toSubscriptionDay(new Date(endDate))
    const daysLeft = daysBetween(today, end)
    return { status: statusFromDaysLeft(daysLeft), endDate: end.toISOString(), daysLeft }
}

export function needsAttention(summary: SubscriptionSummary | null): boolean {
    return summary?.status === 'expiring' || summary?.status === 'expired'
}

/** Current expiry: the furthest end date, so a back-dated correction never shortens it. */
export function latestEndDate(rows: { endDate: Date }[]): Date | null {
    return rows.reduce<Date | null>(
        (latest, row) => (latest === null || row.endDate > latest ? row.endDate : latest),
        null
    )
}

/** Form pre-fill: the day after the current expiry, or today when there is none. */
export function nextRenewalStart(currentEndDate: string | null, todayForInput: string): string {
    if (!currentEndDate) return todayForInput
    const next = toSubscriptionDay(new Date(currentEndDate))
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString().slice(0, 10)
}

/** i18n key + count for "in X days" / "today" / "X days overdue". */
export function remainingLabel(daysLeft: number): { key: string; count: number } {
    if (daysLeft > 0) return { key: 'subscriptions.remaining.daysLeft', count: daysLeft }
    if (daysLeft === 0) return { key: 'subscriptions.remaining.today', count: 0 }
    return { key: 'subscriptions.remaining.daysOverdue', count: -daysLeft }
}

function compareByName(a: SubscriptionOverviewItem, b: SubscriptionOverviewItem): number {
    return a.lastName.localeCompare(b.lastName, 'it') || a.firstName.localeCompare(b.firstName, 'it')
}

function isSubscribed(item: SubscriptionOverviewItem): item is SubscribedOverviewItem {
    return item.subscription !== null
}

export function buildSubscriptionOverview(
    trainees: OverviewTrainee[],
    endDates: Map<string, Date>,
    today: Date
): SubscriptionOverview {
    const items: SubscriptionOverviewItem[] = trainees.map((trainee) => ({
        traineeId: trainee.id,
        firstName: trainee.firstName,
        lastName: trainee.lastName,
        subscription: toSubscriptionSummary(endDates.get(trainee.id) ?? null, today),
    }))

    const withSubscription = items
        .filter(isSubscribed)
        .sort((a, b) => a.subscription.daysLeft - b.subscription.daysLeft || compareByName(a, b))
    const withoutSubscription = items.filter((item) => !isSubscribed(item)).sort(compareByName)

    const counts: Record<SubscriptionStatus, number> = { expired: 0, expiring: 0, active: 0, none: withoutSubscription.length }
    for (const item of withSubscription) counts[item.subscription.status] += 1

    return { withSubscription, withoutSubscription, counts }
}
