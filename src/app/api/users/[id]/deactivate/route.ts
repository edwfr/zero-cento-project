import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { syncUserMetadata } from '@/lib/sync-user-metadata'
import { handleApiError } from '@/lib/api-error-handler'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * PATCH /api/users/[id]/deactivate
 * Disable trainee (login blocked)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        // Check user exists
        const existingUser = await prisma.user.findUnique({
            where: { id },
        })

        if (!existingUser) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        // Only trainees can be activated/deactivated
        if (existingUser.role !== 'trainee') {
            return apiError('FORBIDDEN', 'Can only deactivate trainee accounts', 403, undefined, 'user.canOnlyDeactivateTrainee')
        }

        // Permission check
        if (session.user.role === 'trainer') {
            const association = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId: id,
                },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }

        // Deactivate user, recording the step only when the status changes
        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id },
                data: { isActive: false },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    isActive: true,
                },
            })

            if (existingUser.isActive) {
                await tx.userStatusEvent.create({
                    data: { userId: id, type: 'deactivated', actorId: session.user.id },
                })
            }

            return updated
        })

        await syncUserMetadata(id, { isActive: false })

        logger.info({ userId: id }, 'User deactivated')

        return apiSuccess({ user })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deactivating user',
            message: 'Failed to deactivate user',
            key: 'internal.default',
        })
    }
}
