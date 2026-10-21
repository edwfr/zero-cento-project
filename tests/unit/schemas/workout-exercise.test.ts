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

const valid = ['8', '8/10', '30"', 'max']
const invalid = ['8-10', '10/8', '0', '51']

describe('workoutExerciseSchema reps', () => {
    it.each(valid)('accepts %s', (reps) => {
        expect(workoutExerciseSchema.safeParse(base(reps)).success).toBe(true)
    })
    it.each(invalid)('rejects %s with validation.invalidReps', (reps) => {
        const result = workoutExerciseSchema.safeParse(base(reps))
        expect(result.success).toBe(false)
        expect(messages(result)).toContain('validation.invalidReps')
    })
})

describe('bulkSaveWorkoutExercisesSchema reps', () => {
    const wrap = (reps: unknown) => ({ exercises: [base(reps)] })
    it.each(valid)('accepts %s', (reps) => {
        expect(bulkSaveWorkoutExercisesSchema.safeParse(wrap(reps)).success).toBe(true)
    })
    it.each(invalid)('rejects %s with validation.invalidReps', (reps) => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse(wrap(reps))
        expect(result.success).toBe(false)
        expect(messages(result)).toContain('validation.invalidReps')
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
