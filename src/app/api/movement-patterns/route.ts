import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { movementPatternSchema } from '@/schemas/movement-pattern'
import { logger } from '@/lib/logger'

/**
 * GET /api/movement-patterns
 * List active movement patterns with trainer-specific colors
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('includeInactive') === 'true'

        // Build include clause - for trainers, include their custom colors
        const includeClause: any = {
            creator: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
        }

        // Include trainer's custom colors if they are a trainer
        if (session.user.role === 'trainer') {
            includeClause.movementPatternColors = {
                where: {
                    trainerId: session.user.id,
                },
                select: {
                    color: true,
                },
            }
        }

        const movementPatterns = await prisma.movementPattern.findMany({
            where: includeInactive ? undefined : { isActive: true },
            include: includeClause,
            orderBy: {
                name: 'asc',
            },
        })

        return apiSuccess({ items: movementPatterns })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching movement patterns')
        return apiError('INTERNAL_ERROR', 'Failed to fetch movement patterns', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/movement-patterns
 * Create new movement pattern
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = movementPatternSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { name, description } = validation.data

        // Check if name already exists
        const existing = await prisma.movementPattern.findUnique({
            where: { name },
        })

        if (existing) {
            return apiError('CONFLICT', 'Movement pattern with this name already exists', 409, undefined, 'movementPattern.nameExists')
        }

        const movementPattern = await prisma.movementPattern.create({
            data: {
                name,
                description,
                createdBy: session.user.id,
                isActive: true,
            },
        })

        logger.info({ movementPatternId: movementPattern.id }, 'Movement pattern created')

        return apiSuccess({ movementPattern }, 201)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating movement pattern')
        return apiError('INTERNAL_ERROR', 'Failed to create movement pattern', 500, undefined, 'internal.default')
    }
}
