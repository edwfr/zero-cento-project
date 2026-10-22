import { describe, it, expect } from 'vitest'
import { explainWeight } from '@/lib/weight-explanation'
import type { WeightExplanationInput } from '@/lib/weight-explanation'
import {
    normalizedOneRM,
    recordNormalizedOneRM,
    rpeWeightRange,
} from '@/lib/calculations'
import { ballastFromRange, ballastFromTotal } from '@/lib/bodyweight-load'
import { percentageOfOneRmWeight, percentageOfPreviousWeight } from '@/lib/weight-rounding'

const PR = { weight: 120, reps: 5, recordDate: '2026-09-30' }
const BW = { kg: 80, measuredAt: '2026-10-15' }

function input(overrides: Partial<WeightExplanationInput> = {}): WeightExplanationInput {
    return {
        weightType: 'absolute',
        weight: null,
        reps: '5',
        targetRpe: null,
        isBodyweightLoaded: false,
        latestRecord: PR,
        bodyweight: null,
        previous: null,
        saved: null,
        ...overrides,
    }
}

const kinds = (e: ReturnType<typeof explainWeight>) => e?.steps.map((s) => s.kind)

describe('explainWeight', () => {
    describe('nothing to explain', () => {
        it('absolute on a normal exercise', () => {
            expect(explainWeight(input({ weight: 100 }))).toBeNull()
        })
        it('absolute without weight and RPE', () => {
            expect(explainWeight(input())).toBeNull()
        })
        it('absolute without weight and RPE, bodyweight loaded', () => {
            expect(explainWeight(input({ isBodyweightLoaded: true }))).toBeNull()
        })
        it('percentage without a value', () => {
            expect(explainWeight(input({ weightType: 'percentage_1rm' }))).toBeNull()
            expect(explainWeight(input({ weightType: 'percentage_previous' }))).toBeNull()
        })
    })

    describe('percentage_1rm', () => {
        it('lists record, 1RM and percentage steps', () => {
            const e = explainWeight(input({ weightType: 'percentage_1rm', weight: 75 }))!
            expect(e.missingReason).toBeNull()
            expect(e.result).toEqual({ kind: 'kg', kg: 104.5 })
            expect(e.steps).toHaveLength(3)
            expect(e.steps[0]).toEqual({
                kind: 'latestRecord',
                weightKg: 120,
                reps: 5,
                recordDate: '2026-09-30',
                totalLoad: false,
            })
            expect(e.steps[1]).toMatchObject({
                kind: 'oneRm',
                chart: 'tuchscherer',
                chartPercent: 86.3,
                oneRmKg: 139,
            })
            const oneRm = e.steps[1] as { rawKg: number }
            expect(oneRm.rawKg).toBeCloseTo(139.05, 2)
            expect(e.steps[2]).toMatchObject({
                kind: 'percentOfOneRm',
                percent: 75,
                oneRmKg: 139,
                resultKg: 104.5,
                totalLoad: false,
            })
            expect((e.steps[2] as { rawKg: number }).rawKg).toBeCloseTo(104.25, 2)
        })

        it('uses Epley outside the chart', () => {
            const e = explainWeight(
                input({
                    weightType: 'percentage_1rm',
                    weight: 75,
                    latestRecord: { weight: 100, reps: 15 },
                })
            )!
            const step = e.steps[1]
            expect(step).toMatchObject({ kind: 'oneRm', chart: 'epley', chartPercent: null })
            expect((step as { oneRmKg: number }).oneRmKg).toBe(normalizedOneRM(100, 15))
            expect(e.steps[0]).toMatchObject({ recordDate: null })
        })

        it('without a record', () => {
            const e = explainWeight(
                input({ weightType: 'percentage_1rm', weight: 75, latestRecord: null })
            )!
            expect(e.steps).toEqual([])
            expect(e.result).toBeNull()
            expect(e.missingReason).toBe('noRecord')
        })

        it('normalizes Date and invalid record dates', () => {
            const withDate = explainWeight(
                input({
                    weightType: 'percentage_1rm',
                    weight: 75,
                    latestRecord: { ...PR, recordDate: new Date('2026-09-30T10:00:00Z') },
                })
            )!
            expect(withDate.steps[0]).toMatchObject({ recordDate: '2026-09-30' })
            const invalid = explainWeight(
                input({
                    weightType: 'percentage_1rm',
                    weight: 75,
                    latestRecord: { ...PR, recordDate: 'garbage' },
                })
            )!
            expect(invalid.steps[0]).toMatchObject({ recordDate: null })
        })
    })

    describe('percentage_previous', () => {
        const previous = {
            rowNumber: 2,
            exerciseName: 'Trazioni',
            baseKg: 104.5,
            ballastKg: null,
            range: null,
        }

        it('scales the previous row weight', () => {
            const e = explainWeight(
                input({ weightType: 'percentage_previous', weight: -10, previous })
            )!
            expect(e.steps[0]).toEqual({
                kind: 'previousBase',
                rowNumber: 2,
                exerciseName: 'Trazioni',
                baseKg: 104.5,
                ballastKg: null,
            })
            expect(e.steps[1]).toMatchObject({
                kind: 'percentOfPrevious',
                baseKg: 104.5,
                percent: -10,
                resultKg: 94.5,
            })
            expect((e.steps[1] as { rawKg: number }).rawKg).toBeCloseTo(94.05, 2)
            expect(e.result).toEqual({ kind: 'kg', kg: 94.5 })
        })

        it('without previous row', () => {
            const e = explainWeight(
                input({ weightType: 'percentage_previous', weight: -10, previous: null })
            )!
            expect(e.missingReason).toBe('noPreviousRow')
            expect(e.result).toBeNull()
        })

        it('scales a previous range', () => {
            const e = explainWeight(
                input({
                    weightType: 'percentage_previous',
                    weight: -10,
                    previous: { ...previous, baseKg: null, range: { min: 110.5, max: 115 } },
                })
            )!
            expect(kinds(e)).toEqual(['previousRange', 'percentOfPreviousRange'])
            expect(e.steps[1]).toMatchObject({
                resultMinKg: percentageOfPreviousWeight(110.5, -10),
                resultMaxKg: percentageOfPreviousWeight(115, -10),
            })
            expect(e.result).toEqual({
                kind: 'range',
                minKg: percentageOfPreviousWeight(110.5, -10),
                maxKg: percentageOfPreviousWeight(115, -10),
            })
        })

        it('previous without base nor range', () => {
            const e = explainWeight(
                input({
                    weightType: 'percentage_previous',
                    weight: -10,
                    previous: { ...previous, baseKg: null },
                })
            )!
            expect(e.missingReason).toBe('previousWithoutBase')
        })

        it('bodyweight loaded: previous ballast, total result then bodyweight step', () => {
            const e = explainWeight(
                input({
                    weightType: 'percentage_previous',
                    weight: -10,
                    isBodyweightLoaded: true,
                    bodyweight: BW,
                    previous: { ...previous, baseKg: 100, ballastKg: 20 },
                })
            )!
            expect(e.steps[0]).toMatchObject({ kind: 'previousBase', ballastKg: 20 })
            expect(e.result).toEqual({ kind: 'kg', kg: 90 })
            expect(e.steps[e.steps.length - 1]).toEqual({
                kind: 'bodyweight',
                bodyweightKg: 80,
                measuredAt: '2026-10-15',
                ballast: { kind: 'ballast', kg: 10 },
            })
        })
    })

    describe('RPE range', () => {
        it('explains intensity and tolerance', () => {
            const e = explainWeight(input({ targetRpe: 8 }))!
            expect(kinds(e)).toEqual(['latestRecord', 'oneRm', 'rpeIntensity', 'rpeRange'])
            expect(e.steps[2]).toMatchObject({
                kind: 'rpeIntensity',
                reps: 5,
                rpe: 8,
                chart: 'tuchscherer',
                chartPercent: 81.1,
            })
            expect((e.steps[2] as { centerKg: number }).centerKg).toBeCloseTo(112.73, 2)
            const rangeStep = e.steps[3] as {
                tolerancePercent: number
                rawMinKg: number
                rawMaxKg: number
            }
            expect(rangeStep.tolerancePercent).toBeCloseTo(2, 5)
            expect(rangeStep.rawMinKg).toBeCloseTo(110.47, 2)
            expect(rangeStep.rawMaxKg).toBeCloseTo(114.98, 2)
            expect(e.steps[3]).toMatchObject({ minKg: 110.5, maxKg: 115 })
            const expected = rpeWeightRange(139, 5, 8)!
            expect(e.result).toEqual({ kind: 'range', minKg: expected.min, maxKg: expected.max })
        })

        it('without a record', () => {
            const e = explainWeight(input({ targetRpe: 8, latestRecord: null }))!
            expect(e.missingReason).toBe('noRecord')
        })

        it('reps outside the chart', () => {
            const e = explainWeight(input({ targetRpe: 8, reps: '15' }))!
            expect(kinds(e)).toEqual(['latestRecord', 'oneRm'])
            expect(e.missingReason).toBe('repsOutOfChart')
            expect(e.result).toBeNull()
        })

        it('time-based reps', () => {
            const e = explainWeight(input({ targetRpe: 8, reps: '30"' }))!
            expect(e.missingReason).toBe('repsOutOfChart')
        })

        it('bodyweight loaded range adds ballast range', () => {
            const e = explainWeight(
                input({
                    targetRpe: 8,
                    isBodyweightLoaded: true,
                    latestRecord: { weight: 130, reps: 1 },
                    bodyweight: BW,
                })
            )!
            const range = e.result as { minKg: number; maxKg: number }
            expect(e.steps[2]).toMatchObject({ chart: 'bodyweightLoaded' })
            expect(e.steps[e.steps.length - 1]).toMatchObject({
                kind: 'bodyweight',
                ballast: ballastFromRange(range.minKg, range.maxKg, 80),
            })
        })
    })

    describe('bodyweight loaded', () => {
        const base = {
            weightType: 'percentage_1rm' as const,
            weight: 75,
            isBodyweightLoaded: true,
            latestRecord: { weight: 130, reps: 1, recordDate: '2026-09-30' },
        }

        it('percentage with bodyweight', () => {
            const e = explainWeight(input({ ...base, bodyweight: BW }))!
            expect(e.steps[0]).toMatchObject({ kind: 'latestRecord', totalLoad: true })
            expect(e.steps[1]).toMatchObject({
                kind: 'oneRm',
                chart: 'bodyweightLoaded',
                oneRmKg: 130,
            })
            expect(e.steps[2]).toMatchObject({
                kind: 'percentOfOneRm',
                resultKg: 97.5,
                totalLoad: true,
            })
            expect(e.steps[3]).toEqual({
                kind: 'bodyweight',
                bodyweightKg: 80,
                measuredAt: '2026-10-15',
                ballast: { kind: 'ballast', kg: 17.5 },
            })
        })

        it('missing bodyweight keeps the total', () => {
            const e = explainWeight(input({ ...base, bodyweight: null }))!
            expect(e.steps[e.steps.length - 1]).toEqual({ kind: 'missingBodyweight' })
            expect(e.result).toEqual({ kind: 'kg', kg: 97.5 })
        })

        it('total below bodyweight', () => {
            const e = explainWeight(input({ ...base, weight: 50, bodyweight: BW }))!
            expect(e.steps[e.steps.length - 1]).toMatchObject({
                kind: 'bodyweight',
                ballast: { kind: 'bodyweight' },
            })
            expect((e.steps[e.steps.length - 1] as { ballast: unknown }).ballast).toEqual(
                ballastFromTotal(65, 80)
            )
        })

        it('absolute ballast with bodyweight', () => {
            const e = explainWeight(
                input({ weightType: 'absolute', weight: 20, isBodyweightLoaded: true, bodyweight: BW })
            )!
            expect(e.steps).toEqual([
                {
                    kind: 'absoluteBallast',
                    ballastKg: 20,
                    bodyweightKg: 80,
                    measuredAt: '2026-10-15',
                    totalKg: 100,
                },
            ])
            expect(e.result).toEqual({ kind: 'kg', kg: 100 })
        })

        it('absolute ballast without bodyweight', () => {
            const e = explainWeight(
                input({ weightType: 'absolute', weight: 20, isBodyweightLoaded: true })
            )!
            expect(e.steps).toEqual([
                {
                    kind: 'absoluteBallast',
                    ballastKg: 20,
                    bodyweightKg: null,
                    measuredAt: null,
                    totalKg: null,
                },
            ])
            expect(e.result).toBeNull()
        })

        it('absolute ballast zero', () => {
            const e = explainWeight(
                input({ weightType: 'absolute', weight: 0, isBodyweightLoaded: true, bodyweight: BW })
            )!
            expect(e.steps[0]).toMatchObject({ kind: 'absoluteBallast', ballastKg: 0, totalKg: 80 })
        })
    })

    describe('saved value', () => {
        const pct = { weightType: 'percentage_1rm' as const, weight: 75 }

        it('differs from the recalculation', () => {
            const e = explainWeight(input({ ...pct, saved: { kind: 'kg', kg: 112.5 } }))!
            expect(e.steps[e.steps.length - 1]).toEqual({
                kind: 'savedDiffers',
                saved: { kind: 'kg', kg: 112.5 },
                current: { kind: 'kg', kg: 104.5 },
            })
        })

        it('equal value adds no step', () => {
            const e = explainWeight(input({ ...pct, saved: { kind: 'kg', kg: 104.5 } }))!
            expect(kinds(e)).not.toContain('savedDiffers')
        })

        it('no record', () => {
            const e = explainWeight(
                input({ ...pct, latestRecord: null, saved: { kind: 'kg', kg: 112.5 } })
            )!
            expect(e.missingReason).toBe('noRecord')
            expect(e.steps).toEqual([
                { kind: 'savedDiffers', saved: { kind: 'kg', kg: 112.5 }, current: null },
            ])
        })

        it('different ranges', () => {
            const e = explainWeight(
                input({ targetRpe: 8, saved: { kind: 'range', minKg: 100, maxKg: 105 } })
            )!
            expect(e.steps[e.steps.length - 1]).toMatchObject({
                kind: 'savedDiffers',
                saved: { kind: 'range', minKg: 100, maxKg: 105 },
                current: { kind: 'range', minKg: 110.5, maxKg: 115 },
            })
        })

        it('same range adds no step', () => {
            const e = explainWeight(
                input({ targetRpe: 8, saved: { kind: 'range', minKg: 110.5, maxKg: 115 } })
            )!
            expect(kinds(e)).not.toContain('savedDiffers')
        })

        it('kg saved against a range result differs', () => {
            const e = explainWeight(input({ targetRpe: 8, saved: { kind: 'kg', kg: 110.5 } }))!
            expect(kinds(e)).toContain('savedDiffers')
        })
    })

    describe('same as calculation', () => {
        const table = [60, 72.5, 90].flatMap((pct) =>
            [1, 3, 8].flatMap((reps) =>
                [false, true].map((loaded) => ({ pct, reps, loaded }))
            )
        )

        it.each(table)('%1RM $pct, PR reps $reps, loaded $loaded', ({ pct, reps, loaded }) => {
            const record = { weight: 110, reps }
            const e = explainWeight(
                input({
                    weightType: 'percentage_1rm',
                    weight: pct,
                    isBodyweightLoaded: loaded,
                    latestRecord: record,
                })
            )!
            const oneRm = recordNormalizedOneRM({
                exerciseId: 'x',
                ...record,
                exercise: { isBodyweightLoaded: loaded },
            })
            expect(e.result).toEqual({ kind: 'kg', kg: percentageOfOneRmWeight(oneRm, pct) })
        })

        it.each([6, 7.5, 9])('range at RPE %s', (rpe) => {
            const e = explainWeight(input({ targetRpe: rpe, reps: '5' }))!
            const expected = rpeWeightRange(normalizedOneRM(120, 5), 5, rpe)!
            expect(e.result).toEqual({ kind: 'range', minKg: expected.min, maxKg: expected.max })
        })
    })
})
