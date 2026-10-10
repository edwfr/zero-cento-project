import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireTrainerOwnership } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { dbDateToIsoDay, isValidPeriodRange, isoDayToDbDate } from '@/lib/macro-periods'
import { PERIOD_SELECT, macroPlanLockKey, toPeriodDto } from '@/lib/macro-period-queries'
import { updateMacroPeriodSchema } from '@/schemas/macro-period'

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => apiError('NOT_FOUND', 'Macro period not found', 404, undefined, 'macroPeriod.notFound')

/** A period of another trainer is indistinguishable from a missing one. */
const findOwnedPeriod = (id: string, trainerId: string) =>
    prisma.macroPeriod.findFirst({
        where: { id, trainerId },
        select: { id: true, traineeId: true, phaseTypeId: true, startDate: true, endDate: true },
    })

/**
 * PATCH /api/macro-periods/[id]
 * Body: any of { phaseTypeId, startDate, endDate, note }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const validation = updateMacroPeriodSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }
        const input = validation.data

        const existing = await findOwnedPeriod(id, trainerId)
        if (!existing) return notFound()

        // The trainee may have been reassigned since the period was created
        await requireTrainerOwnership(existing.traineeId)

        const startDay = input.startDate ?? dbDateToIsoDay(existing.startDate)
        const endDay = input.endDate ?? dbDateToIsoDay(existing.endDate)
        const datesChanged = input.startDate !== undefined || input.endDate !== undefined

        if (datesChanged && !isValidPeriodRange(startDay, endDay)) {
            return apiError('VALIDATION_ERROR', 'Invalid period range', 400, undefined, 'validation.macroPeriodInvalidRange')
        }

        // An unchanged phase is not re-checked: a period on an archived phase can still be moved
        if (input.phaseTypeId !== undefined && input.phaseTypeId !== existing.phaseTypeId) {
            const phaseType = await prisma.macroPhaseType.findFirst({
                where: { id: input.phaseTypeId, trainerId },
                select: { id: true, isActive: true },
            })
            if (!phaseType) {
                return apiError('NOT_FOUND', 'Macro phase type not found', 404, undefined, 'macroPhase.notFound')
            }
            if (!phaseType.isActive) {
                return apiError('CONFLICT', 'Macro phase type is archived', 409, undefined, 'macroPhase.archived')
            }
        }

        const data: Prisma.MacroPeriodUncheckedUpdateInput = {}
        if (input.phaseTypeId !== undefined) data.phaseTypeId = input.phaseTypeId
        if (input.startDate !== undefined) data.startDate = isoDayToDbDate(input.startDate)
        if (input.endDate !== undefined) data.endDate = isoDayToDbDate(input.endDate)
        if (input.note !== undefined) data.note = input.note

        const period = await prisma.$transaction(async (tx) => {
            if (datesChanged) {
                // Two writes on the same plan must not both pass the overlap read: queue them until commit
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${macroPlanLockKey(trainerId, existing.traineeId)}))`

                const clash = await tx.macroPeriod.findFirst({
                    where: {
                        traineeId: existing.traineeId,
                        trainerId,
                        id: { not: id },
                        startDate: { lte: isoDayToDbDate(endDay) },
                        endDate: { gte: isoDayToDbDate(startDay) },
                    },
                    select: { id: true },
                })
                if (clash) return null
            }

            return tx.macroPeriod.update({ where: { id }, data, select: PERIOD_SELECT })
        })

        if (!period) {
            return apiError('CONFLICT', 'The period overlaps another period', 409, undefined, 'macroPeriod.overlap')
        }

        logger.info({ trainerId, periodId: id }, 'Macro period updated')

        return apiSuccess({ period: toPeriodDto(period) })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating macro period',
            message: 'Failed to update macro period',
            key: 'internal.default',
            context: { periodId: id },
        })
    }
}

/**
 * DELETE /api/macro-periods/[id]
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const existing = await findOwnedPeriod(id, trainerId)
        if (!existing) return notFound()

        await requireTrainerOwnership(existing.traineeId)

        await prisma.macroPeriod.delete({ where: { id } })

        logger.info({ trainerId, periodId: id }, 'Macro period deleted')

        return apiSuccess({ id })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting macro period',
            message: 'Failed to delete macro period',
            key: 'internal.default',
            context: { periodId: id },
        })
    }
}
