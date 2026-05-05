import { describe, it, expect } from 'vitest'
import { computeExerciseGroupColors } from '@/app/trainer/programs/[id]/edit/row-utils'

type MinimalRow = { id: string; exerciseId: string }

const row = (id: string, exerciseId: string): MinimalRow => ({ id, exerciseId })

describe('computeExerciseGroupColors', () => {
    it('returns empty map for empty rows', () => {
        expect(computeExerciseGroupColors([])).toEqual(new Map())
    })

    it('single exercise: row gets even (0)', () => {
        const result = computeExerciseGroupColors([row('r1', 'ex1')])
        expect(result.get('r1')).toBe('even')
    })

    it('two consecutive rows with same exercise: both even', () => {
        const result = computeExerciseGroupColors([
            row('r1', 'ex1'),
            row('r2', 'ex1'),
        ])
        expect(result.get('r1')).toBe('even')
        expect(result.get('r2')).toBe('even')
    })

    it('two different exercises: first even, second odd', () => {
        const result = computeExerciseGroupColors([
            row('r1', 'ex1'),
            row('r2', 'ex2'),
        ])
        expect(result.get('r1')).toBe('even')
        expect(result.get('r2')).toBe('odd')
    })

    it('ex1, ex2, ex2, ex3: even, odd, odd, even', () => {
        const result = computeExerciseGroupColors([
            row('r1', 'ex1'),
            row('r2', 'ex2'),
            row('r3', 'ex2'),
            row('r4', 'ex3'),
        ])
        expect(result.get('r1')).toBe('even')
        expect(result.get('r2')).toBe('odd')
        expect(result.get('r3')).toBe('odd')
        expect(result.get('r4')).toBe('even')
    })

    it('rows with empty exerciseId are excluded from the map', () => {
        const result = computeExerciseGroupColors([
            row('r1', ''),
            row('r2', 'ex1'),
        ])
        expect(result.has('r1')).toBe(false)
        expect(result.get('r2')).toBe('even')
    })
})
