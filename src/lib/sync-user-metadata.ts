import { createAdminClient } from './supabase-server'
import { logger } from './logger'
import type { Role } from '@prisma/client'

export interface UserMetadataFields {
    role?: Role
    firstName?: string
    lastName?: string
    isActive?: boolean
}

export async function syncUserMetadata(userId: string, fields: UserMetadataFields): Promise<void> {
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient.auth.admin.getUserById(userId)

    if (!existing.user) {
        // User not found in Supabase Auth (e.g. seed users with mismatched IDs).
        // Log a warning but do not throw — the Prisma update has already succeeded.
        logger.warn({ userId }, 'syncUserMetadata: user not found in Supabase Auth, skipping metadata sync')
        return
    }

    const currentMeta = existing.user.user_metadata ?? {}

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
            ...currentMeta,
            ...fields,
        },
    })

    if (error) {
        throw new Error(`syncUserMetadata failed for ${userId}: ${error.message}`)
    }
}
