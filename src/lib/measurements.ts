import type { MeasurementMetric as PrismaMeasurementMetric } from '@prisma/client'

/**
 * Single source of truth for body-measurement metrics: labels, units, ranges,
 * chart behaviour. Pure module — no Prisma client, no React — so it can be used
 * by the Zod schemas, the API routes and the UI alike.
 *
 * Array order is display order (cards, table, chart legend).
 */
export const MEASUREMENT_METRICS = [
    'weight',
    'height',
    'chest',
    'arm',
    'waist',
    'hips',
    'thigh',
    'calf',
] as const

export type MeasurementMetric = (typeof MEASUREMENT_METRICS)[number]

// Compile-time guard: type-check fails if the Prisma enum and this list diverge
type AssertSame = [PrismaMeasurementMetric] extends [MeasurementMetric]
    ? [MeasurementMetric] extends [PrismaMeasurementMetric]
        ? true
        : never
    : never
const _prismaEnumInSync: AssertSame = true
void _prismaEnumInSync

export interface MeasurementMetricMeta {
    labelKey: string
    unit: 'kg' | 'cm'
    min: number
    max: number
    step: number
    /** Height is near-static: shown in cards and history, kept out of the trend chart. */
    inChart: boolean
    chartColor: string
}

export const MEASUREMENT_METRIC_META: Record<MeasurementMetric, MeasurementMetricMeta> = {
    weight: { labelKey: 'measurements.metric.weight', unit: 'kg', min: 20, max: 400, step: 0.1, inChart: true, chartColor: '#0F766E' },
    height: { labelKey: 'measurements.metric.height', unit: 'cm', min: 50, max: 250, step: 0.1, inChart: false, chartColor: '#64748B' },
    chest: { labelKey: 'measurements.metric.chest', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#2563EB' },
    arm: { labelKey: 'measurements.metric.arm', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#DB2777' },
    waist: { labelKey: 'measurements.metric.waist', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#EA580C' },
    hips: { labelKey: 'measurements.metric.hips', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#7C3AED' },
    thigh: { labelKey: 'measurements.metric.thigh', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#16A34A' },
    calf: { labelKey: 'measurements.metric.calf', unit: 'cm', min: 5, max: 250, step: 0.1, inChart: true, chartColor: '#CA8A04' },
}

export interface MeasurementPoint {
    id: string
    metric: MeasurementMetric
    value: number
    /** ISO date, day precision (YYYY-MM-DD) or full ISO string. */
    measuredAt: string
    notes: string | null
}

export type MeasurementChartRow = { measuredAt: string } & Partial<Record<MeasurementMetric, number>>

export function isMeasurementMetric(value: unknown): value is MeasurementMetric {
    return typeof value === 'string' && (MEASUREMENT_METRICS as readonly string[]).includes(value)
}

export function isValueInRange(metric: MeasurementMetric, value: number): boolean {
    const { min, max } = MEASUREMENT_METRIC_META[metric]
    return Number.isFinite(value) && value >= min && value <= max
}

/** A measurement is a calendar fact: the unique constraint compares days, not instants. */
export function toMeasurementDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

/** Day key (YYYY-MM-DD) used to group measurements taken on the same date. */
function dayKey(measuredAt: string): string {
    return measuredAt.slice(0, 10)
}

function byDateDesc(a: MeasurementPoint, b: MeasurementPoint): number {
    return dayKey(b.measuredAt).localeCompare(dayKey(a.measuredAt))
}

/** Sorts defensively: callers must not depend on the API's ordering. */
function entriesFor(rows: MeasurementPoint[], metric: MeasurementMetric): MeasurementPoint[] {
    return rows.filter((row) => row.metric === metric).sort(byDateDesc)
}

export function latestByMetric(
    rows: MeasurementPoint[]
): Partial<Record<MeasurementMetric, MeasurementPoint>> {
    const latest: Partial<Record<MeasurementMetric, MeasurementPoint>> = {}

    for (const metric of MEASUREMENT_METRICS) {
        const [mostRecent] = entriesFor(rows, metric)
        if (mostRecent) latest[metric] = mostRecent
    }

    return latest
}

export function deltaFromPrevious(
    rows: MeasurementPoint[],
    metric: MeasurementMetric
): number | null {
    const entries = entriesFor(rows, metric)
    if (entries.length < 2) return null

    return Math.round((entries[0].value - entries[1].value) * 10) / 10
}

export function buildChartSeries(
    rows: MeasurementPoint[],
    metrics: MeasurementMetric[]
): MeasurementChartRow[] {
    const selected = new Set(metrics)
    const byDay = new Map<string, MeasurementChartRow>()

    for (const row of rows) {
        if (!selected.has(row.metric)) continue

        const key = dayKey(row.measuredAt)
        const existing = byDay.get(key) ?? { measuredAt: key }
        existing[row.metric] = row.value
        byDay.set(key, existing)
    }

    return [...byDay.values()].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
}
