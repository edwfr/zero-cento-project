import { rpeWeightRange, type RpeWeightRange } from '@/lib/calculations'
import { plannedReps } from '@/lib/reps'
import { parseWeightInputValue } from './weight-input'

/** Proposed range for an editor row: only with an empty weight, a numeric RPE and a 1RM. */
export function rpeWeightRangeForRow(input: {
    weight: string
    reps: string
    targetRpe: string
    oneRm: number | undefined
    bodyweightLoaded?: boolean
}): RpeWeightRange | null {
    if (parseWeightInputValue(input.weight).mode !== 'empty') return null

    const rawRpe = input.targetRpe.trim()
    if (rawRpe === '') return null
    const rpe = Number(rawRpe)
    if (!Number.isFinite(rpe)) return null

    if (input.oneRm === undefined) return null

    return rpeWeightRange(input.oneRm, plannedReps(input.reps.trim()), rpe, input.bodyweightLoaded)
}
