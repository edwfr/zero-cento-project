import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { muscleGroupSchema } from '@/schemas/muscle-group'
import { logger } from '@/lib/logger'

/**
 * GET /api/muscle-groups
 * List active muscle groups
 */
export async function GET(request: NextRequest) {
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const muscleGroups = await prisma.muscleGroup.findMany({
            where: includeInactive ? undefined : { isActive: true },
            include: {
                creator: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: {
                name: 'asc',
            },
        })

        return apiSuccess({ items: muscleGroups })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching muscle groups')
        return apiError('INTERNAL_ERROR', 'Failed to fetch muscle groups', 500)
    }
}

/**
 * POST /api/muscle-groups
 * Create new muscle group
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = muscleGroupSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors)
        }

        const { name, description } = validation.data

        // Check if name already exists
        const existing = await prisma.muscleGroup.findUnique({
            where: { name },
        })

        if (existing) {
            return apiError('CONFLICT', 'Muscle group with this name already exists', 409)
        }

        const muscleGroup = await prisma.muscleGroup.create({
            data: {
                name,
                description,
                createdBy: session.user.id,
                isActive: true,
            },
        })

        logger.info({ muscleGroupId: muscleGroup.id }, 'Muscle group created')

        return apiSuccess({ muscleGroup }, 201)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating muscle group')
        return apiError('INTERNAL_ERROR', 'Failed to create muscle group', 500)
    }
}
