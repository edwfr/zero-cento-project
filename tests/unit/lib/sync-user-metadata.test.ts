import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserById = vi.fn()
const updateUserById = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
    createAdminClient: () => ({ auth: { admin: { getUserById, updateUserById } } }),
}))

vi.mock('@/lib/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { syncUserMetadata } from '@/lib/sync-user-metadata'
import { logger } from '@/lib/logger'

describe('syncUserMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getUserById.mockResolvedValue({
            data: {
                user: {
                    id: 'u-1',
                    app_metadata: { role: 'trainee' },
                    user_metadata: { firstName: 'Mario' },
                },
            },
        })
        updateUserById.mockResolvedValue({ error: null })
    })

    it('writes authorization fields to app_metadata', async () => {
        await syncUserMetadata('u-1', { role: 'trainer', isActive: false })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            app_metadata: { role: 'trainer', isActive: false },
        })
    })

    it('writes display fields to user_metadata', async () => {
        await syncUserMetadata('u-1', { firstName: 'Luigi' })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            user_metadata: { firstName: 'Luigi' },
        })
    })

    it('preserves existing metadata it does not touch', async () => {
        getUserById.mockResolvedValue({
            data: {
                user: {
                    id: 'u-1',
                    app_metadata: { role: 'trainee', isActive: true },
                    user_metadata: { locale: 'it', firstName: 'Mario' },
                },
            },
        })

        await syncUserMetadata('u-1', { isActive: false })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            app_metadata: { role: 'trainee', isActive: false },
        })
    })

    it('never writes role or isActive into user_metadata', async () => {
        await syncUserMetadata('u-1', { role: 'admin', isActive: true, firstName: 'Anna' })

        const payload = updateUserById.mock.calls[0][1]
        expect(payload.user_metadata ?? {}).not.toHaveProperty('role')
        expect(payload.user_metadata ?? {}).not.toHaveProperty('isActive')
        expect(payload.app_metadata).toMatchObject({ role: 'admin', isActive: true })
        expect(payload.user_metadata).toMatchObject({ firstName: 'Anna' })
    })

    it('writes mustChangePassword to app_metadata', async () => {
        await syncUserMetadata('u-1', { mustChangePassword: true })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            app_metadata: { role: 'trainee', mustChangePassword: true },
        })
    })

    it('does not call the update when there is nothing to write', async () => {
        await syncUserMetadata('u-1', {})

        expect(updateUserById).not.toHaveBeenCalled()
    })

    it('logs a warning and returns when the Supabase user does not exist', async () => {
        getUserById.mockResolvedValue({ data: { user: null } })

        await expect(syncUserMetadata('missing', { isActive: true })).resolves.toBeUndefined()
        expect(updateUserById).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalled()
    })

    it('throws when the update fails', async () => {
        updateUserById.mockResolvedValue({ error: { message: 'boom' } })

        await expect(syncUserMetadata('u-1', { isActive: true })).rejects.toThrow(/boom/)
    })
})
