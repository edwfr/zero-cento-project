import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireTrainerOwnership, type AuthSession } from '@/lib/auth'
import { updateMeasurementSchema } from '@/schemas/trainee-measurement'
import { isValueInRange } from '@/lib/measurements'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'

type RouteContext = { params: Promise<{ id: string }> }

/** Same rule as the collection route: trainees never reach measurement data. */
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

/**
 * PATCH /api/trainee-measurements/[id]
 * Body: { value?, measuredAt?, notes? }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        if (session.user.role === 'trainee') {
            return apiError('FORBIDDEN', 'Measurements are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
        }

        const body = await request.json()
        const validation = updateMeasurementSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const measurement = await prisma.traineeMeasurement.findUnique({ where: { id } })
        if (!measurement) {
            return apiError('NOT_FOUND', 'Measurement not found', 404, undefined, 'measurement.notFound')
        }

        const denied = await guardMeasurementAccess(session, measurement.traineeId)
        if (denied) return denied

        const { value, measuredAt, notes } = validation.data

        if (value !== undefined && !isValueInRange(measurement.metric, value)) {
            return apiError('VALIDATION_ERROR', 'Value out of range for this metric', 400, undefined, 'validation.measurementOutOfRange')
        }

        // Moving the row onto a day that already holds this metric would break the
        // unique constraint: answer 409 instead of letting Prisma throw a 500
        if (measuredAt !== undefined) {
            const clash = await prisma.traineeMeasurement.findFirst({
                where: {
                    traineeId: measurement.traineeId,
                    metric: measurement.metric,
                    measuredAt,
                    id: { not: id },
                },
                select: { id: true },
            })
            if (clash) {
                return apiError('CONFLICT', 'A measurement for this metric already exists on that day', 409, undefined, 'measurement.duplicateDay')
            }
        }

        const data: Prisma.TraineeMeasurementUpdateInput = {}
        if (value !== undefined) data.value = value
        if (measuredAt !== undefined) data.measuredAt = measuredAt
        if (notes !== undefined) data.notes = notes

        const updated = await prisma.traineeMeasurement.update({ where: { id }, data })

        logger.info(
            { measurementId: id, traineeId: measurement.traineeId, userId: session.user.id },
            'Trainee measurement updated'
        )

        return apiSuccess({ measurement: updated })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating trainee measurement',
            message: 'Failed to update measurement',
            key: 'internal.default',
            context: { measurementId: id },
        })
    }
}

/**
 * DELETE /api/trainee-measurements/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        if (session.user.role === 'trainee') {
            return apiError('FORBIDDEN', 'Measurements are not visible to trainees', 403, undefined, 'auth.traineeAccessDenied')
        }

        const measurement = await prisma.traineeMeasurement.findUnique({ where: { id } })
        if (!measurement) {
            return apiError('NOT_FOUND', 'Measurement not found', 404, undefined, 'measurement.notFound')
        }

        const denied = await guardMeasurementAccess(session, measurement.traineeId)
        if (denied) return denied

        await prisma.traineeMeasurement.delete({ where: { id } })

        logger.info(
            { measurementId: id, traineeId: measurement.traineeId, userId: session.user.id },
            'Trainee measurement deleted'
        )

        return apiSuccess({ success: true })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting trainee measurement',
            message: 'Failed to delete measurement',
            key: 'internal.default',
            context: { measurementId: id },
        })
    }
}
