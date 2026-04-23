import { createAdminClient } from './supabase-server'
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
    const currentMeta = existing.user?.user_metadata ?? {}

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
