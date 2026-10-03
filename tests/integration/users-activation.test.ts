import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/sync-user-metadata', () => ({
    syncUserMetadata: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/invitation', () => ({
    isInvitationPending: vi.fn(),
}))

import { PATCH as activateUser } from '@/app/api/users/[id]/activate/route'
import { PATCH as deactivateUser } from '@/app/api/users/[id]/deactivate/route'
import { syncUserMetadata } from '@/lib/sync-user-metadata'
import { isInvitationPending } from '@/lib/invitation'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asUnauthenticated, asForbidden } from '../helpers/auth-mock'
import { requireRole } from '@/lib/auth'
import { mockTrainerSession } from '../helpers/sessions'

const TRAINEE_ID = 'trainee-uuid-1'

const withParams = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) })

function makeRequest(path: string) {
    return new NextRequest(`http://localhost:3000/api/users/${TRAINEE_ID}/${path}`, { method: 'PATCH' })
}

describe('PATCH /api/users/[id]/activate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee', isActive: false } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: TRAINEE_ID,
        } as never)
        prismaMock.user.update.mockResolvedValue({ id: TRAINEE_ID, isActive: true } as never)
        vi.mocked(isInvitationPending).mockResolvedValue(false)
    })

    it('refuses to activate a trainee who never accepted the invitation', async () => {
        vi.mocked(isInvitationPending).mockResolvedValue(true)

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error.key).toBe('user.invitationPending')
        expect(vi.mocked(isInvitationPending)).toHaveBeenCalledWith(TRAINEE_ID)
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('skips the invitation check for a trainee who is already active', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee', isActive: true } as never)

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))

        expect(res.status).toBe(200)
        expect(vi.mocked(isInvitationPending)).not.toHaveBeenCalled()
        expect(prismaMock.userStatusEvent.create).not.toHaveBeenCalled()
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))

        expect(res.status).toBe(403)
        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer'])
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('records a reactivated event authored by the trainer', async () => {
        await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))

        expect(prismaMock.userStatusEvent.create).toHaveBeenCalledWith({
            data: { userId: TRAINEE_ID, type: 'reactivated', actorId: mockTrainerSession.user.id },
        })
    })

    it('activates a trainee the trainer owns', async () => {
        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.user).toMatchObject({ id: TRAINEE_ID, isActive: true })
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: TRAINEE_ID }, data: { isActive: true } })
        )
        expect(vi.mocked(syncUserMetadata)).toHaveBeenCalledWith(TRAINEE_ID, { isActive: true })
    })

    it('lets an admin activate a trainee without an association', async () => {
        asAdmin()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))

        expect(res.status).toBe(200)
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: TRAINEE_ID }, data: { isActive: true } })
        )
    })

    it('returns 404 when the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('user.notFound')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('refuses a target that is not a trainee', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainer' } as never)

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('user.canOnlyActivateTrainee')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('refuses a trainer who does not own the trainee', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.user.update.mockRejectedValue(new Error('db down'))

        const res = await activateUser(makeRequest('activate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PATCH /api/users/[id]/deactivate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee', isActive: true } as never)
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: TRAINEE_ID,
        } as never)
        prismaMock.user.update.mockResolvedValue({ id: TRAINEE_ID, isActive: false } as never)
    })

    it('deactivates a trainee the trainer owns', async () => {
        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.user).toMatchObject({ id: TRAINEE_ID, isActive: false })
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: TRAINEE_ID }, data: { isActive: false } })
        )
        expect(vi.mocked(syncUserMetadata)).toHaveBeenCalledWith(TRAINEE_ID, { isActive: false })
    })

    it('returns 403 for a trainee', async () => {
        asForbidden()

        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))

        expect(res.status).toBe(403)
        expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['admin', 'trainer'])
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('records a deactivated event authored by the trainer', async () => {
        await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))

        expect(prismaMock.userStatusEvent.create).toHaveBeenCalledWith({
            data: { userId: TRAINEE_ID, type: 'deactivated', actorId: mockTrainerSession.user.id },
        })
    })

    it('records nothing when the trainee is already inactive', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'trainee', isActive: false } as never)

        await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))

        expect(prismaMock.userStatusEvent.create).not.toHaveBeenCalled()
    })

    it('lets an admin deactivate a trainee without an association', async () => {
        asAdmin()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))

        expect(res.status).toBe(200)
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: TRAINEE_ID }, data: { isActive: false } })
        )
    })

    it('returns 404 when the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('user.notFound')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('refuses a target that is not a trainee', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: TRAINEE_ID, role: 'admin' } as never)

        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('user.canOnlyDeactivateTrainee')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('refuses a trainer who does not own the trainee', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))

        expect(res.status).toBe(401)
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the metadata sync fails', async () => {
        vi.mocked(syncUserMetadata).mockRejectedValue(new Error('supabase down'))

        const res = await deactivateUser(makeRequest('deactivate'), withParams({ id: TRAINEE_ID }))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
