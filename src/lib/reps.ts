import { z } from 'zod'

export const REPS_MIN = 1
export const REPS_MAX = 50
export const SECONDS_MAX = 300

export type ParsedReps =
    | { kind: 'reps'; min: number; max: number }
    | { kind: 'time'; min: number; max: number }
    | { kind: 'amrap' }

export type RepsErrorCode = 'format' | 'repsOutOfRange' | 'looksLikeSeconds' | 'rangeOrder' | 'secondsOutOfRange'

/** `suggestion` is set for `looksLikeSeconds`: the same value written as time (e.g. `60"`, `45"/60"`). */
export type RepsError = { code: RepsErrorCode; suggestion?: string }

export type RepsCheck = { ok: true; reps: ParsedReps } | { ok: false; error: RepsError }

/** i18n keys (errors namespace) per error code; `looksLikeSeconds` interpolates `{{suggestion}}`. */
export const REPS_ERROR_KEYS: Record<RepsErrorCode, string> = {
    format: 'validation.invalidReps',
    repsOutOfRange: 'validation.repsOutOfRange',
    looksLikeSeconds: 'validation.repsLooksLikeSeconds',
    rangeOrder: 'validation.repsRangeOrder',
    secondsOutOfRange: 'validation.secondsOutOfRange',
}

const SINGLE = /^(\d+)$/
const RANGE = /^(\d+)\/(\d+)$/
const TIME = /^(\d+)"$/
const TIME_RANGE = /^(\d+)"\/(\d+)"$/

const inRepsLimits = (n: number) => n >= REPS_MIN && n <= REPS_MAX
const inSecondsLimits = (n: number) => n >= 1 && n <= SECONDS_MAX

const fail = (code: RepsErrorCode, suggestion?: string): RepsCheck => ({
    ok: false,
    error: suggestion === undefined ? { code } : { code, suggestion },
})

/** Reps above 50 that would be valid seconds are most likely a time written without quotes. */
const repsLimitError = (values: number[]): RepsCheck =>
    values.every(inSecondsLimits) && values.some((n) => n > REPS_MAX)
        ? fail('looksLikeSeconds', values.map((n) => `${n}"`).join('/'))
        : fail('repsOutOfRange')

/** Validates the canonical reps format ("8", "8/10", `30"`, `30"/45"`, "max") and says why it fails. Input is not trimmed. */
export function checkReps(value: string): RepsCheck {
    if (value === 'max') return { ok: true, reps: { kind: 'amrap' } }

    let m: RegExpMatchArray | null
    if ((m = value.match(SINGLE))) {
        const n = Number(m[1])
        return inRepsLimits(n) ? { ok: true, reps: { kind: 'reps', min: n, max: n } } : repsLimitError([n])
    }
    if ((m = value.match(RANGE))) {
        const a = Number(m[1])
        const b = Number(m[2])
        if (a >= b) return fail('rangeOrder')
        return inRepsLimits(a) && inRepsLimits(b)
            ? { ok: true, reps: { kind: 'reps', min: a, max: b } }
            : repsLimitError([a, b])
    }
    if ((m = value.match(TIME))) {
        const s = Number(m[1])
        return inSecondsLimits(s) ? { ok: true, reps: { kind: 'time', min: s, max: s } } : fail('secondsOutOfRange')
    }
    if ((m = value.match(TIME_RANGE))) {
        const a = Number(m[1])
        const b = Number(m[2])
        if (a >= b) return fail('rangeOrder')
        return inSecondsLimits(a) && inSecondsLimits(b)
            ? { ok: true, reps: { kind: 'time', min: a, max: b } }
            : fail('secondsOutOfRange')
    }
    return fail('format')
}

export function parseReps(value: string): ParsedReps | null {
    const result = checkReps(value)
    return result.ok ? result.reps : null
}

export function isValidReps(value: string): boolean {
    return checkReps(value).ok
}

/** Reps used by calculations: range -> min; time, amrap and invalid -> 0. */
export function plannedReps(value: string): number {
    const parsed = parseReps(value)
    return parsed?.kind === 'reps' ? parsed.min : 0
}

/** Issue message is the i18n key; `params.suggestion` carries the interpolation for `looksLikeSeconds`. */
export const repsSchema: z.ZodType<string> = z.string().superRefine((value, ctx) => {
    const result = checkReps(value)
    if (result.ok) return
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: REPS_ERROR_KEYS[result.error.code],
        params: result.error.suggestion ? { suggestion: result.error.suggestion } : undefined,
    })
})
