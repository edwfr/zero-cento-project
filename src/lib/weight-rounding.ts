/**
 * Client-side weight preview helpers shared by the trainer program pages.
 */

/** Ceil to nearest 0.5 kg; pre-round to 4dp to eliminate floating-point noise. */
export function roundWeightValue(value: number): number {
    const precise = Math.round(value * 10000) / 10000
    return Math.ceil(precise * 2) / 2
}

/** Rounded weight for `percentage` % of `oneRm`. */
export function percentageOfOneRmWeight(oneRm: number, percentage: number): number {
    return roundWeightValue((oneRm * percentage) / 100)
}

/** Rounded weight for `previousWeight` changed by `percentage` % (e.g. -5). */
export function percentageOfPreviousWeight(previousWeight: number, percentage: number): number {
    return roundWeightValue(previousWeight * (1 + percentage / 100))
}
