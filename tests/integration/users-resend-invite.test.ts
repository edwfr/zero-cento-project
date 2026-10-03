import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/invitation', () => ({
    resendInvitation: vi.fn(),
}))

import { POST as resendInvite } from '@/app/api/users/[id]/resend-invite/route'
import { resendInvitation } from '@/lib/invitation'
import { requireRole } from '@/lib/auth'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { mockTrainerSession } from '../helpers/sessions'

const TRAINEE_ID = 'trainee-uuid-1'
const EMAIL = 'mario.rossi@example.com'

const withParams = (id: string) => ({ params: Promise.resolve({ id }) })

function makeRequest() {
    return new NextRequest(`http://localhost:3000/api/users/${TRAINEE_ID}/resend-invite`, { method: 'POST' })
}

describe('POST /api/users/[id]/resend-invite', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({
            id: TRAINEE_ID,
            email: EMAIL,
            role: 'trainee',
            isActive: false,
        } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: TRAINEE_ID,
        } as never)
        vi.mocked(resendInvitation).mockResolvedValue('sent')
    })

    it('re-sends the invite for a pending trainee the trainer owns', async () => {
        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toEqual({ userId: TRAINEE_ID, status: 'invitation_sent' })
        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer'])
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId: TRAINEE_ID },
        })
        expect(vi.mocked(resendInvitation)).toHaveBeenCalledWith(TRAINEE_ID, EMAIL)
    })

    it('lets an admin re-send without an association', async () => {
        asAdmin()

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(200)
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
        expect(vi.mocked(resendInvitation)).toHaveBeenCalledWith(TRAINEE_ID, EMAIL)
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(401)
        expect(vi.mocked(resendInvitation)).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(vi.mocked(resendInvitation)).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainer who does not own the trainee', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(vi.mocked(resendInvitation)).not.toHaveBeenCalled()
    })

    it('returns 403 when a trainer targets a non-trainee', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, email: EMAIL, role: 'trainer', isActive: false } as never)

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(vi.mocked(resendInvitation)).not.toHaveBeenCalled()
    })

    it('returns 403 when an admin targets another admin', async () => {
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, email: EMAIL, role: 'admin', isActive: false } as never)

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))

        expect(res.status).toBe(403)
        expect(vi.mocked(resendInvitation)).not.toHaveBeenCalled()
    })

    it('returns 404 when the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('user.notFound')
    })

    it('returns 409 when the user is already active', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, email: EMAIL, role: 'trainee', isActive: true } as never)

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('user.alreadyOnboarded')
        expect(vi.mocked(resendInvitation)).not.toHaveBeenCalled()
    })

    it('returns 409 when the email is already confirmed', async () => {
        vi.mocked(resendInvitation).mockResolvedValue('alreadyConfirmed')

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('user.alreadyOnboarded')
    })

    it('returns 429 when Supabase rate limits the email', async () => {
        vi.mocked(resendInvitation).mockResolvedValue('rateLimited')

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(429)
        expect(body.error.key).toBe('user.inviteRateLimited')
    })

    it('returns 500 when the invite fails', async () => {
        vi.mocked(resendInvitation).mockRejectedValue(new Error('smtp down'))

        const res = await resendInvite(makeRequest(), withParams(TRAINEE_ID))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
