import type { WorkoutExercise, PersonalRecord } from '@prisma/client'
import { prisma } from './prisma'

export const CALCULATION_ERROR_KEYS = {
    maxRecursionDepthExceeded: 'calculation.maxRecursionDepthExceeded',
    noPreviousOccurrenceFound: 'calculation.noPreviousOccurrenceFound',
} as const

export type TraineePrMap = Map<string, number>

const prKey = (exerciseId: string, reps: number) => `${exerciseId}:${reps}`

/**
 * Best normalized 1RM for an exercise across all rep-range records in the map.
 * Iterates PR map entries for the given exerciseId, returns the max
 * `normalizedOneRM(weight, reps)`, or null when no record exists.
 */
function bestNormalizedOneRMForExercise(
    prMap: TraineePrMap,
    exerciseId: string
): number | null {
    let best: number | null = null
    const prefix = `${exerciseId}:`
    for (const [key, weight] of prMap.entries()) {
        if (!key.startsWith(prefix)) continue
        const reps = Number(key.slice(prefix.length))
        if (!Number.isFinite(reps) || reps <= 0) continue
        const normalized = normalizedOneRM(weight, reps)
        if (best === null || normalized > best) {
            best = normalized
        }
    }
    return best
}

/**
 * Load all personal records for a trainee into a (exerciseId:reps → weight) map.
 * Most recent record per (exerciseId, reps) wins.
 * One query replaces N `personalRecord.findFirst` calls.
 */
export async function loadTraineePrMap(traineeId: string): Promise<TraineePrMap> {
    const records = await prisma.personalRecord.findMany({
        where: { traineeId },
        select: { exerciseId: true, reps: true, weight: true, recordDate: true },
        orderBy: { recordDate: 'desc' },
    })

    const map: TraineePrMap = new Map()
    for (const record of records) {
        const key = prKey(record.exerciseId, record.reps)
        if (!map.has(key)) {
            map.set(key, record.weight)
        }
    }
    return map
}

/**
 * Sync resolver used when caller has pre-fetched the trainee PR map and the
 * relevant workout siblings (exercises of the same workout, any order).
 * Replaces `calculateEffectiveWeight` when batching to avoid N+1.
 */
export function resolveEffectiveWeight(
    workoutExercise: WorkoutExercise,
    prMap: TraineePrMap,
    workoutSiblings: WorkoutExercise[],
    depth = 0
): number | null {
    if (depth > 10) {
        throw new Error(CALCULATION_ERROR_KEYS.maxRecursionDepthExceeded)
    }

    switch (workoutExercise.weightType) {
        case 'absolute':
            return workoutExercise.weight

        case 'percentage_1rm': {
            const oneRm = bestNormalizedOneRMForExercise(prMap, workoutExercise.exerciseId)
            if (oneRm === null) return null
            return (oneRm * (workoutExercise.weight || 0)) / 100
        }

        case 'percentage_rm': {
            const repsMatch = workoutExercise.reps.match(/^\d+/)
            if (!repsMatch) return null
            const targetReps = parseInt(repsMatch[0], 10)
            const rm = prMap.get(prKey(workoutExercise.exerciseId, targetReps))
            if (rm === undefined) return null
            return (rm * (workoutExercise.weight || 0)) / 100
        }

        case 'percentage_previous': {
            const previousExercise = workoutSiblings
                .filter(
                    (sibling) =>
                        sibling.workoutId === workoutExercise.workoutId &&
                        sibling.exerciseId === workoutExercise.exerciseId &&
                        sibling.order < workoutExercise.order
                )
                .sort((a, b) => a.order - b.order)[0]

            if (!previousExercise) {
                throw new Error(CALCULATION_ERROR_KEYS.noPreviousOccurrenceFound)
            }

            const baseWeight = resolveEffectiveWeight(
                previousExercise,
                prMap,
                workoutSiblings,
                depth + 1
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
 * Calculate effective weight for a workout exercise
 * Resolves percentage_previous recursively
 */
export async function calculateEffectiveWeight(
    workoutExercise: WorkoutExercise & { exercise?: { id: string } },
    traineeId: string,
    depth = 0
): Promise<number | null> {
    // Prevent infinite recursion
    if (depth > 10) {
        throw new Error(CALCULATION_ERROR_KEYS.maxRecursionDepthExceeded)
    }

    switch (workoutExercise.weightType) {
        case 'absolute':
            return workoutExercise.weight

        case 'percentage_1rm': {
            // Best normalized 1RM across all rep-range records (RPE table)
            const records = await prisma.personalRecord.findMany({
                where: {
                    traineeId,
                    exerciseId: workoutExercise.exerciseId,
                },
                select: { weight: true, reps: true, recordDate: true },
                orderBy: { recordDate: 'desc' },
            })

            if (records.length === 0) return null

            let bestOneRm: number | null = null
            const seenReps = new Set<number>()
            for (const record of records) {
                if (seenReps.has(record.reps)) continue
                seenReps.add(record.reps)
                const normalized = normalizedOneRM(record.weight, record.reps)
                if (bestOneRm === null || normalized > bestOneRm) {
                    bestOneRm = normalized
                }
            }

            if (bestOneRm === null) return null
            return (bestOneRm * (workoutExercise.weight || 0)) / 100
        }

        case 'percentage_rm': {
            // Find nRM personal record based on reps
            // Parse reps (could be "8", "8-10", "6/8")
            const repsMatch = workoutExercise.reps.match(/^\d+/)
            if (!repsMatch) return null
            const targetReps = parseInt(repsMatch[0], 10)

            const record = await prisma.personalRecord.findFirst({
                where: {
                    traineeId,
                    exerciseId: workoutExercise.exerciseId,
                    reps: targetReps,
                },
                orderBy: {
                    recordDate: 'desc',
                },
            })

            if (!record) return null
            return (record.weight * (workoutExercise.weight || 0)) / 100
        }

        case 'percentage_previous': {
            // Find previous occurrence of same exercise in same workout
            const previousExercise = await prisma.workoutExercise.findFirst({
                where: {
                    workoutId: workoutExercise.workoutId,
                    exerciseId: workoutExercise.exerciseId,
                    order: {
                        lt: workoutExercise.order,
                    },
                },
                orderBy: {
                    order: 'asc',
                },
            })

            if (!previousExercise) {
                throw new Error(CALCULATION_ERROR_KEYS.noPreviousOccurrenceFound)
            }

            // Recursively resolve base weight
            const baseWeight = await calculateEffectiveWeight(
                previousExercise,
                traineeId,
                depth + 1
            )

            if (baseWeight === null) return null

            // Apply percentage adjustment
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
 * Parse reps string to get first number
 * Handles: "8", "8-10", "6/8"
 */
export function parseReps(repsString: string): number {
    const match = repsString.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

/**
 * Calculate estimated 1RM from nRM using Epley formula
 * 1RM = weight × (1 + reps / 30)
 */
export function estimateOneRM(weight: number, reps: number): number {
    if (reps === 1) return weight
    return weight * (1 + reps / 30)
}

export const MIKE_TUCHSCHERER_RPE_LEVELS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5] as const
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
 * Canonical normalized 1RM used across the app.
 * Mike Tuchscherer RPE table at RPE 10, rounded to the nearest 0.5 kg.
 */
export function normalizedOneRM(weight: number, reps: number): number {
    return Math.round(estimateOneRMFromRpeTable(weight, reps, 10) * 2) / 2
}
