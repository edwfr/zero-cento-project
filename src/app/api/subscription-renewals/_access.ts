import { apiError } from '@/lib/api-response'
import { requireTrainerOwnership, type AuthSession } from '@/lib/auth'

/**
 * Subscription renewals are trainer-only data: the trainee has no read or write
 * access, on any method. Single enforcement point for both renewal routes —
 * the UI never relies on hiding alone.
 */
export function denyTrainee(session: AuthSession): Response | null {
    if (session.user.role === 'trainee') {
        return apiError('FORBIDDEN', 'Subscriptions are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
    }
    return null
}

export async function guardRenewalAccess(session: AuthSession, traineeId: string): Promise<Response | null> {
    const denied = denyTrainee(session)
    if (denied) return denied

    if (session.user.role === 'trainer') {
        await requireTrainerOwnership(traineeId)
    }

    return null
}
