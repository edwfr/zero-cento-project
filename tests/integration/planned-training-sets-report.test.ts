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
                                        isWarmup: false,
                                        exercise: {
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
                                        isWarmup: false,
                                        exercise: {
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
                                        isWarmup: true,
                                        exercise: {
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
                                        isWarmup: false,
                                        exercise: {
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
        expect(body.data.points[1].fundamentalSets).toEqual({
            squat: 0,
            bench: 0,
            deadlift: 5,
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
