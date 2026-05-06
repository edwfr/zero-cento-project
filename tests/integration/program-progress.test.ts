import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findUnique: vi.fn() },
        workout: { findMany: vi.fn() },
        exerciseFeedback: { aggregate: vi.fn() },
        setPerformed: { findMany: vi.fn() },
        $queryRaw: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/trainee-program-data', () => ({
    loadProgressAggregates: vi.fn(),
}))

import { GET } from '@/app/api/programs/[id]/progress/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadProgressAggregates } from '@/lib/trainee-program-data'

function makeRequest(url = 'http://localhost:3000/api/programs/prog-1/progress') {
    return new NextRequest(url)
}

const programMeta = {
    id: 'prog-1',
    title: 'Test',
    status: 'active' as const,
    startDate: new Date('2026-04-01'),
    durationWeeks: 4,
    trainerId: 'trainer-1',
    traineeId: mockTraineeSession.user.id,
}

beforeEach(() => {
    vi.clearAllMocks()
    ;(requireRole as any).mockResolvedValue(mockTraineeSession)
    ;(prisma.trainingProgram.findUnique as any).mockResolvedValue(programMeta)
})

describe('GET /api/programs/[id]/progress', () => {
    it('does not load full program tree (no nested workoutExercises include)', async () => {
        ;(loadProgressAggregates as any).mockResolvedValue({
            programId: 'prog-1',
            programName: 'Test',
            status: 'active',
            currentWeek: 1,
            totalWeeks: 4,
            completedWorkouts: 0,
            totalWorkouts: 0,
            feedbackCount: 0,
            avgRPE: null,
            totalVolume: 0,
            nextWorkout: null,
            workouts: [],
            weeklyStats: [],
        })

        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = (prisma.trainingProgram.findUnique as any).mock.calls[0][0]
        // metadata fetch must use `select`, never `include` with weeks
        expect(call.include).toBeUndefined()
        expect(call.select).toBeDefined()
        expect(call.select.weeks).toBeUndefined()
    })

    it('returns the documented response shape with zero data', async () => {
        ;(loadProgressAggregates as any).mockResolvedValue({
            programId: 'prog-1',
            programName: 'Test',
            status: 'active',
            currentWeek: 1,
            totalWeeks: 4,
            completedWorkouts: 0,
            totalWorkouts: 0,
            feedbackCount: 0,
            avgRPE: null,
            totalVolume: 0,
            nextWorkout: null,
            workouts: [],
            weeklyStats: [],
        })

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toMatchObject({
            programId: 'prog-1',
            programName: 'Test',
            status: 'active',
            totalWeeks: 4,
            completedWorkouts: 0,
            totalWorkouts: 0,
            feedbackCount: 0,
            avgRPE: null,
            totalVolume: 0,
            nextWorkout: null,
            workouts: [],
            weeklyStats: [],
        })
    })

    it('aggregates completion counts per workout from $queryRaw rows', async () => {
        ;(loadProgressAggregates as any).mockResolvedValue({
            programId: 'prog-1',
            programName: 'Test',
            status: 'active',
            currentWeek: 1,
            totalWeeks: 4,
            completedWorkouts: 1,
            totalWorkouts: 2,
            feedbackCount: 5,
            avgRPE: 8.4,
            totalVolume: 5000,
            nextWorkout: null,
            workouts: [
                {
                    id: 'w-1',
                    name: 'Giorno 1',
                    weekNumber: 1,
                    weekType: 'volume',
                    dayOfWeek: 1,
                    exerciseCount: 3,
                    completed: true,
                    started: true,
                    feedbackCount: 3,
                    exercisesPerformed: [],
                },
                {
                    id: 'w-2',
                    name: 'Giorno 2',
                    weekNumber: 1,
                    weekType: 'volume',
                    dayOfWeek: 2,
                    exerciseCount: 3,
                    completed: false,
                    started: true,
                    feedbackCount: 2,
                    exercisesPerformed: [],
                },
            ],
            weeklyStats: [
                {
                    weekNumber: 1,
                    weekType: 'volume',
                    totalVolume: 5000,
                    avgRPE: 8.4,
                    completedWorkouts: 1,
                    totalWorkouts: 2,
                    feedbackCount: 5,
                },
            ],
        })

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.totalWorkouts).toBe(2)
        expect(json.data.completedWorkouts).toBe(1)
        expect(json.data.avgRPE).toBe(8.4)
        expect(json.data.feedbackCount).toBe(5)
        expect(json.data.totalVolume).toBe(5000)
        expect(json.data.workouts).toHaveLength(2)
        expect(json.data.workouts[0]).toMatchObject({
            id: 'w-1',
            completed: true,
            started: true,
            feedbackCount: 3,
            exerciseCount: 3,
        })
        expect(json.data.weeklyStats[0]).toMatchObject({
            weekNumber: 1,
            totalVolume: 5000,
            avgRPE: 8.4,
            completedWorkouts: 1,
            totalWorkouts: 2,
        })
    })

    it('populates exercisesPerformed from latest completed feedback set rows', async () => {
        ;(loadProgressAggregates as any).mockResolvedValue({
            programId: 'prog-1',
            programName: 'Test',
            status: 'active',
            currentWeek: 1,
            totalWeeks: 4,
            completedWorkouts: 0,
            totalWorkouts: 1,
            feedbackCount: 1,
            avgRPE: null,
            totalVolume: 0,
            nextWorkout: null,
            workouts: [
                {
                    id: 'w-1',
                    name: 'Giorno 1',
                    weekNumber: 1,
                    weekType: 'volume',
                    dayOfWeek: 1,
                    exerciseCount: 1,
                    completed: false,
                    started: true,
                    feedbackCount: 1,
                    exercisesPerformed: [
                        {
                            workoutExerciseId: 'we-1',
                            performedSets: [
                                { setNumber: 1, reps: 8, weight: 100 },
                                { setNumber: 2, reps: 8, weight: 100 },
                            ],
                        },
                    ],
                },
            ],
            weeklyStats: [],
        })

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(json.data.workouts[0].exercisesPerformed).toEqual([
            {
                workoutExerciseId: 'we-1',
                performedSets: [
                    { setNumber: 1, reps: 8, weight: 100 },
                    { setNumber: 2, reps: 8, weight: 100 },
                ],
            },
        ])
    })
})
