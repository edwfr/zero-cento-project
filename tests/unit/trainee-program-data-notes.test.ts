import { describe, it, expect, beforeEach } from 'vitest'
import { loadTraineeProgramView } from '@/lib/trainee-program-data'
import { prismaMock } from '../helpers/prisma-mock'

describe('WorkoutEntry traineeNote field', () => {
    it('exercisesPerformed items include traineeNote field', () => {
        type ExercisePerformedItem = {
            workoutExerciseId: string
            performedSets: Array<{ setNumber: number; reps: number; weight: number }>
            traineeNote: string | null
        }

        const item: ExercisePerformedItem = {
            workoutExerciseId: 'we-1',
            performedSets: [{ setNumber: 1, reps: 8, weight: 80 }],
            traineeNote: 'felt strong',
        }

        expect(item.traineeNote).toBe('felt strong')

        const itemNoNote: ExercisePerformedItem = {
            workoutExerciseId: 'we-2',
            performedSets: [],
            traineeNote: null,
        }

        expect(itemNoNote.traineeNote).toBeNull()
    })
})

describe('loadTraineeProgramView - bodyweight-loaded rows', () => {
    const row = (overrides: Record<string, unknown> = {}, loaded = true) => ({
        id: 'we-1',
        workoutId: 'w-1',
        exerciseId: 'ex-pullup',
        variant: null,
        sets: 3,
        reps: '5',
        targetRpe: 8,
        weightType: 'percentage_1rm',
        weight: 75,
        effectiveWeight: 97.5,
        rpeWeightMin: null,
        rpeWeightMax: null,
        restTime: 'm2',
        isWarmup: false,
        isJumpSet: false,
        isSuperSet: false,
        notes: null,
        order: 1,
        exercise: { id: 'ex-pullup', name: 'Trazioni', type: 'fundamental', isBodyweightLoaded: loaded },
        ...overrides,
    })

    function mockProgram(rows: unknown[]) {
        const program = {
            id: 'prog-1',
            title: 'P',
            status: 'active',
            startDate: null,
            durationWeeks: 1,
            traineeId: 'trainee-1',
            trainer: { firstName: 'T', lastName: 'R' },
            trainee: { firstName: 'M', lastName: 'A' },
            weeks: [
                {
                    weekNumber: 1,
                    weekType: 'normal',
                    workouts: [{ id: 'w-1', dayIndex: 1, workoutExercises: rows }],
                },
            ],
        }
        prismaMock.trainingProgram.findUnique.mockResolvedValue(program as never)
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)
        prismaMock.workout.findMany.mockResolvedValue([] as never)
        prismaMock.$queryRaw.mockResolvedValue([] as never)
        prismaMock.exerciseFeedback.aggregate.mockResolvedValue({
            _avg: { actualRpe: null },
            _count: { _all: 0 },
        } as never)
        prismaMock.setPerformed.findMany.mockResolvedValue([] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
    }

    async function load() {
        const view = await loadTraineeProgramView({ programId: 'prog-1', traineeId: 'trainee-1' })
        return view!.program.weeks[0].workouts[0].workoutExercises
    }

    beforeEach(() => {
        prismaMock.traineeMeasurement.findFirst.mockResolvedValue({ value: 80 } as never)
    })

    it('hides the total load and returns only the ballast', async () => {
        mockProgram([row()])

        const rows = await load()

        expect(rows[0]).toMatchObject({
            effectiveWeight: null,
            rpeWeightMin: null,
            rpeWeightMax: null,
            ballast: { kind: 'ballast', kg: 17.5 },
        })
        expect(JSON.stringify(rows)).not.toMatch(/"bodyweightKg"/)
    })

    it('returns a ballast range for a frozen total range', async () => {
        mockProgram([row({ weight: null, effectiveWeight: null, rpeWeightMin: 95.5, rpeWeightMax: 99 })])

        const rows = await load()

        expect(rows[0]).toMatchObject({
            rpeWeightMin: null,
            rpeWeightMax: null,
            ballast: { kind: 'ballastRange', minKg: 15.5, maxKg: 19 },
        })
    })

    it('reports a missing bodyweight', async () => {
        prismaMock.traineeMeasurement.findFirst.mockResolvedValue(null)
        mockProgram([row()])

        const rows = await load()

        expect(rows[0].ballast).toEqual({ kind: 'missingBodyweight' })
    })

    it('leaves a non-loaded row unchanged and skips the bodyweight read', async () => {
        mockProgram([row({}, false)])

        const rows = await load()

        expect(rows[0]).toMatchObject({ effectiveWeight: 97.5, ballast: null })
        expect(prismaMock.traineeMeasurement.findFirst).not.toHaveBeenCalled()
    })

    it('resolves -10% after an absolute ballast on top of the bodyweight', async () => {
        mockProgram([
            row({ id: 'we-1', order: 1, weightType: 'absolute', weight: 20, effectiveWeight: null }),
            row({ id: 'we-2', order: 2, weightType: 'percentage_previous', weight: -10, effectiveWeight: null }),
        ])

        const rows = await load()

        expect(rows[0].ballast).toEqual({ kind: 'ballast', kg: 20 })
        expect(rows[1].ballast).toEqual({ kind: 'ballast', kg: 10 })
    })
})
