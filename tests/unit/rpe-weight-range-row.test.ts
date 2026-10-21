import { describe, it, expect } from 'vitest'
import { rpeWeightRangeForRow } from '@/app/trainer/programs/[id]/edit/rpe-weight-range'

const baseRow = { weight: '', reps: '5', targetRpe: '8', oneRm: 139 }

describe('rpeWeightRangeForRow', () => {
    it('proposes the range for an empty weight with reps, RPE and a 1RM', () => {
        expect(rpeWeightRangeForRow(baseRow)).toEqual({ min: 110.5, max: 115 })
    })

    it.each(['100', '75%', '-10%'])('returns null when the weight %s is set', (weight) => {
        expect(rpeWeightRangeForRow({ ...baseRow, weight })).toBeNull()
    })

    it('returns null without a target RPE', () => {
        expect(rpeWeightRangeForRow({ ...baseRow, targetRpe: '' })).toBeNull()
    })

    it('returns null for a non-numeric target RPE', () => {
        expect(rpeWeightRangeForRow({ ...baseRow, targetRpe: 'abc' })).toBeNull()
    })

    it('returns null without a 1RM', () => {
        expect(rpeWeightRangeForRow({ ...baseRow, oneRm: undefined })).toBeNull()
    })

    it('uses the minimum of a reps range', () => {
        expect(rpeWeightRangeForRow({ ...baseRow, reps: '8/10' })).toEqual(
            rpeWeightRangeForRow({ ...baseRow, reps: '8' })
        )
        expect(rpeWeightRangeForRow({ ...baseRow, reps: '8' })).not.toBeNull()
    })

    it.each(['30"', 'max', '13'])('returns null for reps %s', (reps) => {
        expect(rpeWeightRangeForRow({ ...baseRow, reps })).toBeNull()
    })

    it('treats a whitespace-only weight as empty', () => {
        expect(rpeWeightRangeForRow({ ...baseRow, weight: '   ' })).toEqual({ min: 110.5, max: 115 })
    })
})
