import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET, PUT, DELETE } from '@/app/api/programs/[id]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession, mockTraineeSession, makeTrainerSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated } from '../helpers/auth-mock'
import { callArg } from '../helpers/call-args'

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
        } as never)

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
        } as never)
        ;prismaMock.personalRecord.findMany.mockResolvedValue([
            { exerciseId: 'ex-1', reps: 1, weight: 150, recordDate: new Date() },
        ] as never)

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
        } as never)
    })

    it('does not include movementPattern/exerciseMuscleGroups when role is trainee', async () => {
        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = callArg(prismaMock.trainingProgram.findUnique.mock.calls[0][0])
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
        } as never)
    })

    it('keeps full movementPattern + exerciseMuscleGroups include', async () => {
        await GET(makeRequest(), { params: Promise.resolve({ id: 'prog-1' }) })

        const call = callArg(prismaMock.trainingProgram.findUnique.mock.calls[0][0])
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
            } as never)
            ;prismaMock.trainingProgram.delete.mockResolvedValue({ id: 'prog-1' } as never)

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
        } as never)
        ;prismaMock.trainingProgram.delete.mockResolvedValue({ id: 'prog-1' } as never)

        const res = await DELETE(makeRequest(), withIdParam('prog-1'))

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.delete).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
        })
    })
})

// ─── GET: access control and enrichment ───────────────────────────────────────

const withProgramParam = (id = 'prog-1') => ({ params: Promise.resolve({ id }) })

describe('GET /api/programs/[id] — access control', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await GET(makeRequest(), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('program.notFound')
    })

    it('returns 403 for a trainer who does not own the program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-1',
            trainerId: 'another-trainer',
            traineeId: 'trainee-1',
            status: 'draft',
            weeks: [],
        } as never)

        const res = await GET(makeRequest(), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.viewDenied')
    })

    it('returns 403 for a trainee the program is not assigned to', async () => {
        asTrainee()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-1',
            trainerId: 'trainer-1',
            traineeId: 'another-trainee',
            status: 'draft',
            weeks: [],
        } as never)

        const res = await GET(makeRequest(), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.viewAssignedDenied')
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await GET(makeRequest(), withProgramParam())

        expect(res.status).toBe(401)
        expect(prismaMock.trainingProgram.findUnique).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.trainingProgram.findUnique.mockRejectedValue(new Error('db down'))

        const res = await GET(makeRequest(), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(500)
        expect(json.error.key).toBe('internal.default')
    })

    it('marks the workouts an athlete already started for the trainer', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-1',
            trainerId: mockTrainerSession.user.id,
            traineeId: 'trainee-1',
            status: 'active',
            title: 'Test',
            weeks: [
                {
                    weekNumber: 1,
                    weekType: 'volume',
                    workouts: [
                        { id: 'w-1', dayIndex: 1, workoutExercises: [baseExercise] },
                        { id: 'w-2', dayIndex: 2, workoutExercises: [] },
                    ],
                },
            ],
            workoutSkeletons: [{ id: 'sk-1', dayIndex: 1, order: 1, exerciseId: 'ex-1' }],
            trainer: { id: mockTrainerSession.user.id, firstName: 'T', lastName: 'R' },
            trainee: { id: 'trainee-1', firstName: 'M', lastName: 'A' },
        } as never)
        prismaMock.workout.findMany.mockResolvedValue([{ id: 'w-1' }] as never)

        const res = await GET(makeRequest(), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program.weeks[0].workouts.map((w: { isStarted: boolean }) => w.isStarted)).toEqual([true, false])
        expect(json.data.program.skeleton).toHaveLength(1)
    })

    it('reports a null effective weight when the resolution throws', async () => {
        asTrainee()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: 'prog-1',
            trainerId: 'trainer-1',
            traineeId: mockTraineeSession.user.id,
            status: 'active',
            title: 'Test',
            weeks: [
                {
                    weekNumber: 1,
                    weekType: 'volume',
                    workouts: [
                        {
                            id: 'w-1',
                            dayIndex: 1,
                            workoutExercises: [
                                {
                                    ...baseExercise,
                                    weightType: 'percentage_previous' as const,
                                    weight: 90,
                                    effectiveWeight: null,
                                    order: 1,
                                },
                            ],
                        },
                    ],
                },
            ],
            trainer: { id: 'trainer-1', firstName: 'T', lastName: 'R' },
            trainee: { id: mockTraineeSession.user.id, firstName: 'M', lastName: 'A' },
        } as never)
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)

        const res = await GET(makeRequest(), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program.weeks[0].workouts[0].workoutExercises[0].effectiveWeight).toBeNull()
    })
})

// ─── PUT: metadata update and structure alignment ─────────────────────────────

const draftProgram = {
    id: 'prog-1',
    title: 'Blocco forza',
    status: 'draft',
    trainerId: mockTrainerSession.user.id,
    traineeId: 'trainee-uuid-1',
    durationWeeks: 2,
    workoutsPerWeek: 2,
    weeks: [
        { id: 'week-1', weekNumber: 1, workouts: [{ id: 'w-1', dayIndex: 1 }, { id: 'w-2', dayIndex: 2 }] },
        { id: 'week-2', weekNumber: 2, workouts: [{ id: 'w-3', dayIndex: 1 }, { id: 'w-4', dayIndex: 2 }] },
    ],
}

const updatedProgram = { id: 'prog-1', title: 'Blocco ipertrofia' }

const TRAINEE_UUID = '33333333-3333-4333-8333-333333333333'

function putRequest(body: unknown) {
    return new NextRequest('http://localhost:3000/api/programs/prog-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

/** Outer lookup returns `existing`, the one inside the transaction the final program. */
function stubProgramLookups(existing: unknown = draftProgram, final: unknown = updatedProgram) {
    prismaMock.trainingProgram.findUnique
        .mockResolvedValueOnce(existing as never)
        .mockResolvedValueOnce(final as never)
}

describe('PUT /api/programs/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.week.findMany.mockResolvedValue(draftProgram.weeks as never)
        prismaMock.trainingProgram.update.mockResolvedValue({ id: 'prog-1' } as never)
        prismaMock.week.createMany.mockResolvedValue({ count: 0 } as never)
        prismaMock.workout.createMany.mockResolvedValue({ count: 0 } as never)
    })

    it('updates the metadata of a draft program', async () => {
        stubProgramLookups()

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.program).toMatchObject({ id: 'prog-1', title: 'Blocco ipertrofia' })
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
            data: { title: 'Blocco ipertrofia' },
        })
        expect(prismaMock.week.createMany).not.toHaveBeenCalled()
        expect(prismaMock.workout.createMany).not.toHaveBeenCalled()
    })

    it('creates the missing weeks when the duration grows', async () => {
        stubProgramLookups()
        prismaMock.week.findMany
            .mockResolvedValueOnce(draftProgram.weeks as never)
            .mockResolvedValueOnce([
                ...draftProgram.weeks,
                { id: 'week-3', weekNumber: 3, workouts: [] },
            ] as never)

        const res = await PUT(putRequest({ durationWeeks: 3 }), withProgramParam())

        expect(res.status).toBe(200)
        expect(prismaMock.week.createMany).toHaveBeenCalledWith({
            data: [{ programId: 'prog-1', weekNumber: 3 }],
        })
        expect(prismaMock.workout.createMany).toHaveBeenCalledWith({
            data: [
                { weekId: 'week-3', dayIndex: 1 },
                { weekId: 'week-3', dayIndex: 2 },
            ],
        })
    })

    it('creates the missing workouts when workoutsPerWeek grows', async () => {
        stubProgramLookups()

        const res = await PUT(putRequest({ workoutsPerWeek: 3 }), withProgramParam())

        expect(res.status).toBe(200)
        expect(prismaMock.week.createMany).not.toHaveBeenCalled()
        expect(prismaMock.workout.createMany).toHaveBeenCalledWith({ data: [{ weekId: 'week-1', dayIndex: 3 }] })
        expect(prismaMock.workout.createMany).toHaveBeenCalledWith({ data: [{ weekId: 'week-2', dayIndex: 3 }] })
    })

    it('reassigns the program to a trainee the trainer manages', async () => {
        stubProgramLookups()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_UUID, role: 'trainee' } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: TRAINEE_UUID,
        } as never)

        const res = await PUT(putRequest({ traineeId: TRAINEE_UUID }), withProgramParam())

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
            data: { traineeId: TRAINEE_UUID },
        })
    })

    it('returns 403 when the trainer does not manage the new trainee', async () => {
        stubProgramLookups()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_UUID, role: 'trainee' } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await PUT(putRequest({ traineeId: TRAINEE_UUID }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.assignDenied')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the new trainee does not exist', async () => {
        stubProgramLookups()
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await PUT(putRequest({ traineeId: TRAINEE_UUID }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('trainee.notFound')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 400 when the new assignee is not a trainee', async () => {
        stubProgramLookups()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_UUID, role: 'trainer' } as never)

        const res = await PUT(putRequest({ traineeId: TRAINEE_UUID }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.userMustBeTrainee')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 400 when the title is too short', async () => {
        const res = await PUT(putRequest({ title: 'ab' }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.invalidInput')
        expect(prismaMock.trainingProgram.findUnique).not.toHaveBeenCalled()
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('program.notFound')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainer who does not own the program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgram,
            trainerId: 'another-trainer',
        } as never)

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.modifyDenied')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('refuses to edit a non-draft program as a trainer', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({ ...draftProgram, status: 'active' } as never)

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.cannotModifyNonDraft')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('lets an admin edit an active program', async () => {
        asAdmin()
        stubProgramLookups({ ...draftProgram, status: 'active' })

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
            data: { title: 'Blocco ipertrofia' },
        })
    })

    it('refuses to shrink the duration below the configured weeks', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(draftProgram as never)

        const res = await PUT(putRequest({ durationWeeks: 1 }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('program.cannotReduceDurationWeeks')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('refuses to shrink workoutsPerWeek below the configured workouts', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(draftProgram as never)

        const res = await PUT(putRequest({ workoutsPerWeek: 1 }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('program.cannotReduceWorkoutsPerWeek')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the program disappears inside the transaction', async () => {
        stubProgramLookups(draftProgram, null)

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('program.notFound')
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())

        expect(res.status).toBe(401)
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the transaction fails', async () => {
        stubProgramLookups()
        prismaMock.trainingProgram.update.mockRejectedValue(new Error('db down'))

        const res = await PUT(putRequest({ title: 'Blocco ipertrofia' }), withProgramParam())
        const json = await res.json()

        expect(res.status).toBe(500)
        expect(json.error.key).toBe('internal.default')
    })
})
