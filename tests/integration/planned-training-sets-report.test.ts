import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockTrainerSession, mockTraineeSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainerTrainee: {
            findFirst: vi.fn(),
        },
        trainingProgram: {
            findMany: vi.fn(),
        },
        personalRecord: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET } from '@/app/api/users/[id]/reports/planned-training-sets/route'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('GET /api/users/[id]/reports/planned-training-sets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([])
    })

    it('aggregates muscle groups and fundamental sets across programs', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({ id: 'assoc-1' } as any)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([
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
        ] as any)

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
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({ id: 'assoc-1' } as any)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([
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
        ] as any)

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
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

        const request = new Request('http://localhost:3000/api/users/trainee-uuid-1/reports/planned-training-sets')
        const response = await GET(request, { params: Promise.resolve({ id: 'trainee-uuid-1' }) })

        expect(response.status).toBe(403)
    })

    it('returns 403 when trainee requests another trainee id', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockTraineeSession)

        const request = new Request('http://localhost:3000/api/users/trainee-uuid-2/reports/planned-training-sets')
        const response = await GET(request, { params: Promise.resolve({ id: 'trainee-uuid-2' }) })

        expect(response.status).toBe(403)
    })
})
