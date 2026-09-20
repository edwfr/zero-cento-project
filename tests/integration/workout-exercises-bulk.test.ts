import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { PUT as bulkPut } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession } from '../helpers/sessions'
import { asTrainer, asAdmin } from '../helpers/auth-mock'

const PROG = '11111111-1111-1111-1111-111111111111'
const WK = '22222222-2222-2222-2222-222222222222'
const EX = '33333333-3333-3333-3333-333333333331'
const WE_EXISTING = '44444444-4444-4444-4444-444444444444'

const baseRow = {
    exerciseId: EX,
    sets: 3,
    reps: '8',
    weightType: 'absolute' as const,
    weight: 100,
    restTime: 'm2' as const,
    isWarmup: false,
    isJumpSet: false,
    isSuperSet: false,
    order: 1,
}

function makePutRequest(body: unknown) {
    return new NextRequest(
        `http://localhost:3000/api/programs/${PROG}/workouts/${WK}/exercises/bulk`,
        { method: 'PUT', body: JSON.stringify(body) } as never
    )
}

const params = (id: string, workoutId: string) => ({
    params: Promise.resolve({ id, workoutId }),
})

const draftProgramOwned = {
    id: PROG,
    trainerId: mockTrainerSession.user.id,
    status: 'draft',
    weeks: [{ workouts: [{ id: WK }] }],
}

describe('PUT /api/programs/[id]/workouts/[workoutId]/exercises/bulk', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(draftProgramOwned as never)
        prismaMock.exercise.findMany.mockResolvedValue([{ id: EX }] as never)
        prismaMock.workoutExercise.findMany.mockResolvedValue([
            { id: 'new-1', order: 1 },
            { id: 'new-2', order: 2 },
        ] as never)
        prismaMock.$transaction.mockResolvedValue([])
    })

    it('creates all rows and returns the updated list', async () => {
        const res = await bulkPut(
            makePutRequest({ exercises: [baseRow, { ...baseRow, order: 2 }] }),
            params(PROG, WK)
        )
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.data.workoutExercises).toHaveLength(2)
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
        expect(prismaMock.workoutExercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    isJumpSet: false,
                    isSuperSet: false,
                }),
            })
        )
    })

    it('updates an existing row when id is supplied', async () => {
        prismaMock.workoutExercise.findMany
            .mockResolvedValueOnce([{ id: WE_EXISTING }] as never) // ownership check
            .mockResolvedValueOnce([{ id: WE_EXISTING, order: 1 }] as never) // final fetch

        const res = await bulkPut(
            makePutRequest({
                exercises: [{ ...baseRow, id: WE_EXISTING, sets: 5 }],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(200)
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('handles mixed creates and updates in one call', async () => {
        prismaMock.workoutExercise.findMany
            .mockResolvedValueOnce([{ id: WE_EXISTING }] as never)
            .mockResolvedValueOnce([
                { id: WE_EXISTING, order: 1 },
                { id: 'new-1', order: 2 },
            ] as never)

        const res = await bulkPut(
            makePutRequest({
                exercises: [
                    { ...baseRow, id: WE_EXISTING, order: 1 },
                    { ...baseRow, order: 2 },
                ],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data.workoutExercises).toHaveLength(2)
    })

    it('passes deletedExerciseIds to deleteMany in the bulk transaction', async () => {
        const res = await bulkPut(
            makePutRequest({
                exercises: [baseRow],
                deletedExerciseIds: [WE_EXISTING],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.deleteMany).toHaveBeenCalledWith({
            where: {
                workoutId: WK,
                id: { in: [WE_EXISTING] },
            },
        })
    })

    it('rejects empty array with 400', async () => {
        const res = await bulkPut(makePutRequest({ exercises: [] }), params(PROG, WK))
        expect(res.status).toBe(400)
    })

    it('rejects overlapping ids between exercises and deletedExerciseIds', async () => {
        const res = await bulkPut(
            makePutRequest({
                exercises: [{ ...baseRow, id: WE_EXISTING }],
                deletedExerciseIds: [WE_EXISTING],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(400)
    })

    it('rejects invalid deletedExerciseIds values', async () => {
        const res = await bulkPut(
            makePutRequest({
                exercises: [baseRow],
                deletedExerciseIds: ['not-a-uuid'],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(400)
    })

    it('returns 404 when program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null as never)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer does not own the program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgramOwned,
            trainerId: 'other-trainer',
        } as never)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(403)
    })

    it('returns 403 when program is not draft (non-admin)', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgramOwned,
            status: 'completed',
        } as never)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(403)
    })

    it('allows admin to save against a non-draft program', async () => {
        asAdmin()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgramOwned,
            status: 'active',
        } as never)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(200)
    })

    it('returns 404 when workout does not belong to program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgramOwned,
            weeks: [{ workouts: [] }],
        } as never)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(404)
    })

    it('returns 404 when an update id is not in the workout', async () => {
        prismaMock.workoutExercise.findMany.mockResolvedValueOnce([] as never)
        const res = await bulkPut(
            makePutRequest({ exercises: [{ ...baseRow, id: WE_EXISTING }] }),
            params(PROG, WK)
        )
        expect(res.status).toBe(404)
    })

    it('returns 404 when a referenced exerciseId does not exist', async () => {
        prismaMock.exercise.findMany.mockResolvedValue([] as never)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(404)
    })

    it('returns 400 when jump set and super set are both true', async () => {
        const res = await bulkPut(
            makePutRequest({ exercises: [{ ...baseRow, isJumpSet: true, isSuperSet: true }] }),
            params(PROG, WK)
        )
        expect(res.status).toBe(400)
    })

    it('returns 403 when program is active and workout is started', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgramOwned,
            status: 'active',
        } as never)
        prismaMock.setPerformed.count.mockResolvedValue(1)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.key).toBe('program.workoutStartedEditDenied')
    })

    it('allows editing when program is active and workout is NOT started', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgramOwned,
            status: 'active',
        } as never)
        prismaMock.setPerformed.count.mockResolvedValue(0)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(200)
    })

    it('returns 403 when program is completed (not draft)', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgramOwned,
            status: 'completed',
        } as never)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.key).toBe('program.cannotModifyNonDraft')
    })
})
