import { getSession } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { handleApiError } from '@/lib/api-error-handler'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { z } from 'zod'

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

/**
 * POST /api/auth/force-change-password
 * Change password for users with mustChangePassword=true flag
 */
export async function POST(request: Request) {
    try {
        const session = await getSession()

        if (!session) {
            return apiError('UNAUTHORIZED', 'Authentication required', 401, undefined, 'auth.required')
        }

        // Parse and validate request body
        const body = await request.json()
        const validation = changePasswordSchema.safeParse(body)

        if (!validation.success) {
            return apiError(
                'VALIDATION_ERROR',
                validation.error.errors[0].message,
                400,
                validation.error.errors,
                'validation.invalidInput'
            )
        }

        const { currentPassword, newPassword } = validation.data

        // Verify current password by attempting to sign in
        const supabase = await createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: session.user.email!,
            password: currentPassword,
        })

        if (signInError) {
            return apiError('UNAUTHORIZED', 'Current password is incorrect', 401, undefined, 'auth.invalidPassword')
        }

        // Update password using admin client
        const adminClient = createAdminClient()
        const { error: updateError } = await adminClient.auth.admin.updateUserById(session.user.id, {
            password: newPassword,
        })

        if (updateError) {
            return handleApiError(updateError, {
                logMessage: 'Supabase password update failed',
                message: 'Failed to update password',
                key: 'internal.default',
            })
        }

        // Get current metadata to preserve existing values
        const { data: userData } = await adminClient.auth.admin.getUserById(session.user.id)

        // Clear the flag in app_metadata (service-role only), preserving the rest.
        // It must not live in user_metadata: the user could clear it themselves.
        const { error: metadataError } = await adminClient.auth.admin.updateUserById(session.user.id, {
            app_metadata: {
                ...(userData.user?.app_metadata ?? {}),
                mustChangePassword: false,
            },
        })

        if (metadataError) {
            return handleApiError(metadataError, {
                logMessage: 'Supabase metadata update after password change failed',
                message: 'Failed to update user metadata',
                key: 'internal.default',
            })
        }

        return apiSuccess({
            message: 'Password changed successfully',
            messageKey: 'auth.passwordChangedSuccess',
        })
    } catch (error: any) {
        return handleApiError(error, {
            logMessage: 'Error changing password',
            message: error?.message || 'Failed to change password',
            key: 'internal.default',
        })
    }
}
