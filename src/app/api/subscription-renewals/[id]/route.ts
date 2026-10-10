import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateRenewalSchema } from '@/schemas/subscription-renewal'
import { logSubscriptionEvent } from '@/lib/subscription-events'
import { renewalSnapshot, toRenewalColumns } from '../_data'
import { logger } from '@/lib/logger'
import { denyTrainee, guardRenewalAccess } from '../_access'
import { handleApiError } from '@/lib/api-error-handler'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/subscription-renewals/[id]
 * Body: `{ kind, startDate, durationMonths | programCount }`. `kind` cannot change. endDate is recomputed.
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

        const input = validation.data
        if (input.kind !== renewal.kind) {
            return apiError('VALIDATION_ERROR', 'The kind of a renewal cannot be changed', 400, undefined, 'subscription.kindImmutable')
        }

        const updated = await prisma.$transaction(async (tx) => {
            const row = await tx.subscriptionRenewal.update({ where: { id }, data: toRenewalColumns(input) })
            await logSubscriptionEvent(tx, {
                traineeId: renewal.traineeId,
                type: 'renewal_updated',
                actorId: session.user.id,
                renewalId: id,
                creditDelta: row.kind === 'programs' ? (row.programCount ?? 0) - (renewal.programCount ?? 0) : null,
                details: { kind: row.kind, before: renewalSnapshot(renewal), after: renewalSnapshot(row) },
            })
            return row
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
 * Writes a renewal_deleted event with a snapshot in the same transaction.
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

        await prisma.$transaction(async (tx) => {
            await tx.subscriptionRenewal.delete({ where: { id } })
            await logSubscriptionEvent(tx, {
                traineeId: renewal.traineeId,
                type: 'renewal_deleted',
                actorId: session.user.id,
                renewalId: id,
                creditDelta: renewal.kind === 'programs' ? -(renewal.programCount ?? 0) : null,
                details: { kind: renewal.kind, ...renewalSnapshot(renewal) },
            })
        })

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
