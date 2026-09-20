import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { prismaMock } from '../../helpers/prisma-mock'
import { logger } from '@/lib/logger'
import {
    loadTraineeProgramView,
    loadActiveProgramId,
} from '@/lib/trainee-program-data'

const traineeId = 'trainee-1'

beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.workout.findMany.mockResolvedValue([] as never)
    prismaMock.$queryRaw.mockResolvedValue([] as never)
    prismaMock.exerciseFeedback.aggregate.mockResolvedValue({
        _avg: { actualRpe: null },
        _count: { _all: 0 },
    } as never)
    prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
    prismaMock.setPerformed.findMany.mockResolvedValue([] as never)
    prismaMock.personalRecord.findMany.mockResolvedValue([] as never)
})

describe('loadTraineeProgramView', () => {
    it('returns null when program does not exist', async () => {
        let callCount = 0
        prismaMock.trainingProgram.findUnique.mockImplementation((async () => {
            callCount++
            // Both calls (tree and progress) return null when program doesn't exist
            return null
        }) as never)
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns null when program belongs to another trainee', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'p1',
            traineeId: 'other-trainee',
            trainerId: 't1',
            title: 'X',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        } as never)
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns combined { program, progress } for the trainee', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'p1',
            traineeId,
            trainerId: 't1',
            status: 'active',
            title: 'My Program',
            startDate: new Date('2026-04-01'),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        } as never)

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).not.toBeNull()
        expect(result!.program.id).toBe('p1')
        expect(result!.progress.programId).toBe('p1')
        expect(result!.progress.totalWorkouts).toBe(0)
    })
})

describe('loadActiveProgramId', () => {
    it('returns the id when active program exists', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue({ id: 'p1' } as never)
        await expect(loadActiveProgramId(traineeId)).resolves.toBe('p1')
    })

    it('returns the preferred id when it is active for the trainee', async () => {
        prismaMock.trainingProgram.findFirst
            .mockResolvedValueOnce({ id: 'preferred-program' } as never)

        await expect(loadActiveProgramId(traineeId, 'preferred-program')).resolves.toBe('preferred-program')

        expect(prismaMock.trainingProgram.findFirst).toHaveBeenCalledTimes(1)
        expect(prismaMock.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { id: 'preferred-program', traineeId, status: 'active' },
            select: { id: true },
        })
    })

    it('falls back to the default active lookup when preferred id is not active', async () => {
        prismaMock.trainingProgram.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'fallback-program' } as never)

        await expect(loadActiveProgramId(traineeId, 'stale-program')).resolves.toBe('fallback-program')

        expect(prismaMock.trainingProgram.findFirst).toHaveBeenNthCalledWith(1, {
            where: { id: 'stale-program', traineeId, status: 'active' },
            select: { id: true },
        })
        expect(prismaMock.trainingProgram.findFirst).toHaveBeenNthCalledWith(2, {
            where: { traineeId, status: 'active' },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })
    })

    it('returns null otherwise', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue(null)
        await expect(loadActiveProgramId(traineeId)).resolves.toBeNull()
    })
})

import { loadProgressAggregates } from '@/lib/trainee-program-data'

describe('loadProgressAggregates – SQL uses DISTINCT for exerciseCount', () => {
    beforeEach(() => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'p1',
            title: 'Test',
            status: 'active',
            startDate: new Date('2026-04-01'),
            durationWeeks: 4,
        } as never)
    })

    it('uses COUNT(DISTINCT we.id) so multiple feedbacks per exercise do not inflate exerciseCount', async () => {
        prismaMock.workout.findMany.mockResolvedValue([] as never)
        prismaMock.$queryRaw.mockResolvedValue([] as never)

        await loadProgressAggregates('p1')

        // Verify the completion SQL uses DISTINCT to avoid overcounting when an exercise
        // has multiple ExerciseFeedback rows (e.g. draft on day 1, final submit on day 2).
        const firstCall = prismaMock.$queryRaw.mock.calls[0]
        const sqlParts: string[] = Array.from(firstCall[0] as Iterable<string>)
        const sql = sqlParts.join('')
        expect(sql).toContain('COUNT(DISTINCT we."id")')
    })

    it('marks workout as completed when the workout completion flag is true', async () => {
        const workoutId = 'wk-1'
        prismaMock.workout.findMany.mockResolvedValue([{
            id: workoutId,
            dayIndex: 1,
            week: { weekNumber: 1, weekType: 'normal' },
        }] as never)
        prismaMock.$queryRaw
            .mockResolvedValueOnce([{
                workoutId,
                weekNumber: 1,
                exerciseCount: 1,
                workoutCompleted: true,
                startedFeedbackCount: 0,
            }])
            .mockResolvedValueOnce([{ weekNumber: 1, totalVolume: 0 }])
            .mockResolvedValueOnce([{ weekNumber: 1, avgRpe: null, feedbackCount: 0 }])

        const result = await loadProgressAggregates('p1')

        expect(result.workouts[0].completed).toBe(true)
        expect(result.completedWorkouts).toBe(1)
    })

    it('ignores empty workouts when calculating totals and next workout', async () => {
        prismaMock.workout.findMany.mockResolvedValue([
            {
                id: 'wk-empty',
                dayIndex: 1,
                week: { weekNumber: 1, weekType: 'normal' },
            },
            {
                id: 'wk-real',
                dayIndex: 2,
                week: { weekNumber: 1, weekType: 'normal' },
            },
        ] as never)
        prismaMock.$queryRaw
            .mockResolvedValueOnce([
                {
                    workoutId: 'wk-empty',
                    weekNumber: 1,
                    exerciseCount: 0,
                    workoutCompleted: false,
                    startedFeedbackCount: 0,
                },
                {
                    workoutId: 'wk-real',
                    weekNumber: 1,
                    exerciseCount: 1,
                    workoutCompleted: false,
                    startedFeedbackCount: 0,
                },
            ])
            .mockResolvedValueOnce([{ weekNumber: 1, totalVolume: 0 }])
            .mockResolvedValueOnce([{ weekNumber: 1, avgRpe: null, feedbackCount: 0 }])

        const result = await loadProgressAggregates('p1')

        expect(result.totalWorkouts).toBe(1)
        expect(result.completedWorkouts).toBe(0)
        expect(result.nextWorkout?.id).toBe('wk-real')
        expect(result.weeklyStats[0]).toMatchObject({
            completedWorkouts: 0,
            totalWorkouts: 1,
        })
    })

    it('returns the first incomplete workout in order even if a later workout is already started', async () => {
        prismaMock.workout.findMany.mockResolvedValue([
            {
                id: 'wk-todo',
                dayIndex: 1,
                week: { weekNumber: 1, weekType: 'normal' },
            },
            {
                id: 'wk-started',
                dayIndex: 2,
                week: { weekNumber: 1, weekType: 'normal' },
            },
        ] as never)
        prismaMock.$queryRaw
            .mockResolvedValueOnce([
                {
                    workoutId: 'wk-todo',
                    weekNumber: 1,
                    exerciseCount: 1,
                    workoutCompleted: false,
                    startedFeedbackCount: 0,
                },
                {
                    workoutId: 'wk-started',
                    weekNumber: 1,
                    exerciseCount: 1,
                    workoutCompleted: false,
                    startedFeedbackCount: 1,
                },
            ])
            .mockResolvedValueOnce([{ weekNumber: 1, totalVolume: 0 }])
            .mockResolvedValueOnce([{ weekNumber: 1, avgRpe: null, feedbackCount: 1 }])

        const result = await loadProgressAggregates('p1')

        expect(result.nextWorkout?.id).toBe('wk-todo')
        expect(result.nextWorkout?.started).toBe(false)
    })
})

describe('loadTraineeProgramView effective weights', () => {
    const makeProgramWith = (workoutExercises: unknown[]) => ({
        id: 'p1',
        traineeId,
        trainerId: 't1',
        status: 'active',
        title: 'My Program',
        startDate: new Date('2026-04-01'),
        durationWeeks: 1,
        weeks: [{
            weekNumber: 1,
            weekType: 'normal',
            workouts: [{ id: 'wk-1', dayIndex: 0, workoutExercises }],
        }],
        trainer: { firstName: 'A', lastName: 'B' },
        trainee: { firstName: 'C', lastName: 'D' },
    })

    const makeExercise = (overrides: Record<string, unknown> = {}) => ({
        id: 'we-1',
        workoutId: 'wk-1',
        exerciseId: 'ex-1',
        variant: null,
        sets: 3,
        reps: '5',
        targetRpe: null,
        weightType: 'absolute',
        weight: 100,
        effectiveWeight: null,
        restTime: 'm2',
        isWarmup: false,
        isJumpSet: false,
        isSuperSet: false,
        notes: null,
        order: 1,
        exercise: { id: 'ex-1', name: 'Squat' },
        ...overrides,
    })

    it('keeps an effective weight that is already stored', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(
            makeProgramWith([makeExercise({ effectiveWeight: 95, weightType: 'percentage_1rm', weight: 80 })]) as never
        )

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })

        expect(result!.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(95)
    })

    it('uses the assigned weight for an absolute exercise without loading records', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(
            makeProgramWith([makeExercise()]) as never
        )

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })

        expect(result!.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(100)
        expect(prismaMock.personalRecord.findMany).not.toHaveBeenCalled()
    })

    it('loads the personal records only when a relative weight is present', async () => {
        prismaMock.personalRecord.findMany.mockResolvedValue([
            { exerciseId: 'ex-1', reps: 1, weight: 200, recordDate: new Date('2026-01-01') },
        ] as never)
        prismaMock.trainingProgram.findUnique.mockResolvedValue(
            makeProgramWith([makeExercise({ weightType: 'percentage_1rm', weight: 50 })]) as never
        )

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })

        expect(prismaMock.personalRecord.findMany).toHaveBeenCalled()
        expect(result!.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(100)
    })

    it('reports a null weight and warns when the chain cannot be resolved', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(
            makeProgramWith([makeExercise({ weightType: 'percentage_previous', weight: 10, order: 1 })]) as never
        )

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })

        expect(result!.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBeNull()
        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ workoutExerciseId: 'we-1' }),
            'Failed to resolve effective weight'
        )
    })
})

describe('loadProgressAggregates performed sets', () => {
    beforeEach(() => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'p1',
            title: 'Test',
            status: 'active',
            startDate: new Date('2026-04-01'),
            durationWeeks: 4,
        } as never)
        prismaMock.workout.findMany.mockResolvedValue([
            { id: 'wk-1', dayIndex: 0, week: { weekNumber: 1, weekType: 'normal' } },
        ] as never)
        prismaMock.$queryRaw.mockResolvedValue([] as never)
    })

    it('keeps only the sets of the most recent feedback, sorted by set number', async () => {
        // Rows arrive ordered by feedback date desc: fb-2 is the latest submit,
        // fb-1 an older one for the same exercise, whose rows must be dropped.
        prismaMock.setPerformed.findMany.mockResolvedValue([
            { setNumber: 2, reps: 5, weight: 100, feedback: { id: 'fb-2', workoutExerciseId: 'we-1', workoutExercise: { workoutId: 'wk-1' } } },
            { setNumber: 1, reps: 5, weight: 100, feedback: { id: 'fb-2', workoutExerciseId: 'we-1', workoutExercise: { workoutId: 'wk-1' } } },
            { setNumber: 1, reps: 3, weight: 80, feedback: { id: 'fb-1', workoutExerciseId: 'we-1', workoutExercise: { workoutId: 'wk-1' } } },
        ] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            { workoutExerciseId: 'we-1', notes: 'Sensazioni buone' },
            { workoutExerciseId: 'we-1', notes: 'Nota vecchia' },
        ] as never)

        const progress = await loadProgressAggregates('p1')
        const workout = progress.workouts.find((w) => w.id === 'wk-1')
        const performed = workout!.exercisesPerformed[0]

        expect(performed.workoutExerciseId).toBe('we-1')
        expect(performed.performedSets.map((set) => set.setNumber)).toEqual([1, 2])
        expect(performed.performedSets.every((set) => set.weight === 100)).toBe(true)
        expect(performed.traineeNote).toBe('Sensazioni buone')
    })

    it('reports no note when the latest feedback carries none', async () => {
        prismaMock.setPerformed.findMany.mockResolvedValue([
            { setNumber: 1, reps: 5, weight: 100, feedback: { id: 'fb-3', workoutExerciseId: 'we-2', workoutExercise: { workoutId: 'wk-1' } } },
        ] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            { workoutExerciseId: 'we-2', notes: null },
        ] as never)

        const progress = await loadProgressAggregates('p1')
        const workout = progress.workouts.find((w) => w.id === 'wk-1')

        expect(workout!.exercisesPerformed[0].traineeNote).toBeNull()
    })
})
