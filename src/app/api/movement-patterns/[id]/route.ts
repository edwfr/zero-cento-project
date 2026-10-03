import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateMovementPatternSchema } from '@/schemas/movement-pattern'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * GET /api/movement-patterns/[id]
 */
export async function GET(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const movementPattern = await prisma.movementPattern.findUnique({
            where: { id },
            include: {
                creator: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        })

        if (!movementPattern) {
            return apiError('NOT_FOUND', 'Movement pattern not found', 404, undefined, 'movementPattern.notFound')
        }

        return apiSuccess({ movementPattern })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching movement pattern',
            message: 'Failed to fetch movement pattern',
            key: 'internal.default',
        })
    }
}

/**
 * PUT /api/movement-patterns/[id]
 */
export async function PUT(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = updateMovementPatternSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const movementPattern = await prisma.movementPattern.update({
            where: { id },
            data: validation.data,
        })

        logger.info({ movementPatternId: id }, 'Movement pattern updated')

        return apiSuccess({ movementPattern })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating movement pattern',
            message: 'Failed to update movement pattern',
            key: 'internal.default',
        })
    }
}

/**
 * DELETE /api/movement-patterns/[id]
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer'])

        // Check if used in exercises
        const usageCount = await prisma.exercise.count({
            where: { movementPatternId: id },
        })

        if (usageCount > 0) {
            return apiError(
                'CONFLICT',
                `Cannot delete movement pattern. Used in ${usageCount} exercise(s)`,
                409,
                undefined,
                'movementPattern.cannotDeleteInUse'
            )
        }

        await prisma.movementPattern.delete({
            where: { id },
        })

        logger.info({ movementPatternId: id }, 'Movement pattern deleted')

        return apiSuccess({
            message: 'Movement pattern deleted successfully',
            messageKey: 'movementPattern.deletedSuccess',
        })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting movement pattern',
            message: 'Failed to delete movement pattern',
            key: 'internal.default',
        })
    }
}
