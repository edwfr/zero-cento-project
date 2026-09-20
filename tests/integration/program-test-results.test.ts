import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}))

import { GET } from '@/app/api/programs/[id]/test-results/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asTrainee } from '../helpers/auth-mock'

function makeRequest(url = 'http://localhost:3000/api/programs/prog-1/test-results') {
    return new NextRequest(url)
}

describe('GET /api/programs/[id]/test-results', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns workout results for all weeks (not only test weeks)', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
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
                                    effectiveWeight: 100,
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
                                                { setNumber: 1, reps: 5, weight: 102.5, actualRpe: 7, completed: true },
                                                { setNumber: 2, reps: 4, weight: 102.5, actualRpe: null, completed: true },
                                                { setNumber: 3, reps: 3, weight: 105, actualRpe: 9.5, completed: true },
                                                { setNumber: 4, reps: 1, weight: 110, actualRpe: 10, completed: false },
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
                                    effectiveWeight: null,
                                    notes: null,
                                    exercise: {
                                        name: 'Deadlift',
                                    },
                                    exerciseFeedbacks: [],
                                },
                                {
                                    id: 'we-3',
                                    sets: 2,
                                    reps: '3',
                                    targetRpe: 8,
                                    weight: 60,
                                    effectiveWeight: 60,
                                    notes: null,
                                    exercise: {
                                        name: 'Bench Press',
                                    },
                                    exerciseFeedbacks: [
                                        {
                                            id: 'fb-3',
                                            date: new Date('2026-06-08'),
                                            actualRpe: null,
                                            notes: '  ',
                                            setsPerformed: [
                                                { setNumber: 1, reps: 3, weight: 60, actualRpe: null, completed: true },
                                                { setNumber: 2, reps: 3, weight: 62.5, actualRpe: null, completed: true },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        } as never)

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
            reps: '5',
            rpe: 7.5,
            plannedWeight: 100,
            repsDone: '5 / 4 / 3',
            rpeDone: '7 / - / 9.5',
            weightUsed: '102.5 / 102.5 / 105',
            comments: 'Felt good',
        })
        expect(body.data.weeks[1].workouts[0].rows[0]).toMatchObject({
            exerciseName: 'Deadlift',
            sets: 1,
            reps: '1',
            rpe: null,
            plannedWeight: null,
            repsDone: '-',
            rpeDone: '-',
            weightUsed: '-',
            comments: null,
        })
        expect(body.data.weeks[1].workouts[0].rows[1]).toMatchObject({
            exerciseName: 'Bench Press',
            sets: 2,
            repsDone: '3 / 3',
            rpeDone: '-',
            weightUsed: '60 / 62.5',
            comments: null,
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
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'missing-program' }) })

        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer tries to access another trainer program', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
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
        } as never)

        const res = await GET(makeRequest('http://localhost:3000/api/programs/prog-2/test-results'), {
            params: Promise.resolve({ id: 'prog-2' }),
        })

        expect(res.status).toBe(403)
    })

    it('returns 403 when trainee tries to access a program not assigned to them', async () => {
        asTrainee()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
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
        } as never)

        const res = await GET(makeRequest('http://localhost:3000/api/programs/prog-3/test-results'), {
            params: Promise.resolve({ id: 'prog-3' }),
        })

        expect(res.status).toBe(403)
    })
})
