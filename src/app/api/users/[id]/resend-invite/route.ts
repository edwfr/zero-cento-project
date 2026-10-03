import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { resendInvitation } from '@/lib/invitation'
import { handleApiError } from '@/lib/api-error-handler'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * POST /api/users/[id]/resend-invite
 * Re-send the onboarding invite to a user who never accepted it (link expired)
 * - Trainer: own trainees only
 * - Admin: any non-admin user
 */
export async function POST(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, role: true, isActive: true },
        })

        if (!user) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        if (user.role === 'admin' || (session.user.role === 'trainer' && user.role !== 'trainee')) {
            return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
        }

        if (session.user.role === 'trainer') {
            const association = await prisma.trainerTrainee.findFirst({
                where: { trainerId: session.user.id, traineeId: id },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }

        if (user.isActive) {
            return apiError('CONFLICT', 'User already completed onboarding', 409, undefined, 'user.alreadyOnboarded')
        }

        const result = await resendInvitation(user.id, user.email)

        if (result === 'alreadyConfirmed') {
            return apiError('CONFLICT', 'User already completed onboarding', 409, undefined, 'user.alreadyOnboarded')
        }

        if (result === 'rateLimited') {
            return apiError('RATE_LIMIT_EXCEEDED', 'Too many invitation emails, retry later', 429, undefined, 'user.inviteRateLimited')
        }

        // The email is already out: a failed history write must not turn it into an error
        try {
            await prisma.userStatusEvent.create({
                data: { userId: id, type: 'invitation_resent', actorId: session.user.id },
            })
        } catch (error) {
            logger.error({ error, userId: id }, 'Could not record invitation_resent event')
        }

        logger.info({ userId: id, by: session.user.id }, 'Invitation re-sent')

        return apiSuccess({ userId: id, status: 'invitation_sent' })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error re-sending invitation',
            message: 'Failed to re-send invitation',
            key: 'internal.default',
            context: { userId: id },
        })
    }
}
