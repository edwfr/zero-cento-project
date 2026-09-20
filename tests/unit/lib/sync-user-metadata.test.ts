import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserById = vi.fn()
const updateUserById = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
    createAdminClient: () => ({ auth: { admin: { getUserById, updateUserById } } }),
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { syncUserMetadata } from '@/lib/sync-user-metadata'
import { logger } from '@/lib/logger'

describe('syncUserMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getUserById.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: { role: 'trainee' }, user_metadata: { firstName: 'Mario' } } },
        })
        updateUserById.mockResolvedValue({ error: null })
    })

    it('warns and returns when the user does not exist in Supabase Auth', async () => {
        getUserById.mockResolvedValue({ data: { user: null } })

        await expect(syncUserMetadata('u-missing', { role: 'trainee' })).resolves.toBeUndefined()

        expect(logger.warn).toHaveBeenCalled()
        expect(updateUserById).not.toHaveBeenCalled()
    })

    it('does not call update when there is nothing to sync', async () => {
        await syncUserMetadata('u-1', {})

        expect(updateUserById).not.toHaveBeenCalled()
    })

    it('writes authorization fields to app_metadata only', async () => {
        await syncUserMetadata('u-1', { role: 'trainer', isActive: true, mustChangePassword: false })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            app_metadata: { role: 'trainer', isActive: true, mustChangePassword: false },
        })
    })

    it('writes display names to user_metadata only', async () => {
        await syncUserMetadata('u-1', { firstName: 'Luigi', lastName: 'Verdi' })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            user_metadata: { firstName: 'Luigi', lastName: 'Verdi' },
        })
    })

    it('merges into the metadata the user already has', async () => {
        await syncUserMetadata('u-1', { isActive: false })

        expect(updateUserById).toHaveBeenCalledWith('u-1', {
            app_metadata: { role: 'trainee', isActive: false },
        })
    })

    it('tolerates a user without any metadata yet', async () => {
        getUserById.mockResolvedValue({ data: { user: { id: 'u-2' } } })

        await syncUserMetadata('u-2', { role: 'admin', firstName: 'Admin' })

        expect(updateUserById).toHaveBeenCalledWith('u-2', {
            app_metadata: { role: 'admin' },
            user_metadata: { firstName: 'Admin' },
        })
    })

    it('throws when Supabase rejects the update', async () => {
        updateUserById.mockResolvedValue({ error: { message: 'boom' } })

        await expect(syncUserMetadata('u-1', { role: 'trainer' })).rejects.toThrow(
            /syncUserMetadata failed for u-1/
        )
    })
})
