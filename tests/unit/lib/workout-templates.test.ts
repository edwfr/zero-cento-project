import { describe, it, expect } from 'vitest'
import {
    countTemplateExercises,
    buildWeek1ExerciseRows,
    buildSkeletonRows,
    type TemplateWorkoutLike,
} from '@/lib/workout-templates'

const e = (exerciseId: string, order: number) => ({
    exerciseId,
    order,
    sets: 3,
    reps: '8-10',
    restTime: 'm2' as const,
})
const template: TemplateWorkoutLike[] = [
    { dayIndex: 0, exercises: [e('a', 0), e('b', 1)] },
    { dayIndex: 1, exercises: [e('c', 0)] },
]
const week1 = [
    { id: 'w1', dayIndex: 1 },
    { id: 'w2', dayIndex: 2 },
]

describe('countTemplateExercises', () => {
    it('sums exercises', () => {
        expect(
            countTemplateExercises([
                { dayIndex: 0, exercises: [e('a', 0), e('b', 1)] },
                { dayIndex: 1, exercises: [e('a', 0), e('b', 1), e('c', 2)] },
            ])
        ).toBe(5)
    })
    it('returns 0 for empty workouts', () => {
        expect(countTemplateExercises([{ dayIndex: 0, exercises: [] }])).toBe(0)
    })
})

describe('buildWeek1ExerciseRows', () => {
    it('converts 0-based template order to 1-based workout exercise order', () => {
        const rows = buildWeek1ExerciseRows(template, week1)
        expect(rows.map((r) => r.order)).toEqual([1, 2, 1])
    })
    it('maps template day d to workout dayIndex d+1 with null loads', () => {
        const rows = buildWeek1ExerciseRows(template, week1)
        expect(rows).toHaveLength(3)
        expect(rows.map((r) => r.workoutId)).toEqual(['w1', 'w1', 'w2'])
        expect(rows[1]).toEqual({
            workoutId: 'w1',
            exerciseId: 'b',
            order: 2,
            sets: 3,
            reps: '8-10',
            restTime: 'm2',
            weightType: 'absolute',
            weight: null,
            effectiveWeight: null,
            targetRpe: null,
            variant: null,
            notes: null,
            isWarmup: false,
            isJumpSet: false,
            isSuperSet: false,
            isCompleted: false,
        })
    })
    it('throws when no matching program workout', () => {
        expect(() =>
            buildWeek1ExerciseRows([{ dayIndex: 3, exercises: [e('a', 0)] }], week1)
        ).toThrow('Week 1 workout not found for dayIndex 3')
    })
})

describe('buildSkeletonRows', () => {
    it('keeps 0-based dayIndex', () => {
        expect(buildSkeletonRows('prog-1', template)).toEqual([
            { programId: 'prog-1', dayIndex: 0, order: 0, exerciseId: 'a' },
            { programId: 'prog-1', dayIndex: 0, order: 1, exerciseId: 'b' },
            { programId: 'prog-1', dayIndex: 1, order: 0, exerciseId: 'c' },
        ])
    })
    it('returns [] for empty template', () => {
        expect(buildSkeletonRows('prog-1', [])).toEqual([])
    })
})
