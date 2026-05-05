import { describe, it, expect } from 'vitest'
import { buildStructureRowsForWorkout } from '@/app/trainer/programs/[id]/edit/structure-utils'

describe('buildStructureRowsForWorkout', () => {
    it('returns 4 empty rows when sourceExercises is empty', () => {
        const rows = buildStructureRowsForWorkout(0, [])
        expect(rows).toHaveLength(4)
        rows.forEach((row) => {
            expect(row.exerciseId).toBe('')
            expect(row.id).toMatch(/^structure-0-default-\d$/)
        })
    })

    it('returns 4 empty rows for a different workoutIndex', () => {
        const rows = buildStructureRowsForWorkout(2, [])
        expect(rows).toHaveLength(4)
        rows.forEach((row) => {
            expect(row.id).toMatch(/^structure-2-default-\d$/)
        })
    })

    it('maps from sourceExercises when non-empty', () => {
        const source = [
            { id: 'we-1', exercise: { id: 'ex-1' }, isSkeletonExercise: false },
            { id: 'we-2', exercise: { id: 'ex-2' }, isSkeletonExercise: false },
        ]
        const rows = buildStructureRowsForWorkout(1, source)
        expect(rows).toHaveLength(2)
        expect(rows[0]).toEqual({ id: 'structure-1-we-1-0', exerciseId: 'ex-1' })
        expect(rows[1]).toEqual({ id: 'structure-1-we-2-1', exerciseId: 'ex-2' })
    })

    it('returns unique ids across rows', () => {
        const rows = buildStructureRowsForWorkout(0, [])
        const ids = rows.map((r) => r.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
