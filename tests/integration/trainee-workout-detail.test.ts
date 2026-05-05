import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        workout: {
            findUnique: vi.fn(),
        },
        exerciseFeedback: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/calculations', () => ({
    loadTraineePrMap: vi.fn(),
    resolveEffectiveWeight: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/trainee/workouts/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadTraineePrMap, resolveEffectiveWeight } from '@/lib/calculations'

function makeRequest(url = 'http://localhost:3000/api/trainee/workouts/workout-1') {
    return new NextRequest(url)
}

describe('GET /api/trainee/workouts/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(loadTraineePrMap).mockResolvedValue(new Map())
        vi.mocked(resolveEffectiveWeight).mockReturnValue(100)
        vi.mocked(prisma.workout.findUnique).mockResolvedValue({
            id: 'workout-1',
            dayIndex: 1,
            notes: 'Workout notes',
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
                    sets: 2,
                    reps: '5',
                    targetRpe: 8,
                    weightType: 'absolute',
                    weight: 100,
                    effectiveWeight: 100,
                    restTime: 'm2',
                    isWarmup: false,
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
        } as any)
    })

    it('hydrates the latest feedback for each exercise even when it was saved before today', async () => {
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([
            {
                id: 'fb-latest',
                workoutExerciseId: 'we-1',
                actualRpe: 8,
                notes: 'saved yesterday',
                date: new Date('2026-04-29T00:00:00.000Z'),
                updatedAt: new Date('2026-04-29T18:00:00.000Z'),
                setsPerformed: [
                    { setNumber: 1, completed: true, reps: 5, weight: 100 },
                    { setNumber: 2, completed: true, reps: 5, weight: 100 },
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
                    { setNumber: 1, completed: false, reps: 0, weight: 100 },
                    { setNumber: 2, completed: false, reps: 0, weight: 100 },
                ],
            },
        ] as any)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'workout-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(prisma.exerciseFeedback.findMany).toHaveBeenCalledWith({
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
            { setNumber: 1, completed: true, reps: 5, weight: 100 },
            { setNumber: 2, completed: true, reps: 5, weight: 100 },
        ])
    })

    it('preserves completed sets from older feedback rows when a newer snapshot is incomplete', async () => {
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([
            {
                id: 'fb-newer-incomplete',
                workoutExerciseId: 'we-1',
                traineeId: mockTraineeSession.user.id,
                actualRpe: null,
                notes: null,
                date: new Date('2026-04-30T00:00:00.000Z'),
                updatedAt: new Date('2026-04-30T18:00:00.000Z'),
                setsPerformed: [
                    { setNumber: 1, completed: false, reps: 0, weight: 100 },
                    { setNumber: 2, completed: false, reps: 0, weight: 100 },
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
                    { setNumber: 1, completed: true, reps: 5, weight: 100 },
                    { setNumber: 2, completed: true, reps: 5, weight: 100 },
                ],
            },
        ] as any)

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'workout-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.workout.exercises[0].feedback.notes).toBe('completed earlier')
        expect(json.data.workout.exercises[0].feedback.avgRPE).toBe(8)
        expect(json.data.workout.exercises[0].feedback.setsPerformed).toEqual([
            { setNumber: 1, completed: true, reps: 5, weight: 100 },
            { setNumber: 2, completed: true, reps: 5, weight: 100 },
        ])
    })
})