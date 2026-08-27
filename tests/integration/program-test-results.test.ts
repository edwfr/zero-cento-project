import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockTraineeSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}))

import { GET } from '@/app/api/programs/[id]/test-results/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest(url = 'http://localhost:3000/api/programs/prog-1/test-results') {
    return new NextRequest(url)
}

describe('GET /api/programs/[id]/test-results', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns workout results for all weeks (not only test weeks)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-1',
            title: 'Block A',
            trainerId: 'trainer-uuid-1',
            traineeId: 'trainee-uuid-1',
            trainee: {
                id: 'trainee-uuid-1',
                firstName: 'Mario',
                lastName: 'Atleta',
            },
            weeks: [
                {
                    id: 'week-normal',
                    weekNumber: 1,
                    weekType: 'normal',
                    startDate: new Date('2026-06-01'),
                    workouts: [
                        {
                            id: 'wo-1',
                            dayIndex: 1,
                            sleepQuality: 4,
                            stressLevel: 2,
                            nutritionQuality: 5,
                            traineeNotes: 'Solid session',
                            workoutExercises: [
                                {
                                    id: 'we-1',
                                    sets: 3,
                                    reps: '5',
                                    targetRpe: 7.5,
                                    weight: 100,
                                    notes: null,
                                    exercise: {
                                        name: 'Back Squat',
                                    },
                                    exerciseFeedbacks: [
                                        {
                                            id: 'fb-1',
                                            date: new Date('2026-06-01'),
                                            actualRpe: 8,
                                            notes: 'Felt good',
                                            setsPerformed: [
                                                { setNumber: 1, reps: 5, weight: 102.5, completed: true },
                                                { setNumber: 2, reps: 5, weight: 102.5, completed: true },
                                                { setNumber: 3, reps: 5, weight: 102.5, completed: true },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'week-test',
                    weekNumber: 2,
                    weekType: 'test',
                    startDate: new Date('2026-06-08'),
                    workouts: [
                        {
                            id: 'wo-2',
                            dayIndex: 2,
                            traineeNotes: null,
                            workoutExercises: [
                                {
                                    id: 'we-2',
                                    sets: 1,
                                    reps: '1',
                                    targetRpe: null,
                                    weight: 140,
                                    notes: null,
                                    exercise: {
                                        name: 'Deadlift',
                                    },
                                    exerciseFeedbacks: [],
                                },
                            ],
                        },
                    ],
                },
            ],
        } as any)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.weeks).toHaveLength(2)
        expect(body.data.weeks[0].weekId).toBe('week-normal')
        expect(body.data.weeks[0].weekType).toBe('normal')
        expect(body.data.weeks[1].weekType).toBe('test')
        expect(body.data.weeks[0].workouts[0].rows[0]).toMatchObject({
            exerciseName: 'Back Squat',
            sets: 3,
            reps: '5 / 5 / 5',
            weightUsed: '102.5 / 102.5 / 102.5',
            rpe: 8,
            comments: 'Felt good',
        })
        expect(body.data.weeks[0].workouts[0]).toMatchObject({
            sleepQuality: 4,
            stressLevel: 2,
            nutritionQuality: 5,
        })

        // Backward-compatible alias retained for existing clients.
        expect(body.data.testWeeks).toHaveLength(2)
    })

    it('returns 404 when program does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'missing-program' }) })

        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer tries to access another trainer program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-2',
            title: 'Other Program',
            trainerId: 'other-trainer',
            traineeId: 'trainee-uuid-1',
            trainee: {
                id: 'trainee-uuid-1',
                firstName: 'Mario',
                lastName: 'Atleta',
            },
            weeks: [],
        } as any)

        const res = await GET(makeRequest('http://localhost:3000/api/programs/prog-2/test-results'), {
            params: Promise.resolve({ id: 'prog-2' }),
        })

        expect(res.status).toBe(403)
    })

    it('returns 403 when trainee tries to access a program not assigned to them', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: 'prog-3',
            title: 'Another Program',
            trainerId: 'trainer-uuid-1',
            traineeId: 'another-trainee',
            trainee: {
                id: 'another-trainee',
                firstName: 'Luca',
                lastName: 'Rossi',
            },
            weeks: [],
        } as any)

        const res = await GET(makeRequest('http://localhost:3000/api/programs/prog-3/test-results'), {
            params: Promise.resolve({ id: 'prog-3' }),
        })

        expect(res.status).toBe(403)
    })
})
