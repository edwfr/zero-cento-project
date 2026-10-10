import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { PHASE_TYPE_SELECT, findPhaseNameClash, toPhaseTypeDto } from '@/lib/macro-period-queries'
import { updateMacroPhaseTypeSchema } from '@/schemas/macro-period'

type RouteContext = { params: Promise<{ id: string }> }

const notFound = () => apiError('NOT_FOUND', 'Macro phase type not found', 404, undefined, 'macroPhase.notFound')

/**
 * PATCH /api/macro-phase-types/[id]
 * Body: any of { name, description, color, sortOrder, isActive }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const validation = updateMacroPhaseTypeSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        // One query: a phase of another trainer is indistinguishable from a missing one
        const existing = await prisma.macroPhaseType.findFirst({ where: { id, trainerId }, select: { id: true } })
        if (!existing) return notFound()

        const { name } = validation.data
        if (name !== undefined && (await findPhaseNameClash(trainerId, name, id))) {
            return apiError('CONFLICT', 'A phase with this name already exists', 409, undefined, 'macroPhase.nameExists')
        }

        const phaseType = await prisma.macroPhaseType.update({
            where: { id },
            data: validation.data,
            select: PHASE_TYPE_SELECT,
        })

        logger.info({ trainerId, phaseTypeId: id }, 'Macro phase type updated')

        return apiSuccess({ phaseType: toPhaseTypeDto(phaseType) })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating macro phase type',
            message: 'Failed to update macro phase type',
            key: 'internal.default',
            context: { phaseTypeId: id },
        })
    }
}

/**
 * DELETE /api/macro-phase-types/[id]
 * Only a phase no period uses can be deleted; a used one is archived instead.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const { id } = await params
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const existing = await prisma.macroPhaseType.findFirst({
            where: { id, trainerId },
            select: { id: true, _count: { select: { periods: true } } },
        })
        if (!existing) return notFound()

        if (existing._count.periods > 0) {
            return apiError('CONFLICT', 'Macro phase type is used by one or more periods', 409, undefined, 'macroPhase.inUse')
        }

        await prisma.macroPhaseType.delete({ where: { id } })

        logger.info({ trainerId, phaseTypeId: id }, 'Macro phase type deleted')

        return apiSuccess({ id })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting macro phase type',
            message: 'Failed to delete macro phase type',
            key: 'internal.default',
            context: { phaseTypeId: id },
        })
    }
}
