import { describe, it, expect } from 'vitest'
import { workoutTemplateSchema } from '@/schemas/workout-template'

const EX = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'
const ex = (over: Record<string, unknown> = {}) => ({
    exerciseId: EX,
    sets: 3,
    reps: '8',
    restTime: 'm2',
    ...over,
})
const make = (over: Record<string, unknown> = {}) => ({
    name: 'Forza A',
    workoutsPerWeek: 2,
    workouts: [
        { dayIndex: 0, exercises: [ex()] },
        { dayIndex: 1, exercises: [ex({ reps: '8/10' })] },
    ],
    ...over,
})
const msgs = (input: unknown) => {
    const r = workoutTemplateSchema.safeParse(input)
    return r.success ? [] : r.error.issues.map((i) => i.message)
}
const withEx = (e: Record<string, unknown>) =>
    make({
        workoutsPerWeek: 1,
        workouts: [{ dayIndex: 0, exercises: [ex(e)] }],
    })

describe('workoutTemplateSchema', () => {
    it('accepts a valid 2-day template', () => {
        expect(workoutTemplateSchema.safeParse(make()).success).toBe(true)
    })
    it.each(['', '   '])('rejects empty name %j', (name) => {
        expect(msgs(make({ name }))).toContain('validation.templateNameRequired')
    })
    it('rejects name of 101 chars', () => {
        expect(msgs(make({ name: 'a'.repeat(101) }))).toContain('validation.templateNameTooLong')
    })
    it.each([0, 8])('rejects workoutsPerWeek %i', (n) => {
        expect(workoutTemplateSchema.safeParse(make({ workoutsPerWeek: n })).success).toBe(false)
    })
    it.each([1, 7])('accepts workoutsPerWeek %i', (n) => {
        const workouts = Array.from({ length: n }, (_, i) => ({ dayIndex: i, exercises: [] }))
        expect(workoutTemplateSchema.safeParse(make({ workoutsPerWeek: n, workouts })).success).toBe(true)
    })
    it('rejects workouts length mismatch', () => {
        expect(msgs(make({ workoutsPerWeek: 3 }))).toContain('validation.templateWorkoutsMismatch')
    })
    it.each([
        [[0, 2]],
        [[0, 0]],
    ])('rejects dayIndex set %j', (days) => {
        const workouts = days.map((d) => ({ dayIndex: d, exercises: [] }))
        expect(msgs(make({ workouts }))).toContain('validation.templateInvalidDayIndex')
    })
    it.each([0, 1.5])('rejects sets %s', (sets) => {
        expect(workoutTemplateSchema.safeParse(withEx({ sets })).success).toBe(false)
    })
    it.each(['8', '8/10'])('accepts reps %s', (reps) => {
        expect(workoutTemplateSchema.safeParse(withEx({ reps })).success).toBe(true)
    })
    it.each(['abc', '', '10-8', '8-10'])('rejects reps %j', (reps) => {
        expect(msgs(withEx({ reps }))).toContain('validation.invalidReps')
    })
    it.each([
        ['10/8', 'validation.repsRangeOrder'],
        ['60', 'validation.repsLooksLikeSeconds'],
    ])('rejects reps %j with %s', (reps, key) => {
        expect(msgs(withEx({ reps }))).toContain(key)
    })
    it('rejects restTime m4', () => {
        expect(workoutTemplateSchema.safeParse(withEx({ restTime: 'm4' })).success).toBe(false)
    })
    it.each(['s30', 'm1', 'm1s30', 'm2', 'm3', 'm5'])('accepts restTime %s', (restTime) => {
        expect(workoutTemplateSchema.safeParse(withEx({ restTime })).success).toBe(true)
    })
    it('rejects invalid exerciseId', () => {
        expect(workoutTemplateSchema.safeParse(withEx({ exerciseId: 'nope' })).success).toBe(false)
    })
    it('allows a workout with zero exercises', () => {
        const workouts = [{ dayIndex: 0, exercises: [] }, { dayIndex: 1, exercises: [] }]
        expect(workoutTemplateSchema.safeParse(make({ workouts })).success).toBe(true)
    })
})
