import { describe, it, expect } from 'vitest'
import {
    computeExerciseGroupColors,
    mergeDirtyPersistedRows,
    pruneMissingDirtyRowIds,
} from '@/app/trainer/programs/[id]/edit/row-utils'

type MinimalRow = { id: string; exerciseId: string }
type EditableRow = {
    id: string
    workoutId: string
    exerciseId: string
    variant: string
    sets: string
    reps: string
    targetRpe: string
    weight: string
    isWarmup: boolean
    isJumpSet: boolean
    isSuperSet: boolean
    order: number
    restTime: string
    notes: string | null
    isDraft: boolean
}

const row = (id: string, exerciseId: string): MinimalRow => ({ id, exerciseId })

const editableRow = (
    id: string,
    overrides: Partial<EditableRow> = {}
): EditableRow => ({
    id,
    workoutId: 'workout-1',
    exerciseId: 'exercise-1',
    variant: '',
    sets: '3',
    reps: '8',
    targetRpe: '7',
    weight: '80',
    isWarmup: false,
    isJumpSet: false,
    isSuperSet: false,
    order: 1,
    restTime: 'm2',
    notes: null,
    isDraft: false,
    ...overrides,
})

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

describe('mergeDirtyPersistedRows', () => {
    it('returns server rows unchanged when there are no dirty persisted rows', () => {
        const serverRowsById = {
            r1: editableRow('r1', { targetRpe: '8' }),
        }

        const merged = mergeDirtyPersistedRows({
            serverRowsById,
            currentRowsById: {
                r1: editableRow('r1', { targetRpe: '9' }),
            },
            dirtyPersistedRowIds: new Set(),
        })

        expect(merged).toEqual(serverRowsById)
    })

    it('preserves local editable fields and order for dirty persisted rows', () => {
        const serverRowsById = {
            r1: editableRow('r1', {
                exerciseId: 'exercise-server',
                targetRpe: '7',
                weight: '70',
                order: 3,
                restTime: 'm3',
            }),
        }

        const currentRowsById = {
            r1: editableRow('r1', {
                exerciseId: 'exercise-local',
                targetRpe: '9.5',
                weight: '85',
                order: 1,
                restTime: 'm1',
                notes: 'keep me',
            }),
        }

        const merged = mergeDirtyPersistedRows({
            serverRowsById,
            currentRowsById,
            dirtyPersistedRowIds: new Set(['r1']),
        })

        expect(merged.r1.exerciseId).toBe('exercise-local')
        expect(merged.r1.targetRpe).toBe('9.5')
        expect(merged.r1.weight).toBe('85')
        expect(merged.r1.restTime).toBe('m1')
        expect(merged.r1.notes).toBe('keep me')
        expect(merged.r1.order).toBe(1)
    })

    it('ignores dirty IDs that are missing from server rows', () => {
        const serverRowsById = {
            r1: editableRow('r1', { targetRpe: '8' }),
        }

        const merged = mergeDirtyPersistedRows({
            serverRowsById,
            currentRowsById: {
                r2: editableRow('r2', { targetRpe: '10' }),
            },
            dirtyPersistedRowIds: new Set(['r2']),
        })

        expect(merged).toEqual(serverRowsById)
    })

    it('does not merge draft rows even if their ID is marked dirty', () => {
        const serverRowsById = {
            r1: editableRow('r1', { targetRpe: '8' }),
        }

        const merged = mergeDirtyPersistedRows({
            serverRowsById,
            currentRowsById: {
                r1: editableRow('r1', {
                    targetRpe: '10',
                    isDraft: true,
                }),
            },
            dirtyPersistedRowIds: new Set(['r1']),
        })

        expect(merged).toEqual(serverRowsById)
    })
})

describe('pruneMissingDirtyRowIds', () => {
    it('keeps only dirty IDs that still exist on the server snapshot', () => {
        const pruned = pruneMissingDirtyRowIds(
            new Set(['r1', 'r2', 'r3']),
            new Set(['r1', 'r3', 'r4'])
        )

        expect(Array.from(pruned).sort()).toEqual(['r1', 'r3'])
    })

    it('returns an empty set when no dirty IDs are still present', () => {
        const pruned = pruneMissingDirtyRowIds(
            new Set(['r1']),
            new Set(['r2'])
        )

        expect(Array.from(pruned)).toEqual([])
    })
})
