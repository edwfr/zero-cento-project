import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateMovementPatternSchema } from '@/schemas/movement-pattern'
import { logger } from '@/lib/logger'

type Params = {
    params: {
        id: string
    }
}

/**
 * GET /api/movement-patterns/[id]
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const movementPattern = await prisma.movementPattern.findUnique({
            where: { id: params.id },
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
            return apiError('NOT_FOUND', 'Movement pattern not found', 404)
        }

        return apiSuccess({ movementPattern })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching movement pattern')
        return apiError('INTERNAL_ERROR', 'Failed to fetch movement pattern', 500)
    }
}

/**
 * PUT /api/movement-patterns/[id]
 */
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = updateMovementPatternSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors)
        }

        const movementPattern = await prisma.movementPattern.update({
            where: { id: params.id },
            data: validation.data,
        })

        logger.info({ movementPatternId: params.id }, 'Movement pattern updated')

        return apiSuccess({ movementPattern })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error updating movement pattern')
        return apiError('INTERNAL_ERROR', 'Failed to update movement pattern', 500)
    }
}

/**
 * DELETE /api/movement-patterns/[id]
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        await requireRole(['admin', 'trainer'])

        // Check if used in exercises
        const usageCount = await prisma.exercise.count({
            where: { movementPatternId: params.id },
        })

        if (usageCount > 0) {
            return apiError(
                'CONFLICT',
                `Cannot delete movement pattern. Used in ${usageCount} exercise(s)`,
                409
            )
        }

        await prisma.movementPattern.delete({
            where: { id: params.id },
        })

        logger.info({ movementPatternId: params.id }, 'Movement pattern deleted')

        return apiSuccess({ message: 'Movement pattern deleted successfully' })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error deleting movement pattern')
        return apiError('INTERNAL_ERROR', 'Failed to delete movement pattern', 500)
    }
}
