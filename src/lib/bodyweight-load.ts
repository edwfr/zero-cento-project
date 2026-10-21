/**
 * Pure helpers for bodyweight-loaded exercises (pull-ups, dips): convert the
 * total load (bodyweight + ballast) into the ballast the trainee actually loads,
 * and build the labels shown to trainer and trainee. No Prisma, no React.
 */
import { formatWeightRange, roundWeightValue } from './weight-rounding'

export type BallastDisplay =
    | { kind: 'ballast'; kg: number }
    | { kind: 'ballastRange'; minKg: number; maxKg: number }
    | { kind: 'bodyweight' }
    | { kind: 'missingBodyweight' }

export interface BodyweightLoadRow {
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_previous'
    weight: number | null
    effectiveWeight: number | null
    rpeWeightMin: number | null
    rpeWeightMax: number | null
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const SEPARATOR = ' · '

function formatKg(value: number): string {
    const rounded = roundWeightValue(value)
    if (Number.isInteger(rounded)) return String(rounded)
    return rounded.toFixed(2).replace(/\.?0+$/, '')
}

export function ballastFromTotal(totalKg: number, bodyweightKg: number | null): BallastDisplay {
    if (bodyweightKg === null) return { kind: 'missingBodyweight' }
    const kg = roundWeightValue(totalKg - bodyweightKg)
    if (kg <= 0) return { kind: 'bodyweight' }
    return { kind: 'ballast', kg }
}

function ballastFromRange(
    minTotal: number,
    maxTotal: number,
    bodyweightKg: number | null
): BallastDisplay {
    if (bodyweightKg === null) return { kind: 'missingBodyweight' }
    const maxKg = roundWeightValue(maxTotal - bodyweightKg)
    if (maxKg <= 0) return { kind: 'bodyweight' }
    const minKg = Math.max(0, roundWeightValue(minTotal - bodyweightKg))
    return { kind: 'ballastRange', minKg, maxKg }
}

function hasRange(row: BodyweightLoadRow): boolean {
    return typeof row.rpeWeightMin === 'number' && typeof row.rpeWeightMax === 'number'
}

/** null = nothing planned (no weight, no range). */
export function ballastForRow(
    row: BodyweightLoadRow,
    bodyweightKg: number | null
): BallastDisplay | null {
    if (row.weightType === 'absolute') {
        if (typeof row.weight === 'number') {
            return row.weight > 0
                ? { kind: 'ballast', kg: roundWeightValue(row.weight) }
                : { kind: 'bodyweight' }
        }
    } else if (typeof row.effectiveWeight === 'number') {
        return ballastFromTotal(row.effectiveWeight, bodyweightKg)
    }
    if (hasRange(row)) {
        return ballastFromRange(row.rpeWeightMin as number, row.rpeWeightMax as number, bodyweightKg)
    }
    return null
}

/** Trainee API rows: bodyweight-loaded rows never carry total load. */
export function traineeWeightFields(
    row: BodyweightLoadRow & { isBodyweightLoaded: boolean },
    bodyweightKg: number | null
): {
    effectiveWeight: number | null
    rpeWeightMin: number | null
    rpeWeightMax: number | null
    ballast: BallastDisplay | null
} {
    if (!row.isBodyweightLoaded) {
        return {
            effectiveWeight: row.effectiveWeight,
            rpeWeightMin: row.rpeWeightMin,
            rpeWeightMax: row.rpeWeightMax,
            ballast: null,
        }
    }
    return {
        effectiveWeight: null,
        rpeWeightMin: null,
        rpeWeightMax: null,
        ballast: ballastForRow(row, bodyweightKg),
    }
}

/**
 * Base of a following percentage_previous row. Ballasted absolute rows store
 * the ballast, so their base is ballast + bodyweight; null when that is unknown.
 */
export function previousLoadBase(
    previousWeight: number | null,
    options: { isBodyweightLoaded: boolean; previousIsAbsolute: boolean; bodyweightKg: number | null }
): number | null {
    if (typeof previousWeight !== 'number' || !Number.isFinite(previousWeight)) return null
    if (!options.isBodyweightLoaded || !options.previousIsAbsolute) return previousWeight
    return options.bodyweightKg === null ? null : previousWeight + options.bodyweightKg
}

/** kg to prefill in the trainee's sets. */
export function plannedBallastKg(ballast: BallastDisplay | null): number {
    return ballast?.kind === 'ballast' ? ballast.kg : 0
}

export function formatBallastLabel(ballast: BallastDisplay, t: Translate): string {
    switch (ballast.kind) {
        case 'ballast':
            return t('common.bodyweightLoad.ballast', { weight: formatKg(ballast.kg) })
        case 'ballastRange':
            return t('common.bodyweightLoad.ballastRange', {
                range: formatWeightRange(ballast.minKg, ballast.maxKg),
            })
        case 'bodyweight':
            return t('common.bodyweightLoad.bodyweight')
        case 'missingBodyweight':
            return t('common.bodyweightLoad.missingBodyweight')
    }
}

export function formatTrainerLoadLabel(
    row: BodyweightLoadRow,
    bodyweightKg: number | null,
    t: Translate
): { label: string; missingBodyweight: boolean } | null {
    const missing = bodyweightKg === null

    if (row.weightType === 'absolute' && typeof row.weight === 'number') {
        if (row.weight <= 0) {
            return { label: t('common.bodyweightLoad.bodyweight'), missingBodyweight: false }
        }
        const weight = formatKg(row.weight)
        if (missing) {
            return {
                label: t('common.bodyweightLoad.ballast', { weight }),
                missingBodyweight: true,
            }
        }
        return {
            label: t('common.bodyweightLoad.ballastWithTotal', {
                weight,
                total: formatKg(row.weight + bodyweightKg),
            }),
            missingBodyweight: false,
        }
    }

    if (row.weightType !== 'absolute' && typeof row.effectiveWeight === 'number') {
        const total = t('common.bodyweightLoad.total', { weight: formatKg(row.effectiveWeight) })
        if (missing) return { label: total, missingBodyweight: true }
        const ballast = formatBallastLabel(ballastFromTotal(row.effectiveWeight, bodyweightKg), t)
        return { label: `${total}${SEPARATOR}${ballast}`, missingBodyweight: false }
    }

    if (hasRange(row)) {
        const min = row.rpeWeightMin as number
        const max = row.rpeWeightMax as number
        const total = t('common.bodyweightLoad.totalRange', {
            range: formatWeightRange(min, max),
        })
        if (missing) return { label: total, missingBodyweight: true }
        const ballast = formatBallastLabel(ballastFromRange(min, max, bodyweightKg), t)
        return { label: `${total}${SEPARATOR}${ballast}`, missingBodyweight: false }
    }

    return null
}

/**
 * Short trainer label for the editor weight cell: `+20 kg`, `+60.5–66 kg`, bodyweight.
 * Without bodyweight the ballast is unknown, so it falls back to the total.
 */
export function formatCompactLoadLabel(
    row: BodyweightLoadRow,
    bodyweightKg: number | null,
    t: Translate
): string | null {
    const ballast = ballastForRow(row, bodyweightKg)
    if (ballast === null) return null
    switch (ballast.kind) {
        case 'ballast':
            return t('common.bodyweightLoad.ballastCompact', { weight: formatKg(ballast.kg) })
        case 'ballastRange':
            return t('common.bodyweightLoad.ballastRangeCompact', {
                range: formatWeightRange(ballast.minKg, ballast.maxKg),
            })
        case 'bodyweight':
            return t('common.bodyweightLoad.bodyweight')
        case 'missingBodyweight':
            return formatTrainerLoadLabel(row, bodyweightKg, t)?.label ?? null
    }
}
