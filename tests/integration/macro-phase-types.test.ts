import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/macro-phase-types/route'
import { PATCH, DELETE } from '@/app/api/macro-phase-types/[id]/route'
import { requireRole } from '@/lib/auth'
import { PHASE_COLOR_PALETTE } from '@/lib/macro-periods'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asForbidden, asUnauthenticated } from '../helpers/auth-mock'

const TRAINER_ID = 'trainer-uuid-1'
const PHASE_ID = '22222222-2222-2222-2222-222222222222'

const phaseRow = (overrides: Record<string, unknown> = {}) => ({
    id: PHASE_ID,
    name: 'Forza',
    description: 'Carichi alti',
    color: '#2563eb',
    sortOrder: 0,
    isActive: true,
    _count: { periods: 0 },
    ...overrides,
})

const withId = (id: string) => ({ params: Promise.resolve({ id }) })

const request = (method: string, body?: unknown, url = 'http://localhost:3000/api/macro-phase-types') =>
    new NextRequest(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

beforeEach(() => {
    vi.clearAllMocks()
})

describe('GET /api/macro-phase-types', () => {
    it('lists the trainer phases with their usage count', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findMany.mockResolvedValue([phaseRow({ _count: { periods: 3 } })] as never)

        const res = await GET()
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(requireRole).toHaveBeenCalledWith('trainer')
        expect(body.data.items).toEqual([
            { id: PHASE_ID, name: 'Forza', description: 'Carichi alti', color: '#2563eb', sortOrder: 0, isActive: true, usageCount: 3 },
        ])
        expect(prismaMock.macroPhaseType.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { trainerId: TRAINER_ID } })
        )
        expect(prismaMock.macroPhaseType.createMany).not.toHaveBeenCalled()
    })

    it('creates the three placeholders when the trainer has no phases', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findMany
            .mockResolvedValueOnce([] as never)
            .mockResolvedValueOnce([
                phaseRow({ id: 'a', name: 'Tipo fase 1' }),
                phaseRow({ id: 'b', name: 'Tipo fase 2', sortOrder: 1 }),
                phaseRow({ id: 'c', name: 'Tipo fase 3', sortOrder: 2 }),
            ] as never)
        prismaMock.macroPhaseType.createMany.mockResolvedValue({ count: 3 } as never)

        const res = await GET()
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items.map((item: { name: string }) => item.name)).toEqual(['Tipo fase 1', 'Tipo fase 2', 'Tipo fase 3'])
        expect(prismaMock.macroPhaseType.createMany).toHaveBeenCalledWith({
            data: [
                { trainerId: TRAINER_ID, name: 'Tipo fase 1', color: PHASE_COLOR_PALETTE[0], sortOrder: 0 },
                { trainerId: TRAINER_ID, name: 'Tipo fase 2', color: PHASE_COLOR_PALETTE[1], sortOrder: 1 },
                { trainerId: TRAINER_ID, name: 'Tipo fase 3', color: PHASE_COLOR_PALETTE[2], sortOrder: 2 },
            ],
            skipDuplicates: true,
        })
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await GET()).status).toBe(401)

        asForbidden()
        expect((await GET()).status).toBe(403)
        expect(prismaMock.macroPhaseType.findMany).not.toHaveBeenCalled()
    })

    it('answers 500 when the database fails', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findMany.mockRejectedValue(new Error('db down'))

        const res = await GET()
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.code).toBe('INTERNAL_ERROR')
    })
})

describe('POST /api/macro-phase-types', () => {
    it('creates a phase at the end of the list', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)
        prismaMock.macroPhaseType.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } } as never)
        prismaMock.macroPhaseType.create.mockResolvedValue(phaseRow({ sortOrder: 5 }) as never)

        const res = await POST(request('POST', { name: ' Forza ', description: 'Carichi alti', color: '#2563eb' }))
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.phaseType).toMatchObject({ id: PHASE_ID, name: 'Forza', sortOrder: 5, usageCount: 0 })
        expect(prismaMock.macroPhaseType.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { trainerId: TRAINER_ID, name: 'Forza', description: 'Carichi alti', color: '#2563eb', sortOrder: 5 },
            })
        )
    })

    it('starts at sortOrder 0 for the first phase and stores a missing description as null', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)
        prismaMock.macroPhaseType.aggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
        prismaMock.macroPhaseType.create.mockResolvedValue(phaseRow({ description: null }) as never)

        await POST(request('POST', { name: 'Forza', color: '#2563eb' }))

        expect(prismaMock.macroPhaseType.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { trainerId: TRAINER_ID, name: 'Forza', description: null, color: '#2563eb', sortOrder: 0 },
            })
        )
    })

    it('rejects a name already used by this trainer, ignoring case', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: 'other' } as never)

        const res = await POST(request('POST', { name: 'forza', color: '#2563eb' }))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatchObject({ code: 'CONFLICT', key: 'macroPhase.nameExists' })
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { trainerId: TRAINER_ID, name: { equals: 'forza', mode: 'insensitive' } },
            select: { id: true },
        })
        expect(prismaMock.macroPhaseType.create).not.toHaveBeenCalled()
    })

    it('rejects an invalid body with 400', async () => {
        asTrainer()

        const res = await POST(request('POST', { name: '', color: 'red' }))
        const body = await res.json()

        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.macroPhaseType.create).not.toHaveBeenCalled()
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await POST(request('POST', { name: 'A', color: '#2563eb' }))).status).toBe(401)

        asForbidden()
        expect((await POST(request('POST', { name: 'A', color: '#2563eb' }))).status).toBe(403)
    })
})

describe('PATCH /api/macro-phase-types/[id]', () => {
    it('updates the given fields of an owned phase', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValueOnce({ id: PHASE_ID } as never).mockResolvedValueOnce(null)
        prismaMock.macroPhaseType.update.mockResolvedValue(phaseRow({ name: 'Ipertrofia', color: '#dc2626' }) as never)

        const res = await PATCH(request('PATCH', { name: 'Ipertrofia', color: '#dc2626' }), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.phaseType).toMatchObject({ name: 'Ipertrofia', color: '#dc2626' })
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenNthCalledWith(1, {
            where: { id: PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true },
        })
        expect(prismaMock.macroPhaseType.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: PHASE_ID }, data: { name: 'Ipertrofia', color: '#dc2626' } })
        )
    })

    it('archives a phase', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID } as never)
        prismaMock.macroPhaseType.update.mockResolvedValue(phaseRow({ isActive: false }) as never)

        const res = await PATCH(request('PATCH', { isActive: false }), withId(PHASE_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.macroPhaseType.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: PHASE_ID }, data: { isActive: false } })
        )
        // no name in the body → no name-clash lookup
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledTimes(1)
    })

    it('rejects a rename onto another phase name', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst
            .mockResolvedValueOnce({ id: PHASE_ID } as never)
            .mockResolvedValueOnce({ id: 'other' } as never)

        const res = await PATCH(request('PATCH', { name: 'Scarico' }), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('macroPhase.nameExists')
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenNthCalledWith(2, {
            where: { trainerId: TRAINER_ID, name: { equals: 'Scarico', mode: 'insensitive' }, id: { not: PHASE_ID } },
            select: { id: true },
        })
        expect(prismaMock.macroPhaseType.update).not.toHaveBeenCalled()
    })

    it('answers 404 for a phase of another trainer', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)

        const res = await PATCH(request('PATCH', { name: 'X' }), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('macroPhase.notFound')
        expect(prismaMock.macroPhaseType.update).not.toHaveBeenCalled()
    })

    it('rejects an empty body with 400', async () => {
        asTrainer()

        const res = await PATCH(request('PATCH', {}), withId(PHASE_ID))

        expect(res.status).toBe(400)
        expect(prismaMock.macroPhaseType.findFirst).not.toHaveBeenCalled()
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await PATCH(request('PATCH', { name: 'X' }), withId(PHASE_ID))).status).toBe(401)

        asForbidden()
        expect((await PATCH(request('PATCH', { name: 'X' }), withId(PHASE_ID))).status).toBe(403)
    })
})

describe('DELETE /api/macro-phase-types/[id]', () => {
    it('deletes a phase that no period uses', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, _count: { periods: 0 } } as never)
        prismaMock.macroPhaseType.delete.mockResolvedValue(phaseRow() as never)

        const res = await DELETE(request('DELETE'), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toEqual({ id: PHASE_ID })
        expect(prismaMock.macroPhaseType.delete).toHaveBeenCalledWith({ where: { id: PHASE_ID } })
    })

    it('refuses to delete a phase in use', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, _count: { periods: 2 } } as never)

        const res = await DELETE(request('DELETE'), withId(PHASE_ID))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatchObject({ code: 'CONFLICT', key: 'macroPhase.inUse' })
        expect(prismaMock.macroPhaseType.delete).not.toHaveBeenCalled()
    })

    it('answers 404 for a phase of another trainer', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)

        const res = await DELETE(request('DELETE'), withId(PHASE_ID))

        expect(res.status).toBe(404)
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { id: PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true, _count: { select: { periods: true } } },
        })
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await DELETE(request('DELETE'), withId(PHASE_ID))).status).toBe(401)

        asForbidden()
        expect((await DELETE(request('DELETE'), withId(PHASE_ID))).status).toBe(403)
    })
})
