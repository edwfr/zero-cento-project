import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    CALCULATION_ERROR_KEYS,
    calculateVolume,
    calculateTrainingSets,
    parseReps,
    estimateOneRM,
    estimateOneRMFromRpeTable,
    intensityFromRpeChart,
    normalizedOneRM,
    resolveEffectiveWeight,
    loadTraineeOneRmMap,
    latestPersonalRecordByExercise,
    latestNormalizedOneRMByExercise,
} from '@/lib/calculations'
import { prisma } from '@/lib/prisma'

describe('calculateVolume', () => {
    it('returns sets × reps × weight × coefficient', () => {
        expect(calculateVolume(3, 8, 100, 1)).toBe(2400)
    })

    it('applies fractional coefficient correctly', () => {
        expect(calculateVolume(4, 10, 80, 0.5)).toBe(1600)
    })

    it('returns 0 when weight is 0', () => {
        expect(calculateVolume(3, 8, 0, 1)).toBe(0)
    })

    it('returns 0 when coefficient is 0', () => {
        expect(calculateVolume(3, 8, 100, 0)).toBe(0)
    })
})

describe('calculateTrainingSets', () => {
    it('returns 0 for warmup sets', () => {
        expect(calculateTrainingSets(3, 1, true)).toBe(0)
    })

    it('returns sets × coefficient for non-warmup', () => {
        expect(calculateTrainingSets(4, 0.75, false)).toBe(3)
    })

    it('returns sets × 1 for full-contribution exercise', () => {
        expect(calculateTrainingSets(5, 1, false)).toBe(5)
    })

    it('still returns 0 for warmup even with coefficient', () => {
        expect(calculateTrainingSets(3, 0.5, true)).toBe(0)
    })
})

describe('parseReps', () => {
    it('parses simple integer string', () => {
        expect(parseReps('8')).toBe(8)
    })

    it('parses range "8/10" and returns the minimum', () => {
        expect(parseReps('8/10')).toBe(8)
    })

    it('returns 0 for seconds and max', () => {
        expect(parseReps('30"')).toBe(0)
        expect(parseReps('max')).toBe(0)
    })

    it('returns 0 for empty string', () => {
        expect(parseReps('')).toBe(0)
    })

    it('returns 0 for non-numeric string', () => {
        expect(parseReps('AMRAP')).toBe(0)
    })

    it('parses "12" correctly', () => {
        expect(parseReps('12')).toBe(12)
    })
})

describe('estimateOneRM', () => {
    it('returns weight directly when reps = 1', () => {
        expect(estimateOneRM(100, 1)).toBe(100)
    })

    it('uses Epley formula: weight × (1 + reps/30)', () => {
        // 100 × (1 + 10/30) = 100 × 1.333... ≈ 133.33
        expect(estimateOneRM(100, 10)).toBeCloseTo(133.33, 1)
    })

    it('handles reps = 5 correctly', () => {
        // 80 × (1 + 5/30) = 80 × 1.1667 ≈ 93.33
        expect(estimateOneRM(80, 5)).toBeCloseTo(93.33, 1)
    })

    it('returns higher estimate for more reps at same weight', () => {
        const light = estimateOneRM(100, 3)
        const heavy = estimateOneRM(100, 12)
        expect(heavy).toBeGreaterThan(light)
    })
})

describe('estimateOneRMFromRpeTable', () => {
    it('returns input weight for 1 rep at RPE 10', () => {
        expect(estimateOneRMFromRpeTable(100, 1, 10)).toBe(100)
    })

    it('normalizes 5 reps @ RPE 10 using Mike T chart', () => {
        // 100 / 0.863 = 115.87...
        expect(estimateOneRMFromRpeTable(100, 5, 10)).toBeCloseTo(115.87, 2)
    })

    it('supports lower RPE values from the same chart', () => {
        // 100 / 0.837 = 119.47...
        expect(estimateOneRMFromRpeTable(100, 5, 9)).toBeCloseTo(119.47, 2)
    })

    it('matches chart values for high-rep rows', () => {
        // 100 / 0.68 = 147.05...
        expect(estimateOneRMFromRpeTable(100, 12, 10)).toBeCloseTo(147.06, 2)
    })

    it('falls back to Epley when reps are outside chart range', () => {
        expect(estimateOneRMFromRpeTable(100, 15, 10)).toBeCloseTo(estimateOneRM(100, 15), 5)
    })
})

describe('intensityFromRpeChart', () => {
    it('returns 100 for 1 rep @ RPE 10', () => {
        expect(intensityFromRpeChart(1, 10)).toBe(100)
    })

    it('reads 6 reps @ RPE 8 as 78.6', () => {
        expect(intensityFromRpeChart(6, 8)).toBe(78.6)
    })

    it('reads 2 reps @ RPE 8.5 as 90.7', () => {
        expect(intensityFromRpeChart(2, 8.5)).toBe(90.7)
    })

    it('normalizes rpe to nearest 0.5 step', () => {
        expect(intensityFromRpeChart(5, 8.4)).toBe(intensityFromRpeChart(5, 8.5))
    })

    it('returns null when reps exceed the chart (>12)', () => {
        expect(intensityFromRpeChart(15, 10)).toBeNull()
    })

    it('returns null when RPE is below the chart (<5)', () => {
        expect(intensityFromRpeChart(5, 4.5)).toBeNull()
    })

    it('returns null on non-finite inputs', () => {
        expect(intensityFromRpeChart(Number.NaN, 10)).toBeNull()
        expect(intensityFromRpeChart(5, Number.NaN)).toBeNull()
    })
})

describe('normalizedOneRM', () => {
    it('returns input weight for 1 rep', () => {
        expect(normalizedOneRM(100, 1)).toBe(100)
    })

    it('rounds to nearest 0.5 kg', () => {
        // 100 / 0.863 = 115.8748... → 116 (nearest 0.5)
        expect(normalizedOneRM(100, 5)).toBe(116)
    })

    it('produces a multiple of 0.5', () => {
        const value = normalizedOneRM(82.5, 7)
        expect(value * 2).toBe(Math.round(value * 2))
    })

    it('matches estimateOneRMFromRpeTable at RPE 10 (rounded to 0.5)', () => {
        const reps = 8
        const weight = 90
        const expected = Math.round(estimateOneRMFromRpeTable(weight, reps, 10) * 2) / 2
        expect(normalizedOneRM(weight, reps)).toBe(expected)
    })
})

// ────────────────────────────────────────────────────────────────────────────
// resolveEffectiveWeight — the batched resolver used by the API routes
// ────────────────────────────────────────────────────────────────────────────

type ResolverExercise = Parameters<typeof resolveEffectiveWeight>[0]

const EX_1 = 'exercise-1'
const WORKOUT_1 = 'workout-1'

const makeWorkoutExercise = (overrides: Partial<ResolverExercise> = {}): ResolverExercise => ({
    id: 'we-1',
    workoutId: WORKOUT_1,
    exerciseId: EX_1,
    order: 1,
    sets: 3,
    reps: '5',
    weightType: 'absolute',
    weight: 100,
    ...overrides,
} as ResolverExercise)

describe('resolveEffectiveWeight', () => {
    it('returns the stored weight for an absolute exercise', () => {
        expect(resolveEffectiveWeight(makeWorkoutExercise(), new Map(), [])).toBe(100)
    })

    it('returns null for an unknown weightType', () => {
        const exercise = makeWorkoutExercise({ weightType: 'unsupported' as ResolverExercise['weightType'] })

        expect(resolveEffectiveWeight(exercise, new Map(), [])).toBeNull()
    })

    describe('percentage_1rm', () => {
        it('applies the percentage to the 1RM of the exercise', () => {
            const oneRmMap = new Map([[EX_1, 100]])
            const exercise = makeWorkoutExercise({ weightType: 'percentage_1rm', weight: 80 })

            expect(resolveEffectiveWeight(exercise, oneRmMap, [])).toBe(80)
        })

        it('does not round the result', () => {
            const oneRmMap = new Map([[EX_1, 139]])
            const exercise = makeWorkoutExercise({ weightType: 'percentage_1rm', weight: 75 })

            expect(resolveEffectiveWeight(exercise, oneRmMap, [])).toBeCloseTo(104.25, 6)
        })

        it('returns null when the trainee has no record for the exercise', () => {
            const exercise = makeWorkoutExercise({ weightType: 'percentage_1rm', weight: 80 })

            expect(resolveEffectiveWeight(exercise, new Map(), [])).toBeNull()
        })

        it('treats a missing percentage as zero', () => {
            const oneRmMap = new Map([[EX_1, 100]])
            const exercise = makeWorkoutExercise({ weightType: 'percentage_1rm', weight: null })

            expect(resolveEffectiveWeight(exercise, oneRmMap, [])).toBe(0)
        })
    })

    describe('percentage_previous', () => {
        it('applies the percentage to the previous occurrence in the same workout', () => {
            const previous = makeWorkoutExercise({ id: 'we-0', order: 1, weight: 100 })
            const current = makeWorkoutExercise({
                id: 'we-2', order: 2, weightType: 'percentage_previous', weight: 10,
            })

            expect(resolveEffectiveWeight(current, new Map(), [previous, current])).toBeCloseTo(110, 6)
        })

        it('accepts a negative percentage as a decrease', () => {
            const previous = makeWorkoutExercise({ id: 'we-0', order: 1, weight: 100 })
            const current = makeWorkoutExercise({
                id: 'we-2', order: 2, weightType: 'percentage_previous', weight: -10,
            })

            expect(resolveEffectiveWeight(current, new Map(), [previous, current])).toBe(90)
        })

        it('throws when there is no earlier occurrence of the same exercise', () => {
            const current = makeWorkoutExercise({ order: 1, weightType: 'percentage_previous', weight: 10 })

            expect(() => resolveEffectiveWeight(current, new Map(), [current])).toThrow(
                CALCULATION_ERROR_KEYS.noPreviousOccurrenceFound
            )
        })

        it('ignores occurrences from another workout', () => {
            const otherWorkout = makeWorkoutExercise({ id: 'we-0', workoutId: 'workout-2', order: 1 })
            const current = makeWorkoutExercise({
                id: 'we-2', order: 2, weightType: 'percentage_previous', weight: 10,
            })

            expect(() => resolveEffectiveWeight(current, new Map(), [otherWorkout, current])).toThrow(
                CALCULATION_ERROR_KEYS.noPreviousOccurrenceFound
            )
        })

        it('resolves a chain that ends on an absolute weight', () => {
            const first = makeWorkoutExercise({ id: 'we-0', order: 1, weight: 100 })
            const second = makeWorkoutExercise({
                id: 'we-1', order: 2, weightType: 'percentage_previous', weight: 10,
            })
            const third = makeWorkoutExercise({
                id: 'we-2', order: 3, weightType: 'percentage_previous', weight: 10,
            })

            // 100 -> 110 -> 121: the third is based on the nearest previous occurrence
            expect(resolveEffectiveWeight(third, new Map(), [first, second, third])).toBeCloseTo(121, 6)
        })

        it('bases the third occurrence on the second, not on the first', () => {
            const first = makeWorkoutExercise({ id: 'we-1', order: 1, weight: 100 })
            const second = makeWorkoutExercise({
                id: 'we-2', order: 2, weightType: 'percentage_previous', weight: -10,
            })
            const third = makeWorkoutExercise({
                id: 'we-3', order: 3, weightType: 'percentage_previous', weight: -10,
            })

            expect(resolveEffectiveWeight(third, new Map(), [third, first, second])).toBeCloseTo(81, 6)
        })

        it('returns null when the chain ends on an unresolvable weight', () => {
            const previous = makeWorkoutExercise({ id: 'we-0', order: 1, weightType: 'percentage_1rm', weight: 80 })
            const current = makeWorkoutExercise({
                id: 'we-2', order: 2, weightType: 'percentage_previous', weight: 10,
            })

            expect(resolveEffectiveWeight(current, new Map(), [previous, current])).toBeNull()
        })

        it('resolves a chain longer than ten occurrences', () => {
            // Nearest-previous base: depth grows by one per occurrence.
            const siblings: ResolverExercise[] = [
                makeWorkoutExercise({ id: 'we-1', order: 1, weightType: 'absolute', weight: 100 }),
            ]
            for (let order = 2; order <= 13; order++) {
                siblings.push(makeWorkoutExercise({
                    id: `we-${order}`, order, weightType: 'percentage_previous', weight: -1,
                }))
            }

            expect(resolveEffectiveWeight(siblings[12], new Map(), siblings)).toBeCloseTo(100 * 0.99 ** 12, 6)
        })
    })
})

const PR_OLD_HIGH = { exerciseId: EX_1, reps: 1, weight: 150, recordDate: new Date('2026-06-01') }
const PR_RECENT = { exerciseId: EX_1, reps: 5, weight: 120, recordDate: new Date('2026-09-30') }

describe('latestPersonalRecordByExercise', () => {
    it('picks the most recent record even when an older one is heavier', () => {
        const result = latestPersonalRecordByExercise([PR_OLD_HIGH, PR_RECENT])

        expect(result[EX_1]).toBe(PR_RECENT)
    })

    it('breaks a date tie with the higher theoretical 1RM, whatever the input order', () => {
        const one = { exerciseId: EX_1, reps: 1, weight: 100, recordDate: '2026-09-30' }
        const five = { exerciseId: EX_1, reps: 5, weight: 100, recordDate: '2026-09-30' }

        expect(latestPersonalRecordByExercise([one, five])[EX_1]).toBe(five)
        expect(latestPersonalRecordByExercise([five, one])[EX_1]).toBe(five)
    })

    it('compares Date objects and ISO strings on the same scale', () => {
        const older = { exerciseId: EX_1, reps: 5, weight: 100, recordDate: new Date('2026-06-01') }
        const newer = { exerciseId: EX_1, reps: 5, weight: 90, recordDate: '2026-09-30T00:00:00.000Z' }

        expect(latestPersonalRecordByExercise([older, newer])[EX_1]).toBe(newer)
    })

    it('treats a missing or invalid date as the oldest', () => {
        const undated = { exerciseId: EX_1, reps: 5, weight: 200 }
        const invalid = { exerciseId: EX_1, reps: 5, weight: 200, recordDate: 'not-a-date' }
        const dated = { exerciseId: EX_1, reps: 5, weight: 50, recordDate: '2020-01-01' }

        expect(latestPersonalRecordByExercise([undated, dated, invalid])[EX_1]).toBe(dated)
    })

    it('returns one entry per exercise', () => {
        const other = { exerciseId: 'ex-2', reps: 3, weight: 80, recordDate: '2026-01-01' }

        const result = latestPersonalRecordByExercise([PR_RECENT, other])

        expect(Object.keys(result).sort()).toEqual(['ex-2', EX_1])
    })

    it('returns an empty object for no records', () => {
        expect(latestPersonalRecordByExercise([])).toEqual({})
    })
})

describe('latestNormalizedOneRMByExercise', () => {
    it('uses the 1RM of the most recent record', () => {
        const result = latestNormalizedOneRMByExercise([PR_OLD_HIGH, PR_RECENT])

        expect(result).toEqual({ [EX_1]: normalizedOneRM(120, 5) })
        expect(result[EX_1]).toBeCloseTo(139, 0)
    })
})

describe('loadTraineeOneRmMap', () => {
    it('maps each exercise to the 1RM of its most recent record', async () => {
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([PR_OLD_HIGH, PR_RECENT] as never)

        const map = await loadTraineeOneRmMap('trainee-1')

        expect(map.get(EX_1)).toBe(normalizedOneRM(120, 5))
        expect(map.size).toBe(1)
    })

    it('asks Prisma only for the records of that trainee, including recordDate', async () => {
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([] as never)

        const map = await loadTraineeOneRmMap('trainee-1')

        expect(map.size).toBe(0)
        expect(prisma.personalRecord.findMany).toHaveBeenCalledWith({
            where: { traineeId: 'trainee-1' },
            select: expect.objectContaining({ recordDate: true }),
        })
    })
})
