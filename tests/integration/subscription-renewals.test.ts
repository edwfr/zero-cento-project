import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/subscription-renewals/route'
import { PATCH, DELETE } from '@/app/api/subscription-renewals/[id]/route'
import { requireTrainerOwnership } from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated } from '../helpers/auth-mock'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const RENEWAL_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const mockRenewal = {
    id: RENEWAL_ID,
    traineeId: TRAINEE_ID,
    startDate: day('2026-09-10'),
    durationMonths: 1,
    endDate: day('2026-10-10'),
    createdBy: 'trainer-uuid-1',
    createdAt: new Date('2026-09-10T10:00:00.000Z'),
}

const BASE = 'http://localhost:3000/api/subscription-renewals'

function makeRequest(url: string, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

const jsonRequest = (url: string, method: string, body: unknown) =>
    makeRequest(url, { method, body: JSON.stringify(body) })

const params = (id = RENEWAL_ID) => ({ params: Promise.resolve({ id }) })

/** Trainer authenticated, but the trainee belongs to someone else. */
function asForeignTrainer() {
    asTrainer()
    vi.mocked(requireTrainerOwnership).mockRejectedValue(
        apiError('FORBIDDEN', 'You do not have access to this trainee', 403, undefined, 'auth.traineeAccessDenied')
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'))
})

afterEach(() => {
    vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/subscription-renewals
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/subscription-renewals', () => {
    it('returns the history and the current status for the owning trainer', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([mockRenewal] as never)

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.current).toEqual({ status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 })
        expect(prismaMock.subscriptionRenewal.findMany).toHaveBeenCalledWith({
            where: { traineeId: TRAINEE_ID },
            orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
    })

    it('returns current null when there are no renewals', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([] as never)

        const body = await (await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))).json()

        expect(body.data.current).toBeNull()
    })

    it('uses the furthest end date across overlapping renewals', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([
            { ...mockRenewal, id: 'r-2', startDate: day('2026-09-20'), endDate: day('2026-09-30') },
            mockRenewal,
        ] as never)

        const body = await (await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))).json()

        expect(body.data.current.endDate).toBe('2026-10-10T00:00:00.000Z')
    })

    it('rejects a missing traineeId with 400', async () => {
        asTrainer()

        const res = await GET(makeRequest(BASE))

        expect(res.status).toBe(400)
    })

    it('forbids the trainee role and never reads data', async () => {
        asTrainee()

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.findMany).not.toHaveBeenCalled()
    })

    it('forbids a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(403)
    })

    it('lets an admin read without the ownership check', async () => {
        asAdmin()
        prismaMock.subscriptionRenewal.findMany.mockResolvedValue([] as never)

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(200)
        expect(requireTrainerOwnership).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated', async () => {
        asUnauthenticated()

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(401)
    })

    it('returns 500 when the query fails', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findMany.mockRejectedValue(new Error('db down'))

        const res = await GET(makeRequest(`${BASE}?traineeId=${TRAINEE_ID}`))

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/subscription-renewals
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/subscription-renewals', () => {
    const validBody = { traineeId: TRAINEE_ID, startDate: '2027-01-31', durationMonths: 1 }

    function traineeExists(role = 'trainee') {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role } as never)
    }

    it('creates a renewal with a server-computed, month-end-clamped end date', async () => {
        asTrainer()
        traineeExists()
        prismaMock.subscriptionRenewal.create.mockResolvedValue(mockRenewal as never)

        const res = await POST(jsonRequest(BASE, 'POST', { ...validBody, endDate: '2099-01-01' }))

        expect(res.status).toBe(201)
        expect(prismaMock.subscriptionRenewal.create).toHaveBeenCalledWith({
            data: {
                traineeId: TRAINEE_ID,
                startDate: day('2027-01-31'),
                durationMonths: 1,
                endDate: day('2027-02-28'),
                createdBy: 'trainer-uuid-1',
            },
        })
    })

    it.each([0, 37, 1.5])('rejects duration %s with 400', async (durationMonths) => {
        asTrainer()

        const res = await POST(jsonRequest(BASE, 'POST', { ...validBody, durationMonths }))

        expect(res.status).toBe(400)
        expect(prismaMock.subscriptionRenewal.create).not.toHaveBeenCalled()
    })

    it('rejects an unparseable start date with 400', async () => {
        asTrainer()

        const res = await POST(jsonRequest(BASE, 'POST', { ...validBody, startDate: 'nope' }))

        expect(res.status).toBe(400)
    })

    it('forbids the trainee role', async () => {
        asTrainee()

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.create).not.toHaveBeenCalled()
    })

    it('forbids a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(403)
    })

    it('returns 404 for an unknown trainee', async () => {
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(404)
    })

    it('rejects a user who is not a trainee with 400', async () => {
        asAdmin()
        traineeExists('trainer')

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(400)
    })

    it('returns 500 when the insert fails', async () => {
        asTrainer()
        traineeExists()
        prismaMock.subscriptionRenewal.create.mockRejectedValue(new Error('db down'))

        const res = await POST(jsonRequest(BASE, 'POST', validBody))

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/subscription-renewals/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/subscription-renewals/[id]', () => {
    const body = { startDate: '2026-11-01', durationMonths: 3 }

    it('recomputes the end date', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.update.mockResolvedValue(mockRenewal as never)

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(200)
        expect(prismaMock.subscriptionRenewal.update).toHaveBeenCalledWith({
            where: { id: RENEWAL_ID },
            data: { startDate: day('2026-11-01'), durationMonths: 3, endDate: day('2027-02-01') },
        })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
    })

    it('returns 404 for an unknown renewal', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(null)

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(404)
    })

    it('rejects invalid input with 400', async () => {
        asTrainer()

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', { ...body, durationMonths: 0 }), params())

        expect(res.status).toBe(400)
    })

    it('forbids the trainee role', async () => {
        asTrainee()

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.update).not.toHaveBeenCalled()
    })

    it("forbids a trainer who does not own the renewal's trainee", async () => {
        asForeignTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.update.mockRejectedValue(new Error('db down'))

        const res = await PATCH(jsonRequest(`${BASE}/${RENEWAL_ID}`, 'PATCH', body), params())

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/subscription-renewals/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/subscription-renewals/[id]', () => {
    it('deletes the renewal', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.delete.mockResolvedValue(mockRenewal as never)

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(200)
        expect(prismaMock.subscriptionRenewal.delete).toHaveBeenCalledWith({ where: { id: RENEWAL_ID } })
    })

    it('returns 404 for an unknown renewal', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(null)

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(404)
    })

    it('forbids the trainee role', async () => {
        asTrainee()

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.delete).not.toHaveBeenCalled()
    })

    it("forbids a trainer who does not own the renewal's trainee", async () => {
        asForeignTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(403)
        expect(prismaMock.subscriptionRenewal.delete).not.toHaveBeenCalled()
    })

    it('returns 500 when the delete fails', async () => {
        asTrainer()
        prismaMock.subscriptionRenewal.findUnique.mockResolvedValue(mockRenewal as never)
        prismaMock.subscriptionRenewal.delete.mockRejectedValue(new Error('db down'))

        const res = await DELETE(makeRequest(`${BASE}/${RENEWAL_ID}`, { method: 'DELETE' }), params())

        expect(res.status).toBe(500)
    })
})
