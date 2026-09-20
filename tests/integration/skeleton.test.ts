import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { PUT } from '@/app/api/programs/[id]/skeleton/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asForbidden } from '../helpers/auth-mock'

function makePutRequest(
    body: unknown,
    url = 'http://localhost:3000/api/programs/prog-1/skeleton'
): NextRequest {
    return new NextRequest(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

const EX_1 = '00000000-0000-0000-0000-000000000001'
const EX_2 = '00000000-0000-0000-0000-000000000002'
const EX_MISSING = '00000000-0000-0000-0000-000000000099'

const draftProgram = {
    id: 'prog-1',
    status: 'draft',
    workoutsPerWeek: 3,
}

const skeletonRows = [
    { id: 'sk-1', dayIndex: 0, order: 0, exerciseId: EX_1, createdAt: new Date() },
    { id: 'sk-2', dayIndex: 1, order: 0, exerciseId: EX_2, createdAt: new Date() },
]

describe('PUT /api/programs/[id]/skeleton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(draftProgram as never)
        prismaMock.exercise.findMany.mockResolvedValue([
            { id: EX_1 },
            { id: EX_2 },
        ] as never)
        prismaMock.workoutSkeleton.deleteMany.mockResolvedValue({ count: 0 } as never)
        prismaMock.workoutSkeleton.createMany.mockResolvedValue({ count: 2 } as never)
        prismaMock.workoutSkeleton.findMany.mockResolvedValue(skeletonRows as never)
    })

    it('returns 200 and the new skeleton on success', async () => {
        const res = await PUT(
            makePutRequest({
                rows: [
                    { dayIndex: 0, order: 0, exerciseId: EX_1 },
                    { dayIndex: 1, order: 0, exerciseId: EX_2 },
                ],
            }),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.skeleton).toHaveLength(2)
        expect(json.data.skeleton[0].dayIndex).toBe(0)
        expect(json.data.skeleton[1].dayIndex).toBe(1)
    })

    it('returns 200 with empty skeleton when rows is empty', async () => {
        prismaMock.workoutSkeleton.findMany.mockResolvedValue([] as never)

        const res = await PUT(makePutRequest({ rows: [] }), {
            params: Promise.resolve({ id: 'prog-1' }),
        })
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.skeleton).toHaveLength(0)
    })

    it('returns 403 when program status is not draft', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...draftProgram,
            status: 'active',
        })

        const res = await PUT(
            makePutRequest({ rows: [{ dayIndex: 0, order: 0, exerciseId: 'ex-1' }] }),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.code).toBe('FORBIDDEN')
        expect(json.error.key).toBe('program.skeletonEditDenied')
    })

    it('returns 404 when program is not found', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await PUT(
            makePutRequest({ rows: [] }),
            { params: Promise.resolve({ id: 'missing-prog' }) }
        )
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 when dayIndex exceeds workoutsPerWeek', async () => {
        const res = await PUT(
            makePutRequest({ rows: [{ dayIndex: 5, order: 0, exerciseId: EX_1 }] }),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
        expect(json.error.key).toBe('validation.dayIndexOutOfRange')
    })

    it('returns 404 when an exerciseId does not exist', async () => {
        prismaMock.exercise.findMany.mockResolvedValue([{ id: EX_1 }] as never) // only 1 of 2

        const res = await PUT(
            makePutRequest({
                rows: [
                    { dayIndex: 0, order: 0, exerciseId: EX_1 },
                    { dayIndex: 1, order: 0, exerciseId: EX_MISSING },
                ],
            }),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
        expect(json.error.key).toBe('validation.exerciseNotFound')
    })

    it('returns 400 when payload is invalid (missing required fields)', async () => {
        const res = await PUT(
            makePutRequest({ rows: [{ dayIndex: 'bad' }] }),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 403 when ownership check fails', async () => {
        asForbidden()

        const res = await PUT(makePutRequest({ rows: [] }), {
            params: Promise.resolve({ id: 'prog-1' }),
        })

        expect(res.status).toBe(403)
    })
})
