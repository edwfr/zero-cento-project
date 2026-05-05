import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findUnique: vi.fn(),
        },
        workoutExercise: {
            findUnique: vi.fn(),
            delete: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { DELETE } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PROGRAM_ID = '11111111-1111-1111-1111-111111111111'
const WORKOUT_ID = '22222222-2222-2222-2222-222222222222'
const EXERCISE_ID = '33333333-3333-3333-3333-333333333333'

const withParams = (id: string, workoutId: string, exerciseId: string) => ({
    params: Promise.resolve({ id, workoutId, exerciseId }),
})

describe('DELETE /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
    })

    it('returns 403 when program is not draft status for trainer', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'active',
        } as any)

        const req = new NextRequest(
            `http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`,
            {
                method: 'DELETE',
            }
        )
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))
        expect(res.status).toBe(403)
    })

    it('returns 404 when exercise does not belong to workout', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'draft',
        } as any)
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue({
            id: EXERCISE_ID,
            workoutId: 'other-workout',
        } as any)

        const req = new NextRequest(
            `http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`,
            {
                method: 'DELETE',
            }
        )
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))
        expect(res.status).toBe(404)
    })

    it('deletes the exercise and reorders remaining exercises', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'draft',
        } as any)
        vi.mocked(prisma.workoutExercise.findUnique).mockResolvedValue({
            id: EXERCISE_ID,
            workoutId: WORKOUT_ID,
            order: 2,
        } as any)
        vi.mocked(prisma.workoutExercise.delete).mockResolvedValue({} as any)
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([
            { id: 'aaaa', order: 1 },
            { id: 'bbbb', order: 3 },
        ] as any)
        vi.mocked(prisma.workoutExercise.update)
            .mockResolvedValueOnce({ id: 'aaaa', order: 1 } as any)
            .mockResolvedValueOnce({ id: 'bbbb', order: 2 } as any)
        vi.mocked(prisma.$transaction).mockResolvedValue([] as any)

        const req = new NextRequest(
            `http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`,
            {
                method: 'DELETE',
            }
        )
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))

        expect(res.status).toBe(200)
        expect(prisma.workoutExercise.delete).toHaveBeenCalledWith({
            where: { id: EXERCISE_ID },
        })
        expect(prisma.workoutExercise.update).toHaveBeenCalledTimes(2)
        expect(prisma.workoutExercise.update).toHaveBeenCalledWith({
            where: { id: 'aaaa' },
            data: { order: 1 },
        })
        expect(prisma.workoutExercise.update).toHaveBeenCalledWith({
            where: { id: 'bbbb' },
            data: { order: 2 },
        })
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })
})
