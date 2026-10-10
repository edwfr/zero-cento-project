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

/** Programs mode: the balance at which the trainer gets the amber "last program" warning */
export const LAST_PROGRAM_THRESHOLD = 1
export const MIN_PROGRAM_COUNT = 1
export const MAX_PROGRAM_COUNT = 50
export const PROGRAM_COUNT_SHORTCUTS = [1, 3, 5, 10] as const

const DAY_MS = 24 * 60 * 60 * 1000

export type SubscriptionStatus = 'none' | 'active' | 'expiring' | 'expired'
export type RenewalKind = 'period' | 'programs'

type RecordedStatus = Exclude<SubscriptionStatus, 'none'>

export interface PeriodSummary {
    kind: 'period'
    status: RecordedStatus
    /** ISO string of the current expiry day */
    endDate: string
    /** Negative when expired */
    daysLeft: number
}

export interface ProgramsSummary {
    kind: 'programs'
    status: RecordedStatus
    /** Programs still available; negative = programs published on credit */
    remaining: number
}

export type SubscriptionSummary = PeriodSummary | ProgramsSummary

/** A renewal as the API returns it (dates serialized to ISO strings). */
export interface RenewalRow {
    id: string
    traineeId: string
    startDate: string
    durationMonths: number
    endDate: string
    createdAt: string
}

export type SubscriptionEventType =
    | 'period_renewal_created'
    | 'package_created'
    | 'renewal_updated'
    | 'renewal_deleted'
    | 'credit_consumed'
    | 'credit_refunded'
    | 'credit_forfeited'

/** A history row as the API returns it. */
export interface SubscriptionEventRow {
    id: string
    type: SubscriptionEventType
    creditDelta: number | null
    details: Record<string, unknown>
    createdAt: string
    actorName: string
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

function statusFromDaysLeft(daysLeft: number): RecordedStatus {
    if (daysLeft < 0) return 'expired'
    if (daysLeft <= EXPIRING_THRESHOLD_DAYS) return 'expiring'
    return 'active'
}

/** Period summary. null means "no end date recorded". */
export function toSubscriptionSummary(endDate: Date | string | null, today: Date): PeriodSummary | null {
    if (!endDate) return null
    const end = toSubscriptionDay(new Date(endDate))
    const daysLeft = daysBetween(today, end)
    return { kind: 'period', status: statusFromDaysLeft(daysLeft), endDate: end.toISOString(), daysLeft }
}

export function isValidProgramCount(value: number): boolean {
    return Number.isInteger(value) && value >= MIN_PROGRAM_COUNT && value <= MAX_PROGRAM_COUNT
}

/** Programs summary: red when nothing is left (or owed), amber on the last program. */
export function toProgramsSummary(remaining: number): ProgramsSummary {
    let status: RecordedStatus = 'active'
    if (remaining <= 0) status = 'expired'
    else if (remaining <= LAST_PROGRAM_THRESHOLD) status = 'expiring'
    return { kind: 'programs', status, remaining }
}

export interface SummaryInput {
    /** kind of the most recently registered renewal, null when there is none */
    mode: RenewalKind | null
    endDate: Date | string | null
    purchased: number
    used: number
}

/** The two modes are mutually exclusive: the current one decides which numbers matter. */
export function resolveSummary(input: SummaryInput, today: Date): SubscriptionSummary | null {
    if (input.mode === 'programs') return toProgramsSummary(input.purchased - input.used)
    if (input.mode === 'period') return toSubscriptionSummary(input.endDate, today)
    return null
}

export type UncoveredReason = 'none' | 'periodExpired' | 'programsExhausted'

/** Why a publish would happen without coverage; null when the trainee is covered. */
export function uncoveredReason(summary: SubscriptionSummary | null): UncoveredReason | null {
    if (!summary) return 'none'
    if (summary.status !== 'expired') return null
    return summary.kind === 'programs' ? 'programsExhausted' : 'periodExpired'
}

/** i18n key + count for a program balance. */
export function programsLabel(remaining: number): { key: string; count: number } {
    if (remaining < 0) return { key: 'subscriptions.programs.debt', count: -remaining }
    if (remaining === 0) return { key: 'subscriptions.programs.exhausted', count: 0 }
    if (remaining <= LAST_PROGRAM_THRESHOLD) return { key: 'subscriptions.programs.last', count: remaining }
    return { key: 'subscriptions.programs.available', count: remaining }
}

/** Short status text of either kind: key, count (days or programs) and, for a period, the expiry date. */
export function summaryLabel(summary: SubscriptionSummary): { key: string; count: number; date?: string } {
    if (summary.kind === 'programs') return programsLabel(summary.remaining)
    return { key: `subscriptions.badge.${summary.status}`, count: summary.daysLeft, date: summary.endDate }
}

/** What the summary needs from a renewal row, of either kind. */
export interface RenewalFacts {
    kind: RenewalKind
    endDate: Date | null
    programCount: number | null
    createdAt: Date
}

/**
 * Folds a trainee's renewals into the summary input: the mode is the kind of the
 * latest registered row, the expiry is the furthest end date (a back-dated
 * correction never shortens it), the purchased programs add up across packages.
 */
export function summarizeRenewals(rows: RenewalFacts[], used: number): SummaryInput {
    let latest: RenewalFacts | null = null
    let endDate: Date | null = null
    let purchased = 0

    for (const row of rows) {
        if (latest === null || row.createdAt > latest.createdAt) latest = row
        if (row.endDate && (endDate === null || row.endDate > endDate)) endDate = row.endDate
        purchased += row.programCount ?? 0
    }

    return { mode: latest?.kind ?? null, endDate, purchased, used }
}

export function needsAttention(summary: SubscriptionSummary | null): boolean {
    return summary?.status === 'expiring' || summary?.status === 'expired'
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

const STATUS_ORDER: Record<RecordedStatus, number> = { expired: 0, expiring: 1, active: 2 }
const KIND_ORDER: Record<RenewalKind, number> = { period: 0, programs: 1 }

function urgency(summary: SubscriptionSummary): number {
    return summary.kind === 'period' ? summary.daysLeft : summary.remaining
}

/** Red first, then amber, then active; inside a status periods before packages, most urgent first. */
export function compareOverviewItems(a: SubscribedOverviewItem, b: SubscribedOverviewItem): number {
    return (
        STATUS_ORDER[a.subscription.status] - STATUS_ORDER[b.subscription.status] ||
        KIND_ORDER[a.subscription.kind] - KIND_ORDER[b.subscription.kind] ||
        urgency(a.subscription) - urgency(b.subscription) ||
        compareByName(a, b)
    )
}

export function buildSubscriptionOverview(
    trainees: OverviewTrainee[],
    summaries: Map<string, SubscriptionSummary>
): SubscriptionOverview {
    const items: SubscriptionOverviewItem[] = trainees.map((trainee) => ({
        traineeId: trainee.id,
        firstName: trainee.firstName,
        lastName: trainee.lastName,
        subscription: summaries.get(trainee.id) ?? null,
    }))

    const withSubscription = items.filter(isSubscribed).sort(compareOverviewItems)
    const withoutSubscription = items.filter((item) => !isSubscribed(item)).sort(compareByName)

    const counts: Record<SubscriptionStatus, number> = { expired: 0, expiring: 0, active: 0, none: withoutSubscription.length }
    for (const item of withSubscription) counts[item.subscription.status] += 1

    return { withSubscription, withoutSubscription, counts }
}
