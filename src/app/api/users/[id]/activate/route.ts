import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { syncUserMetadata } from '@/lib/sync-user-metadata'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * PATCH /api/users/[id]/activate
 * Reactivate disabled trainee
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        const session = await requireAuth()

        // Check user exists
        const existingUser = await prisma.user.findUnique({
            where: { id },
        })

        if (!existingUser) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        // Only trainees can be activated/deactivated
        if (existingUser.role !== 'trainee') {
            return apiError('FORBIDDEN', 'Can only activate trainee accounts', 403, undefined, 'user.canOnlyActivateTrainee')
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

        // Activate user
        const user = await prisma.user.update({
            where: { id },
            data: { isActive: true },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
            },
        })

        await syncUserMetadata(id, { isActive: true })

        logger.info({ userId: id }, 'User activated')

        return apiSuccess({ user })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error activating user')
        return apiError('INTERNAL_ERROR', 'Failed to activate user', 500, undefined, 'internal.default')
    }
}
