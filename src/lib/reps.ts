import { z } from 'zod'

export const REPS_MIN = 1
export const REPS_MAX = 50
export const SECONDS_MAX = 300

export type ParsedReps =
    | { kind: 'reps'; min: number; max: number }
    | { kind: 'time'; min: number; max: number }
    | { kind: 'amrap' }

const SINGLE = /^(\d+)$/
const RANGE = /^(\d+)\/(\d+)$/
const TIME = /^(\d+)"$/
const TIME_RANGE = /^(\d+)"\/(\d+)"$/

const inRepsLimits = (n: number) => n >= REPS_MIN && n <= REPS_MAX
const inSecondsLimits = (n: number) => n >= 1 && n <= SECONDS_MAX

/** Parses the canonical reps format ("8", "8/10", `30"`, `30"/45"`, "max"). Input is not trimmed. */
export function parseReps(value: string): ParsedReps | null {
    if (value === 'max') return { kind: 'amrap' }

    let m: RegExpMatchArray | null
    if ((m = value.match(SINGLE))) {
        const n = Number(m[1])
        return inRepsLimits(n) ? { kind: 'reps', min: n, max: n } : null
    }
    if ((m = value.match(RANGE))) {
        const a = Number(m[1])
        const b = Number(m[2])
        return inRepsLimits(a) && inRepsLimits(b) && a < b ? { kind: 'reps', min: a, max: b } : null
    }
    if ((m = value.match(TIME))) {
        const s = Number(m[1])
        return inSecondsLimits(s) ? { kind: 'time', min: s, max: s } : null
    }
    if ((m = value.match(TIME_RANGE))) {
        const a = Number(m[1])
        const b = Number(m[2])
        return inSecondsLimits(a) && inSecondsLimits(b) && a < b ? { kind: 'time', min: a, max: b } : null
    }
    return null
}

export function isValidReps(value: string): boolean {
    return parseReps(value) !== null
}

/** Reps used by calculations: range -> min; time, amrap and invalid -> 0. */
export function plannedReps(value: string): number {
    const parsed = parseReps(value)
    return parsed?.kind === 'reps' ? parsed.min : 0
}

export const repsSchema: z.ZodType<string> = z.string().refine(isValidReps, 'validation.invalidReps')
