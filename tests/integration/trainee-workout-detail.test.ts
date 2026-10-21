import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/calculations', () => ({
    loadTraineeOneRmMap: vi.fn(),
    loadLatestBodyweightKg: vi.fn(),
    resolveEffectiveWeight: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/trainee/workouts/[id]/route'
import { GET as getRecap } from '@/app/api/trainee/workouts/[id]/recap/route'
import { loadLatestBodyweightKg, loadTraineeOneRmMap, resolveEffectiveWeight } from '@/lib/calculations'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTraineeSession } from '../helpers/sessions'
import { asTrainee, asForbidden } from '../helpers/auth-mock'

function makeRequest(url = 'http://localhost:3000/api/trainee/workouts/workout-1') {
    return new NextRequest(url)
}

describe('GET /api/trainee/workouts/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainee()
        vi.mocked(loadTraineeOneRmMap).mockResolvedValue(new Map())
        vi.mocked(resolveEffectiveWeight).mockReturnValue(100)
        prismaMock.workout.findUnique.mockResolvedValue({
            id: 'workout-1',
            dayIndex: 1,
            notes: 'Workout notes',
            week: {
                weekNumber: 2,
                weekType: 'volume',
                program: {
                    id: 'program-1',
                    title: 'Programma Test',
                    traineeId: mockTraineeSession.user.id,
                    trainerId: 'trainer-1',
                },
            },
            workoutExercises: [
                {
                    id: 'we-1',
                    exerciseId: 'exercise-1',
                    variant: null,
                    sets: 2,
                    reps: '5',
                    targetRpe: 8,
                    weightType: 'absolute',
                    weight: 100,
                    effectiveWeight: 100,
                    restTime: 'm2',
                    isWarmup: false,
                    isJumpSet: false,
                    isSuperSet: false,
                    notes: null,
                    order: 1,
                    isCompleted: true,
                    exercise: {
                        id: 'exercise-1',
                        name: 'Back Squat',
                        description: null,
                        youtubeUrl: null,
                        type: 'fundamental',
                        notes: null,
                    },
                },
            ],
        } as never)
    })

    it('returns 404 when the program has not started yet', async () => {
        prismaMock.workout.findUnique.mockResolvedValue({
            id: 'workout-1',
            dayIndex: 1,
            notes: null,
            workoutExercises: [],
            week: {
                weekNumber: 1,
                weekType: 'normal',
                program: {
                    id: 'program-1',
                    title: 'Programma Futuro',
                    traineeId: mockTraineeSession.user.id,
                    trainerId: 'trainer-1',
                    status: 'active',
                    startDate: new Date('2999-01-01T00:00:00Z'),
                },
            },
        } as never)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'workout-1' }) })
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('workout.notFound')
    })

    it('returns the frozen rpe weight range for an exercise without a weight', async () => {
        vi.mocked(resolveEffectiveWeight).mockReturnValue(null)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
        prismaMock.workout.findUnique.mockResolvedValue({
            id: 'workout-1',
            dayIndex: 1,
            notes: null,
            week: {
                weekNumber: 2,
                weekType: 'normal',
                program: {
                    id: 'program-1',
                    title: 'Programma Test',
                    traineeId: mockTraineeSession.user.id,
                    trainerId: 'trainer-1',
                },
            },
            workoutExercises: [
                {
                    id: 'we-1',
                    exerciseId: 'exercise-1',
                    variant: null,
                    sets: 3,
                    reps: '5',
                    targetRpe: 8,
                    weightType: 'absolute',
                    weight: null,
                    effectiveWeight: null,
                    rpeWeightMin: 110.5,
                    rpeWeightMax: 115,
                    restTime: 'm2',
                    isWarmup: false,
                    isJumpSet: false,
                    isSuperSet: false,
                    notes: null,
                    order: 1,
                    isCompleted: false,
                    exercise: {
                        id: 'exercise-1',
                        name: 'Back Squat',
                        description: null,
                        youtubeUrl: null,
                        type: 'fundamental',
                        notes: null,
                    },
                },
            ],
        } as never)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'workout-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.workout.exercises[0]).toMatchObject({
            weight: null,
            effectiveWeight: null,
            rpeWeightMin: 110.5,
            rpeWeightMax: 115,
        })
    })

    it('hydrates the latest feedback for each exercise even when it was saved before today', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            {
                id: 'fb-latest',
                workoutExerciseId: 'we-1',
                actualRpe: 8,
                notes: 'saved yesterday',
                date: new Date('2026-04-29T00:00:00.000Z'),
                updatedAt: new Date('2026-04-29T18:00:00.000Z'),
                setsPerformed: [
                    { setNumber: 1, completed: true, reps: 5, weight: 100, actualRpe: 8.5 },
                    { setNumber: 2, completed: true, reps: 5, weight: 100, actualRpe: null },
                ],
            },
            {
                id: 'fb-older',
                workoutExerciseId: 'we-1',
                actualRpe: 7.5,
                notes: 'older draft',
                date: new Date('2026-04-28T00:00:00.000Z'),
                updatedAt: new Date('2026-04-28T18:00:00.000Z'),
                setsPerformed: [
                    { setNumber: 1, completed: false, reps: 0, weight: 100, actualRpe: null },
                    { setNumber: 2, completed: false, reps: 0, weight: 100, actualRpe: null },
                ],
            },
        ] as never)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'workout-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: {
                workoutExerciseId: { in: ['we-1'] },
                traineeId: mockTraineeSession.user.id,
            },
            include: {
                setsPerformed: {
                    orderBy: {
                        setNumber: 'asc',
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        })
        expect(json.data.workout.exercises[0].feedback.id).toBe('fb-latest')
        expect(json.data.workout.exercises[0].feedback.setsPerformed).toEqual([
            { setNumber: 1, completed: true, reps: 5, weight: 100, actualRpe: 8.5 },
            { setNumber: 2, completed: true, reps: 5, weight: 100, actualRpe: null },
        ])
    })

    it('preserves completed sets from older feedback rows when a newer snapshot is incomplete', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            {
                id: 'fb-newer-incomplete',
                workoutExerciseId: 'we-1',
                traineeId: mockTraineeSession.user.id,
                actualRpe: null,
                notes: null,
                date: new Date('2026-04-30T00:00:00.000Z'),
                updatedAt: new Date('2026-04-30T18:00:00.000Z'),
                setsPerformed: [
                    { setNumber: 1, completed: false, reps: 0, weight: 100, actualRpe: null },
                    { setNumber: 2, completed: false, reps: 0, weight: 100, actualRpe: null },
                ],
            },
            {
                id: 'fb-older-complete',
                workoutExerciseId: 'we-1',
                traineeId: mockTraineeSession.user.id,
                actualRpe: 8,
                notes: 'completed earlier',
                date: new Date('2026-04-29T00:00:00.000Z'),
                updatedAt: new Date('2026-04-29T18:00:00.000Z'),
                setsPerformed: [
                    { setNumber: 1, completed: true, reps: 5, weight: 100, actualRpe: 8 },
                    { setNumber: 2, completed: true, reps: 5, weight: 100, actualRpe: 8.5 },
                ],
            },
        ] as never)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'workout-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.workout.exercises[0].feedback.notes).toBe('completed earlier')
        expect(json.data.workout.exercises[0].feedback.avgRPE).toBe(8)
        expect(json.data.workout.exercises[0].feedback.setsPerformed).toEqual([
            { setNumber: 1, completed: true, reps: 5, weight: 100, actualRpe: 8 },
            { setNumber: 2, completed: true, reps: 5, weight: 100, actualRpe: 8.5 },
        ])
    })
})

// ─── Workout recap ────────────────────────────────────────────────────────────

const recapParams = () => ({ params: Promise.resolve({ id: 'workout-1' }) })

describe('GET /api/trainee/workouts/[id]/recap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainee()
        prismaMock.workout.findFirst.mockResolvedValue({
            traineeNotes: 'Sessione buona',
            workoutExercises: [
                {
                    id: 'we-1',
                    order: 1,
                    isCompleted: true,
                    isWarmup: null,
                    isJumpSet: null,
                    isSuperSet: null,
                    sets: 3,
                    reps: '8',
                    targetRpe: 8,
                    restTime: 'm2',
                    effectiveWeight: 100,
                    exercise: { name: 'Panca piana', type: 'strength' },
                    exerciseFeedbacks: [
                        {
                            actualRpe: 9,
                            notes: 'Ultima serie dura',
                            setsPerformed: [
                                { setNumber: 1, reps: 8, weight: 100, completed: true },
                                { setNumber: 2, reps: 7, weight: 100, completed: false },
                            ],
                        },
                    ],
                },
                {
                    id: 'we-2',
                    order: 2,
                    isCompleted: false,
                    isWarmup: true,
                    isJumpSet: false,
                    isSuperSet: false,
                    sets: 2,
                    reps: '10',
                    targetRpe: null,
                    restTime: 'm1',
                    effectiveWeight: null,
                    exercise: { name: 'Squat', type: 'strength' },
                    exerciseFeedbacks: [],
                },
            ],
        } as never)
    })

    it('returns every exercise with its performed sets and status', async () => {
        const res = await getRecap(makeRequest(), recapParams())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.workoutNote).toBe('Sessione buona')
        expect(body.data.exercises).toHaveLength(2)
        expect(body.data.exercises[0]).toMatchObject({
            id: 'we-1',
            exerciseName: 'Panca piana',
            targetSets: 3,
            completedSets: 1,
            status: 'done',
            actualRpe: 9,
            exerciseNote: 'Ultima serie dura',
            isWarmup: false,
        })
        expect(body.data.exercises[0].sets).toEqual([
            { setNumber: 1, reps: 8, weight: 100, completed: true },
            { setNumber: 2, reps: 7, weight: 100, completed: false },
        ])
        expect(prismaMock.workout.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: 'workout-1',
                    week: {
                        program: { traineeId: mockTraineeSession.user.id, OR: expect.any(Array) },
                    },
                },
            })
        )
    })

    it('reports an exercise without feedback as not started', async () => {
        const res = await getRecap(makeRequest(), recapParams())
        const body = await res.json()

        expect(body.data.exercises[1]).toMatchObject({
            id: 'we-2',
            status: 'not_started',
            completedSets: 0,
            actualRpe: null,
            exerciseNote: null,
            isWarmup: true,
            effectiveWeight: null,
        })
        expect(body.data.exercises[1].sets).toEqual([])
    })

    it('reports an exercise with some completed sets as in progress', async () => {
        prismaMock.workout.findFirst.mockResolvedValue({
            traineeNotes: null,
            workoutExercises: [
                {
                    id: 'we-3',
                    order: 1,
                    isCompleted: false,
                    isWarmup: false,
                    isJumpSet: false,
                    isSuperSet: false,
                    sets: 3,
                    reps: '5',
                    targetRpe: 7,
                    restTime: 'm3',
                    effectiveWeight: 80,
                    exercise: { name: 'Stacco', type: 'strength' },
                    exerciseFeedbacks: [
                        {
                            actualRpe: null,
                            notes: null,
                            setsPerformed: [{ setNumber: 1, reps: 5, weight: 80, completed: true }],
                        },
                    ],
                },
            ],
        } as never)

        const res = await getRecap(makeRequest(), recapParams())
        const body = await res.json()

        expect(body.data.workoutNote).toBeNull()
        expect(body.data.exercises[0]).toMatchObject({ status: 'in_progress', completedSets: 1 })
    })

    it('returns 404 when the workout does not belong to the trainee', async () => {
        prismaMock.workout.findFirst.mockResolvedValue(null)

        const res = await getRecap(makeRequest(), recapParams())
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('workout.notFound')
    })

    it('returns 403 for a caller that is not a trainee', async () => {
        asForbidden()

        const res = await getRecap(makeRequest(), recapParams())

        expect(res.status).toBe(403)
        expect(prismaMock.workout.findFirst).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.workout.findFirst.mockRejectedValue(new Error('db down'))

        const res = await getRecap(makeRequest(), recapParams())
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

// ─── Bodyweight-loaded exercises: trainee sees only the ballast ──────────────

function loadedWorkoutExercise(overrides: Record<string, unknown> = {}, loaded = true) {
    return {
        id: 'we-b',
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
        isCompleted: false,
        exercise: {
            id: 'ex-pullup',
            name: 'Trazioni',
            description: null,
            youtubeUrl: null,
            type: 'fundamental',
            notes: null,
            isBodyweightLoaded: loaded,
        },
        ...overrides,
    }
}

function mockWorkoutWith(rows: unknown[]) {
    prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
    prismaMock.workout.findUnique.mockResolvedValue({
        id: 'workout-1',
        dayIndex: 1,
        traineeNotes: null,
        week: {
            weekNumber: 1,
            weekType: 'normal',
            program: {
                id: 'program-1',
                title: 'P',
                traineeId: mockTraineeSession.user.id,
                trainerId: 'trainer-1',
            },
        },
        workoutExercises: rows,
    } as never)
}

describe('GET /api/trainee/workouts/[id] - bodyweight-loaded rows', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainee()
        vi.mocked(loadTraineeOneRmMap).mockResolvedValue(new Map())
        vi.mocked(resolveEffectiveWeight).mockReturnValue(null)
        vi.mocked(loadLatestBodyweightKg).mockResolvedValue(80)
    })

    const getWorkout = () => GET(makeRequest(), { params: Promise.resolve({ id: 'workout-1' }) })

    it('hides the total load and returns only the ballast', async () => {
        mockWorkoutWith([loadedWorkoutExercise()])

        const body = await (await getWorkout()).json()

        expect(body.data.workout.exercises[0]).toMatchObject({
            effectiveWeight: null,
            rpeWeightMin: null,
            rpeWeightMax: null,
            ballast: { kind: 'ballast', kg: 17.5 },
        })
        expect(loadLatestBodyweightKg).toHaveBeenCalledWith(mockTraineeSession.user.id)
        expect(JSON.stringify(body)).not.toMatch(/"bodyweightKg"/)
    })

    it('returns a ballast range for a frozen total range', async () => {
        mockWorkoutWith([
            loadedWorkoutExercise({
                weightType: 'percentage_1rm',
                weight: null,
                effectiveWeight: null,
                rpeWeightMin: 95.5,
                rpeWeightMax: 99,
            }),
        ])

        const body = await (await getWorkout()).json()

        expect(body.data.workout.exercises[0]).toMatchObject({
            effectiveWeight: null,
            rpeWeightMin: null,
            rpeWeightMax: null,
            ballast: { kind: 'ballastRange', minKg: 15.5, maxKg: 19 },
        })
    })

    it('reports a missing bodyweight', async () => {
        vi.mocked(loadLatestBodyweightKg).mockResolvedValue(null)
        mockWorkoutWith([loadedWorkoutExercise()])

        const body = await (await getWorkout()).json()

        expect(body.data.workout.exercises[0].ballast).toEqual({ kind: 'missingBodyweight' })
        expect(body.data.workout.exercises[0].effectiveWeight).toBeNull()
    })

    it('leaves a non-loaded row unchanged with ballast null', async () => {
        mockWorkoutWith([loadedWorkoutExercise({}, false)])

        const body = await (await getWorkout()).json()

        expect(body.data.workout.exercises[0]).toMatchObject({
            effectiveWeight: 97.5,
            ballast: null,
        })
    })

    it('does not read the bodyweight when no row is loaded', async () => {
        mockWorkoutWith([loadedWorkoutExercise({}, false)])

        await getWorkout()

        expect(loadLatestBodyweightKg).not.toHaveBeenCalled()
    })

    it('resolves a -10% row after an absolute ballast with the bodyweight options', async () => {
        vi.mocked(resolveEffectiveWeight).mockReturnValue(90)
        mockWorkoutWith([
            loadedWorkoutExercise({
                id: 'we-1',
                order: 1,
                weightType: 'absolute',
                weight: 20,
                effectiveWeight: 20,
            }),
            loadedWorkoutExercise({
                id: 'we-2',
                order: 2,
                weightType: 'percentage_previous',
                weight: -10,
                effectiveWeight: null,
            }),
        ])

        const body = await (await getWorkout()).json()

        expect(body.data.workout.exercises[0].ballast).toEqual({ kind: 'ballast', kg: 20 })
        expect(body.data.workout.exercises[1].ballast).toEqual({ kind: 'ballast', kg: 10 })
        const options = vi.mocked(resolveEffectiveWeight).mock.calls[0][3]
        expect(options?.bodyweightKg).toBe(80)
        expect(options?.isBodyweightLoaded?.('ex-pullup')).toBe(true)
        expect(options?.isBodyweightLoaded?.('other')).toBe(false)
    })
})

describe('GET /api/trainee/workouts/[id]/recap - bodyweight-loaded rows', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainee()
        vi.mocked(loadLatestBodyweightKg).mockResolvedValue(80)
    })

    function mockRecap(loaded: boolean, extra: Record<string, unknown> = {}) {
        prismaMock.workout.findFirst.mockResolvedValue({
            traineeNotes: null,
            workoutExercises: [
                {
                    id: 'we-b',
                    order: 1,
                    isCompleted: false,
                    isWarmup: false,
                    isJumpSet: false,
                    isSuperSet: false,
                    sets: 3,
                    reps: '5',
                    targetRpe: 8,
                    restTime: 'm2',
                    weightType: 'percentage_1rm',
                    weight: 75,
                    effectiveWeight: 97.5,
                    rpeWeightMin: null,
                    rpeWeightMax: null,
                    exercise: { name: 'Trazioni', type: 'fundamental', isBodyweightLoaded: loaded },
                    exerciseFeedbacks: [],
                    ...extra,
                },
            ],
        } as never)
    }

    it('returns the ballast and hides the total load', async () => {
        mockRecap(true)

        const body = await (await getRecap(makeRequest(), recapParams())).json()

        expect(body.data.exercises[0]).toMatchObject({
            effectiveWeight: null,
            ballast: { kind: 'ballast', kg: 17.5 },
        })
        expect(JSON.stringify(body)).not.toMatch(/"bodyweightKg"/)
    })

    it('reports a missing bodyweight', async () => {
        vi.mocked(loadLatestBodyweightKg).mockResolvedValue(null)
        mockRecap(true)

        const body = await (await getRecap(makeRequest(), recapParams())).json()

        expect(body.data.exercises[0].ballast).toEqual({ kind: 'missingBodyweight' })
    })

    it('leaves a non-loaded row unchanged and skips the bodyweight read', async () => {
        mockRecap(false)

        const body = await (await getRecap(makeRequest(), recapParams())).json()

        expect(body.data.exercises[0]).toMatchObject({ effectiveWeight: 97.5, ballast: null })
        expect(loadLatestBodyweightKg).not.toHaveBeenCalled()
    })
})
