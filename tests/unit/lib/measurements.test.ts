import { describe, it, expect } from 'vitest'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    buildChartSeries,
    deltaFromPrevious,
    groupByMetric,
    isMeasurementMetric,
    isValueInRange,
    latestByMetric,
    toMeasurementDay,
    type MeasurementPoint,
} from '@/lib/measurements'

const point = (
    id: string,
    metric: MeasurementPoint['metric'],
    value: number,
    measuredAt: string
): MeasurementPoint => ({ id, metric, value, measuredAt, notes: null })

describe('MEASUREMENT_METRIC_META', () => {
    it('declares metadata for every metric', () => {
        for (const metric of MEASUREMENT_METRICS) {
            const meta = MEASUREMENT_METRIC_META[metric]
            expect(meta.labelKey).toBe(`measurements.metric.${metric}`)
            expect(meta.min).toBeLessThan(meta.max)
            expect(meta.chartColor).toMatch(/^#[0-9a-f]{6}$/i)
        }
    })

    it('keeps weight first and height out of the chart', () => {
        expect(MEASUREMENT_METRICS[0]).toBe('weight')
        expect(MEASUREMENT_METRIC_META.weight.unit).toBe('kg')
        expect(MEASUREMENT_METRIC_META.height.inChart).toBe(false)
        expect(MEASUREMENT_METRIC_META.waist.inChart).toBe(true)
    })
})

describe('isMeasurementMetric', () => {
    it('accepts known metrics and rejects anything else', () => {
        expect(isMeasurementMetric('thigh')).toBe(true)
        expect(isMeasurementMetric('neck')).toBe(false)
        expect(isMeasurementMetric(undefined)).toBe(false)
    })
})

describe('isValueInRange', () => {
    it('checks the metric-specific bounds', () => {
        expect(isValueInRange('weight', 78.5)).toBe(true)
        expect(isValueInRange('weight', 5)).toBe(false)
        expect(isValueInRange('arm', 38)).toBe(true)
        expect(isValueInRange('arm', 400)).toBe(false)
    })
})

describe('toMeasurementDay', () => {
    it('strips the time component in UTC', () => {
        const day = toMeasurementDay(new Date('2026-09-21T22:45:10.000Z'))
        expect(day.toISOString()).toBe('2026-09-21T00:00:00.000Z')
    })
})

describe('latestByMetric', () => {
    it('picks the most recent entry per metric regardless of input order', () => {
        const rows = [
            point('a', 'weight', 80, '2026-09-01'),
            point('b', 'weight', 78.5, '2026-09-20'),
            point('c', 'arm', 38, '2026-09-10'),
        ]

        const latest = latestByMetric(rows)

        expect(latest.weight?.id).toBe('b')
        expect(latest.arm?.id).toBe('c')
        expect(latest.thigh).toBeUndefined()
    })
})

describe('deltaFromPrevious', () => {
    it('returns the signed difference against the previous entry', () => {
        const rows = [
            point('a', 'weight', 80, '2026-09-01'),
            point('b', 'weight', 78.5, '2026-09-20'),
        ]

        expect(deltaFromPrevious(rows, 'weight')).toBe(-1.5)
    })

    it('returns null with fewer than two entries', () => {
        expect(deltaFromPrevious([point('a', 'weight', 80, '2026-09-01')], 'weight')).toBeNull()
        expect(deltaFromPrevious([], 'weight')).toBeNull()
    })

    it('returns 0 when the value did not change', () => {
        const rows = [
            point('a', 'waist', 84, '2026-09-01'),
            point('b', 'waist', 84, '2026-09-20'),
        ]

        expect(deltaFromPrevious(rows, 'waist')).toBe(0)
    })

    it('rounds float noise to one decimal', () => {
        const rows = [
            point('a', 'weight', 80.1, '2026-09-01'),
            point('b', 'weight', 78.4, '2026-09-20'),
        ]

        expect(deltaFromPrevious(rows, 'weight')).toBe(-1.7)
    })
})

describe('buildChartSeries', () => {
    it('merges metrics measured on the same day into one ascending row', () => {
        const rows = [
            point('b', 'weight', 78.5, '2026-09-20'),
            point('c', 'waist', 84, '2026-09-20'),
            point('a', 'weight', 80, '2026-09-01'),
            point('d', 'arm', 38, '2026-09-10'),
        ]

        const series = buildChartSeries(rows, ['weight', 'waist'])

        expect(series).toEqual([
            { measuredAt: '2026-09-01', weight: 80 },
            { measuredAt: '2026-09-20', weight: 78.5, waist: 84 },
        ])
    })

    it('returns an empty array when no selected metric has data', () => {
        expect(buildChartSeries([point('a', 'weight', 80, '2026-09-01')], ['calf'])).toEqual([])
    })
})

describe('groupByMetric', () => {
    it('groups entries per metric in display order, newest first, with delta vs previous', () => {
        const groups = groupByMetric([
            point('w-old', 'weight', 80, '2026-09-01'),
            point('c-1', 'waist', 84, '2026-09-20'),
            point('w-new', 'weight', 78.5, '2026-09-20'),
        ])

        expect(groups.map((group) => group.metric)).toEqual(['weight', 'waist'])
        expect(groups[0].entries.map((entry) => entry.point.id)).toEqual(['w-new', 'w-old'])
        expect(groups[0].entries.map((entry) => entry.delta)).toEqual([-1.5, null])
        expect(groups[1].entries).toEqual([{ point: expect.objectContaining({ id: 'c-1' }), delta: null }])
    })

    it('omits metrics without entries', () => {
        expect(groupByMetric([])).toEqual([])
    })
})
