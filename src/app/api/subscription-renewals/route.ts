import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createRenewalSchema } from '@/schemas/subscription-renewal'
import { resolveSummary, summarizeRenewals } from '@/lib/subscriptions'
import { listSubscriptionEvents, logSubscriptionEvent } from '@/lib/subscription-events'
import { renewalSnapshot, toRenewalColumns } from './_data'
import { getTodayDateKey } from '@/lib/date-format'
import { logger } from '@/lib/logger'
import { guardRenewalAccess } from './_access'
import { handleApiError } from '@/lib/api-error-handler'

/**
 * GET /api/subscription-renewals?traineeId=
 * History (newest first), current status and program balance.
 * RBAC: owning trainer or admin. Trainees: 403.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const traineeId = new URL(request.url).searchParams.get('traineeId')
        if (!traineeId) {
            return apiError('VALIDATION_ERROR', 'traineeId is required', 400, undefined, 'validation.traineeIdRequired')
        }

        const denied = await guardRenewalAccess(session, traineeId)
        if (denied) return denied

        const [items, used, events] = await Promise.all([
            prisma.subscriptionRenewal.findMany({
                where: { traineeId },
                orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
            }),
            prisma.programCreditUsage.count({ where: { traineeId } }),
            listSubscriptionEvents(traineeId),
        ])

        const input = summarizeRenewals(items, used)
        const current = resolveSummary(input, getTodayDateKey())

        return apiSuccess({ items, current, programBalance: input.purchased - input.used, events })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching subscription renewals',
            message: 'Failed to fetch subscription renewals',
            key: 'internal.default',
        })
    }
}

/**
 * POST /api/subscription-renewals
 * Body: `{ traineeId, kind, startDate, durationMonths | programCount }`. endDate is computed here, never accepted.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const body = await request.json()

        const validation = createRenewalSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { traineeId, ...input } = validation.data

        const denied = await guardRenewalAccess(session, traineeId)
        if (denied) return denied

        const trainee = await prisma.user.findUnique({ where: { id: traineeId } })
        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }
        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        const renewal = await prisma.$transaction(async (tx) => {
            const created = await tx.subscriptionRenewal.create({
                data: { traineeId, ...toRenewalColumns(input), createdBy: session.user.id },
            })
            await logSubscriptionEvent(tx, {
                traineeId,
                type: created.kind === 'programs' ? 'package_created' : 'period_renewal_created',
                actorId: session.user.id,
                renewalId: created.id,
                creditDelta: created.programCount,
                details: renewalSnapshot(created),
            })
            return created
        })

        logger.info({ traineeId, renewalId: renewal.id, userId: session.user.id }, 'Subscription renewal created')

        return apiSuccess({ renewal }, 201)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error creating subscription renewal',
            message: 'Failed to create subscription renewal',
            key: 'internal.default',
        })
    }
}
