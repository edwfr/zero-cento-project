import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession, mockAdminSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
        },
        personalRecord: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/programs/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function makeRequest(url = 'http://localhost:3000/api/programs/prog-1') {
    return new NextRequest(url)
}

const baseExercise = {
    id: 'we-1',
    workoutId: 'w-1',
    exerciseId: 'ex-1',
    sets: 3,
    reps: '8',
    targetRpe: 8,
    weightType: 'absolute' as const,
    weight: 100,
    effectiveWeight: 100,
    restTime: 'm2' as const,
    isWarmup: false,
    isSkeletonExercise: false,
    notes: null,
    variant: null,
    order: 1,
    exercise: { id: 'ex-1', name: 'Squat', type: 'fundamental' as const },
}

describe('GET /api/programs/[id] — trainee branch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
    })

    it('skips PR map fetch when all exercises are absolute', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: mockTraineeSession.user.id,
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [
                {
                    weekNumber: 1,
                    weekType: 'volume',
                    workouts: [
                        {
                            id: 'w-1',
                            dayIndex: 1,
                            workoutExercises: [baseExercise],
                        },
                    ],
                },
            ],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: mockTraineeSession.user.id, firstName: 'M', lastName: 'A' },
        })

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(100)
        expect(prisma.personalRecord.findMany).not.toHaveBeenCalled()
    })

    it('fetches PR map when at least one exercise needs resolution', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: mockTraineeSession.user.id,
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [
                {
                    weekNumber: 1,
                    weekType: 'volume',
                    workouts: [
                        {
                            id: 'w-1',
                            dayIndex: 1,
                            workoutExercises: [
                                { ...baseExercise, weightType: 'percentage_1rm' as const, weight: 80, effectiveWeight: null },
                            ],
                        },
                    ],
                },
            ],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: mockTraineeSession.user.id, firstName: 'M', lastName: 'A' },
        })
        ;(prisma.personalRecord.findMany as any).mockResolvedValue([
            { exerciseId: 'ex-1', reps: 1, weight: 150, recordDate: new Date() },
        ])

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(120)
        expect(prisma.personalRecord.findMany).toHaveBeenCalledTimes(1)
    })
})

describe('GET /api/programs/[id] — trainee select shape', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: mockTraineeSession.user.id,
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: mockTraineeSession.user.id, firstName: 'M', lastName: 'A' },
        })
    })

    it('does not include movementPattern/exerciseMuscleGroups when role is trainee', async () => {
        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = (prisma.trainingProgram.findUnique as any).mock.calls[0][0]
        const exerciseInclude = call.include.weeks.include.workouts.include.workoutExercises.include.exercise

        // Trainee branch must use `select`, not `include` with movementPattern.
        expect(exerciseInclude.include).toBeUndefined()
        expect(exerciseInclude.select).toEqual({ id: true, name: true, type: true })
    })
})

describe('GET /api/programs/[id] — admin select shape', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockAdminSession)
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'prog-1',
            traineeId: 'trainee-1',
            trainerId: 'trainer-1',
            title: 'Test',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: 'trainee-1', firstName: 'M', lastName: 'A' },
        })
    })

    it('keeps full movementPattern + exerciseMuscleGroups include', async () => {
        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = (prisma.trainingProgram.findUnique as any).mock.calls[0][0]
        const exerciseInclude = call.include.weeks.include.workouts.include.workoutExercises.include.exercise.include

        expect(exerciseInclude.movementPattern).toBeDefined()
        expect(exerciseInclude.exerciseMuscleGroups).toBeDefined()
    })
})
