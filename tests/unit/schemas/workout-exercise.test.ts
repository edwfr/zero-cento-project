import { describe, it, expect } from 'vitest'
import {
    workoutExerciseSchema,
    updateWorkoutExerciseSchema,
    bulkSaveWorkoutExercisesSchema,
} from '@/schemas/workout-exercise'

const ID = '11111111-1111-4111-8111-111111111111'

const base = (reps: unknown) => ({
    exerciseId: ID,
    sets: 3,
    reps,
    weightType: 'absolute',
    weight: 50,
    restTime: 'm2',
    order: 1,
})

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.error?.issues.map((i) => i.message) ?? []

const valid = ['8', '8/10', '30"', '30"/45"', 'max']
const invalid = [
    ['8-10', 'validation.invalidReps'],
    ['10/8', 'validation.repsRangeOrder'],
    ['0', 'validation.repsOutOfRange'],
    ['51', 'validation.repsLooksLikeSeconds'],
]

describe('workoutExerciseSchema reps', () => {
    it.each(valid)('accepts %s', (reps) => {
        expect(workoutExerciseSchema.safeParse(base(reps)).success).toBe(true)
    })
    it.each(invalid)('rejects %s with %s', (reps, key) => {
        const result = workoutExerciseSchema.safeParse(base(reps))
        expect(result.success).toBe(false)
        expect(messages(result)).toContain(key)
    })
})

describe('bulkSaveWorkoutExercisesSchema reps', () => {
    const wrap = (reps: unknown) => ({ exercises: [base(reps)] })
    it.each(valid)('accepts %s', (reps) => {
        expect(bulkSaveWorkoutExercisesSchema.safeParse(wrap(reps)).success).toBe(true)
    })
    it.each(invalid)('rejects %s with %s', (reps, key) => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse(wrap(reps))
        expect(result.success).toBe(false)
        expect(messages(result)).toContain(key)
    })
})

describe('updateWorkoutExerciseSchema reps', () => {
    it('accepts missing reps', () => {
        expect(updateWorkoutExerciseSchema.safeParse({ id: ID }).success).toBe(true)
    })
    it('accepts 8/10', () => {
        expect(updateWorkoutExerciseSchema.safeParse({ id: ID, reps: '8/10' }).success).toBe(true)
    })
    it('rejects 8-10', () => {
        const result = updateWorkoutExerciseSchema.safeParse({ id: ID, reps: '8-10' })
        expect(result.success).toBe(false)
        expect(messages(result)).toContain('validation.invalidReps')
    })
})

describe('rpe weight range', () => {
    const row = (extra: Record<string, unknown> = {}) => ({
        ...base('5'),
        weight: null,
        targetRpe: 8,
        ...extra,
    })
    const schemas = [
        ['workoutExerciseSchema', (data: unknown) => workoutExerciseSchema.safeParse(data)],
        [
            'bulkSaveWorkoutExercisesSchema',
            (data: unknown) => bulkSaveWorkoutExercisesSchema.safeParse({ exercises: [data] }),
        ],
    ] as const
    const issues = (result: {
        success: boolean
        error?: { issues: { message: string; path: (string | number)[] }[] }
    }) => result.error?.issues ?? []

    describe.each(schemas)('%s', (_name, parse) => {
        it('accepts a valid range', () => {
            expect(parse(row({ rpeWeightMin: 110.5, rpeWeightMax: 115 })).success).toBe(true)
        })
        it('accepts missing range fields', () => {
            expect(parse(row()).success).toBe(true)
        })
        it('accepts both fields null', () => {
            expect(parse(row({ rpeWeightMin: null, rpeWeightMax: null })).success).toBe(true)
        })
        it('rejects min greater than max', () => {
            const result = parse(row({ rpeWeightMin: 115, rpeWeightMax: 110.5 }))
            expect(result.success).toBe(false)
            const issue = issues(result).find((i) => i.message === 'validation.rpeWeightRangeOrder')
            expect(issue?.path.slice(-1)).toEqual(['rpeWeightMin'])
        })
        it('rejects only min set', () => {
            const result = parse(row({ rpeWeightMin: 110 }))
            expect(result.success).toBe(false)
            const issue = issues(result).find(
                (i) => i.message === 'validation.rpeWeightRangeIncomplete'
            )
            expect(issue?.path.slice(-1)).toEqual(['rpeWeightMax'])
        })
        it('rejects negative values', () => {
            const result = parse(row({ rpeWeightMin: -1, rpeWeightMax: 5 }))
            expect(result.success).toBe(false)
            expect(messages(result)).toContain('validation.rpeWeightMinZero')
        })
    })
})
