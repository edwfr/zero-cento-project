import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { DELETE } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession } from '../helpers/sessions'
import { asTrainer } from '../helpers/auth-mock'

const PROGRAM_ID = '11111111-1111-1111-1111-111111111111'
const WORKOUT_ID = '22222222-2222-2222-2222-222222222222'
const EXERCISE_ID = '33333333-3333-3333-3333-333333333333'

const withParams = (id: string, workoutId: string, exerciseId: string) => ({
    params: Promise.resolve({ id, workoutId, exerciseId }),
})

describe('DELETE /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('returns 403 when program is completed (not draft)', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'completed',
        } as never)

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
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'draft',
        } as never)
        prismaMock.workoutExercise.findUnique.mockResolvedValue({
            id: EXERCISE_ID,
            workoutId: 'other-workout',
        } as never)

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
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'draft',
        } as never)
        prismaMock.workoutExercise.findUnique.mockResolvedValue({
            id: EXERCISE_ID,
            workoutId: WORKOUT_ID,
            order: 2,
        } as never)
        prismaMock.workoutExercise.delete.mockResolvedValue({} as never)
        prismaMock.workoutExercise.findMany.mockResolvedValue([
            { id: 'aaaa', order: 1 },
            { id: 'bbbb', order: 3 },
        ] as never)
        prismaMock.workoutExercise.update
            .mockResolvedValueOnce({ id: 'aaaa', order: 1 } as never)
            .mockResolvedValueOnce({ id: 'bbbb', order: 2 } as never)
        prismaMock.$transaction.mockResolvedValue([] as never)

        const req = new NextRequest(
            `http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`,
            {
                method: 'DELETE',
            }
        )
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.workoutExercise.delete).toHaveBeenCalledWith({
            where: { id: EXERCISE_ID },
        })
        expect(prismaMock.workoutExercise.update).toHaveBeenCalledTimes(2)
        expect(prismaMock.workoutExercise.update).toHaveBeenCalledWith({
            where: { id: 'aaaa' },
            data: { order: 1 },
        })
        expect(prismaMock.workoutExercise.update).toHaveBeenCalledWith({
            where: { id: 'bbbb' },
            data: { order: 2 },
        })
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    })

    it('returns 403 when program is active and workout is started', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'active',
        } as never)
        prismaMock.setPerformed.count.mockResolvedValue(1)

        const req = new NextRequest(
            `http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`,
            { method: 'DELETE' }
        )
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error.key).toBe('program.workoutStartedEditDenied')
    })

    it('allows delete when program is active and workout is NOT started', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            id: PROGRAM_ID,
            trainerId: mockTrainerSession.user.id,
            status: 'active',
        } as never)
        prismaMock.setPerformed.count.mockResolvedValue(0)
        prismaMock.workoutExercise.findUnique.mockResolvedValue({
            id: EXERCISE_ID,
            workoutId: WORKOUT_ID,
            order: 1,
        } as never)
        prismaMock.workoutExercise.delete.mockResolvedValue({} as never)
        prismaMock.workoutExercise.findMany.mockResolvedValue([] as never)
        prismaMock.$transaction.mockResolvedValue([] as never)

        const req = new NextRequest(
            `http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`,
            { method: 'DELETE' }
        )
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))
        expect(res.status).toBe(200)
    })
})
