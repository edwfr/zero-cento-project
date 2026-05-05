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
        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: { isActive: true },
            select: { id: true },
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
