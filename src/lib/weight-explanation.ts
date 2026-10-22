/**
 * Pure step-by-step explanation of how a trainer-facing weight was derived
 * (PR -> 1RM -> % or RPE -> rounding -> ballast). Steps are structured data with
 * raw numbers, never translated strings; every number comes from the same
 * functions that compute the weight the pages display. No Prisma, no React.
 */
import { ballastFromRange, ballastFromTotal } from './bodyweight-load'
import type { BallastDisplay } from './bodyweight-load'
import {
    RPE_WEIGHT_RANGE_TOLERANCE,
    estimateOneRMFromRpeTable,
    intensityFromRpeChart,
    normalizedOneRM,
    rpeWeightRange,
} from './calculations'
import type { RpeWeightRange } from './calculations'
import { plannedReps } from './reps'
import { percentageOfOneRmWeight, percentageOfPreviousWeight } from './weight-rounding'

export type WeightValue =
    | { kind: 'kg'; kg: number }
    | { kind: 'range'; minKg: number; maxKg: number }

export type OneRmChart = 'tuchscherer' | 'bodyweightLoaded' | 'epley'

export type WeightExplanationStep =
    | { kind: 'latestRecord'; weightKg: number; reps: number; recordDate: string | null; totalLoad: boolean }
    | { kind: 'oneRm'; recordWeightKg: number; reps: number; chart: OneRmChart; chartPercent: number | null; rawKg: number; oneRmKg: number }
    | { kind: 'percentOfOneRm'; percent: number; oneRmKg: number; rawKg: number; resultKg: number; totalLoad: boolean }
    | { kind: 'previousBase'; rowNumber: number; exerciseName: string; baseKg: number; ballastKg: number | null }
    | { kind: 'percentOfPrevious'; baseKg: number; percent: number; rawKg: number; resultKg: number }
    | { kind: 'previousRange'; rowNumber: number; exerciseName: string; minKg: number; maxKg: number }
    | { kind: 'percentOfPreviousRange'; percent: number; minKg: number; maxKg: number; resultMinKg: number; resultMaxKg: number }
    | { kind: 'rpeIntensity'; reps: number; rpe: number; chart: 'tuchscherer' | 'bodyweightLoaded'; chartPercent: number; centerKg: number }
    | { kind: 'rpeRange'; tolerancePercent: number; rawMinKg: number; rawMaxKg: number; minKg: number; maxKg: number }
    | { kind: 'absoluteBallast'; ballastKg: number; bodyweightKg: number | null; measuredAt: string | null; totalKg: number | null }
    | { kind: 'bodyweight'; bodyweightKg: number; measuredAt: string | null; ballast: BallastDisplay }
    | { kind: 'missingBodyweight' }
    | { kind: 'savedDiffers'; saved: WeightValue; current: WeightValue | null }

export type WeightExplanationReason =
    | 'noRecord'
    | 'noPreviousRow'
    | 'previousWithoutBase'
    | 'repsOutOfChart'

export interface WeightExplanation {
    steps: WeightExplanationStep[]
    result: WeightValue | null
    missingReason: WeightExplanationReason | null
}

export interface WeightExplanationInput {
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_previous'
    /** kg for absolute, % for percentage_1rm, signed % (e.g. -10) for percentage_previous */
    weight: number | null
    reps: string
    targetRpe: number | null
    isBodyweightLoaded: boolean
    /** Most recent PR of the exercise (latestPersonalRecordByExercise), or null */
    latestRecord: { weight: number; reps: number; recordDate?: string | Date | null } | null
    bodyweight: { kg: number; measuredAt: string | Date | null } | null
    /** Nearest previous row of the same exercise in the workout; only for percentage_previous */
    previous: {
        rowNumber: number
        exerciseName: string
        /** previousLoadBase() of that row, null when it has no kg base */
        baseKg: number | null
        /** ballast typed on that row when it is absolute and bodyweight-loaded */
        ballastKg: number | null
        range: RpeWeightRange | null
    } | null
    /** Value the page shows from the database; null in the editable editor */
    saved: WeightValue | null
}

function toIsoDate(value: string | Date | null | undefined): string | null {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function sameValue(a: WeightValue, b: WeightValue | null): boolean {
    if (!b || a.kind !== b.kind) return false
    if (a.kind === 'kg' && b.kind === 'kg') return a.kg === b.kg
    if (a.kind === 'range' && b.kind === 'range') return a.minKg === b.minKg && a.maxKg === b.maxKg
    return false
}

/** null = nothing to explain (absolute on a normal exercise, or nothing planned). */
export function explainWeight(input: WeightExplanationInput): WeightExplanation | null {
    const { weightType, weight, targetRpe, isBodyweightLoaded: loaded, latestRecord, bodyweight } = input

    let mode: 'absolute' | 'oneRm' | 'previous' | 'rpe'
    if (weightType === 'absolute') {
        if (typeof weight === 'number') {
            if (!loaded) return null
            mode = 'absolute'
        } else if (typeof targetRpe === 'number') {
            mode = 'rpe'
        } else {
            return null
        }
    } else if (typeof weight !== 'number') {
        return null
    } else {
        mode = weightType === 'percentage_1rm' ? 'oneRm' : 'previous'
    }

    const steps: WeightExplanationStep[] = []
    const measuredAt = toIsoDate(bodyweight?.measuredAt)

    if (mode === 'absolute') {
        const ballastKg = weight as number
        const totalKg = bodyweight ? ballastKg + bodyweight.kg : null
        steps.push({
            kind: 'absoluteBallast',
            ballastKg,
            bodyweightKg: bodyweight ? bodyweight.kg : null,
            measuredAt: bodyweight ? measuredAt : null,
            totalKg,
        })
        return {
            steps,
            result: totalKg === null ? null : { kind: 'kg', kg: totalKg },
            missingReason: null,
        }
    }

    let result: WeightValue | null = null
    let missingReason: WeightExplanationReason | null = null

    if (mode === 'oneRm' || mode === 'rpe') {
        if (!latestRecord) {
            missingReason = 'noRecord'
        } else {
            steps.push({
                kind: 'latestRecord',
                weightKg: latestRecord.weight,
                reps: latestRecord.reps,
                recordDate: toIsoDate(latestRecord.recordDate),
                totalLoad: loaded,
            })
            const normReps = Math.max(1, Math.round(latestRecord.reps))
            const recordPercent = intensityFromRpeChart(normReps, 10, loaded)
            const oneRmKg = normalizedOneRM(latestRecord.weight, latestRecord.reps, loaded)
            steps.push({
                kind: 'oneRm',
                recordWeightKg: latestRecord.weight,
                reps: latestRecord.reps,
                chart:
                    recordPercent === null ? 'epley' : loaded ? 'bodyweightLoaded' : 'tuchscherer',
                chartPercent: recordPercent,
                rawKg: estimateOneRMFromRpeTable(latestRecord.weight, latestRecord.reps, 10, loaded),
                oneRmKg,
            })

            if (mode === 'oneRm') {
                const percent = weight as number
                const resultKg = percentageOfOneRmWeight(oneRmKg, percent)
                steps.push({
                    kind: 'percentOfOneRm',
                    percent,
                    oneRmKg,
                    rawKg: (oneRmKg * percent) / 100,
                    resultKg,
                    totalLoad: loaded,
                })
                result = { kind: 'kg', kg: resultKg }
            } else {
                const reps = plannedReps(input.reps.trim())
                const rpe = targetRpe as number
                const chartPercent = intensityFromRpeChart(reps, rpe, loaded)
                const range = chartPercent === null ? null : rpeWeightRange(oneRmKg, reps, rpe, loaded)
                if (chartPercent === null || !range) {
                    missingReason = 'repsOutOfChart'
                } else {
                    const centerKg = (oneRmKg * chartPercent) / 100
                    steps.push({
                        kind: 'rpeIntensity',
                        reps,
                        rpe,
                        chart: loaded ? 'bodyweightLoaded' : 'tuchscherer',
                        chartPercent,
                        centerKg,
                    })
                    steps.push({
                        kind: 'rpeRange',
                        tolerancePercent: RPE_WEIGHT_RANGE_TOLERANCE * 100,
                        rawMinKg: centerKg * (1 - RPE_WEIGHT_RANGE_TOLERANCE),
                        rawMaxKg: centerKg * (1 + RPE_WEIGHT_RANGE_TOLERANCE),
                        minKg: range.min,
                        maxKg: range.max,
                    })
                    result = { kind: 'range', minKg: range.min, maxKg: range.max }
                }
            }
        }
    } else {
        const percent = weight as number
        const previous = input.previous
        if (!previous) {
            missingReason = 'noPreviousRow'
        } else if (typeof previous.baseKg === 'number') {
            const baseKg = previous.baseKg
            const resultKg = percentageOfPreviousWeight(baseKg, percent)
            steps.push({
                kind: 'previousBase',
                rowNumber: previous.rowNumber,
                exerciseName: previous.exerciseName,
                baseKg,
                ballastKg: previous.ballastKg,
            })
            steps.push({
                kind: 'percentOfPrevious',
                baseKg,
                percent,
                rawKg: baseKg * (1 + percent / 100),
                resultKg,
            })
            result = { kind: 'kg', kg: resultKg }
        } else if (previous.range) {
            const { min, max } = previous.range
            const resultMinKg = percentageOfPreviousWeight(min, percent)
            const resultMaxKg = percentageOfPreviousWeight(max, percent)
            steps.push({
                kind: 'previousRange',
                rowNumber: previous.rowNumber,
                exerciseName: previous.exerciseName,
                minKg: min,
                maxKg: max,
            })
            steps.push({
                kind: 'percentOfPreviousRange',
                percent,
                minKg: min,
                maxKg: max,
                resultMinKg,
                resultMaxKg,
            })
            result = { kind: 'range', minKg: resultMinKg, maxKg: resultMaxKg }
        } else {
            missingReason = 'previousWithoutBase'
        }
    }

    if (loaded && result) {
        if (!bodyweight) {
            steps.push({ kind: 'missingBodyweight' })
        } else {
            steps.push({
                kind: 'bodyweight',
                bodyweightKg: bodyweight.kg,
                measuredAt,
                ballast:
                    result.kind === 'kg'
                        ? ballastFromTotal(result.kg, bodyweight.kg)
                        : ballastFromRange(result.minKg, result.maxKg, bodyweight.kg),
            })
        }
    }

    if (input.saved && !sameValue(input.saved, result)) {
        steps.push({ kind: 'savedDiffers', saved: input.saved, current: result })
    }

    return { steps, result, missingReason }
}
