import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateMuscleGroupSchema } from '@/schemas/muscle-group'
import { logger } from '@/lib/logger'

type Params = {
    params: {
        id: string
    }
}

/**
 * GET /api/muscle-groups/[id]
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const muscleGroup = await prisma.muscleGroup.findUnique({
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

        if (!muscleGroup) {
            return apiError('NOT_FOUND', 'Muscle group not found', 404, undefined, 'muscleGroup.notFound')
        }

        return apiSuccess({ muscleGroup })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching muscle group')
        return apiError('INTERNAL_ERROR', 'Failed to fetch muscle group', 500, undefined, 'internal.default')
    }
}

/**
 * PUT /api/muscle-groups/[id]
 */
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = updateMuscleGroupSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const muscleGroup = await prisma.muscleGroup.update({
            where: { id: params.id },
            data: validation.data,
        })

        logger.info({ muscleGroupId: params.id }, 'Muscle group updated')

        return apiSuccess({ muscleGroup })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error updating muscle group')
        return apiError('INTERNAL_ERROR', 'Failed to update muscle group', 500, undefined, 'internal.default')
    }
}

/**
 * DELETE /api/muscle-groups/[id]
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        await requireRole(['admin', 'trainer'])

        // Check if used in exercises
        const usageCount = await prisma.exerciseMuscleGroup.count({
            where: { muscleGroupId: params.id },
        })

        if (usageCount > 0) {
            return apiError(
                'CONFLICT',
                `Cannot delete muscle group. Used in ${usageCount} exercise(s)`,
                409,
                undefined,
                'muscleGroup.cannotDeleteInUse'
            )
        }

        await prisma.muscleGroup.delete({
            where: { id: params.id },
        })

        logger.info({ muscleGroupId: params.id }, 'Muscle group deleted')

        return apiSuccess({
            message: 'Muscle group deleted successfully',
            messageKey: 'muscleGroup.deletedSuccess',
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error deleting muscle group')
        return apiError('INTERNAL_ERROR', 'Failed to delete muscle group', 500, undefined, 'internal.default')
    }
}
