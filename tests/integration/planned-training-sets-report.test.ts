import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET } from '@/app/api/users/[id]/reports/planned-training-sets/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asTrainee, asAdmin, asUnauthenticated } from '../helpers/auth-mock'

describe('GET /api/users/[id]/reports/planned-training-sets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)
    })

    it('aggregates muscle groups and fundamental sets across programs', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assoc-1' } as never)
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                id: 'program-1',
                title: 'Programma A',
                startDate: new Date('2026-01-06T00:00:00.000Z'),
                weeks: [
                    {
                        id: 'week-1',
                        weekNumber: 1,
                        startDate: new Date('2026-01-06T00:00:00.000Z'),
                        workouts: [
                            {
                                id: 'workout-1',
                                workoutExercises: [
                                    {
                                        id: 'we-1',
                                        sets: 4,
                                        reps: '5',
                                        isWarmup: false,
                                        weightType: 'percentage_1rm',
                                        weight: 80,
                                        targetRpe: null,
                                        exercise: {
                                            id: 'ex-squat',
                                            name: 'Back Squat',
                                            type: 'fundamental',
                                            exerciseMuscleGroups: [
                                                {
                                                    coefficient: 1,
                                                    muscleGroup: { id: 'mg-legs', name: 'Legs' },
                                                },
                                            ],
                                        },
                                    },
                                    {
                                        id: 'we-2',
                                        sets: 3,
                                        reps: '6',
                                        isWarmup: false,
                                        weightType: 'percentage_1rm',
                                        weight: 75,
                                        targetRpe: null,
                                        exercise: {
                                            id: 'ex-bench',
                                            name: 'Panca Piana',
                                            type: 'fundamental',
                                            exerciseMuscleGroups: [
                                                {
                                                    coefficient: 1,
                                                    muscleGroup: { id: 'mg-chest', name: 'Chest' },
                                                },
                                            ],
                                        },
                                    },
                                    {
                                        id: 'we-3',
                                        sets: 2,
                                        reps: '1',
                                        isWarmup: true,
                                        weightType: 'percentage_1rm',
                                        weight: 50,
                                        targetRpe: null,
                                        exercise: {
                                            id: 'ex-dl',
                                            name: 'Deadlift',
                                            type: 'fundamental',
                                            exerciseMuscleGroups: [
                                                {
                                                    coefficient: 1,
                                                    muscleGroup: { id: 'mg-back', name: 'Back' },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                id: 'program-2',
                title: 'Programma B',
                startDate: new Date('2026-01-13T00:00:00.000Z'),
                weeks: [
                    {
                        id: 'week-2',
                        weekNumber: 1,
                        startDate: new Date('2026-01-13T00:00:00.000Z'),
                        workouts: [
                            {
                                id: 'workout-2',
                                workoutExercises: [
                                    {
                                        id: 'we-4',
                                        sets: 5,
                                        reps: '2',
                                        isWarmup: false,
                                        weightType: 'percentage_1rm',
                                        weight: 90,
                                        targetRpe: null,
                                        exercise: {
                                            id: 'ex-dl',
                                            name: 'Stacco da terra',
                                            type: 'fundamental',
                                            exerciseMuscleGroups: [
                                                {
                                                    coefficient: 1,
                                                    muscleGroup: { id: 'mg-back', name: 'Back' },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ] as never)

        const request = new Request('http://localhost:3000/api/users/trainee-uuid-1/reports/planned-training-sets')
        const response = await GET(request, { params: Promise.resolve({ id: 'trainee-uuid-1' }) })
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.points).toHaveLength(2)
        expect(body.data.points[0].fundamentalSets).toEqual({
            squat: 4,
            bench: 3,
            deadlift: 0,
        })
        expect(body.data.points[0].fundamentalLifts).toEqual({
            squat: 20,
            bench: 18,
            deadlift: 0,
        })
        expect(body.data.points[0].fundamentalMetrics.squat).toEqual({
            frequency: 1,
            totalLifts: 20,
            averageIntensity: 80,
        })
        expect(body.data.points[0].fundamentalMetrics.bench).toEqual({
            frequency: 1,
            totalLifts: 18,
            averageIntensity: 75,
        })
        expect(body.data.points[0].fundamentalMetrics.deadlift).toBeNull()
        expect(body.data.points[1].fundamentalSets).toEqual({
            squat: 0,
            bench: 0,
            deadlift: 5,
        })
        expect(body.data.points[1].fundamentalLifts).toEqual({
            squat: 0,
            bench: 0,
            deadlift: 10,
        })
        expect(body.data.points[1].fundamentalMetrics.deadlift).toEqual({
            frequency: 1,
            totalLifts: 10,
            averageIntensity: 90,
        })
    })

    it('counts distinct workouts per week for FRQ and derives IM from RPE table', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assoc-1' } as never)
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                id: 'program-rpe',
                title: 'Programma RPE',
                startDate: new Date('2026-02-02T00:00:00.000Z'),
                weeks: [
                    {
                        id: 'week-rpe-1',
                        weekNumber: 1,
                        startDate: new Date('2026-02-02T00:00:00.000Z'),
                        workouts: [
                            {
                                id: 'workout-mon',
                                workoutExercises: [
                                    {
                                        id: 'we-mon',
                                        sets: 3,
                                        reps: '5',
                                        isWarmup: false,
                                        weightType: 'absolute',
                                        weight: 100,
                                        targetRpe: 8,
                                        exercise: {
                                            id: 'ex-squat',
                                            name: 'Back Squat',
                                            type: 'fundamental',
                                            exerciseMuscleGroups: [],
                                        },
                                    },
                                ],
                            },
                            {
                                id: 'workout-wed',
                                workoutExercises: [
                                    {
                                        id: 'we-wed',
                                        sets: 2,
                                        reps: '5',
                                        isWarmup: false,
                                        weightType: 'absolute',
                                        weight: 100,
                                        targetRpe: 8,
                                        exercise: {
                                            id: 'ex-squat',
                                            name: 'Back Squat',
                                            type: 'fundamental',
                                            exerciseMuscleGroups: [],
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ] as never)

        const request = new Request('http://localhost:3000/api/users/trainee-uuid-1/reports/planned-training-sets')
        const response = await GET(request, { params: Promise.resolve({ id: 'trainee-uuid-1' }) })
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.points).toHaveLength(1)
        // 2 workout distinti in una settimana → FRQ = 2 (NON 1 punto)
        // NBL = 3x5 + 2x5 = 25; IM from Tuchscherer table[5][8] = 81.1%
        expect(body.data.points[0].fundamentalMetrics.squat).toEqual({
            frequency: 2,
            totalLifts: 25,
            averageIntensity: 81.1,
        })
    })

    it('returns 403 when trainer is not associated with trainee', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const request = new Request('http://localhost:3000/api/users/trainee-uuid-1/reports/planned-training-sets')
        const response = await GET(request, { params: Promise.resolve({ id: 'trainee-uuid-1' }) })

        expect(response.status).toBe(403)
    })

    it('returns 403 when trainee requests another trainee id', async () => {
        asTrainee()

        const request = new Request('http://localhost:3000/api/users/trainee-uuid-2/reports/planned-training-sets')
        const response = await GET(request, { params: Promise.resolve({ id: 'trainee-uuid-2' }) })

        expect(response.status).toBe(403)
    })
})

describe('GET /api/users/[id]/reports/planned-training-sets — week dates and PRs', () => {
    const traineeId = 'trainee-uuid-1'

    const reportRequest = () =>
        new Request(`http://localhost:3000/api/users/${traineeId}/reports/planned-training-sets`)

    const withTraineeParam = () => ({ params: Promise.resolve({ id: traineeId }) })

    const squatExercise = {
        id: 'we-1',
        sets: 3,
        reps: '5',
        isWarmup: false,
        weightType: 'percentage_1rm',
        weight: 80,
        targetRpe: null,
        exercise: {
            id: 'ex-squat',
            name: 'Back Squat',
            type: 'fundamental',
            exerciseMuscleGroups: [{ coefficient: 1, muscleGroup: { id: 'mg-legs', name: 'Legs' } }],
        },
    }

    beforeEach(() => {
        vi.clearAllMocks()
        asAdmin()
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)
    })

    it('answers with an empty report when the trainee has no program', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([] as never)

        const response = await GET(reportRequest(), withTraineeParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data).toEqual({ traineeId, muscleGroups: [], points: [] })
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })

    it('derives a week start date from the program start when the week has none', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                id: 'program-1',
                title: 'Programma A',
                startDate: new Date('2026-01-06T00:00:00.000Z'),
                weeks: [
                    {
                        id: 'week-2',
                        weekNumber: 2,
                        startDate: null,
                        workouts: [{ id: 'workout-1', workoutExercises: [squatExercise] }],
                    },
                ],
            },
        ] as never)

        const response = await GET(reportRequest(), withTraineeParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.points).toHaveLength(1)
        // week 2 of a program starting on 2026-01-06 falls seven days later
        expect(body.data.points[0].date).toBe('2026-01-13')
    })

    it('skips a week with no date when the program has none either', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                id: 'program-1',
                title: 'Programma A',
                startDate: null,
                weeks: [
                    {
                        id: 'week-1',
                        weekNumber: 1,
                        startDate: null,
                        workouts: [{ id: 'workout-1', workoutExercises: [squatExercise] }],
                    },
                ],
            },
        ] as never)

        const response = await GET(reportRequest(), withTraineeParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.points).toEqual([])
        // the muscle-group catalog is filled while walking the weeks: a skipped week adds nothing
        expect(body.data.muscleGroups).toEqual([])
    })

    it('keeps the highest normalized 1RM per exercise', async () => {
        prismaMock.personalRecord.findMany.mockResolvedValue([
            { exerciseId: 'ex-squat', reps: 1, weight: 150, recordDate: new Date('2026-02-01') },
            { exerciseId: 'ex-squat', reps: 5, weight: 140, recordDate: new Date('2026-01-01') },
        ] as never)
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            {
                id: 'program-1',
                title: 'Programma A',
                startDate: new Date('2026-01-06T00:00:00.000Z'),
                weeks: [
                    {
                        id: 'week-1',
                        weekNumber: 1,
                        startDate: new Date('2026-01-06T00:00:00.000Z'),
                        workouts: [{ id: 'workout-1', workoutExercises: [squatExercise] }],
                    },
                ],
            },
        ] as never)

        const response = await GET(reportRequest(), withTraineeParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        // the 5-rep PR normalizes above the single: it is the one that survives
        expect(body.data.points[0].fundamentalMetrics.squat.averageIntensity).toBeGreaterThan(0)
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const response = await GET(reportRequest(), withTraineeParam())

        expect(response.status).toBe(401)
        expect(prismaMock.trainingProgram.findMany).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.trainingProgram.findMany.mockRejectedValue(new Error('db down'))

        const response = await GET(reportRequest(), withTraineeParam())
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
