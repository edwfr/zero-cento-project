import { describe, it, expect } from 'vitest'
import {
    ballastFromTotal,
    ballastForRow,
    traineeWeightFields,
    plannedBallastKg,
    formatBallastLabel,
    formatTrainerLoadLabel,
    previousLoadBase,
    type BodyweightLoadRow,
} from '@/lib/bodyweight-load'
import { percentageOfPreviousWeight } from '@/lib/weight-rounding'

const t = (key: string, opts?: Record<string, unknown>) => key + JSON.stringify(opts ?? {})

const row = (over: Partial<BodyweightLoadRow> = {}): BodyweightLoadRow => ({
    weightType: 'percentage_1rm',
    weight: null,
    effectiveWeight: null,
    rpeWeightMin: null,
    rpeWeightMax: null,
    ...over,
})

describe('ballastFromTotal', () => {
    it('subtracts bodyweight', () => {
        expect(ballastFromTotal(97.5, 80)).toEqual({ kind: 'ballast', kg: 17.5 })
    })
    it('rounds up to 0.5', () => {
        expect(ballastFromTotal(97.3, 80)).toEqual({ kind: 'ballast', kg: 17.5 })
    })
    it('returns bodyweight when not above BW', () => {
        expect(ballastFromTotal(75, 80)).toEqual({ kind: 'bodyweight' })
        expect(ballastFromTotal(80, 80)).toEqual({ kind: 'bodyweight' })
    })
    it('returns missingBodyweight without BW', () => {
        expect(ballastFromTotal(97.5, null)).toEqual({ kind: 'missingBodyweight' })
    })
})

describe('ballastForRow', () => {
    it('rounds an absolute ballast up to 0.5 kg like the labels', () => {
        expect(ballastForRow(row({ weightType: 'absolute', weight: 17.3 }), 80)).toEqual({
            kind: 'ballast',
            kg: 17.5,
        })
    })

    it('uses weight for absolute rows regardless of BW', () => {
        const r = row({ weightType: 'absolute', weight: 20 })
        expect(ballastForRow(r, 80)).toEqual({ kind: 'ballast', kg: 20 })
        expect(ballastForRow(r, null)).toEqual({ kind: 'ballast', kg: 20 })
    })
    it('absolute zero is bodyweight', () => {
        expect(ballastForRow(row({ weightType: 'absolute', weight: 0 }), 80)).toEqual({
            kind: 'bodyweight',
        })
    })
    it('percentage rows use effectiveWeight', () => {
        expect(ballastForRow(row({ effectiveWeight: 97.5 }), 80)).toEqual({
            kind: 'ballast',
            kg: 17.5,
        })
    })
    it('uses the range when no weight', () => {
        const r = row({ rpeWeightMin: 95.5, rpeWeightMax: 99 })
        expect(ballastForRow(r, 80)).toEqual({ kind: 'ballastRange', minKg: 15.5, maxKg: 19 })
        expect(ballastForRow(r, 98)).toEqual({ kind: 'ballastRange', minKg: 0, maxKg: 1 })
        expect(ballastForRow(r, 100)).toEqual({ kind: 'bodyweight' })
        expect(ballastForRow(r, null)).toEqual({ kind: 'missingBodyweight' })
    })
    it('absolute without weight falls back to range', () => {
        const r = row({ weightType: 'absolute', rpeWeightMin: 95.5, rpeWeightMax: 99 })
        expect(ballastForRow(r, 80)).toEqual({ kind: 'ballastRange', minKg: 15.5, maxKg: 19 })
    })
    it('returns null when nothing planned', () => {
        expect(ballastForRow(row(), 80)).toBeNull()
        expect(ballastForRow(row({ rpeWeightMin: 90 }), 80)).toBeNull()
    })
})

describe('traineeWeightFields', () => {
    const base = row({ effectiveWeight: 97.5, rpeWeightMin: 95, rpeWeightMax: 99 })
    it('leaves normal rows untouched', () => {
        expect(traineeWeightFields({ ...base, isBodyweightLoaded: false }, 80)).toEqual({
            effectiveWeight: 97.5,
            rpeWeightMin: 95,
            rpeWeightMax: 99,
            ballast: null,
        })
    })
    it('strips total load on bodyweight-loaded rows', () => {
        expect(traineeWeightFields({ ...base, isBodyweightLoaded: true }, 80)).toEqual({
            effectiveWeight: null,
            rpeWeightMin: null,
            rpeWeightMax: null,
            ballast: { kind: 'ballast', kg: 17.5 },
        })
    })
})

describe('plannedBallastKg', () => {
    it('returns kg only for ballast', () => {
        expect(plannedBallastKg({ kind: 'ballast', kg: 17.5 })).toBe(17.5)
        expect(plannedBallastKg({ kind: 'bodyweight' })).toBe(0)
        expect(plannedBallastKg({ kind: 'missingBodyweight' })).toBe(0)
        expect(plannedBallastKg({ kind: 'ballastRange', minKg: 1, maxKg: 2 })).toBe(0)
        expect(plannedBallastKg(null)).toBe(0)
    })
})

describe('formatBallastLabel', () => {
    it('maps each kind to its key', () => {
        expect(formatBallastLabel({ kind: 'ballast', kg: 17.5 }, t)).toBe(
            'common.bodyweightLoad.ballast{"weight":"17.5"}'
        )
        expect(formatBallastLabel({ kind: 'ballast', kg: 20 }, t)).toBe(
            'common.bodyweightLoad.ballast{"weight":"20"}'
        )
        expect(formatBallastLabel({ kind: 'ballastRange', minKg: 15.5, maxKg: 19 }, t)).toBe(
            'common.bodyweightLoad.ballastRange{"range":"15.5–19"}'
        )
        expect(formatBallastLabel({ kind: 'bodyweight' }, t)).toBe('common.bodyweightLoad.bodyweight{}')
        expect(formatBallastLabel({ kind: 'missingBodyweight' }, t)).toBe(
            'common.bodyweightLoad.missingBodyweight{}'
        )
    })
})

describe('formatTrainerLoadLabel', () => {
    it('percentage with ballast', () => {
        expect(formatTrainerLoadLabel(row({ effectiveWeight: 97.5 }), 80, t)).toEqual({
            label:
                'common.bodyweightLoad.total{"weight":"97.5"} · common.bodyweightLoad.ballast{"weight":"17.5"}',
            missingBodyweight: false,
        })
    })
    it('percentage at or below BW', () => {
        expect(formatTrainerLoadLabel(row({ effectiveWeight: 75 }), 80, t)).toEqual({
            label: 'common.bodyweightLoad.total{"weight":"75"} · common.bodyweightLoad.bodyweight{}',
            missingBodyweight: false,
        })
    })
    it('percentage without BW', () => {
        expect(formatTrainerLoadLabel(row({ effectiveWeight: 97.5 }), null, t)).toEqual({
            label: 'common.bodyweightLoad.total{"weight":"97.5"}',
            missingBodyweight: true,
        })
    })
    it('absolute with and without BW', () => {
        const r = row({ weightType: 'absolute', weight: 20 })
        expect(formatTrainerLoadLabel(r, 80, t)).toEqual({
            label: 'common.bodyweightLoad.ballastWithTotal{"weight":"20","total":"100"}',
            missingBodyweight: false,
        })
        expect(formatTrainerLoadLabel(r, null, t)).toEqual({
            label: 'common.bodyweightLoad.ballast{"weight":"20"}',
            missingBodyweight: true,
        })
    })
    it('absolute zero is bodyweight', () => {
        expect(
            formatTrainerLoadLabel(row({ weightType: 'absolute', weight: 0 }), 80, t)
        ).toEqual({ label: 'common.bodyweightLoad.bodyweight{}', missingBodyweight: false })
    })
    it('range with and without BW', () => {
        const r = row({ rpeWeightMin: 95.5, rpeWeightMax: 99 })
        expect(formatTrainerLoadLabel(r, 80, t)).toEqual({
            label:
                'common.bodyweightLoad.totalRange{"range":"95.5–99"} · common.bodyweightLoad.ballastRange{"range":"15.5–19"}',
            missingBodyweight: false,
        })
        expect(formatTrainerLoadLabel(r, null, t)).toEqual({
            label: 'common.bodyweightLoad.totalRange{"range":"95.5–99"}',
            missingBodyweight: true,
        })
    })
    it('returns null when nothing planned', () => {
        expect(formatTrainerLoadLabel(row(), 80, t)).toBeNull()
    })
})

describe('previousLoadBase', () => {
    const loadedAbsolute = { isBodyweightLoaded: true, previousIsAbsolute: true }

    it('adds bodyweight to a ballasted absolute previous row', () => {
        expect(previousLoadBase(20, { ...loadedAbsolute, bodyweightKg: 80 })).toBe(100)
        expect(percentageOfPreviousWeight(previousLoadBase(20, { ...loadedAbsolute, bodyweightKg: 80 })!, -10)).toBe(90)
    })

    it('returns null when bodyweight is missing for a ballasted absolute previous row', () => {
        expect(previousLoadBase(20, { ...loadedAbsolute, bodyweightKg: null })).toBeNull()
    })

    it('keeps a percentage previous row as is: it already stores the total', () => {
        expect(
            previousLoadBase(117, { isBodyweightLoaded: true, previousIsAbsolute: false, bodyweightKg: 80 })
        ).toBe(117)
    })

    it('keeps non bodyweight-loaded rows as is', () => {
        expect(
            previousLoadBase(100, { isBodyweightLoaded: false, previousIsAbsolute: true, bodyweightKg: 80 })
        ).toBe(100)
    })

    it('returns null for a missing previous weight', () => {
        expect(previousLoadBase(null, { ...loadedAbsolute, bodyweightKg: 80 })).toBeNull()
    })
})
