import type { WorkoutExercise } from '@prisma/client'
import { prisma } from './prisma'
import { plannedReps } from './reps'

export const CALCULATION_ERROR_KEYS = {
    noPreviousOccurrenceFound: 'calculation.noPreviousOccurrenceFound',
} as const

/** exerciseId → theoretical 1RM of the most recent PR. */
export type TraineeOneRmMap = Map<string, number>

export interface PersonalRecordInput {
    exerciseId: string
    weight: number
    reps: number
    recordDate?: Date | string | null
}

function recordTime(recordDate: PersonalRecordInput['recordDate']): number {
    if (!recordDate) return -Infinity
    const time = new Date(recordDate).getTime()
    return Number.isNaN(time) ? -Infinity : time
}

/**
 * Most recent PR per exercise. Ties on recordDate → higher normalizedOneRM wins.
 * Missing/invalid recordDate counts as the oldest possible date.
 */
export function latestPersonalRecordByExercise<T extends PersonalRecordInput>(
    records: readonly T[]
): Record<string, T> {
    const latest: Record<string, T> = {}
    for (const candidate of records) {
        const current = latest[candidate.exerciseId]
        if (!current) {
            latest[candidate.exerciseId] = candidate
            continue
        }
        const candidateTime = recordTime(candidate.recordDate)
        const currentTime = recordTime(current.recordDate)
        if (
            candidateTime > currentTime ||
            (candidateTime === currentTime &&
                normalizedOneRM(candidate.weight, candidate.reps) >
                    normalizedOneRM(current.weight, current.reps))
        ) {
            latest[candidate.exerciseId] = candidate
        }
    }
    return latest
}

/** normalizedOneRM(weight, reps) of latestPersonalRecordByExercise. */
export function latestNormalizedOneRMByExercise(
    records: readonly PersonalRecordInput[]
): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [exerciseId, record] of Object.entries(latestPersonalRecordByExercise(records))) {
        result[exerciseId] = normalizedOneRM(record.weight, record.reps)
    }
    return result
}

/**
 * Load all personal records for a trainee into an (exerciseId → 1RM) map.
 * The 1RM is the theoretical one of the most recent PR of each exercise.
 * One query replaces N `personalRecord.findFirst` calls.
 */
export async function loadTraineeOneRmMap(traineeId: string): Promise<TraineeOneRmMap> {
    const records = await prisma.personalRecord.findMany({
        where: { traineeId },
        select: { exerciseId: true, reps: true, weight: true, recordDate: true },
    })
    return new Map(Object.entries(latestNormalizedOneRMByExercise(records)))
}

/**
 * Sync resolver used when caller has pre-fetched the trainee 1RM map and the
 * relevant workout siblings (exercises of the same workout, any order).
 * `percentage_previous` is based on the nearest previous occurrence.
 */
export function resolveEffectiveWeight(
    workoutExercise: WorkoutExercise,
    oneRmMap: TraineeOneRmMap,
    workoutSiblings: WorkoutExercise[]
): number | null {
    // No depth guard: each percentage_previous step moves to a strictly lower
    // order, so the chain always ends within the sibling count.

    switch (workoutExercise.weightType) {
        case 'absolute':
            return workoutExercise.weight

        case 'percentage_1rm': {
            const oneRm = oneRmMap.get(workoutExercise.exerciseId)
            if (oneRm === undefined) return null
            return (oneRm * (workoutExercise.weight || 0)) / 100
        }

        case 'percentage_previous': {
            const previousExercise = workoutSiblings
                .filter(
                    (sibling) =>
                        sibling.workoutId === workoutExercise.workoutId &&
                        sibling.exerciseId === workoutExercise.exerciseId &&
                        sibling.order < workoutExercise.order
                )
                .sort((a, b) => b.order - a.order)[0]

            if (!previousExercise) {
                throw new Error(CALCULATION_ERROR_KEYS.noPreviousOccurrenceFound)
            }

            const baseWeight = resolveEffectiveWeight(
                previousExercise,
                oneRmMap,
                workoutSiblings
            )
            if (baseWeight === null) return null

            const percentage = workoutExercise.weight || 0
            return baseWeight * (1 + percentage / 100)
        }

        default:
            return null
    }
}

/**
 * Calculate total volume (sets × reps × weight) for a muscle group
 */
export function calculateVolume(
    sets: number,
    reps: number,
    weight: number,
    coefficient: number
): number {
    return sets * reps * weight * coefficient
}

/**
 * Calculate training sets for a muscle group
 * Only counts non-warmup sets
 */
export function calculateTrainingSets(
    sets: number,
    coefficient: number,
    isWarmup: boolean
): number {
    if (isWarmup) return 0
    return sets * coefficient
}

/**
 * Planned reps of a reps string: "8" -> 8, "8/10" -> 8 (minimum),
 * seconds and "max" -> 0.
 */
export function parseReps(repsString: string): number {
    return plannedReps(repsString)
}

/**
 * Calculate estimated 1RM from nRM using Epley formula
 * 1RM = weight × (1 + reps / 30)
 */
export function estimateOneRM(weight: number, reps: number): number {
    if (reps === 1) return weight
    return weight * (1 + reps / 30)
}

export const MIKE_TUCHSCHERER_RPE_LEVELS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5] as const
export const MIKE_TUCHSCHERER_REP_RANGE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const MIKE_TUCHSCHERER_RPE_CHART: Record<number, Record<string, number>> = {
    1: {
        '10': 100,
        '9.5': 97.8,
        '9': 95.5,
        '8.5': 93.9,
        '8': 92.2,
        '7.5': 90.7,
        '7': 89.2,
        '6.5': 87.8,
        '6': 86.3,
        '5.5': 85,
        '5': 83.7,
    },
    2: {
        '10': 95.5,
        '9.5': 93.9,
        '9': 92.2,
        '8.5': 90.7,
        '8': 89.2,
        '7.5': 87.8,
        '7': 86.3,
        '6.5': 85,
        '6': 83.7,
        '5.5': 82.4,
        '5': 81.1,
    },
    3: {
        '10': 92.2,
        '9.5': 90.7,
        '9': 89.2,
        '8.5': 87.8,
        '8': 86.3,
        '7.5': 85,
        '7': 83.7,
        '6.5': 82.4,
        '6': 81.1,
        '5.5': 79.9,
        '5': 78.6,
    },
    4: {
        '10': 89.2,
        '9.5': 87.8,
        '9': 86.3,
        '8.5': 85,
        '8': 83.7,
        '7.5': 82.4,
        '7': 81.1,
        '6.5': 79.9,
        '6': 78.6,
        '5.5': 77.4,
        '5': 76.2,
    },
    5: {
        '10': 86.3,
        '9.5': 85,
        '9': 83.7,
        '8.5': 82.4,
        '8': 81.1,
        '7.5': 79.9,
        '7': 78.6,
        '6.5': 77.4,
        '6': 76.2,
        '5.5': 75.1,
        '5': 73.9,
    },
    6: {
        '10': 83.7,
        '9.5': 82.4,
        '9': 81.1,
        '8.5': 79.9,
        '8': 78.6,
        '7.5': 77.4,
        '7': 76.2,
        '6.5': 75.1,
        '6': 73.9,
        '5.5': 72.3,
        '5': 70.7,
    },
    7: {
        '10': 81.1,
        '9.5': 79.9,
        '9': 78.6,
        '8.5': 77.4,
        '8': 76.2,
        '7.5': 75.1,
        '7': 73.9,
        '6.5': 72.3,
        '6': 70.7,
        '5.5': 69.4,
        '5': 68,
    },
    8: {
        '10': 78.6,
        '9.5': 77.4,
        '9': 76.2,
        '8.5': 75.1,
        '8': 73.9,
        '7.5': 72.3,
        '7': 70.7,
        '6.5': 69.4,
        '6': 68,
        '5.5': 66.7,
        '5': 65.3,
    },
    9: {
        '10': 76.2,
        '9.5': 75.1,
        '9': 73.9,
        '8.5': 72.3,
        '8': 70.7,
        '7.5': 69.4,
        '7': 68,
        '6.5': 66.7,
        '6': 65.3,
        '5.5': 64,
        '5': 62.6,
    },
    10: {
        '10': 73.9,
        '9.5': 72.3,
        '9': 70.7,
        '8.5': 69.4,
        '8': 68,
        '7.5': 66.7,
        '7': 65.3,
        '6.5': 64,
        '6': 62.6,
        '5.5': 61.3,
        '5': 59.9,
    },
    11: {
        '10': 70.7,
        '9.5': 69.4,
        '9': 68,
        '8.5': 66.7,
        '8': 65.3,
        '7.5': 64,
        '7': 62.6,
        '6.5': 61.3,
        '6': 59.9,
        '5.5': 58.6,
        '5': 57.2,
    },
    12: {
        '10': 68,
        '9.5': 66.7,
        '9': 65.3,
        '8.5': 64,
        '8': 62.6,
        '7.5': 61.3,
        '7': 59.9,
        '6.5': 58.6,
        '6': 57.2,
        '5.5': 55.9,
        '5': 54.5,
    },
}

function normalizeRpeToHalfStep(rpe: number): number {
    return Math.round(rpe * 2) / 2
}

function toRpeChartKey(rpe: number): string {
    return Number.isInteger(rpe) ? String(rpe) : rpe.toFixed(1)
}

/**
 * Estimate 1RM using Mike Tuchscherer's RPE chart.
 * Falls back to Epley when reps/rpe are outside the chart.
 */
export function estimateOneRMFromRpeTable(weight: number, reps: number, rpe = 10): number {
    if (!Number.isFinite(weight) || weight <= 0) return 0
    if (!Number.isFinite(reps)) return 0

    const normalizedReps = Math.max(1, Math.round(reps))
    const normalizedRpe = Math.max(5, Math.min(10, normalizeRpeToHalfStep(rpe)))
    const byReps = MIKE_TUCHSCHERER_RPE_CHART[normalizedReps]

    if (!byReps) {
        return estimateOneRM(weight, normalizedReps)
    }

    const percentage = byReps[toRpeChartKey(normalizedRpe)]
    if (!percentage || percentage <= 0) {
        return estimateOneRM(weight, normalizedReps)
    }

    return weight / (percentage / 100)
}

/**
 * Look up the % of 1RM from Mike Tuchscherer's RPE chart for a (reps, rpe) pair.
 * Returns null when the combination is outside the chart (reps > 12, rpe < 5).
 */
export function intensityFromRpeChart(reps: number, rpe: number): number | null {
    if (!Number.isFinite(reps) || !Number.isFinite(rpe)) return null

    const normalizedReps = Math.round(reps)
    if (normalizedReps < 1) return null

    const byReps = MIKE_TUCHSCHERER_RPE_CHART[normalizedReps]
    if (!byReps) return null

    const normalizedRpe = normalizeRpeToHalfStep(rpe)
    const percentage = byReps[toRpeChartKey(normalizedRpe)]
    if (typeof percentage !== 'number' || percentage <= 0) return null

    return percentage
}

/**
 * Canonical normalized 1RM used across the app.
 * Mike Tuchscherer RPE table at RPE 10, rounded to the nearest 0.5 kg.
 */
export function normalizedOneRM(weight: number, reps: number): number {
    return Math.round(estimateOneRMFromRpeTable(weight, reps, 10) * 2) / 2
}
