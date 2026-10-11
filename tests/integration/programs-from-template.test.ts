import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/programs/route'
import { logger } from '@/lib/logger'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer } from '../helpers/auth-mock'

const TRAINEE_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const TEMPLATE_ID = '00000000-0000-0000-0000-0000000000a1'
const EX_1 = '00000000-0000-0000-0000-000000000001'
const EX_2 = '00000000-0000-0000-0000-000000000002'
const EX_3 = '00000000-0000-0000-0000-000000000003'

function makePostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

function baseBody(extra: Record<string, unknown> = {}) {
    return {
        title: 'From template',
        traineeId: TRAINEE_ID,
        isSbdProgram: false,
        durationWeeks: 4,
        workoutsPerWeek: 2,
        templateId: TEMPLATE_ID,
        ...extra,
    }
}

function makeTemplate(workouts?: unknown[]) {
    return {
        id: TEMPLATE_ID,
        trainerId: 'trainer-uuid-1',
        workoutsPerWeek: 2,
        workouts: workouts ?? [
            {
                dayIndex: 0,
                exercises: [
                    { exerciseId: EX_1, order: 0, sets: 3, reps: '5', restTime: 'm3' },
                    { exerciseId: EX_2, order: 1, sets: 4, reps: '8-10', restTime: 'm2' },
                ],
            },
            {
                dayIndex: 1,
                exercises: [{ exerciseId: EX_3, order: 0, sets: 2, reps: '12', restTime: 's90' }],
            },
        ],
    }
}

describe('POST /api/programs - template branch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
        } as never)
        prismaMock.trainingProgram.create.mockResolvedValue({
            id: 'new-prog-id',
            trainerId: 'trainer-uuid-1',
            traineeId: TRAINEE_ID,
            trainer: { id: 'trainer-uuid-1', firstName: 'M', lastName: 'T' },
            trainee: { id: TRAINEE_ID, firstName: 'Mario', lastName: 'Atleta' },
            weeks: [
                {
                    weekNumber: 1,
                    workouts: [
                        { id: 'wk1-d1', dayIndex: 1 },
                        { id: 'wk1-d2', dayIndex: 2 },
                    ],
                },
            ],
        } as never)
        prismaMock.workoutTemplate.findFirst.mockResolvedValue(makeTemplate() as never)
        prismaMock.workoutTemplate.update.mockResolvedValue({} as never)
        prismaMock.workoutExercise.createMany.mockResolvedValue({ count: 0 } as never)
        prismaMock.workoutSkeleton.createMany.mockResolvedValue({ count: 0 } as never)
    })

    it('copies template into Week 1, skeleton and bumps usage', async () => {
        const res = await POST(makePostRequest(baseBody()))
        const json = await res.json()

        expect(res.status).toBe(201)
        expect(prismaMock.workoutTemplate.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: TEMPLATE_ID, trainerId: 'trainer-uuid-1' } })
        )

        expect(prismaMock.workoutExercise.createMany).toHaveBeenCalledOnce()
        const rows = (prismaMock.workoutExercise.createMany.mock.calls[0][0] as { data: any[] }).data
        expect(rows).toHaveLength(3)
        expect(rows.map((r) => r.workoutId)).toEqual(['wk1-d1', 'wk1-d1', 'wk1-d2'])
        for (const r of rows) {
            expect(r.weight).toBeNull()
            expect(r.targetRpe).toBeNull()
            expect(r.weightType).toBe('absolute')
        }

        expect(prismaMock.workoutSkeleton.createMany).toHaveBeenCalledOnce()
        const skel = (prismaMock.workoutSkeleton.createMany.mock.calls[0][0] as { data: any[] }).data
        expect(skel).toHaveLength(3)
        expect(skel.map((r) => r.dayIndex)).toEqual([0, 0, 1])
        expect(skel.every((r) => r.programId === 'new-prog-id')).toBe(true)

        expect(prismaMock.workoutTemplate.update).toHaveBeenCalledWith({
            where: { id: TEMPLATE_ID },
            data: { usageCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
        })

        expect(JSON.stringify(json.data.program)).not.toContain('templateId')
        const logged = vi.mocked(logger.info).mock.calls[0][0] as Record<string, unknown>
        expect(logged.templateId).toBe(TEMPLATE_ID)
    })

    it('returns 404 when template is missing or not owned', async () => {
        prismaMock.workoutTemplate.findFirst.mockResolvedValue(null)

        const res = await POST(makePostRequest(baseBody()))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('template.notFound')
        expect(prismaMock.trainingProgram.create).not.toHaveBeenCalled()
    })

    it('returns 400 when workoutsPerWeek differs from the template', async () => {
        const res = await POST(makePostRequest(baseBody({ workoutsPerWeek: 3 })))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.workoutsPerWeekMismatchWithTemplate')
        expect(prismaMock.trainingProgram.create).not.toHaveBeenCalled()
    })

    it('returns 400 when both templateId and cloneFromProgramId are sent', async () => {
        const res = await POST(
            makePostRequest(baseBody({ cloneFromProgramId: '00000000-0000-0000-0000-000000000099' }))
        )
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.templateAndCloneExclusive')
        expect(prismaMock.trainingProgram.create).not.toHaveBeenCalled()
    })

    it('returns 400 VALIDATION_ERROR for a non-uuid templateId', async () => {
        const res = await POST(makePostRequest(baseBody({ templateId: 'not-a-uuid' })))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
    })

    it('skips createMany for days without exercises', async () => {
        prismaMock.workoutTemplate.findFirst.mockResolvedValue(
            makeTemplate([
                { dayIndex: 0, exercises: [] },
                { dayIndex: 1, exercises: [] },
            ]) as never
        )

        const res = await POST(makePostRequest(baseBody()))

        expect(res.status).toBe(201)
        expect(prismaMock.workoutExercise.createMany).not.toHaveBeenCalled()
        expect(prismaMock.workoutSkeleton.createMany).not.toHaveBeenCalled()
    })

    it('does not bump usage when program creation fails', async () => {
        prismaMock.trainingProgram.create.mockRejectedValue(new Error('boom'))

        const res = await POST(makePostRequest(baseBody()))

        expect(res.status).toBe(500)
        expect(prismaMock.workoutTemplate.update).not.toHaveBeenCalled()
    })
})
