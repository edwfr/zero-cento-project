import { createAdminClient } from './supabase-server'
import { logger } from './logger'
import type { Role } from '@prisma/client'

export interface UserMetadataFields {
    role?: Role
    firstName?: string
    lastName?: string
    isActive?: boolean
    mustChangePassword?: boolean
}

/**
 * Sync user fields to Supabase Auth metadata.
 *
 * Authorization data (role, isActive, mustChangePassword) goes to app_metadata,
 * which only the service role can write. user_metadata is writable by the user
 * themselves with the anon key (supabase.auth.updateUser), so it must never
 * carry anything the server trusts for access control — display names only.
 */
export async function syncUserMetadata(userId: string, fields: UserMetadataFields): Promise<void> {
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient.auth.admin.getUserById(userId)

    if (!existing.user) {
        // User not found in Supabase Auth (e.g. seed users with mismatched IDs).
        // Log a warning but do not throw — the Prisma update has already succeeded.
        logger.warn({ userId }, 'syncUserMetadata: user not found in Supabase Auth, skipping metadata sync')
        return
    }

    const { role, isActive, mustChangePassword, firstName, lastName } = fields

    const payload: {
        app_metadata?: Record<string, unknown>
        user_metadata?: Record<string, unknown>
    } = {}

    if (role !== undefined || isActive !== undefined || mustChangePassword !== undefined) {
        payload.app_metadata = {
            ...(existing.user.app_metadata ?? {}),
            ...(role !== undefined && { role }),
            ...(isActive !== undefined && { isActive }),
            ...(mustChangePassword !== undefined && { mustChangePassword }),
        }
    }

    if (firstName !== undefined || lastName !== undefined) {
        payload.user_metadata = {
            ...(existing.user.user_metadata ?? {}),
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
        }
    }

    if (Object.keys(payload).length === 0) {
        return
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, payload)

    if (error) {
        throw new Error(`syncUserMetadata failed for ${userId}: ${error.message}`)
    }
}
