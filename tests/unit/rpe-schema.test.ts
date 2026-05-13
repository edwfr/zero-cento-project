import { describe, it, expect } from 'vitest'
import { setPerformedSchema, workoutExerciseRpeSchema } from '@/schemas/feedback'

describe('workoutExerciseRpeSchema', () => {
    it('accepts a valid RPE value', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 7.5 })
        expect(result.success).toBe(true)
    })

    it('accepts null RPE (clear value)', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: null })
        expect(result.success).toBe(true)
    })

    it('rejects RPE below 5.0', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 4.5 })
        expect(result.success).toBe(false)
    })

    it('rejects RPE above 10.0', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 10.5 })
        expect(result.success).toBe(false)
    })

    it('rejects RPE not in 0.5 steps', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 7.3 })
        expect(result.success).toBe(false)
    })
})

describe('setPerformedSchema.actualRpe', () => {
    const baseSet = { setNumber: 1, completed: true, reps: 8, weight: 60 }

    it('accepts a valid actualRpe', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 8.5 })
        expect(result.success).toBe(true)
    })

    it('accepts null actualRpe', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: null })
        expect(result.success).toBe(true)
    })

    it('accepts omitted actualRpe', () => {
        const result = setPerformedSchema.safeParse(baseSet)
        expect(result.success).toBe(true)
    })

    it('rejects actualRpe below 5.0', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 4.5 })
        expect(result.success).toBe(false)
    })

    it('rejects actualRpe above 10.0', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 10.5 })
        expect(result.success).toBe(false)
    })

    it('rejects actualRpe not on 0.5 step', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 7.3 })
        expect(result.success).toBe(false)
    })

    it('rejects non-numeric actualRpe', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: '8.5' })
        expect(result.success).toBe(false)
    })
})
