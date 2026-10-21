import { z } from 'zod'

export const REPS_MIN = 1
export const REPS_MAX = 50
export const SECONDS_MAX = 300

export type ParsedReps =
    | { kind: 'reps'; min: number; max: number }
    | { kind: 'time'; seconds: number }
    | { kind: 'amrap' }

const SINGLE = /^(\d+)$/
const RANGE = /^(\d+)\/(\d+)$/
const TIME = /^(\d+)"$/

const inRepsLimits = (n: number) => n >= REPS_MIN && n <= REPS_MAX

/** Parses the canonical reps format ("8", "8/10", `30"`, "max"). Input is not trimmed. */
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
        return s >= 1 && s <= SECONDS_MAX ? { kind: 'time', seconds: s } : null
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
