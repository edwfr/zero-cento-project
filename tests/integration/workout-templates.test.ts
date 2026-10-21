import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as LIST, POST } from '@/app/api/workout-templates/route'
import { GET, PUT, DELETE } from '@/app/api/workout-templates/[id]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession } from '../helpers/sessions'

const TRAINER_ID = mockTrainerSession.user.id
const TEMPLATE_ID = '00000000-0000-4000-8000-0000000000aa'
const EX_1 = '00000000-0000-4000-8000-000000000001'
const EX_2 = '00000000-0000-4000-8000-000000000002'

const validBody = {
    name: 'Settimana tipo',
    workoutsPerWeek: 2,
    workouts: [
        {
            dayIndex: 0,
            exercises: [
                { exerciseId: EX_1, sets: 3, reps: '8', restTime: 'm2' },
                { exerciseId: EX_2, sets: 4, reps: '8/10', restTime: 'm1' },
            ],
        },
        { dayIndex: 1, exercises: [{ exerciseId: EX_1, sets: 5, reps: '5', restTime: 'm3' }] },
    ],
}

function req(method: string, body?: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/workout-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

/** Templates are copy-only: editing or deleting one must never write to programs. */
function expectProgramsUntouched() {
    for (const model of [
        prismaMock.trainingProgram,
        prismaMock.workoutExercise,
        prismaMock.workoutSkeleton,
    ]) {
        for (const fn of [model.create, model.createMany, model.update, model.updateMany, model.delete, model.deleteMany]) {
            expect(fn).not.toHaveBeenCalled()
        }
    }
}

describe('workout templates API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    describe('GET list', () => {
        it('returns own templates with exerciseCount', async () => {
            prismaMock.workoutTemplate.findMany.mockResolvedValue([
                {
                    id: TEMPLATE_ID,
                    name: 'A',
                    workoutsPerWeek: 2,
                    usageCount: 3,
                    lastUsedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    workouts: [
                        { exercises: [{ id: 'a' }, { id: 'b' }] },
                        { exercises: [{ id: 'c' }] },
                    ],
                },
            ] as never)

            const res = await LIST()
            expect(res.status).toBe(200)
            expect(prismaMock.workoutTemplate.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { trainerId: TRAINER_ID } })
            )
            const { data } = await res.json()
            expect(Object.keys(data[0]).sort()).toEqual(
                ['createdAt', 'exerciseCount', 'id', 'lastUsedAt', 'name', 'updatedAt', 'usageCount', 'workoutsPerWeek']
            )
            expect(data[0].exerciseCount).toBe(3)
        })

        it.each([['admin', asAdmin], ['trainee', asTrainee]])('rejects %s with 403', async (_n, fn) => {
            fn()
            asForbidden()
            const res = await LIST()
            expect(res.status).toBe(403)
            expect(prismaMock.workoutTemplate.findMany).not.toHaveBeenCalled()
        })
    })

    describe('POST', () => {
        it('creates a template with 1-based order from array index', async () => {
            prismaMock.exercise.findMany.mockResolvedValue([{ id: EX_1 }, { id: EX_2 }] as never)
            prismaMock.workoutTemplate.create.mockResolvedValue({ id: TEMPLATE_ID, name: 'Settimana tipo' } as never)

            const res = await POST(req('POST', validBody))
            expect(res.status).toBe(201)
            const arg = prismaMock.workoutTemplate.create.mock.calls[0][0] as { data: { trainerId: string; workouts: { create: Array<{ exercises: { create: Array<{ order: number }> } }> } } }
            expect(arg.data.trainerId).toBe(TRAINER_ID)
            expect(arg.data.workouts.create[0].exercises.create.map((e: { order: number }) => e.order)).toEqual([1, 2])
            expect(arg.data.workouts.create[1].exercises.create[0].order).toBe(1)
            expect((await res.json()).data.id).toBe(TEMPLATE_ID)
        })

        it('rejects empty name with VALIDATION_ERROR', async () => {
            const res = await POST(req('POST', { ...validBody, name: '' }))
            expect(res.status).toBe(400)
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
            expect(prismaMock.workoutTemplate.create).not.toHaveBeenCalled()
        })

        it('rejects unknown exercise ids', async () => {
            prismaMock.exercise.findMany.mockResolvedValue([{ id: EX_1 }] as never)
            const res = await POST(req('POST', validBody))
            expect(res.status).toBe(400)
            expect((await res.json()).error.key).toBe('workout.exercisesNotFound')
            expect(prismaMock.workoutTemplate.create).not.toHaveBeenCalled()
        })
    })

    describe('GET /[id]', () => {
        it('returns own template ordered', async () => {
            prismaMock.workoutTemplate.findFirst.mockResolvedValue({ id: TEMPLATE_ID, workouts: [] } as never)
            const res = await GET(req('GET'), ctx(TEMPLATE_ID))
            expect(res.status).toBe(200)
            expect(prismaMock.workoutTemplate.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: TEMPLATE_ID, trainerId: TRAINER_ID },
                    include: {
                        workouts: {
                            orderBy: { dayIndex: 'asc' },
                            include: { exercises: { orderBy: { order: 'asc' } } },
                        },
                    },
                })
            )
        })

        it('returns 404 for another trainer template', async () => {
            prismaMock.workoutTemplate.findFirst.mockResolvedValue(null)
            const res = await GET(req('GET'), ctx(TEMPLATE_ID))
            expect(res.status).toBe(404)
            expect((await res.json()).error.key).toBe('template.notFound')
            expect(prismaMock.workoutTemplate.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: TEMPLATE_ID, trainerId: TRAINER_ID } })
            )
        })

        it('returns 404 for non-uuid id', async () => {
            const res = await GET(req('GET'), ctx('not-a-uuid'))
            expect(res.status).toBe(404)
            expect((await res.json()).error.key).toBe('template.notFound')
        })
    })

    describe('PUT /[id]', () => {
        it('replaces workouts in a transaction and keeps usage stats', async () => {
            prismaMock.workoutTemplate.findFirst.mockResolvedValue({ id: TEMPLATE_ID } as never)
            prismaMock.exercise.findMany.mockResolvedValue([{ id: EX_1 }, { id: EX_2 }] as never)
            prismaMock.workoutTemplateWorkout.deleteMany.mockResolvedValue({ count: 2 } as never)
            prismaMock.workoutTemplate.update.mockResolvedValue({ id: TEMPLATE_ID } as never)

            const res = await PUT(req('PUT', validBody), ctx(TEMPLATE_ID))
            expect(res.status).toBe(200)
            expect(prismaMock.$transaction).toHaveBeenCalled()
            expect(prismaMock.workoutTemplateWorkout.deleteMany).toHaveBeenCalledWith({
                where: { templateId: TEMPLATE_ID },
            })
            const data = (prismaMock.workoutTemplate.update.mock.calls[0][0] as { data: Record<string, unknown> }).data
            expect(data.name).toBe('Settimana tipo')
            expect(data.workoutsPerWeek).toBe(2)
            expect(data).not.toHaveProperty('usageCount')
            expect(data).not.toHaveProperty('lastUsedAt')
            expectProgramsUntouched()
        })

        it('returns 404 for another trainer template without deleting', async () => {
            prismaMock.workoutTemplate.findFirst.mockResolvedValue(null)
            const res = await PUT(req('PUT', validBody), ctx(TEMPLATE_ID))
            expect(res.status).toBe(404)
            expect(prismaMock.workoutTemplateWorkout.deleteMany).not.toHaveBeenCalled()
        })
    })

    describe('DELETE /[id]', () => {
        it('deletes own template after ownership check', async () => {
            prismaMock.workoutTemplate.findFirst.mockResolvedValue({ id: TEMPLATE_ID } as never)
            prismaMock.workoutTemplate.delete.mockResolvedValue({ id: TEMPLATE_ID } as never)
            const res = await DELETE(req('DELETE'), ctx(TEMPLATE_ID))
            expect(res.status).toBe(200)
            expect(prismaMock.workoutTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } })
            expectProgramsUntouched()
        })

        it('returns 404 for another trainer template without deleting', async () => {
            prismaMock.workoutTemplate.findFirst.mockResolvedValue(null)
            const res = await DELETE(req('DELETE'), ctx(TEMPLATE_ID))
            expect(res.status).toBe(404)
            expect(prismaMock.workoutTemplate.delete).not.toHaveBeenCalled()
        })
    })
})
