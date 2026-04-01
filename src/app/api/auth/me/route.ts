import { getSession } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api-response'

/**
 * GET /api/auth/me
 * Get current authenticated user's data
 */
export async function GET() {
    try {
        const session = await getSession()

        if (!session) {
            return apiError('UNAUTHORIZED', 'Authentication required', 401, undefined, 'auth.required')
        }

        return apiSuccess({
            id: session.user.id,
            email: session.user.email,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            role: session.user.role,
            isActive: session.user.isActive,
        })
    } catch (error: any) {
        return apiError('INTERNAL_ERROR', error.message || 'Failed to fetch user data', 500, undefined, 'internal.default')
    }
}
