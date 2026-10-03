import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createRenewalSchema } from '@/schemas/subscription-renewal'
import { addMonthsClamped, latestEndDate, toSubscriptionSummary } from '@/lib/subscriptions'
import { getTodayDateKey } from '@/lib/date-format'
import { logger } from '@/lib/logger'
import { guardRenewalAccess } from './_access'

/**
 * GET /api/subscription-renewals?traineeId=
 * History (newest first) plus the current status derived from MAX(endDate).
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

        const items = await prisma.subscriptionRenewal.findMany({
            where: { traineeId },
            orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        })

        const current = toSubscriptionSummary(latestEndDate(items), getTodayDateKey())

        return apiSuccess({ items, current })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching subscription renewals')
        return apiError('INTERNAL_ERROR', 'Failed to fetch subscription renewals', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/subscription-renewals
 * Body: { traineeId, startDate, durationMonths }. endDate is computed here, never accepted.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const body = await request.json()

        const validation = createRenewalSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { traineeId, startDate, durationMonths } = validation.data

        const denied = await guardRenewalAccess(session, traineeId)
        if (denied) return denied

        const trainee = await prisma.user.findUnique({ where: { id: traineeId } })
        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }
        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        const renewal = await prisma.subscriptionRenewal.create({
            data: {
                traineeId,
                startDate,
                durationMonths,
                endDate: addMonthsClamped(startDate, durationMonths),
                createdBy: session.user.id,
            },
        })

        logger.info({ traineeId, renewalId: renewal.id, userId: session.user.id }, 'Subscription renewal created')

        return apiSuccess({ renewal }, 201)
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating subscription renewal')
        return apiError('INTERNAL_ERROR', 'Failed to create subscription renewal', 500, undefined, 'internal.default')
    }
}
