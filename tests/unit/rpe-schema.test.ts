import { describe, it, expect } from 'vitest'
import { workoutExerciseRpeSchema } from '@/schemas/feedback'

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
