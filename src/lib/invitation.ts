import { createAdminClient } from './supabase-server'

export type ResendInvitationResult = 'sent' | 'alreadyConfirmed' | 'rateLimited'

/**
 * An invitation is pending until the user verifies the invite link, which is
 * what sets email_confirmed_at in Supabase Auth. Users missing from Supabase
 * Auth (e.g. seed users with mismatched IDs) are never pending.
 */
export async function isInvitationPending(userId: string): Promise<boolean> {
    const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
    if (error) throw new Error(error.message)
    return !!data.user && !data.user.email_confirmed_at
}

/**
 * Re-send the onboarding invite to a user who never accepted it.
 * Supabase re-invites an unconfirmed user in place: same auth user, new token,
 * the previous link stops working.
 */
export async function resendInvitation(userId: string, email: string): Promise<ResendInvitationResult> {
    const supabase = createAdminClient()

    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error(`Auth user ${userId} not found`)
    if (data.user.email_confirmed_at) return 'alreadyConfirmed'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/onboarding/set-password`,
        data: data.user.user_metadata,
    })

    if (inviteError) {
        if (inviteError.status === 429) return 'rateLimited'
        throw new Error(inviteError.message)
    }

    return 'sent'
}
