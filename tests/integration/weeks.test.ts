import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { PATCH as updateWeek } from '@/app/api/weeks/[id]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession } from '../helpers/sessions'

const WEEK_ID = '77777777-7777-7777-7777-777777777771'

const withId = () => ({ params: Promise.resolve({ id: WEEK_ID }) })

const makeRequest = (body: unknown) => new NextRequest(`http://localhost/api/weeks/${WEEK_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
})

const week = {
    id: WEEK_ID,
    program: {
        id: '55555555-5555-5555-5555-555555555551',
        trainerId: mockTrainerSession.user.id,
        status: 'draft',
        title: 'Blocco forza',
    },
}

beforeEach(() => {
    asTrainer()
    prismaMock.week.findUnique.mockResolvedValue(week as never)
    prismaMock.week.update.mockResolvedValue({ id: WEEK_ID, weekType: 'deload' } as never)
})

describe('PATCH /api/weeks/[id]', () => {
    it('updates the week type', async () => {
        const response = await updateWeek(makeRequest({ weekType: 'deload' }), withId())

        expect(response.status).toBe(200)
        expect(prismaMock.week.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: WEEK_ID },
                data: expect.objectContaining({ weekType: 'deload' }),
            })
        )
    })

    it('updates feedbackRequested', async () => {
        const response = await updateWeek(makeRequest({ feedbackRequested: true }), withId())

        expect(response.status).toBe(200)
        expect(prismaMock.week.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: WEEK_ID },
                data: expect.objectContaining({ feedbackRequested: true }),
            })
        )
    })

    it('returns 400 for an invalid week type', async () => {
        const response = await updateWeek(makeRequest({ weekType: 'invalid' }), withId())
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.week.update).not.toHaveBeenCalled()
    })

    it('returns 400 when no field is provided', async () => {
        const response = await updateWeek(makeRequest({}), withId())
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error.key).toBe('validation.atLeastOneField')
        expect(prismaMock.week.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the week does not exist', async () => {
        prismaMock.week.findUnique.mockResolvedValue(null)

        const response = await updateWeek(makeRequest({ weekType: 'test' }), withId())
        const body = await response.json()

        expect(response.status).toBe(404)
        expect(body.error.key).toBe('week.notFound')
    })

    it('returns 403 when the trainer does not own the program', async () => {
        prismaMock.week.findUnique.mockResolvedValue({
            ...week,
            program: { ...week.program, trainerId: 'trainer-other' },
        } as never)

        const response = await updateWeek(makeRequest({ weekType: 'test' }), withId())
        const body = await response.json()

        expect(response.status).toBe(403)
        expect(body.error.key).toBe('week.modifyDenied')
        expect(prismaMock.week.update).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated', async () => {
        asUnauthenticated()

        const response = await updateWeek(makeRequest({ weekType: 'test' }), withId())

        expect(response.status).toBe(401)
        expect(prismaMock.week.update).not.toHaveBeenCalled()
    })

    it('returns 403 when the caller lacks the required role', async () => {
        asForbidden()

        const response = await updateWeek(makeRequest({ weekType: 'test' }), withId())

        expect(response.status).toBe(403)
        expect(prismaMock.week.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.week.update.mockRejectedValue(new Error('db down'))

        const response = await updateWeek(makeRequest({ weekType: 'test' }), withId())
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
