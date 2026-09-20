import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET, DELETE } from '@/app/api/programs/[id]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession, mockTraineeSession, makeTrainerSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asTrainee } from '../helpers/auth-mock'

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
    notes: null,
    variant: null,
    order: 1,
    exercise: { id: 'ex-1', name: 'Squat', type: 'fundamental' as const },
}

describe('GET /api/programs/[id] — trainee branch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;asTrainee()
    })

    it('skips PR map fetch when all exercises are absolute', async () => {
        ;prismaMock.trainingProgram.findUnique.mockResolvedValue({
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
        expect(prismaMock.personalRecord.findMany).not.toHaveBeenCalled()
    })

    it('fetches PR map when at least one exercise needs resolution', async () => {
        ;prismaMock.trainingProgram.findUnique.mockResolvedValue({
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
        ;prismaMock.personalRecord.findMany.mockResolvedValue([
            { exerciseId: 'ex-1', reps: 1, weight: 150, recordDate: new Date() },
        ])

        const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBe(120)
        expect(prismaMock.personalRecord.findMany).toHaveBeenCalledTimes(1)
    })
})

describe('GET /api/programs/[id] — trainee select shape', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;asTrainee()
        ;prismaMock.trainingProgram.findUnique.mockResolvedValue({
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

        const call = prismaMock.trainingProgram.findUnique.mock.calls[0][0]
        const exerciseInclude = call.include.weeks.include.workouts.include.workoutExercises.include.exercise

        // Trainee branch must use `select`, not `include` with movementPattern.
        expect(exerciseInclude.include).toBeUndefined()
        expect(exerciseInclude.select).toEqual({ id: true, name: true, type: true })
    })
})

describe('GET /api/programs/[id] — admin select shape', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;asAdmin()
        ;prismaMock.trainingProgram.findUnique.mockResolvedValue({
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

        const call = prismaMock.trainingProgram.findUnique.mock.calls[0][0]
        const exerciseInclude = call.include.weeks.include.workouts.include.workoutExercises.include.exercise.include

        expect(exerciseInclude.movementPattern).toBeDefined()
        expect(exerciseInclude.exerciseMuscleGroups).toBeDefined()
    })
})

describe('DELETE /api/programs/[id] — trainer deletion', () => {
    const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

    beforeEach(() => {
        vi.clearAllMocks()
        ;asTrainer()
    })

    it.each(['draft', 'active', 'completed'])(
        'lets the owning trainer delete a %s program',
        async (status) => {
            ;prismaMock.trainingProgram.findUnique.mockResolvedValue({
                id: 'prog-1',
                trainerId: mockTrainerSession.user.id,
                traineeId: 'trainee-uuid-1',
                status,
            })
            ;prismaMock.trainingProgram.delete.mockResolvedValue({ id: 'prog-1' })

            const res = await DELETE(makeRequest(), withIdParam('prog-1'))
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.data.messageKey).toBe('program.deletedSuccess')
            expect(prismaMock.trainingProgram.delete).toHaveBeenCalledWith({
                where: { id: 'prog-1' },
            })
        }
    )

    it('rejects deletion of a program owned by another trainer', async () => {
        asTrainer(makeTrainerSession({ id: 'other-trainer' }))
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-1',
            trainerId: mockTrainerSession.user.id,
            traineeId: 'trainee-uuid-1',
            status: 'active',
        } as never)

        const res = await DELETE(makeRequest(), withIdParam('prog-1'))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.deleteDenied')
        expect(prismaMock.trainingProgram.delete).not.toHaveBeenCalled()
    })

    it('returns 404 when the program does not exist', async () => {
        ;prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await DELETE(makeRequest(), withIdParam('missing'))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
        expect(prismaMock.trainingProgram.delete).not.toHaveBeenCalled()
    })

    it('lets an admin delete any program', async () => {
        ;asAdmin()
        ;prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-1',
            trainerId: 'someone-else',
            traineeId: 'trainee-uuid-1',
            status: 'completed',
        })
        ;prismaMock.trainingProgram.delete.mockResolvedValue({ id: 'prog-1' })

        const res = await DELETE(makeRequest(), withIdParam('prog-1'))

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.delete).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
        })
    })
})
