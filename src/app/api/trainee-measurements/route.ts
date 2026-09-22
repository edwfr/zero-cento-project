import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireTrainerOwnership } from '@/lib/auth'
import { createMeasurementsSchema } from '@/schemas/trainee-measurement'
import { isMeasurementMetric, toMeasurementDay, type MeasurementMetric } from '@/lib/measurements'
import { logger } from '@/lib/logger'
import type { AuthSession } from '@/lib/auth'

/**
 * Body measurements are trainer-only data: the trainee has no read or write
 * access, on any method. This guard is the single enforcement point — the UI
 * never relies on hiding alone.
 */
async function guardMeasurementAccess(
    session: AuthSession,
    traineeId: string
): Promise<Response | null> {
    if (session.user.role === 'trainee') {
        return apiError('FORBIDDEN', 'Measurements are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
    }

    if (session.user.role === 'trainer') {
        await requireTrainerOwnership(traineeId)
    }

    return null
}

const INVALID_DATE = 'invalid' as const

/** An unparseable filter is a 400, not an Invalid Date handed to Prisma (which throws a 500). */
function parseDateParam(value: string | null): Date | null | typeof INVALID_DATE {
    if (!value) return null
    const date = new Date(value)
    return isNaN(date.getTime()) ? INVALID_DATE : toMeasurementDay(date)
}

/**
 * GET /api/trainee-measurements
 * Query params: traineeId (required), metric, from, to
 * RBAC: owning trainer or admin. Trainees: 403.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const { searchParams } = new URL(request.url)

        const traineeId = searchParams.get('traineeId')
        if (!traineeId) {
            return apiError('VALIDATION_ERROR', 'traineeId is required', 400, undefined, 'validation.traineeIdRequired')
        }

        const denied = await guardMeasurementAccess(session, traineeId)
        if (denied) return denied

        const metricParam = searchParams.get('metric')
        let metric: MeasurementMetric | undefined
        if (metricParam) {
            if (!isMeasurementMetric(metricParam)) {
                return apiError('VALIDATION_ERROR', 'Unknown metric', 400, undefined, 'validation.invalidMetric')
            }
            metric = metricParam
        }

        const from = parseDateParam(searchParams.get('from'))
        const to = parseDateParam(searchParams.get('to'))
        if (from === INVALID_DATE || to === INVALID_DATE) {
            return apiError('VALIDATION_ERROR', 'Invalid date filter', 400, undefined, 'validation.invalidDate')
        }

        const where: Prisma.TraineeMeasurementWhereInput = { traineeId }
        if (metric) where.metric = metric
        if (from || to) {
            where.measuredAt = {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
            }
        }

        const items = await prisma.traineeMeasurement.findMany({
            where,
            orderBy: [{ measuredAt: 'desc' }, { metric: 'asc' }],
        })

        return apiSuccess({ items })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching trainee measurements')
        return apiError('INTERNAL_ERROR', 'Failed to fetch measurements', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/trainee-measurements
 * Body: { traineeId, measuredAt, notes?, values: { weight?, height?, ... } }
 * One upsert per supplied metric: re-entering the same metric on the same day
 * corrects the value instead of adding a duplicate chart point.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const body = await request.json()

        const validation = createMeasurementsSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { traineeId, measuredAt, notes, values } = validation.data

        const denied = await guardMeasurementAccess(session, traineeId)
        if (denied) return denied

        const trainee = await prisma.user.findUnique({ where: { id: traineeId } })
        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }
        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        const entries = Object.entries(values).filter(
            (entry): entry is [MeasurementMetric, number] => entry[1] !== undefined
        )

        const items = await prisma.$transaction(
            entries.map(([metric, value]) =>
                prisma.traineeMeasurement.upsert({
                    where: {
                        traineeId_metric_measuredAt: { traineeId, metric, measuredAt },
                    },
                    create: {
                        traineeId,
                        metric,
                        value,
                        measuredAt,
                        notes: notes ?? null,
                        createdBy: session.user.id,
                    },
                    update: {
                        value,
                        notes: notes ?? null,
                        createdBy: session.user.id,
                    },
                })
            )
        )

        logger.info(
            { traineeId, metrics: entries.map(([metric]) => metric), userId: session.user.id },
            'Trainee measurements saved'
        )

        return apiSuccess({ items }, 201)
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error saving trainee measurements')
        return apiError('INTERNAL_ERROR', 'Failed to save measurements', 500, undefined, 'internal.default')
    }
}
