import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/trainee-measurements/route'
import { PATCH, DELETE } from '@/app/api/trainee-measurements/[id]/route'
import { requireTrainerOwnership } from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated } from '../helpers/auth-mock'

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const MEASUREMENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const mockMeasurement = {
    id: MEASUREMENT_ID,
    traineeId: TRAINEE_ID,
    metric: 'weight',
    value: 78.5,
    measuredAt: new Date('2026-09-20T00:00:00.000Z'),
    notes: null,
    createdBy: 'trainer-uuid-1',
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
}

function makeRequest(url = `http://localhost:3000/api/trainee-measurements?traineeId=${TRAINEE_ID}`, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

function postRequest(body: unknown) {
    return makeRequest('http://localhost:3000/api/trainee-measurements', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

/** Trainer authenticated, but the trainee belongs to someone else. */
function asForeignTrainer() {
    asTrainer()
    vi.mocked(requireTrainerOwnership).mockRejectedValue(
        apiError('FORBIDDEN', 'You do not have access to this trainee', 403, undefined, 'auth.traineeAccessDenied')
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/trainee-measurements
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/trainee-measurements', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the trainee measurements for the owning trainer', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findMany.mockResolvedValue([mockMeasurement] as never)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.items[0].metric).toBe('weight')
        expect(prismaMock.traineeMeasurement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { traineeId: TRAINEE_ID } })
        )
    })

    it('filters by metric and date range', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findMany.mockResolvedValue([] as never)

        const res = await GET(
            makeRequest(
                `http://localhost:3000/api/trainee-measurements?traineeId=${TRAINEE_ID}&metric=waist&from=2026-01-01&to=2026-09-21`
            )
        )

        expect(res.status).toBe(200)
        expect(prismaMock.traineeMeasurement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    traineeId: TRAINEE_ID,
                    metric: 'waist',
                    measuredAt: {
                        gte: new Date('2026-01-01T00:00:00.000Z'),
                        lte: new Date('2026-09-21T00:00:00.000Z'),
                    },
                },
            })
        )
    })

    it('rejects an unknown metric filter with 400', async () => {
        asTrainer()

        const res = await GET(
            makeRequest(`http://localhost:3000/api/trainee-measurements?traineeId=${TRAINEE_ID}&metric=neck`)
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('rejects an unparseable date filter with 400', async () => {
        asTrainer()

        const res = await GET(
            makeRequest(`http://localhost:3000/api/trainee-measurements?traineeId=${TRAINEE_ID}&from=not-a-date`)
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidDate')
        expect(prismaMock.traineeMeasurement.findMany).not.toHaveBeenCalled()
    })

    it('requires traineeId', async () => {
        asTrainer()

        const res = await GET(makeRequest('http://localhost:3000/api/trainee-measurements'))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.traineeIdRequired')
    })

    it('denies a trainee with 403 and never queries the table', async () => {
        asTrainee()

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.traineeAccessDenied')
        expect(prismaMock.traineeMeasurement.findMany).not.toHaveBeenCalled()
    })

    it('denies a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await GET(makeRequest())

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.findMany).not.toHaveBeenCalled()
    })

    it('allows an admin without an ownership check', async () => {
        asAdmin()
        prismaMock.traineeMeasurement.findMany.mockResolvedValue([mockMeasurement] as never)

        const res = await GET(makeRequest())

        expect(res.status).toBe(200)
        expect(requireTrainerOwnership).not.toHaveBeenCalled()
    })

    it('propagates the 401 from the auth guard', async () => {
        asUnauthenticated()

        const res = await GET(makeRequest())

        expect(res.status).toBe(401)
    })

    it('returns 500 when the query throws', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findMany.mockRejectedValue(new Error('db down') as never)

        const res = await GET(makeRequest())
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.code).toBe('INTERNAL_ERROR')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/trainee-measurements
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/trainee-measurements', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('upserts only the supplied metrics', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.traineeMeasurement.upsert.mockResolvedValue(mockMeasurement as never)

        const res = await POST(
            postRequest({
                traineeId: TRAINEE_ID,
                measuredAt: '2026-09-20',
                values: { weight: 78.5, arm: 38.5 },
            })
        )
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.items).toHaveLength(2)
        expect(prismaMock.traineeMeasurement.upsert).toHaveBeenCalledTimes(2)
        expect(prismaMock.traineeMeasurement.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    traineeId_metric_measuredAt: {
                        traineeId: TRAINEE_ID,
                        metric: 'weight',
                        measuredAt: new Date('2026-09-20T00:00:00.000Z'),
                    },
                },
            })
        )
    })

    it('stores the author of the measurement', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.traineeMeasurement.upsert.mockResolvedValue(mockMeasurement as never)

        await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(prismaMock.traineeMeasurement.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ createdBy: 'trainer-uuid-1' }),
            })
        )
    })

    it('rejects an empty values object with 400', async () => {
        asTrainer()

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: {} }))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(prismaMock.traineeMeasurement.upsert).not.toHaveBeenCalled()
    })

    it('returns 404 when the trainee does not exist', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue(null as never)

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('trainee.notFound')
    })

    it('denies a trainee with 403', async () => {
        asTrainee()

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.upsert).not.toHaveBeenCalled()
    })

    it('denies a trainer who does not own the trainee', async () => {
        asForeignTrainer()

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(res.status).toBe(403)
    })

    it('returns 500 when the transaction throws', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee' } as never)
        prismaMock.traineeMeasurement.upsert.mockRejectedValue(new Error('db down') as never)

        const res = await POST(postRequest({ traineeId: TRAINEE_ID, measuredAt: '2026-09-20', values: { weight: 78.5 } }))

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/trainee-measurements/[id]
// ═══════════════════════════════════════════════════════════════════════════

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

function patchRequest(body: unknown) {
    return makeRequest(`http://localhost:3000/api/trainee-measurements/${MEASUREMENT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    })
}

describe('PATCH /api/trainee-measurements/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('updates the value of an owned measurement', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.update.mockResolvedValue({ ...mockMeasurement, value: 79 } as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.measurement.value).toBe(79)
        expect(prismaMock.traineeMeasurement.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: MEASUREMENT_ID }, data: { value: 79 } })
        )
    })

    it('clears the notes when null is sent', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.update.mockResolvedValue(mockMeasurement as never)

        await PATCH(patchRequest({ notes: null }), withIdParam(MEASUREMENT_ID))

        expect(prismaMock.traineeMeasurement.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { notes: null } })
        )
    })

    it('rejects a value outside the range of the row metric', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)

        const res = await PATCH(patchRequest({ value: 900 }), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.measurementOutOfRange')
        expect(prismaMock.traineeMeasurement.update).not.toHaveBeenCalled()
    })

    it('rejects moving the row onto a day that already has this metric with 409', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.findFirst.mockResolvedValue({ ...mockMeasurement, id: 'other-id' } as never)

        const res = await PATCH(patchRequest({ measuredAt: '2026-09-10' }), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('measurement.duplicateDay')
        expect(prismaMock.traineeMeasurement.findFirst).toHaveBeenCalledWith({
            where: {
                traineeId: TRAINEE_ID,
                metric: 'weight',
                measuredAt: new Date('2026-09-10T00:00:00.000Z'),
                id: { not: MEASUREMENT_ID },
            },
            select: { id: true },
        })
        expect(prismaMock.traineeMeasurement.update).not.toHaveBeenCalled()
    })

    it('moves the row to a free day', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.findFirst.mockResolvedValue(null as never)
        prismaMock.traineeMeasurement.update.mockResolvedValue(mockMeasurement as never)

        const res = await PATCH(patchRequest({ measuredAt: '2026-09-10' }), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.traineeMeasurement.update).toHaveBeenCalledWith({
            where: { id: MEASUREMENT_ID },
            data: { measuredAt: new Date('2026-09-10T00:00:00.000Z') },
        })
    })

    it('rejects an empty payload', async () => {
        asTrainer()

        const res = await PATCH(patchRequest({}), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(400)
    })

    it('returns 404 for an unknown id', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(null as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('measurement.notFound')
    })

    it('denies a trainee with 403', async () => {
        asTrainee()

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.update).not.toHaveBeenCalled()
    })

    it('denies a trainer who does not own the trainee', async () => {
        asForeignTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update throws', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.update.mockRejectedValue(new Error('db down') as never)

        const res = await PATCH(patchRequest({ value: 79 }), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(500)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/trainee-measurements/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /api/trainee-measurements/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function deleteRequest() {
        return makeRequest(`http://localhost:3000/api/trainee-measurements/${MEASUREMENT_ID}`, {
            method: 'DELETE',
        })
    }

    it('deletes an owned measurement', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.delete.mockResolvedValue(mockMeasurement as never)

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.success).toBe(true)
        expect(prismaMock.traineeMeasurement.delete).toHaveBeenCalledWith({ where: { id: MEASUREMENT_ID } })
    })

    it('returns 404 for an unknown id', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(null as never)

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(404)
    })

    it('denies a trainee with 403', async () => {
        asTrainee()

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.traineeMeasurement.delete).not.toHaveBeenCalled()
    })

    it('returns 500 when the delete throws', async () => {
        asTrainer()
        prismaMock.traineeMeasurement.findUnique.mockResolvedValue(mockMeasurement as never)
        prismaMock.traineeMeasurement.delete.mockRejectedValue(new Error('db down') as never)

        const res = await DELETE(deleteRequest(), withIdParam(MEASUREMENT_ID))

        expect(res.status).toBe(500)
    })
})
