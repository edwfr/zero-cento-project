import { describe, it, expect } from 'vitest'
import {
    computeSbdMetricsByLiftAcrossWeeks,
    computeWeekSbdMetrics,
    matchFundamentalLift,
    parseRepsValue,
    type LiftLabels,
    type SbdMetricsWeek,
} from '@/lib/program-sbd-metrics'

const LIFT_LABELS: LiftLabels = {
    squat: 'Squat',
    bench: 'Bench',
    deadlift: 'Deadlift',
}

function makeExercise(
    overrides: Partial<{
        id: string
        name: string
        type: 'fundamental' | 'accessory'
        sets: number
        reps: string
        isWarmup: boolean
        weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
        weight: number | null
    }> = {},
) {
    return {
        sets: overrides.sets ?? 3,
        reps: overrides.reps ?? '5',
        isWarmup: overrides.isWarmup ?? false,
        weightType: overrides.weightType ?? 'percentage_1rm',
        weight: overrides.weight ?? 80,
        exercise: {
            id: overrides.id ?? 'ex-squat',
            name: overrides.name ?? 'Back Squat',
            type: overrides.type ?? 'fundamental',
        },
    }
}

describe('parseRepsValue', () => {
    it('parses leading integer', () => {
        expect(parseRepsValue('5')).toBe(5)
        expect(parseRepsValue('10+')).toBe(10)
        expect(parseRepsValue('8x3')).toBe(8)
    })
    it('returns 0 when no leading digits', () => {
        expect(parseRepsValue('AMRAP')).toBe(0)
        expect(parseRepsValue('')).toBe(0)
    })
})

describe('matchFundamentalLift', () => {
    it('matches squat variants', () => {
        expect(matchFundamentalLift('Back Squat')).toBe('squat')
        expect(matchFundamentalLift('Front squat')).toBe('squat')
    })
    it('matches bench and italian panca', () => {
        expect(matchFundamentalLift('Bench Press')).toBe('bench')
        expect(matchFundamentalLift('Panca piana')).toBe('bench')
    })
    it('matches deadlift and italian stacco', () => {
        expect(matchFundamentalLift('Deadlift')).toBe('deadlift')
        expect(matchFundamentalLift('Stacco da terra')).toBe('deadlift')
    })
    it('returns null for non-fundamentals', () => {
        expect(matchFundamentalLift('Bicep curl')).toBeNull()
    })
})

describe('computeWeekSbdMetrics', () => {
    const buildWeek = (workouts: SbdMetricsWeek['workouts']): SbdMetricsWeek => ({
        id: 'week-1',
        workouts,
    })

    it('computes intensity from percentage_1rm weight directly', () => {
        const week = buildWeek([
            {
                id: 'w1',
                workoutExercises: [
                    makeExercise({ sets: 3, reps: '5', weightType: 'percentage_1rm', weight: 80 }),
                ],
            },
        ])

        const result = computeWeekSbdMetrics({
            weeks: [week],
            oneRmByExerciseId: {},
            liftLabels: LIFT_LABELS,
        })

        expect(result['week-1']).toHaveLength(1)
        const metric = result['week-1'][0]
        expect(metric.lift).toBe('squat')
        expect(metric.liftLabel).toBe('Squat')
        expect(metric.frequency).toBe(1)
        expect(metric.totalLifts).toBe(15)
        expect(metric.averageIntensity).toBeCloseTo(80)
    })

    it('computes intensity from absolute weight using oneRm map', () => {
        const week = buildWeek([
            {
                id: 'w1',
                workoutExercises: [
                    makeExercise({ sets: 2, reps: '3', weightType: 'absolute', weight: 100 }),
                ],
            },
        ])

        const result = computeWeekSbdMetrics({
            weeks: [week],
            oneRmByExerciseId: { 'ex-squat': 200 },
            liftLabels: LIFT_LABELS,
        })

        expect(result['week-1'][0].averageIntensity).toBeCloseTo(50)
    })

    it('leaves averageIntensity null when absolute weight has no 1RM', () => {
        const week = buildWeek([
            {
                id: 'w1',
                workoutExercises: [
                    makeExercise({ sets: 2, reps: '3', weightType: 'absolute', weight: 100 }),
                ],
            },
        ])

        const result = computeWeekSbdMetrics({
            weeks: [week],
            oneRmByExerciseId: {},
            liftLabels: LIFT_LABELS,
        })

        expect(result['week-1'][0].totalLifts).toBe(6)
        expect(result['week-1'][0].averageIntensity).toBeNull()
    })

    it('excludes warmup and accessory exercises', () => {
        const week = buildWeek([
            {
                id: 'w1',
                workoutExercises: [
                    makeExercise({ isWarmup: true }),
                    makeExercise({ type: 'accessory', name: 'Back Squat' }),
                ],
            },
        ])

        const result = computeWeekSbdMetrics({
            weeks: [week],
            oneRmByExerciseId: {},
            liftLabels: LIFT_LABELS,
        })

        expect(result['week-1'] ?? []).toHaveLength(0)
    })

    it('sorts metrics per week by squat > bench > deadlift', () => {
        const week = buildWeek([
            {
                id: 'w1',
                workoutExercises: [
                    makeExercise({ id: 'ex-dl', name: 'Deadlift' }),
                    makeExercise({ id: 'ex-b', name: 'Bench Press' }),
                    makeExercise({ id: 'ex-s', name: 'Back Squat' }),
                ],
            },
        ])

        const result = computeWeekSbdMetrics({
            weeks: [week],
            oneRmByExerciseId: {},
            liftLabels: LIFT_LABELS,
        })

        expect(result['week-1'].map((m) => m.lift)).toEqual(['squat', 'bench', 'deadlift'])
    })

    it('averages intensity weighted by lift count across workouts', () => {
        const week = buildWeek([
            {
                id: 'w1',
                workoutExercises: [
                    makeExercise({ sets: 1, reps: '10', weightType: 'percentage_1rm', weight: 60 }),
                ],
            },
            {
                id: 'w2',
                workoutExercises: [
                    makeExercise({ sets: 1, reps: '2', weightType: 'percentage_1rm', weight: 90 }),
                ],
            },
        ])

        const result = computeWeekSbdMetrics({
            weeks: [week],
            oneRmByExerciseId: {},
            liftLabels: LIFT_LABELS,
        })

        const metric = result['week-1'][0]
        expect(metric.frequency).toBe(2)
        expect(metric.totalLifts).toBe(12)
        expect(metric.averageIntensity).toBeCloseTo((60 * 10 + 90 * 2) / 12)
    })
})

describe('computeSbdMetricsByLiftAcrossWeeks', () => {
    it('groups by lift and keeps ordering squat > bench > deadlift', () => {
        const weekOne: SbdMetricsWeek = {
            id: 'w1',
            workouts: [
                {
                    id: 'wo-1',
                    workoutExercises: [
                        makeExercise({ id: 'ex-squat', name: 'Back Squat' }),
                        makeExercise({ id: 'ex-bench', name: 'Bench Press' }),
                    ],
                },
            ],
        }
        const weekTwo: SbdMetricsWeek = {
            id: 'w2',
            workouts: [
                {
                    id: 'wo-2',
                    workoutExercises: [
                        makeExercise({ id: 'ex-dl', name: 'Deadlift' }),
                    ],
                },
            ],
        }

        const weekSbdMetrics = computeWeekSbdMetrics({
            weeks: [weekOne, weekTwo],
            oneRmByExerciseId: {},
            liftLabels: LIFT_LABELS,
        })

        const result = computeSbdMetricsByLiftAcrossWeeks({
            weeks: [weekOne, weekTwo],
            weekSbdMetrics,
            liftLabels: LIFT_LABELS,
        })

        expect(result.map((r) => r.lift)).toEqual(['squat', 'bench', 'deadlift'])
        expect(Object.keys(result[0].metricsByWeekId)).toEqual(['w1'])
        expect(Object.keys(result[1].metricsByWeekId)).toEqual(['w1'])
        expect(Object.keys(result[2].metricsByWeekId)).toEqual(['w2'])
    })

    it('filters out lifts that never appear in any week', () => {
        const week: SbdMetricsWeek = {
            id: 'w1',
            workouts: [
                {
                    id: 'wo',
                    workoutExercises: [
                        makeExercise({ id: 'ex-squat', name: 'Back Squat' }),
                    ],
                },
            ],
        }

        const weekSbdMetrics = computeWeekSbdMetrics({
            weeks: [week],
            oneRmByExerciseId: {},
            liftLabels: LIFT_LABELS,
        })

        const result = computeSbdMetricsByLiftAcrossWeeks({
            weeks: [week],
            weekSbdMetrics,
            liftLabels: LIFT_LABELS,
        })

        expect(result).toHaveLength(1)
        expect(result[0].lift).toBe('squat')
    })
})
