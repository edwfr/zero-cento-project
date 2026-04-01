import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const movementPatternColorSchema = z.object({
    movementPatternId: z.string().uuid(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #3b82f6)'),
})

const bulkUpdateSchema = z.array(movementPatternColorSchema)

/**
 * GET /api/movement-pattern-colors
 * Get all movement pattern colors for the authenticated trainer
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['trainer'])

        const colors = await prisma.movementPatternColor.findMany({
            where: {
                trainerId: session.user.id,
            },
            include: {
                movementPattern: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                movementPattern: {
                    name: 'asc',
                },
            },
        })

        return apiSuccess({ items: colors })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching movement pattern colors')
        return apiError('INTERNAL_ERROR', 'Failed to fetch movement pattern colors', 500, undefined, 'internal.default')
    }
}

/**
 * PUT /api/movement-pattern-colors
 * Update movement pattern colors for the authenticated trainer
 * Accepts an array of { movementPatternId, color } objects
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await requireRole(['trainer'])
        const body = await request.json()

        const validation = bulkUpdateSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const updates = validation.data

        // Verify all movement patterns exist
        const movementPatternIds = updates.map(u => u.movementPatternId)
        const movementPatterns = await prisma.movementPattern.findMany({
            where: {
                id: { in: movementPatternIds },
                isActive: true,
            },
        })

        if (movementPatterns.length !== movementPatternIds.length) {
            return apiError('NOT_FOUND', 'One or more movement patterns not found', 404, undefined, 'movementPattern.notFound')
        }

        // Use transaction to upsert all colors
        const results = await prisma.$transaction(
            updates.map(({ movementPatternId, color }) =>
                prisma.movementPatternColor.upsert({
                    where: {
                        trainerId_movementPatternId: {
                            trainerId: session.user.id,
                            movementPatternId,
                        },
                    },
                    create: {
                        trainerId: session.user.id,
                        movementPatternId,
                        color,
                    },
                    update: {
                        color,
                    },
                })
            )
        )

        logger.info(
            { trainerId: session.user.id, count: results.length },
            'Movement pattern colors updated'
        )

        return apiSuccess({ items: results })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error updating movement pattern colors')
        return apiError('INTERNAL_ERROR', 'Failed to update movement pattern colors', 500, undefined, 'internal.default')
    }
}
