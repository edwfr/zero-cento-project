import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockAdminSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findUnique: vi.fn() },
        workoutExercise: {
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        exercise: { findMany: vi.fn() },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { PUT as bulkPut } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    order: 1,
}

function makePutRequest(body: unknown) {
    return new NextRequest(
        `http://localhost:3000/api/programs/${PROG}/workouts/${WK}/exercises/bulk`,
        { method: 'PUT', body: JSON.stringify(body) } as any
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
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(draftProgramOwned as any)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([{ id: EX }] as any)
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([
            { id: 'new-1', order: 1 },
            { id: 'new-2', order: 2 },
        ] as any)
        vi.mocked(prisma.$transaction).mockResolvedValue([])
    })

    it('creates all rows and returns the updated list', async () => {
        const res = await bulkPut(
            makePutRequest({ exercises: [baseRow, { ...baseRow, order: 2 }] }),
            params(PROG, WK)
        )
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.data.workoutExercises).toHaveLength(2)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('updates an existing row when id is supplied', async () => {
        vi.mocked(prisma.workoutExercise.findMany)
            .mockResolvedValueOnce([{ id: WE_EXISTING }] as any) // ownership check
            .mockResolvedValueOnce([{ id: WE_EXISTING, order: 1 }] as any) // final fetch

        const res = await bulkPut(
            makePutRequest({
                exercises: [{ ...baseRow, id: WE_EXISTING, sets: 5 }],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(200)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('handles mixed creates and updates in one call', async () => {
        vi.mocked(prisma.workoutExercise.findMany)
            .mockResolvedValueOnce([{ id: WE_EXISTING }] as any)
            .mockResolvedValueOnce([
                { id: WE_EXISTING, order: 1 },
                { id: 'new-1', order: 2 },
            ] as any)

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
})
