import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as reviewProgram } from '@/app/api/programs/[id]/review/route'
import { POST as completeProgram } from '@/app/api/programs/[id]/complete/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession } from '../helpers/sessions'

const PROGRAM_ID = '55555555-5555-5555-5555-555555555551'
const TRAINEE_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

function makeRequest(body?: unknown, method = 'POST') {
    return new NextRequest(`http://localhost:3000/api/programs/${PROGRAM_ID}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
}

describe('GET /api/programs/[id]/review', () => {
    const programTree = {
        id: PROGRAM_ID,
        title: 'Blocco Forza',
        status: 'active',
        isSbdProgram: true,
        durationWeeks: 4,
        workoutsPerWeek: 3,
        trainer: { id: mockTrainerSession.user.id, firstName: 'Marco', lastName: 'Trainer' },
        weeks: [],
    }

    beforeEach(() => {
        asTrainer()
        prismaMock.trainingProgram.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: TRAINEE_ID,
        } as never)
        prismaMock.trainingProgram.findUnique.mockResolvedValue(programTree as never)
        prismaMock.$queryRaw.mockResolvedValue([] as never)
    })

    it('returns the program tree with the pre-aggregated records', async () => {
        prismaMock.$queryRaw.mockResolvedValue([
            { exerciseId: 'ex-1', reps: 1, maxWeight: 150 },
            { exerciseId: 'ex-1', reps: 5, maxWeight: 130 },
        ] as never)

        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.program.id).toBe(PROGRAM_ID)
        expect(body.data.bestWeightByExerciseAndReps['ex-1']).toEqual({ 1: 150, 5: 130 })
        // 5 reps at 130 kg estimates a higher 1RM than a 150 kg single
        expect(body.data.estimatedOneRMByExercise['ex-1']).toBeGreaterThan(150)
    })

    it('returns empty aggregates when the trainee has no records', async () => {
        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.estimatedOneRMByExercise).toEqual({})
        expect(body.data.bestWeightByExerciseAndReps).toEqual({})
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue(null)

        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
        expect(prismaMock.trainingProgram.findUnique).not.toHaveBeenCalled()
    })

    it('returns 404 when the tree disappears between the two queries', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
    })

    it('returns 403 when the trainer does not own the program', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue({
            trainerId: 'trainer-other',
            traineeId: TRAINEE_ID,
        } as never)

        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.viewDenied')
    })

    it('lets an admin review a program owned by someone else', async () => {
        asAdmin()
        prismaMock.trainingProgram.findFirst.mockResolvedValue({
            trainerId: 'trainer-other',
            traineeId: TRAINEE_ID,
        } as never)

        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(200)
    })

    it('returns 401 when the caller is not authenticated', async () => {
        asUnauthenticated()

        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(401)
        expect(prismaMock.trainingProgram.findFirst).not.toHaveBeenCalled()
    })

    it('returns 500 when a query fails', async () => {
        prismaMock.$queryRaw.mockRejectedValue(new Error('db down'))

        const res = await reviewProgram(makeRequest(undefined, 'GET'), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('POST /api/programs/[id]/complete', () => {
    beforeEach(() => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'active',
        } as never)
        prismaMock.trainingProgram.update.mockResolvedValue({
            id: PROGRAM_ID,
            status: 'completed',
        } as never)
    })

    it('completes an active program and stores the reason', async () => {
        const res = await completeProgram(
            makeRequest({ completionReason: 'Blocco concluso' }),
            withIdParam(PROGRAM_ID)
        )

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: PROGRAM_ID },
                data: expect.objectContaining({
                    status: 'completed',
                    completionReason: 'Blocco concluso',
                    completedAt: expect.any(Date),
                }),
            })
        )
    })

    it('stores a null reason when none is given', async () => {
        const res = await completeProgram(makeRequest({}), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ completionReason: null }) })
        )
    })

    it('returns 400 when the reason is longer than the limit', async () => {
        const res = await completeProgram(
            makeRequest({ completionReason: 'a'.repeat(501) }),
            withIdParam(PROGRAM_ID)
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('refuses to complete a draft program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: mockTrainerSession.user.id, status: 'draft',
        } as never)

        const res = await completeProgram(makeRequest({}), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('program.cannotCompleteDraft')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('refuses to complete a program that is already completed', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: mockTrainerSession.user.id, status: 'completed',
        } as never)

        const res = await completeProgram(makeRequest({}), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('program.alreadyCompleted')
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await completeProgram(makeRequest({}), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
    })

    it('returns 403 when the program belongs to another trainer', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID, trainerId: 'trainer-other', status: 'active',
        } as never)

        const res = await completeProgram(makeRequest({}), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.completeDenied')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await completeProgram(makeRequest({}), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(403)
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.trainingProgram.update.mockRejectedValue(new Error('db down'))

        const res = await completeProgram(makeRequest({}), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
