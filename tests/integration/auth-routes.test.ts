import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.mock factories are hoisted above const declarations, so the spies they
// close over have to be created with vi.hoisted.
const {
    requireAuthDuringOnboarding,
    createClient,
    createAdminClient,
    signInWithPassword,
    updateUserById,
    getUserById,
    syncUserMetadata,
} = vi.hoisted(() => ({
    requireAuthDuringOnboarding: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUserById: vi.fn(),
    getUserById: vi.fn(),
    syncUserMetadata: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getSession: vi.fn(),
    requireAuthDuringOnboarding,
}))

vi.mock('@/lib/sync-user-metadata', () => ({ syncUserMetadata }))

vi.mock('@/lib/supabase-server', () => ({ createClient, createAdminClient }))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as getMe } from '@/app/api/auth/me/route'
import { POST as activate } from '@/app/api/auth/activate/route'
import { POST as forceChangePassword } from '@/app/api/auth/force-change-password/route'
import { getSession } from '@/lib/auth'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession } from '../helpers/sessions'

const makeRequest = (body: unknown) => new NextRequest('http://localhost/api/auth/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
})

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue(mockTrainerSession)
    requireAuthDuringOnboarding.mockResolvedValue({ user: mockTrainerSession.user })
    prismaMock.user.update.mockResolvedValue({ id: mockTrainerSession.user.id, isActive: true } as never)
    syncUserMetadata.mockResolvedValue(undefined)
    signInWithPassword.mockResolvedValue({ error: null })
    updateUserById.mockResolvedValue({ error: null })
    getUserById.mockResolvedValue({ data: { user: { app_metadata: { role: 'trainer' } } }, error: null })
    createClient.mockResolvedValue({ auth: { signInWithPassword } })
    createAdminClient.mockReturnValue({ auth: { admin: { updateUserById, getUserById } } })
})

describe('GET /api/auth/me', () => {
    it('returns the current session user', async () => {
        const response = await getMe()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data).toMatchObject({
            id: mockTrainerSession.user.id,
            email: mockTrainerSession.user.email,
            role: 'trainer',
        })
    })

    it('returns 401 without a session', async () => {
        vi.mocked(getSession).mockResolvedValue(null)

        const response = await getMe()
        const body = await response.json()

        expect(response.status).toBe(401)
        expect(body.error.key).toBe('auth.required')
    })

    it('returns 500 when loading the session fails', async () => {
        vi.mocked(getSession).mockRejectedValue(new Error('session down'))

        const response = await getMe()
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('POST /api/auth/activate', () => {
    it('activates the onboarding user and syncs metadata', async () => {
        const response = await activate(makeRequest({}))

        expect(response.status).toBe(200)
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: mockTrainerSession.user.id },
                data: { isActive: true },
            })
        )
        expect(syncUserMetadata).toHaveBeenCalledWith(mockTrainerSession.user.id, { isActive: true })
    })

    it('returns 500 when activation fails', async () => {
        prismaMock.user.update.mockRejectedValue(new Error('db down'))

        const response = await activate(makeRequest({}))
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('POST /api/auth/force-change-password', () => {
    const validBody = { currentPassword: 'old-password', newPassword: 'new-password-123' }

    it('returns 401 without a session', async () => {
        vi.mocked(getSession).mockResolvedValue(null)

        const response = await forceChangePassword(makeRequest(validBody))
        const body = await response.json()

        expect(response.status).toBe(401)
        expect(body.error.key).toBe('auth.required')
    })

    it('returns 400 for an invalid password payload', async () => {
        const response = await forceChangePassword(makeRequest({ currentPassword: '' }))
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(signInWithPassword).not.toHaveBeenCalled()
    })

    it('returns 401 when the current password is incorrect', async () => {
        signInWithPassword.mockResolvedValue({ error: { message: 'invalid credentials' } })

        const response = await forceChangePassword(makeRequest(validBody))
        const body = await response.json()

        expect(response.status).toBe(401)
        expect(body.error.key).toBe('auth.invalidPassword')
        expect(updateUserById).not.toHaveBeenCalled()
    })

    it('updates the password and clears the metadata flag', async () => {
        const response = await forceChangePassword(makeRequest(validBody))

        expect(response.status).toBe(200)
        expect(updateUserById).toHaveBeenNthCalledWith(1, mockTrainerSession.user.id, { password: 'new-password-123' })
        expect(updateUserById).toHaveBeenNthCalledWith(
            2,
            mockTrainerSession.user.id,
            { app_metadata: { role: 'trainer', mustChangePassword: false } }
        )
    })

    it('returns 500 when the password update fails', async () => {
        updateUserById.mockResolvedValueOnce({ error: { message: 'update failed' } })

        const response = await forceChangePassword(makeRequest(validBody))
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })

    it('returns 500 when metadata update fails', async () => {
        updateUserById
            .mockResolvedValueOnce({ error: null })
            .mockResolvedValueOnce({ error: { message: 'metadata failed' } })

        const response = await forceChangePassword(makeRequest(validBody))
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
