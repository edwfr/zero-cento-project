import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireAuthDuringOnboarding } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { syncUserMetadata } from '@/lib/sync-user-metadata'

/**
 * POST /api/auth/activate
 * Activate a user after they complete onboarding
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireAuthDuringOnboarding()

        // Activate the user
        // Onboarding completes once: an inactive user who already activated was
        // deactivated by a trainer or admin and must not reactivate themselves
        if (!session.user.isActive) {
            const previousActivation = await prisma.userStatusEvent.findFirst({
                where: { userId: session.user.id, type: 'activated' },
                select: { id: true },
            })

            if (previousActivation) {
                return apiError('FORBIDDEN', 'Account deactivated', 403, undefined, 'user.accountDeactivated')
            }
        }

        // The activation is the trainee's own step: they are its author
        const updatedUser = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: session.user.id },
                data: { isActive: true },
                select: { id: true },
            })

            if (!session.user.isActive) {
                await tx.userStatusEvent.create({
                    data: { userId: session.user.id, type: 'activated', actorId: session.user.id },
                })
            }

            return updated
        })

        await syncUserMetadata(updatedUser.id, { isActive: true })

        logger.info({ userId: session.user.id }, 'User activated after onboarding')

        return apiSuccess({
            message: 'User activated successfully',
            messageKey: 'user.activatedSuccess',
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error activating user')
        return apiError('INTERNAL_ERROR', 'Failed to activate user', 500, undefined, 'internal.default')
    }
}
