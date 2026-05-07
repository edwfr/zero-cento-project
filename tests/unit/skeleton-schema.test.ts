import { describe, it, expect } from 'vitest'
import { putSkeletonSchema, skeletonRowSchema } from '@/schemas/skeleton'

describe('skeletonRowSchema', () => {
    it('accepts valid skeleton row', () => {
        const result = skeletonRowSchema.safeParse({
            dayIndex: 0,
            order: 1,
            exerciseId: '550e8400-e29b-41d4-a716-446655440000',
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid dayIndex', () => {
        const result = skeletonRowSchema.safeParse({
            dayIndex: -1,
            order: 0,
            exerciseId: '550e8400-e29b-41d4-a716-446655440000',
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid exerciseId', () => {
        const result = skeletonRowSchema.safeParse({
            dayIndex: 0,
            order: 0,
            exerciseId: 'not-a-uuid',
        })
        expect(result.success).toBe(false)
    })
})

describe('putSkeletonSchema', () => {
    it('accepts valid skeleton payload', () => {
        const result = putSkeletonSchema.safeParse({
            rows: [
                {
                    dayIndex: 0,
                    order: 0,
                    exerciseId: '550e8400-e29b-41d4-a716-446655440000',
                },
                {
                    dayIndex: 0,
                    order: 1,
                    exerciseId: '550e8400-e29b-41d4-a716-446655440001',
                },
            ],
        })
        expect(result.success).toBe(true)
    })

    it('accepts empty rows array', () => {
        const result = putSkeletonSchema.safeParse({
            rows: [],
        })
        expect(result.success).toBe(true)
    })

    it('defaults rows to empty array', () => {
        const result = putSkeletonSchema.safeParse({})
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.rows).toEqual([])
        }
    })

    it('rejects invalid rows', () => {
        const result = putSkeletonSchema.safeParse({
            rows: [
                {
                    dayIndex: 0,
                    order: 0,
                    exerciseId: 'invalid-uuid',
                },
            ],
        })
        expect(result.success).toBe(false)
    })
})
