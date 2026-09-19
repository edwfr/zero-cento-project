import { describe, it, expect } from 'vitest'
import {
    EXERCISE_TYPES,
    EXERCISE_TYPE_META,
    DEFAULT_EXERCISE_TYPE,
    isExerciseType,
    compareExerciseType,
} from '@/lib/exercise-type'

describe('exercise-type', () => {
    it('lists the three types in display order', () => {
        expect(EXERCISE_TYPES).toEqual(['fundamental', 'accessory', 'postural'])
    })

    it('has complete metadata for every type', () => {
        for (const type of EXERCISE_TYPES) {
            const meta = EXERCISE_TYPE_META[type]
            expect(meta.labelKey).toBe(`common:exerciseTypes.${type}.label`)
            expect(meta.pluralKey).toBe(`common:exerciseTypes.${type}.plural`)
            expect(meta.shortKey).toBe(`common:exerciseTypes.${type}.short`)
            expect(meta.formLabelKey).toBeTruthy()
            expect(meta.badgeClass).toMatch(/^border-\w+-200 bg-\w+-100 text-\w+-800$/)
        }
    })

    it('uses the SBD label in forms for fundamental only', () => {
        expect(EXERCISE_TYPE_META.fundamental.formLabelKey).toBe('trainer:exercises.fundamentalSBD')
        expect(EXERCISE_TYPE_META.accessory.formLabelKey).toBe(EXERCISE_TYPE_META.accessory.labelKey)
        expect(EXERCISE_TYPE_META.postural.formLabelKey).toBe(EXERCISE_TYPE_META.postural.labelKey)
    })

    it('uses emerald for postural', () => {
        expect(EXERCISE_TYPE_META.postural.badgeClass).toBe(
            'border-emerald-200 bg-emerald-100 text-emerald-800'
        )
    })

    it('defaults to accessory', () => {
        expect(DEFAULT_EXERCISE_TYPE).toBe('accessory')
    })

    it('isExerciseType accepts known values and rejects others', () => {
        expect(isExerciseType('postural')).toBe(true)
        expect(isExerciseType('fundamental')).toBe(true)
        expect(isExerciseType('compound')).toBe(false)
        expect(isExerciseType(undefined)).toBe(false)
        expect(isExerciseType(1)).toBe(false)
    })

    it('sorts fundamental < accessory < postural, unknown last', () => {
        const input = ['postural', undefined, 'accessory', 'fundamental', 'weird']
        const sorted = [...input].sort(compareExerciseType)
        expect(sorted.slice(0, 3)).toEqual(['fundamental', 'accessory', 'postural'])
        expect(sorted.slice(3)).toEqual(expect.arrayContaining([undefined, 'weird']))
    })

    it('returns 0 for equal types', () => {
        expect(compareExerciseType('postural', 'postural')).toBe(0)
    })
})
