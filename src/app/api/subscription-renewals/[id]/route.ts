import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateRenewalSchema } from '@/schemas/subscription-renewal'
import { addMonthsClamped } from '@/lib/subscriptions'
import { logger } from '@/lib/logger'
import { denyTrainee, guardRenewalAccess } from '../_access'
import { handleApiError } from '@/lib/api-error-handler'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/subscription-renewals/[id]
 * Body: { startDate, durationMonths }. endDate is recomputed.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const traineeDenied = denyTrainee(session)
        if (traineeDenied) return traineeDenied

        const body = await request.json()
        const validation = updateRenewalSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const renewal = await prisma.subscriptionRenewal.findUnique({ where: { id } })
        if (!renewal) {
            return apiError('NOT_FOUND', 'Subscription renewal not found', 404, undefined, 'subscription.notFound')
        }

        const denied = await guardRenewalAccess(session, renewal.traineeId)
        if (denied) return denied

        const { startDate, durationMonths } = validation.data
        const updated = await prisma.subscriptionRenewal.update({
            where: { id },
            data: { startDate, durationMonths, endDate: addMonthsClamped(startDate, durationMonths) },
        })

        logger.info({ renewalId: id, traineeId: renewal.traineeId, userId: session.user.id }, 'Subscription renewal updated')

        return apiSuccess({ renewal: updated })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating subscription renewal',
            message: 'Failed to update subscription renewal',
            key: 'internal.default',
            context: { renewalId: id },
        })
    }
}

/**
 * DELETE /api/subscription-renewals/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const traineeDenied = denyTrainee(session)
        if (traineeDenied) return traineeDenied

        const renewal = await prisma.subscriptionRenewal.findUnique({ where: { id } })
        if (!renewal) {
            return apiError('NOT_FOUND', 'Subscription renewal not found', 404, undefined, 'subscription.notFound')
        }

        const denied = await guardRenewalAccess(session, renewal.traineeId)
        if (denied) return denied

        await prisma.subscriptionRenewal.delete({ where: { id } })

        logger.info({ renewalId: id, traineeId: renewal.traineeId, userId: session.user.id }, 'Subscription renewal deleted')

        return apiSuccess({ success: true })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting subscription renewal',
            message: 'Failed to delete subscription renewal',
            key: 'internal.default',
            context: { renewalId: id },
        })
    }
}
