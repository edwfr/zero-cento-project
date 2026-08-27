import { intensityFromRpeChart } from './calculations'

export type FundamentalLift = 'squat' | 'bench' | 'deadlift'

export const FUNDAMENTAL_PATTERNS: Record<FundamentalLift, string[]> = {
    squat: ['squat', 'back squat', 'front squat', 'box squat'],
    bench: ['bench press', 'bench', 'panca'],
    deadlift: ['deadlift', 'stacco', 'stacco da terra'],
}

export const FUNDAMENTAL_LIFT_ORDER: FundamentalLift[] = ['squat', 'bench', 'deadlift']

export function parseRepsValue(repsValue: string): number {
    const match = repsValue.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

export function matchFundamentalLift(exerciseName: string): FundamentalLift | null {
    const lowerName = exerciseName.toLowerCase()

    if (FUNDAMENTAL_PATTERNS.squat.some((pattern) => lowerName.includes(pattern))) {
        return 'squat'
    }

    if (FUNDAMENTAL_PATTERNS.bench.some((pattern) => lowerName.includes(pattern))) {
        return 'bench'
    }

    if (FUNDAMENTAL_PATTERNS.deadlift.some((pattern) => lowerName.includes(pattern))) {
        return 'deadlift'
    }

    return null
}

export interface WeekSbdMetric {
    lift: FundamentalLift
    liftLabel: string
    frequency: number
    totalLifts: number
    averageIntensity: number | null
}

export interface SbdLiftAcrossWeeks {
    lift: FundamentalLift
    liftLabel: string
    metricsByWeekId: Record<string, WeekSbdMetric>
}

export interface SbdMetricsWorkoutExercise {
    sets: number
    reps: string
    isWarmup: boolean
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
    weight: number | null
    targetRpe: number | null
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

export interface SbdMetricsWorkout {
    id: string
    workoutExercises: SbdMetricsWorkoutExercise[]
}

export interface SbdMetricsWeek {
    id: string
    workouts: SbdMetricsWorkout[]
}

export interface LiftLabels {
    squat: string
    bench: string
    deadlift: string
}

interface ComputeWeekSbdMetricsInput {
    weeks: SbdMetricsWeek[]
    oneRmByExerciseId: Record<string, number>
    liftLabels: LiftLabels
}

export function computeWeekSbdMetrics({
    weeks,
    oneRmByExerciseId,
    liftLabels,
}: ComputeWeekSbdMetricsInput): Record<string, WeekSbdMetric[]> {
    return weeks.reduce((acc, week) => {
        const metricsByLift = week.workouts.reduce(
            (weekAcc, workout) => {
                workout.workoutExercises
                    .filter(
                        (workoutExercise) =>
                            workoutExercise.exercise.type === 'fundamental' &&
                            !workoutExercise.isWarmup,
                    )
                    .forEach((workoutExercise) => {
                        const matchedLift = matchFundamentalLift(workoutExercise.exercise.name)
                        if (!matchedLift) {
                            return
                        }

                        const plannedReps = parseRepsValue(workoutExercise.reps)
                        const liftCount = workoutExercise.sets * plannedReps

                        let intensity: number | null = null
                        if (
                            typeof workoutExercise.targetRpe === 'number' &&
                            Number.isFinite(workoutExercise.targetRpe) &&
                            plannedReps > 0
                        ) {
                            intensity = intensityFromRpeChart(
                                plannedReps,
                                workoutExercise.targetRpe,
                            )
                        } else if (
                            workoutExercise.weightType === 'percentage_1rm' &&
                            typeof workoutExercise.weight === 'number'
                        ) {
                            intensity = workoutExercise.weight
                        } else if (
                            workoutExercise.weightType === 'absolute' &&
                            typeof workoutExercise.weight === 'number'
                        ) {
                            const oneRm = oneRmByExerciseId[workoutExercise.exercise.id]
                            if (oneRm) {
                                intensity = (workoutExercise.weight / oneRm) * 100
                            }
                        }

                        if (!weekAcc[matchedLift]) {
                            weekAcc[matchedLift] = {
                                lift: matchedLift,
                                workoutIds: new Set<string>(),
                                totalLifts: 0,
                                weightedIntensitySum: 0,
                                intensityLiftCount: 0,
                            }
                        }

                        weekAcc[matchedLift].workoutIds.add(workout.id)
                        weekAcc[matchedLift].totalLifts += liftCount

                        if (intensity !== null && liftCount > 0) {
                            weekAcc[matchedLift].weightedIntensitySum += intensity * liftCount
                            weekAcc[matchedLift].intensityLiftCount += liftCount
                        }
                    })

                return weekAcc
            },
            {} as Record<
                FundamentalLift,
                {
                    lift: FundamentalLift
                    workoutIds: Set<string>
                    totalLifts: number
                    weightedIntensitySum: number
                    intensityLiftCount: number
                }
            >,
        )

        acc[week.id] = Object.values(metricsByLift)
            .map((metric) => ({
                lift: metric.lift,
                liftLabel: liftLabels[metric.lift],
                frequency: metric.workoutIds.size,
                totalLifts: metric.totalLifts,
                averageIntensity:
                    metric.intensityLiftCount > 0
                        ? metric.weightedIntensitySum / metric.intensityLiftCount
                        : null,
            }))
            .sort(
                (left, right) =>
                    FUNDAMENTAL_LIFT_ORDER.indexOf(left.lift) -
                    FUNDAMENTAL_LIFT_ORDER.indexOf(right.lift),
            )

        return acc
    }, {} as Record<string, WeekSbdMetric[]>)
}

interface ComputeSbdMetricsByLiftInput {
    weeks: Array<{ id: string }>
    weekSbdMetrics: Record<string, WeekSbdMetric[]>
    liftLabels: LiftLabels
}

export function computeSbdMetricsByLiftAcrossWeeks({
    weeks,
    weekSbdMetrics,
    liftLabels,
}: ComputeSbdMetricsByLiftInput): SbdLiftAcrossWeeks[] {
    return FUNDAMENTAL_LIFT_ORDER.map((lift) => {
        const metricsByWeekId = weeks.reduce((acc, week) => {
            const metric = (weekSbdMetrics[week.id] || []).find(
                (weekMetric) => weekMetric.lift === lift,
            )
            if (metric) {
                acc[week.id] = metric
            }
            return acc
        }, {} as Record<string, WeekSbdMetric>)

        return {
            lift,
            liftLabel: liftLabels[lift],
            metricsByWeekId,
        }
    }).filter((liftMetric) => Object.keys(liftMetric.metricsByWeekId).length > 0)
}

export interface AggregatedSbdMetric {
    frequency: number
    totalLifts: number
    averageIntensity: number | null
}

/**
 * Combine multiple WeekSbdMetric entries (same lift, different weeks) into a single
 * aggregate. FRQ = Σ frequency, NBL = Σ totalLifts, IM = NBL-weighted average of
 * averageIntensity (entries with null intensity contribute to NBL but not to IM).
 */
export function aggregateWeekMetrics(
    weekMetrics: Array<Pick<WeekSbdMetric, 'frequency' | 'totalLifts' | 'averageIntensity'>>,
): AggregatedSbdMetric {
    let frequency = 0
    let totalLifts = 0
    let weightedIntensitySum = 0
    let intensityWeight = 0

    for (const metric of weekMetrics) {
        frequency += metric.frequency
        totalLifts += metric.totalLifts

        if (metric.averageIntensity !== null && metric.totalLifts > 0) {
            weightedIntensitySum += metric.averageIntensity * metric.totalLifts
            intensityWeight += metric.totalLifts
        }
    }

    return {
        frequency,
        totalLifts,
        averageIntensity: intensityWeight > 0 ? weightedIntensitySum / intensityWeight : null,
    }
}
