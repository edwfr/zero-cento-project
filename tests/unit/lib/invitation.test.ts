import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserById = vi.fn()
const inviteUserByEmail = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
    createAdminClient: () => ({ auth: { admin: { getUserById, inviteUserByEmail } } }),
}))

import { isInvitationPending, resendInvitation } from '@/lib/invitation'

const pendingUser = {
    id: 'u-1',
    email_confirmed_at: null,
    user_metadata: { role: 'trainee', firstName: 'Mario', lastName: 'Rossi', locale: 'it' },
}

describe('isInvitationPending', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('is true when the auth user has never confirmed the email', async () => {
        getUserById.mockResolvedValue({ data: { user: pendingUser }, error: null })

        await expect(isInvitationPending('u-1')).resolves.toBe(true)
        expect(getUserById).toHaveBeenCalledWith('u-1')
    })

    it('is false when the email is confirmed', async () => {
        getUserById.mockResolvedValue({
            data: { user: { ...pendingUser, email_confirmed_at: '2026-01-01T00:00:00Z' } },
            error: null,
        })

        await expect(isInvitationPending('u-1')).resolves.toBe(false)
    })

    it('is false when the user is missing from Supabase Auth', async () => {
        getUserById.mockResolvedValue({ data: { user: null }, error: null })

        await expect(isInvitationPending('u-1')).resolves.toBe(false)
    })

    it('throws when Supabase returns an error', async () => {
        getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'boom', status: 500 } })

        await expect(isInvitationPending('u-1')).rejects.toThrow('boom')
    })
})

describe('resendInvitation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
        getUserById.mockResolvedValue({ data: { user: pendingUser }, error: null })
        inviteUserByEmail.mockResolvedValue({ data: { user: pendingUser }, error: null })
    })

    it('re-sends the invite with the existing metadata and the onboarding redirect', async () => {
        await expect(resendInvitation('u-1', 'mario@example.com')).resolves.toBe('sent')

        expect(inviteUserByEmail).toHaveBeenCalledWith('mario@example.com', {
            redirectTo: 'https://app.example.com/onboarding/set-password',
            data: pendingUser.user_metadata,
        })
    })

    it('does not re-send when the email is already confirmed', async () => {
        getUserById.mockResolvedValue({
            data: { user: { ...pendingUser, email_confirmed_at: '2026-01-01T00:00:00Z' } },
            error: null,
        })

        await expect(resendInvitation('u-1', 'mario@example.com')).resolves.toBe('alreadyConfirmed')
        expect(inviteUserByEmail).not.toHaveBeenCalled()
    })

    it('reports a Supabase email rate limit', async () => {
        inviteUserByEmail.mockResolvedValue({
            data: { user: null },
            error: { message: 'Email rate limit exceeded', status: 429 },
        })

        await expect(resendInvitation('u-1', 'mario@example.com')).resolves.toBe('rateLimited')
    })

    it('throws when the auth user does not exist', async () => {
        getUserById.mockResolvedValue({ data: { user: null }, error: null })

        await expect(resendInvitation('u-1', 'mario@example.com')).rejects.toThrow()
        expect(inviteUserByEmail).not.toHaveBeenCalled()
    })

    it('throws on any other invite error', async () => {
        inviteUserByEmail.mockResolvedValue({
            data: { user: null },
            error: { message: 'smtp down', status: 500 },
        })

        await expect(resendInvitation('u-1', 'mario@example.com')).rejects.toThrow('smtp down')
    })
})
