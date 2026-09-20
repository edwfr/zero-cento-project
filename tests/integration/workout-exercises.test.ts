import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { POST as addExercise } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/route'
import { PUT as updateExercise, DELETE as deleteExercise } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route'
import { PATCH as reorderExercises } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/reorder/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession, mockAdminSession, makeTrainerSession } from '../helpers/sessions'

const PROGRAM_ID = '55555555-5555-5555-5555-555555555551'
const WORKOUT_ID = '66666666-6666-6666-6666-666666666661'
const EXERCISE_ID = '33333333-3333-3333-3333-333333333331'
const WE_ID = '77777777-7777-7777-7777-777777777771'
const WE_ID_2 = '77777777-7777-7777-7777-777777777772'

const withParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) })

function makeRequest(body?: unknown, method = 'POST') {
    return new NextRequest(`http://localhost:3000/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
}

const draftProgram = {
    id: PROGRAM_ID,
    trainerId: mockTrainerSession.user.id,
    status: 'draft',
    weeks: [{ id: 'week-1', weekNumber: 1, workouts: [{ id: WORKOUT_ID, dayIndex: 0 }] }],
}

const validBody = {
    exerciseId: EXERCISE_ID,
    sets: 3,
    reps: '5',
    weightType: 'absolute' as const,
    weight: 100,
    restTime: 'm2' as const,
    isWarmup: false,
    isJumpSet: false,
    isSuperSet: false,
    order: 1,
}

describe('POST /api/programs/[id]/workouts/[workoutId]/exercises', () => {
    beforeEach(() => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(draftProgram as never)
        prismaMock.exercise.findUnique.mockResolvedValue({ id: EXERCISE_ID, name: 'Squat' } as never)
        prismaMock.workoutExercise.findFirst.mockResolvedValue({ order: 2 } as never)
        prismaMock.workoutExercise.create.mockResolvedValue({ id: WE_ID, order: 1 } as never)
        prismaMock.setPerformed.count.mockResolvedValue(0 as never)
    })

    it('creates the exercise with the requested order', async () => {
        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))

        expect(res.status).toBe(201)
        expect(prismaMock.workoutExercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    workoutId: WORKOUT_ID,
                    exerciseId: EXERCISE_ID,
                    order: 1,
                    sets: 3,
                    reps: '5',
                    weightType: 'absolute',
                    weight: 100,
                }),
            })
        )
    })

    // The route computes a fallback order from the highest existing one, but
    // workoutExerciseSchema makes `order` required, so that branch cannot be
    // reached through the API: a body without it is rejected at validation.
    it('rejects a body without an order instead of computing one', async () => {
        const bodyWithoutOrder = { ...validBody, order: undefined }

        const res = await addExercise(
            makeRequest(bodyWithoutOrder),
            withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID })
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.workoutExercise.findFirst).not.toHaveBeenCalled()
    })

    it('returns 400 when the body does not match the schema', async () => {
        const res = await addExercise(makeRequest({ sets: 'tre' }), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.workoutExercise.create).not.toHaveBeenCalled()
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
    })

    it('returns 403 when the program belongs to another trainer', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({ ...draftProgram, trainerId: 'trainer-other' } as never)

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.modifyDenied')
        expect(prismaMock.workoutExercise.create).not.toHaveBeenCalled()
    })

    it('refuses to edit a completed program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({ ...draftProgram, status: 'completed' } as never)

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.cannotModifyNonDraft')
    })

    it('refuses to edit a workout the trainee has already started', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({ ...draftProgram, status: 'active' } as never)
        prismaMock.setPerformed.count.mockResolvedValue(1 as never)

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.workoutStartedEditDenied')
    })

    it('lets an admin edit a completed program', async () => {
        asAdmin()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgram, status: 'completed', trainerId: 'trainer-other',
        } as never)

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))

        expect(res.status).toBe(201)
    })

    it('returns 404 when the workout is not part of the program', async () => {
        const res = await addExercise(
            makeRequest(validBody),
            withParams({ id: PROGRAM_ID, workoutId: 'workout-altro' })
        )
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('workout.notFoundInProgram')
    })

    it('returns 404 when the exercise does not exist', async () => {
        prismaMock.exercise.findUnique.mockResolvedValue(null)

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('exercise.notFound')
    })

    it('returns 401 when the caller is not authenticated', async () => {
        asUnauthenticated()

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.workoutExercise.create).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))

        expect(res.status).toBe(403)
        expect(prismaMock.workoutExercise.create).not.toHaveBeenCalled()
    })

    it('returns 500 when the create fails', async () => {
        prismaMock.workoutExercise.create.mockRejectedValue(new Error('db down'))

        const res = await addExercise(makeRequest(validBody), withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PUT /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]', () => {
    const putParams = withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID, exerciseId: WE_ID })

    beforeEach(() => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: mockTrainerSession.user.id, status: 'draft',
        } as never)
        prismaMock.workoutExercise.findUnique.mockResolvedValue({ id: WE_ID, workoutId: WORKOUT_ID } as never)
        prismaMock.exercise.findUnique.mockResolvedValue({ id: EXERCISE_ID, name: 'Squat' } as never)
        prismaMock.workoutExercise.update.mockResolvedValue({ id: WE_ID, sets: 4 } as never)
        prismaMock.setPerformed.count.mockResolvedValue(0 as never)
    })

    it('updates the exercise', async () => {
        const res = await updateExercise(makeRequest({ ...validBody, sets: 4 }, 'PUT'), putParams)

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: WE_ID },
                data: expect.objectContaining({ sets: 4 }),
            })
        )
    })

    it('returns 400 for an invalid body', async () => {
        const res = await updateExercise(makeRequest({ sets: -1 }, 'PUT'), putParams)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.workoutExercise.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await updateExercise(makeRequest(validBody, 'PUT'), putParams)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
    })

    it('returns 403 when the program belongs to another trainer', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: 'trainer-other', status: 'draft',
        } as never)

        const res = await updateExercise(makeRequest(validBody, 'PUT'), putParams)
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.modifyDenied')
    })

    it('returns 404 when the workout exercise does not exist', async () => {
        prismaMock.workoutExercise.findUnique.mockResolvedValue(null)

        const res = await updateExercise(makeRequest(validBody, 'PUT'), putParams)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('workoutExercise.notFound')
    })

    it('returns 404 when the new exercise id does not exist', async () => {
        prismaMock.exercise.findUnique.mockResolvedValue(null)

        const res = await updateExercise(makeRequest(validBody, 'PUT'), putParams)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('exercise.notFound')
    })

    it('returns 401 when the caller is not authenticated', async () => {
        asUnauthenticated()

        const res = await updateExercise(makeRequest(validBody, 'PUT'), putParams)

        expect(res.status).toBe(401)
        expect(prismaMock.workoutExercise.update).not.toHaveBeenCalled()
    })
})

describe('DELETE /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]', () => {
    const deleteParams = withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID, exerciseId: WE_ID })

    beforeEach(() => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: mockTrainerSession.user.id, status: 'draft',
        } as never)
        prismaMock.workoutExercise.findUnique.mockResolvedValue({ id: WE_ID, workoutId: WORKOUT_ID } as never)
        prismaMock.workoutExercise.delete.mockResolvedValue({ id: WE_ID } as never)
        prismaMock.workoutExercise.findMany.mockResolvedValue([{ id: WE_ID_2, order: 2 }] as never)
        prismaMock.workoutExercise.update.mockResolvedValue({ id: WE_ID_2, order: 1 } as never)
        prismaMock.setPerformed.count.mockResolvedValue(0 as never)
    })

    it('deletes the exercise and closes the gap in the order', async () => {
        const res = await deleteExercise(makeRequest(undefined, 'DELETE'), deleteParams)

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.delete).toHaveBeenCalledWith({ where: { id: WE_ID } })
        expect(prismaMock.workoutExercise.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: WE_ID_2 }, data: { order: 1 } })
        )
    })

    it('does not renumber anything when the workout is left empty', async () => {
        prismaMock.workoutExercise.findMany.mockResolvedValue([] as never)

        const res = await deleteExercise(makeRequest(undefined, 'DELETE'), deleteParams)

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the workout exercise does not exist', async () => {
        prismaMock.workoutExercise.findUnique.mockResolvedValue(null)

        const res = await deleteExercise(makeRequest(undefined, 'DELETE'), deleteParams)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('workoutExercise.notFound')
        expect(prismaMock.workoutExercise.delete).not.toHaveBeenCalled()
    })

    it('returns 403 when the program belongs to another trainer', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: 'trainer-other', status: 'draft',
        } as never)

        const res = await deleteExercise(makeRequest(undefined, 'DELETE'), deleteParams)
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.modifyDenied')
        expect(prismaMock.workoutExercise.delete).not.toHaveBeenCalled()
    })

    it('returns 401 when the caller is not authenticated', async () => {
        asUnauthenticated()

        const res = await deleteExercise(makeRequest(undefined, 'DELETE'), deleteParams)

        expect(res.status).toBe(401)
        expect(prismaMock.workoutExercise.delete).not.toHaveBeenCalled()
    })
})

describe('PATCH /api/programs/[id]/workouts/[workoutId]/exercises/reorder', () => {
    const reorderParams = withParams({ id: PROGRAM_ID, workoutId: WORKOUT_ID })
    const reorderBody = {
        exercises: [
            { id: WE_ID, order: 2 },
            { id: WE_ID_2, order: 1 },
        ],
    }

    beforeEach(() => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: mockTrainerSession.user.id, status: 'draft',
        } as never)
        prismaMock.workoutExercise.findMany.mockResolvedValue([
            { id: WE_ID, order: 1 },
            { id: WE_ID_2, order: 2 },
        ] as never)
        prismaMock.workoutExercise.update.mockResolvedValue({ id: WE_ID } as never)
        prismaMock.setPerformed.count.mockResolvedValue(0 as never)
    })

    it('writes the new order of every exercise', async () => {
        const res = await reorderExercises(makeRequest(reorderBody, 'PATCH'), reorderParams)

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: WE_ID }, data: { order: 2 } })
        )
        expect(prismaMock.workoutExercise.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: WE_ID_2 }, data: { order: 1 } })
        )
    })

    it('returns 400 when an order is not a positive integer', async () => {
        const res = await reorderExercises(
            makeRequest({ exercises: [{ id: WE_ID, order: 0 }] }, 'PATCH'),
            reorderParams
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.workoutExercise.update).not.toHaveBeenCalled()
    })

    it('returns 404 when an exercise does not belong to the workout', async () => {
        prismaMock.workoutExercise.findMany.mockResolvedValue([{ id: WE_ID, order: 1 }] as never)

        const res = await reorderExercises(makeRequest(reorderBody, 'PATCH'), reorderParams)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('workout.exercisesNotFound')
        expect(prismaMock.workoutExercise.update).not.toHaveBeenCalled()
    })

    it('returns 403 when the program belongs to another trainer', async () => {
        asTrainer(makeTrainerSession({ id: 'trainer-other' }))

        const res = await reorderExercises(makeRequest(reorderBody, 'PATCH'), reorderParams)
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.modifyDenied')
    })

    it('returns 401 when the caller is not authenticated', async () => {
        asUnauthenticated()

        const res = await reorderExercises(makeRequest(reorderBody, 'PATCH'), reorderParams)

        expect(res.status).toBe(401)
        expect(prismaMock.workoutExercise.update).not.toHaveBeenCalled()
    })

    it('lets an admin reorder a program owned by someone else', async () => {
        asAdmin()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: 'trainer-other', status: 'completed',
        } as never)

        const res = await reorderExercises(makeRequest(reorderBody, 'PATCH'), reorderParams)

        expect(res.status).toBe(200)
        expect(mockAdminSession.user.role).toBe('admin')
    })
})
