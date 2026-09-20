import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { PUT as overrideProgram } from '@/app/api/admin/programs/[id]/override/route'
import { POST as reassignTrainee } from '@/app/api/admin/trainees/[traineeId]/reassign/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'

const PROGRAM_ID = 'program-uuid-1'
const TRAINEE_ID = 'trainee-uuid-1'
const NEW_TRAINER_ID = 'trainer-uuid-2'

const withParams = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) })

function jsonRequest(url: string, method: string, body: unknown) {
    return new NextRequest(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

const overrideRequest = (body: unknown) =>
    jsonRequest(`http://localhost:3000/api/admin/programs/${PROGRAM_ID}/override`, 'PUT', body)

const reassignRequest = (body: unknown) =>
    jsonRequest(`http://localhost:3000/api/admin/trainees/${TRAINEE_ID}/reassign`, 'POST', body)

describe('PUT /api/admin/programs/[id]/override', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asAdmin()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            title: 'Blocco forza',
            status: 'active',
            traineeId: 'trainee-uuid-0',
            trainerId: 'trainer-uuid-1',
        } as never)
        prismaMock.trainingProgram.update.mockResolvedValue({ id: PROGRAM_ID, title: 'Blocco ipertrofia' } as never)
    })

    it('updates the title of an active program', async () => {
        const res = await overrideProgram(overrideRequest({ title: 'Blocco ipertrofia' }), withParams({ id: PROGRAM_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.program).toMatchObject({ id: PROGRAM_ID, title: 'Blocco ipertrofia' })
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: PROGRAM_ID }, data: { title: 'Blocco ipertrofia' } })
        )
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('reassigns the program to another trainee', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)

        const res = await overrideProgram(overrideRequest({ traineeId: TRAINEE_ID }), withParams({ id: PROGRAM_ID }))

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: PROGRAM_ID }, data: { traineeId: TRAINEE_ID } })
        )
    })

    it('returns 400 when no field is provided', async () => {
        const res = await overrideProgram(overrideRequest({}), withParams({ id: PROGRAM_ID }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.atLeastOneField')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await overrideProgram(overrideRequest({ title: 'Blocco ipertrofia' }), withParams({ id: PROGRAM_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the new trainee does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await overrideProgram(overrideRequest({ traineeId: TRAINEE_ID }), withParams({ id: PROGRAM_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('trainee.notFound')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 400 when the target user is not a trainee', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainer' } as never)

        const res = await overrideProgram(overrideRequest({ traineeId: TRAINEE_ID }), withParams({ id: PROGRAM_ID }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.targetMustBeTrainee')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainer', async () => {
        asForbidden()

        const res = await overrideProgram(overrideRequest({ title: 'Blocco ipertrofia' }), withParams({ id: PROGRAM_ID }))

        expect(res.status).toBe(403)
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await overrideProgram(overrideRequest({ title: 'Blocco ipertrofia' }), withParams({ id: PROGRAM_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.trainingProgram.update.mockRejectedValue(new Error('db down'))

        const res = await overrideProgram(overrideRequest({ title: 'Blocco ipertrofia' }), withParams({ id: PROGRAM_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('POST /api/admin/trainees/[traineeId]/reassign', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asAdmin()
        prismaMock.user.findUnique
            .mockResolvedValueOnce({ id: TRAINEE_ID, role: 'trainee', firstName: 'Luca', lastName: 'A' } as never)
            .mockResolvedValueOnce({ id: NEW_TRAINER_ID, role: 'trainer', firstName: 'Sara', lastName: 'B' } as never)
        prismaMock.trainerTrainee.upsert.mockResolvedValue({
            trainerId: NEW_TRAINER_ID,
            traineeId: TRAINEE_ID,
        } as never)
    })

    it('reassigns the trainee to the new trainer', async () => {
        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.messageKey).toBe('trainee.reassignedSuccess')
        expect(prismaMock.trainerTrainee.upsert).toHaveBeenCalledWith({
            where: { traineeId: TRAINEE_ID },
            update: { trainerId: NEW_TRAINER_ID },
            create: { traineeId: TRAINEE_ID, trainerId: NEW_TRAINER_ID },
        })
    })

    it('returns 400 when newTrainerId is missing', async () => {
        const res = await reassignTrainee(reassignRequest({}), withParams({ traineeId: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.newTrainerIdRequired')
        expect(prismaMock.trainerTrainee.upsert).not.toHaveBeenCalled()
    })

    it('returns 404 when the trainee does not exist', async () => {
        prismaMock.user.findUnique.mockReset()
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('trainee.notFound')
        expect(prismaMock.trainerTrainee.upsert).not.toHaveBeenCalled()
    })

    it('returns 400 when the user is not a trainee', async () => {
        prismaMock.user.findUnique.mockReset()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainer' } as never)

        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.userMustBeTrainee')
        expect(prismaMock.trainerTrainee.upsert).not.toHaveBeenCalled()
    })

    it('returns 404 when the new trainer does not exist', async () => {
        prismaMock.user.findUnique.mockReset()
        prismaMock.user.findUnique
            .mockResolvedValueOnce({ id: TRAINEE_ID, role: 'trainee' } as never)
            .mockResolvedValueOnce(null)

        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('trainer.notFound')
        expect(prismaMock.trainerTrainee.upsert).not.toHaveBeenCalled()
    })

    it('returns 400 when the target user is not a trainer', async () => {
        prismaMock.user.findUnique.mockReset()
        prismaMock.user.findUnique
            .mockResolvedValueOnce({ id: TRAINEE_ID, role: 'trainee' } as never)
            .mockResolvedValueOnce({ id: NEW_TRAINER_ID, role: 'trainee' } as never)

        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.targetMustBeTrainer')
        expect(prismaMock.trainerTrainee.upsert).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainer', async () => {
        asForbidden()

        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))

        expect(res.status).toBe(403)
        expect(prismaMock.trainerTrainee.upsert).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.trainerTrainee.upsert).not.toHaveBeenCalled()
    })

    it('returns 500 when the upsert fails', async () => {
        prismaMock.trainerTrainee.upsert.mockRejectedValue(new Error('db down'))

        const res = await reassignTrainee(reassignRequest({ newTrainerId: NEW_TRAINER_ID }), withParams({ traineeId: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
