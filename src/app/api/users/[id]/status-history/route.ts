import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

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
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, userId: id }, 'Error fetching status history')
        return apiError('INTERNAL_ERROR', 'Failed to fetch status history', 500, undefined, 'internal.default')
    }
}
