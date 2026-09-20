import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}))

import { GET, PUT } from '@/app/api/trainer/trainees/[id]/notes/route'
import { GET as getWorkoutTraineeNotes } from '@/app/api/programs/[id]/workouts/[workoutId]/trainee-notes/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asUnauthenticated } from '../helpers/auth-mock'
import { requireRole } from '@/lib/auth'

const traineeId = 'trainee-uuid-1'
const validDocument = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Coach note' }] }],
}

const withIdParam = (id = traineeId) => ({ params: Promise.resolve({ id }) })

function makeRequest(method = 'GET', body?: unknown) {
    return new NextRequest(`http://localhost/api/trainer/trainees/${traineeId}/notes`, {
        method,
        ...(body === undefined ? {} : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
    })
}

describe('trainer trainee notes API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('returns an empty document for an owned trainee without a note', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerNotes: null,
            trainerNotesUpdatedAt: null,
        } as never)

        const response = await GET(makeRequest(), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
        expect(body.data.updatedAt).toBeNull()
        expect(requireRole).toHaveBeenCalledWith(['trainer'])
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId },
            select: { trainerNotes: true, trainerNotesUpdatedAt: true },
        })
    })

    it('returns the saved document for an owned trainee', async () => {
        const updatedAt = new Date('2026-08-27T10:00:00.000Z')
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerNotes: validDocument,
            trainerNotesUpdatedAt: updatedAt,
        } as never)

        const response = await GET(makeRequest(), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual(validDocument)
        expect(body.data.updatedAt).toBe(updatedAt.toISOString())
    })

    it('saves a valid document for an owned trainee', async () => {
        const updatedAt = new Date('2026-08-27T10:00:00.000Z')
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assignment-1' } as never)
        prismaMock.trainerTrainee.update.mockResolvedValue({
            trainerNotes: validDocument,
            trainerNotesUpdatedAt: updatedAt,
        } as never)

        const response = await PUT(makeRequest('PUT', { document: validDocument }), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual(validDocument)
        expect(body.data.updatedAt).toBe(updatedAt.toISOString())
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId },
            select: { id: true },
        })
        expect(prismaMock.trainerTrainee.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'assignment-1' },
            data: expect.objectContaining({ trainerNotes: validDocument }),
        }))
    })

    it('rejects a document that exceeds the complexity limit before checking ownership', async () => {
        const oversizedContent = Array.from({ length: 501 }, () => ({
            type: 'paragraph',
            content: [{ type: 'text', text: 'x' }],
        }))
        const response = await PUT(makeRequest('PUT', {
            document: { type: 'doc', content: oversizedContent },
        }), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })

    it('silently strips unknown nodes when saving', async () => {
        const updatedAt = new Date('2026-08-27T10:00:00.000Z')
        const sanitizedDocument = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Coach note' }] }],
        }
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assignment-1' } as never)
        prismaMock.trainerTrainee.update.mockResolvedValue({
            trainerNotes: sanitizedDocument,
            trainerNotesUpdatedAt: updatedAt,
        } as never)

        const response = await PUT(makeRequest('PUT', {
            document: {
                type: 'doc',
                content: [
                    { type: 'image' },
                    { type: 'paragraph', content: [{ type: 'text', text: 'Coach note' }] },
                ],
            },
        }), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.document).toEqual(sanitizedDocument)
        expect(prismaMock.trainerTrainee.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ trainerNotes: sanitizedDocument }),
        }))
    })

    it('rejects access to a trainee assigned to another trainer', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const response = await GET(makeRequest(), withIdParam())
        const body = await response.json()

        expect(response.status).toBe(403)
        expect(body.error.code).toBe('FORBIDDEN')
    })

    it('passes through unauthenticated responses', async () => {asUnauthenticated()

        const response = await GET(makeRequest(), withIdParam())

        expect(response.status).toBe(401)
    })
})

// ─── Trainee notes of a single workout (trainer-facing) ───────────────────────

const programId = 'program-uuid-1'
const workoutId = 'workout-uuid-1'

const workoutNotesParams = () => ({ params: Promise.resolve({ id: programId, workoutId }) })

function workoutNotesRequest() {
    return new NextRequest(`http://localhost/api/programs/${programId}/workouts/${workoutId}/trainee-notes`)
}

describe('GET /api/programs/[id]/workouts/[workoutId]/trainee-notes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.trainingProgram.findFirst.mockResolvedValue({ id: programId } as never)
        prismaMock.workout.findFirst.mockResolvedValue({
            traineeNotes: 'Giornata pesante',
            workoutExercises: [
                { id: 'we-1', exercise: { name: 'Panca piana' }, exerciseFeedbacks: [{ notes: 'Spalla ok' }] },
                { id: 'we-2', exercise: { name: 'Squat' }, exerciseFeedbacks: [{ notes: null }] },
                { id: 'we-3', exercise: { name: 'Stacco' }, exerciseFeedbacks: [] },
            ],
        } as never)
    })

    it('returns the workout note and only the exercises that carry one', async () => {
        const response = await getWorkoutTraineeNotes(workoutNotesRequest(), workoutNotesParams())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data).toEqual({
            workoutNote: 'Giornata pesante',
            exercises: [{ workoutExerciseId: 'we-1', exerciseName: 'Panca piana', note: 'Spalla ok' }],
        })
        expect(prismaMock.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { id: programId, trainerId: mockTrainerSession.user.id },
            select: { id: true },
        })
    })

    it('reports a null note when the workout has none', async () => {
        prismaMock.workout.findFirst.mockResolvedValue({
            traineeNotes: null,
            workoutExercises: [],
        } as never)

        const response = await getWorkoutTraineeNotes(workoutNotesRequest(), workoutNotesParams())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data).toEqual({ workoutNote: null, exercises: [] })
    })

    it('lets an admin read the notes of any program', async () => {
        asAdmin()

        const response = await getWorkoutTraineeNotes(workoutNotesRequest(), workoutNotesParams())

        expect(response.status).toBe(200)
        expect(prismaMock.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { id: programId },
            select: { id: true },
        })
    })

    it('returns 403 when the program is not the trainer own', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue(null)

        const response = await getWorkoutTraineeNotes(workoutNotesRequest(), workoutNotesParams())
        const body = await response.json()

        expect(response.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(prismaMock.workout.findFirst).not.toHaveBeenCalled()
    })

    it('returns 404 when the workout does not belong to the program', async () => {
        prismaMock.workout.findFirst.mockResolvedValue(null)

        const response = await getWorkoutTraineeNotes(workoutNotesRequest(), workoutNotesParams())
        const body = await response.json()

        expect(response.status).toBe(404)
        expect(body.error.key).toBe('workout.notFound')
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const response = await getWorkoutTraineeNotes(workoutNotesRequest(), workoutNotesParams())

        expect(response.status).toBe(401)
        expect(prismaMock.trainingProgram.findFirst).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.workout.findFirst.mockRejectedValue(new Error('db down'))

        const response = await getWorkoutTraineeNotes(workoutNotesRequest(), workoutNotesParams())
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
