import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error-handler'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * GET /api/users/[id]/status-history
 * Account timeline (created, invitation re-sent, activated, deactivated, reactivated)
 * - Trainer: own trainees only
 * - Admin: any user
 */
export async function GET(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        if (session.user.role === 'trainer') {
            const association = await prisma.trainerTrainee.findFirst({
                where: { trainerId: session.user.id, traineeId: id },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                createdAt: true,
                isActive: true,
                statusEvents: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        type: true,
                        createdAt: true,
                        actor: { select: { firstName: true, lastName: true } },
                    },
                },
            },
        })

        if (!user) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        return apiSuccess({
            createdAt: user.createdAt,
            isActive: user.isActive,
            events: user.statusEvents.map((event) => ({
                type: event.type,
                at: event.createdAt,
                actor: event.actor,
            })),
        })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching status history',
            message: 'Failed to fetch status history',
            key: 'internal.default',
            context: { userId: id },
        })
    }
}
