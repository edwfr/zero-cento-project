import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { PATCH } from '@/app/api/programs/[id]/start-date/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession, makeTrainerSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

function makeRequest(body: unknown) {
    return new NextRequest('http://localhost:3000/api/programs/prog-1/start-date', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

// "Today" in these tests: 2026-10-04 (Rome)
const futureProgram = {
    id: 'prog-1',
    trainerId: mockTrainerSession.user.id,
    status: 'active',
    startDate: new Date('2026-10-12T00:00:00Z'),
    weeks: [
        { id: 'week-1', weekNumber: 1 },
        { id: 'week-2', weekNumber: 2 },
    ],
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-04T10:00:00Z'))
    prismaMock.trainingProgram.findUnique.mockResolvedValue(futureProgram as never)
    prismaMock.trainingProgram.update.mockResolvedValue({} as never)
    prismaMock.week.update.mockResolvedValue({} as never)
})

afterEach(() => {
    vi.useRealTimers()
})

describe('PATCH /api/programs/[id]/start-date', () => {
    it('moves the program and its weeks to the new start date', async () => {
        asTrainer()

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toEqual({ startDate: '2026-10-19T00:00:00.000Z' })
        expect(prismaMock.trainingProgram.update).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
            data: { startDate: new Date('2026-10-19T00:00:00Z') },
        })
        expect(prismaMock.week.update).toHaveBeenCalledWith({
            where: { id: 'week-1' },
            data: { startDate: new Date('2026-10-19T00:00:00Z') },
        })
        expect(prismaMock.week.update).toHaveBeenCalledWith({
            where: { id: 'week-2' },
            data: { startDate: new Date('2026-10-26T00:00:00Z') },
        })
        expect(prismaMock.$transaction).toHaveBeenCalled()
    })

    it('accepts today as the new start date', async () => {
        asTrainer()

        const res = await PATCH(makeRequest({ startDate: '2026-10-04' }), withIdParam('prog-1'))

        expect(res.status).toBe(200)
    })

    it('lets an admin change any program start date', async () => {
        asAdmin()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...futureProgram,
            trainerId: 'another-trainer',
        } as never)

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))

        expect(res.status).toBe(200)
    })

    it('returns 400 for a malformed date', async () => {
        asTrainer()

        const res = await PATCH(makeRequest({ startDate: '19/10/2026' }), withIdParam('prog-1'))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.trainingProgram.findUnique).not.toHaveBeenCalled()
    })

    it('returns 400 for an impossible calendar date', async () => {
        asTrainer()

        const res = await PATCH(makeRequest({ startDate: '2026-02-31' }), withIdParam('prog-1'))

        expect(res.status).toBe(400)
    })

    it('returns 400 when the new date is in the past', async () => {
        asTrainer()

        const res = await PATCH(makeRequest({ startDate: '2026-10-03' }), withIdParam('prog-1'))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('program.startDateInPast')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 400 when the program is not active', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({ ...futureProgram, status: 'draft' } as never)

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('program.startDateNotEditable')
    })

    it('returns 400 when the program has already started', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...futureProgram,
            startDate: new Date('2026-10-04T00:00:00Z'),
        } as never)

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('program.startDateNotEditable')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the program does not exist', async () => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('program.notFound')
    })

    it('returns 403 when the trainer does not own the program', async () => {
        asTrainer(makeTrainerSession({ id: 'another-trainer' }))

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))
        const json = await res.json()

        expect(res.status).toBe(403)
        expect(json.error.key).toBe('program.modifyDenied')
        expect(prismaMock.trainingProgram.update).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))

        expect(res.status).toBe(403)
        expect(prismaMock.trainingProgram.findUnique).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))

        expect(res.status).toBe(401)
    })

    it('returns 500 when the update fails', async () => {
        asTrainer()
        prismaMock.$transaction.mockRejectedValueOnce(new Error('db down'))

        const res = await PATCH(makeRequest({ startDate: '2026-10-19' }), withIdParam('prog-1'))

        expect(res.status).toBe(500)
    })
})
