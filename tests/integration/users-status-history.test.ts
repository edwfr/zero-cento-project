import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as getStatusHistory } from '@/app/api/users/[id]/status-history/route'
import { requireRole } from '@/lib/auth'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession } from '../helpers/sessions'

const TRAINEE_ID = 'trainee-uuid-1'

const withParams = (id: string) => ({ params: Promise.resolve({ id }) })

function makeRequest() {
    return new NextRequest(`http://localhost:3000/api/users/${TRAINEE_ID}/status-history`)
}

const storedUser = {
    createdAt: new Date('2026-10-01T09:12:05Z'),
    isActive: true,
    statusEvents: [
        {
            type: 'created',
            createdAt: new Date('2026-10-01T09:12:05Z'),
            actor: { firstName: 'Luca', lastName: 'Bianchi' },
        },
        { type: 'activated', createdAt: new Date('2026-10-01T18:40:11Z'), actor: null },
    ],
}

describe('GET /api/users/[id]/status-history', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: TRAINEE_ID,
        } as never)
        prismaMock.user.findUnique.mockResolvedValue(storedUser as never)
    })

    it('returns the history of a trainee the trainer owns, oldest first', async () => {
        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toEqual({
            createdAt: '2026-10-01T09:12:05.000Z',
            isActive: true,
            events: [
                { type: 'created', at: '2026-10-01T09:12:05.000Z', actor: { firstName: 'Luca', lastName: 'Bianchi' } },
                { type: 'activated', at: '2026-10-01T18:40:11.000Z', actor: null },
            ],
        })
        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer'])
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId: TRAINEE_ID },
        })
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { id: TRAINEE_ID },
            select: {
                createdAt: true,
                isActive: true,
                statusEvents: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        type: true,
                        createdAt: true,
                        actor: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        })
    })

    it('lets an admin read any user without an association', async () => {
        asAdmin()

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(401)
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainer who does not own the trainee', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns 404 when the user does not exist', async () => {
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('user.notFound')
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.user.findUnique.mockRejectedValue(new Error('db down'))

        const res = await getStatusHistory(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
