import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from '@/app/api/trainer/trainees/[id]/macro-periods/route'
import { PATCH, DELETE } from '@/app/api/macro-periods/[id]/route'
import { requireTrainerOwnership } from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asForbidden, asUnauthenticated } from '../helpers/auth-mock'

const TRAINER_ID = 'trainer-uuid-1'
const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'
const PHASE_ID = '22222222-2222-2222-2222-222222222222'
const OTHER_PHASE_ID = '33333333-3333-3333-3333-333333333333'
const PERIOD_ID = '44444444-4444-4444-4444-444444444444'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const periodRow = (overrides: Record<string, unknown> = {}) => ({
    id: PERIOD_ID,
    startDate: day('2026-10-05'),
    endDate: day('2026-10-18'),
    note: null,
    phaseType: { id: PHASE_ID, name: 'Forza', color: '#2563eb', isActive: true },
    ...overrides,
})

const storedPeriod = {
    id: PERIOD_ID,
    traineeId: TRAINEE_ID,
    phaseTypeId: PHASE_ID,
    startDate: day('2026-10-05'),
    endDate: day('2026-10-18'),
}

const withId = (id: string) => ({ params: Promise.resolve({ id }) })

const request = (method: string, body?: unknown) =>
    new NextRequest('http://localhost:3000/api/x', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

/** Trainer authenticated, but the trainee belongs to someone else. */
function asForeignTrainer() {
    asTrainer()
    vi.mocked(requireTrainerOwnership).mockRejectedValue(
        apiError('FORBIDDEN', 'You do not have access to this trainee', 403, undefined, 'auth.traineeAccessDenied')
    )
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('GET /api/trainer/trainees/[id]/macro-periods', () => {
    it('returns the periods of this trainer and the dated programs', async () => {
        asTrainer()
        prismaMock.macroPeriod.findMany.mockResolvedValue([periodRow()] as never)
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            { id: 'prog-1', title: 'Scheda A', status: 'active', startDate: day('2026-10-07'), durationWeeks: 4 },
        ] as never)

        const res = await GET(request('GET'), withId(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
        expect(body.data.periods).toEqual([
            {
                id: PERIOD_ID,
                startDate: '2026-10-05',
                endDate: '2026-10-18',
                note: null,
                phaseType: { id: PHASE_ID, name: 'Forza', color: '#2563eb', isActive: true },
            },
        ])
        expect(body.data.programs).toEqual([
            { id: 'prog-1', title: 'Scheda A', status: 'active', startDate: '2026-10-07', durationWeeks: 4 },
        ])
        expect(prismaMock.macroPeriod.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { traineeId: TRAINEE_ID, trainerId: TRAINER_ID }, orderBy: { startDate: 'asc' } })
        )
        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { traineeId: TRAINEE_ID, trainerId: TRAINER_ID, startDate: { not: null } } })
        )
    })

    it('answers 403 for a trainee of another trainer, without reading anything', async () => {
        asForeignTrainer()

        const res = await GET(request('GET'), withId(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.macroPeriod.findMany).not.toHaveBeenCalled()
    })

    it('answers 401 without a session and 403 for another role', async () => {
        asUnauthenticated()
        expect((await GET(request('GET'), withId(TRAINEE_ID))).status).toBe(401)

        asForbidden()
        expect((await GET(request('GET'), withId(TRAINEE_ID))).status).toBe(403)
    })
})

describe('POST /api/trainer/trainees/[id]/macro-periods', () => {
    const body = { phaseTypeId: PHASE_ID, startDate: '2026-10-05', endDate: '2026-10-18', note: 'Blocco 1' }

    it('creates a period on free weeks', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, isActive: true } as never)
        prismaMock.macroPeriod.findFirst.mockResolvedValue(null)
        prismaMock.macroPeriod.create.mockResolvedValue(periodRow({ note: 'Blocco 1' }) as never)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(201)
        expect(json.data.period).toMatchObject({ id: PERIOD_ID, startDate: '2026-10-05', endDate: '2026-10-18', note: 'Blocco 1' })
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { id: PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true, isActive: true },
        })
        expect(prismaMock.macroPeriod.findFirst).toHaveBeenCalledWith({
            where: {
                traineeId: TRAINEE_ID,
                trainerId: TRAINER_ID,
                startDate: { lte: day('2026-10-18') },
                endDate: { gte: day('2026-10-05') },
            },
            select: { id: true },
        })
        expect(prismaMock.macroPeriod.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    traineeId: TRAINEE_ID,
                    trainerId: TRAINER_ID,
                    phaseTypeId: PHASE_ID,
                    startDate: day('2026-10-05'),
                    endDate: day('2026-10-18'),
                    note: 'Blocco 1',
                },
            })
        )
    })

    it('answers 409 when the weeks are already taken', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, isActive: true } as never)
        prismaMock.macroPeriod.findFirst.mockResolvedValue({ id: 'other' } as never)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error).toMatchObject({ code: 'CONFLICT', key: 'macroPeriod.overlap' })
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 409 for an archived phase', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: PHASE_ID, isActive: false } as never)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('macroPhase.archived')
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 404 for a phase of another trainer', async () => {
        asTrainer()
        prismaMock.macroPhaseType.findFirst.mockResolvedValue(null)

        const res = await POST(request('POST', body), withId(TRAINEE_ID))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('macroPhase.notFound')
    })

    it.each([
        ['a start that is not a Monday', { ...body, startDate: '2026-10-06' }],
        ['an end that is not a Sunday', { ...body, endDate: '2026-10-17' }],
        ['a missing phase', { startDate: '2026-10-05', endDate: '2026-10-18' }],
    ])('rejects %s with 400', async (_label, invalid) => {
        asTrainer()

        const res = await POST(request('POST', invalid), withId(TRAINEE_ID))

        expect(res.status).toBe(400)
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 403 for a trainee of another trainer', async () => {
        asForeignTrainer()

        const res = await POST(request('POST', body), withId(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.macroPeriod.create).not.toHaveBeenCalled()
    })

    it('answers 401 without a session', async () => {
        asUnauthenticated()
        expect((await POST(request('POST', body), withId(TRAINEE_ID))).status).toBe(401)
    })
})

describe('PATCH /api/macro-periods/[id]', () => {
    it('moves a period, checking overlap against the others only', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPeriod.update.mockResolvedValue(
            periodRow({ startDate: day('2026-10-12'), endDate: day('2026-10-25') }) as never
        )

        const res = await PATCH(request('PATCH', { startDate: '2026-10-12', endDate: '2026-10-25' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.period).toMatchObject({ startDate: '2026-10-12', endDate: '2026-10-25' })
        expect(prismaMock.macroPeriod.findFirst).toHaveBeenNthCalledWith(1, {
            where: { id: PERIOD_ID, trainerId: TRAINER_ID },
            select: { id: true, traineeId: true, phaseTypeId: true, startDate: true, endDate: true },
        })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
        expect(prismaMock.macroPeriod.findFirst).toHaveBeenNthCalledWith(2, {
            where: {
                traineeId: TRAINEE_ID,
                trainerId: TRAINER_ID,
                id: { not: PERIOD_ID },
                startDate: { lte: day('2026-10-25') },
                endDate: { gte: day('2026-10-12') },
            },
            select: { id: true },
        })
        expect(prismaMock.macroPeriod.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: PERIOD_ID },
                data: { startDate: day('2026-10-12'), endDate: day('2026-10-25') },
            })
        )
    })

    it('resizes one edge by merging with the stored dates', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPeriod.update.mockResolvedValue(periodRow({ endDate: day('2026-11-01') }) as never)

        const res = await PATCH(request('PATCH', { endDate: '2026-11-01' }), withId(PERIOD_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.macroPeriod.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { endDate: day('2026-11-01') } })
        )
    })

    it('rejects a merged range that is not whole weeks', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)

        // 2026-10-04 is a Sunday before the stored Monday start → end <= start
        const res = await PATCH(request('PATCH', { endDate: '2026-10-04' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.macroPeriodInvalidRange')
        expect(prismaMock.macroPeriod.update).not.toHaveBeenCalled()
    })

    it('answers 409 when the new range overlaps another period', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst
            .mockResolvedValueOnce(storedPeriod as never)
            .mockResolvedValueOnce({ id: 'other' } as never)

        const res = await PATCH(request('PATCH', { endDate: '2026-11-01' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('macroPeriod.overlap')
        expect(prismaMock.macroPeriod.update).not.toHaveBeenCalled()
    })

    it('changes the phase when the new one is active and owned', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: OTHER_PHASE_ID, isActive: true } as never)
        prismaMock.macroPeriod.update.mockResolvedValue(periodRow() as never)

        const res = await PATCH(request('PATCH', { phaseTypeId: OTHER_PHASE_ID }), withId(PERIOD_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.macroPhaseType.findFirst).toHaveBeenCalledWith({
            where: { id: OTHER_PHASE_ID, trainerId: TRAINER_ID },
            select: { id: true, isActive: true },
        })
        expect(prismaMock.macroPeriod.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { phaseTypeId: OTHER_PHASE_ID } })
        )
    })

    it('refuses to change the phase to an archived one', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)
        prismaMock.macroPhaseType.findFirst.mockResolvedValue({ id: OTHER_PHASE_ID, isActive: false } as never)

        const res = await PATCH(request('PATCH', { phaseTypeId: OTHER_PHASE_ID }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('macroPhase.archived')
    })

    it('lets a period on an archived phase be moved without re-checking the phase', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValueOnce(storedPeriod as never).mockResolvedValueOnce(null)
        prismaMock.macroPeriod.update.mockResolvedValue(periodRow() as never)

        // same phase id sent back by the dialog: not a phase change
        const res = await PATCH(
            request('PATCH', { phaseTypeId: PHASE_ID, startDate: '2026-10-12', endDate: '2026-10-25' }),
            withId(PERIOD_ID)
        )

        expect(res.status).toBe(200)
        expect(prismaMock.macroPhaseType.findFirst).not.toHaveBeenCalled()
    })

    it('answers 404 for a period of another trainer', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(null)

        const res = await PATCH(request('PATCH', { note: 'x' }), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('macroPeriod.notFound')
    })

    it('answers 403 when the trainee no longer belongs to the trainer', async () => {
        asForeignTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)

        const res = await PATCH(request('PATCH', { note: 'x' }), withId(PERIOD_ID))

        expect(res.status).toBe(403)
        expect(prismaMock.macroPeriod.update).not.toHaveBeenCalled()
    })

    it('rejects an empty body with 400, and answers 401 without a session', async () => {
        asTrainer()
        expect((await PATCH(request('PATCH', {}), withId(PERIOD_ID))).status).toBe(400)

        asUnauthenticated()
        expect((await PATCH(request('PATCH', { note: 'x' }), withId(PERIOD_ID))).status).toBe(401)
    })
})

describe('DELETE /api/macro-periods/[id]', () => {
    it('deletes an owned period', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)
        prismaMock.macroPeriod.delete.mockResolvedValue(storedPeriod as never)

        const res = await DELETE(request('DELETE'), withId(PERIOD_ID))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data).toEqual({ id: PERIOD_ID })
        expect(requireTrainerOwnership).toHaveBeenCalledWith(TRAINEE_ID)
        expect(prismaMock.macroPeriod.delete).toHaveBeenCalledWith({ where: { id: PERIOD_ID } })
    })

    it('answers 404 for a period of another trainer', async () => {
        asTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(null)

        const res = await DELETE(request('DELETE'), withId(PERIOD_ID))

        expect(res.status).toBe(404)
        expect(prismaMock.macroPeriod.delete).not.toHaveBeenCalled()
    })

    it('answers 403 when the trainee no longer belongs to the trainer, 401 without a session', async () => {
        asForeignTrainer()
        prismaMock.macroPeriod.findFirst.mockResolvedValue(storedPeriod as never)
        expect((await DELETE(request('DELETE'), withId(PERIOD_ID))).status).toBe(403)
        expect(prismaMock.macroPeriod.delete).not.toHaveBeenCalled()

        asUnauthenticated()
        expect((await DELETE(request('DELETE'), withId(PERIOD_ID))).status).toBe(401)
    })
})
