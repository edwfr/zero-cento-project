import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateMuscleGroupSchema } from '@/schemas/muscle-group'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * GET /api/muscle-groups/[id]
 */
export async function GET(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const muscleGroup = await prisma.muscleGroup.findUnique({
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

        if (!muscleGroup) {
            return apiError('NOT_FOUND', 'Muscle group not found', 404, undefined, 'muscleGroup.notFound')
        }

        return apiSuccess({ muscleGroup })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching muscle group',
            message: 'Failed to fetch muscle group',
            key: 'internal.default',
        })
    }
}

/**
 * PUT /api/muscle-groups/[id]
 */
export async function PUT(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = updateMuscleGroupSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const muscleGroup = await prisma.muscleGroup.update({
            where: { id },
            data: validation.data,
        })

        logger.info({ muscleGroupId: id }, 'Muscle group updated')

        return apiSuccess({ muscleGroup })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating muscle group',
            message: 'Failed to update muscle group',
            key: 'internal.default',
        })
    }
}

/**
 * DELETE /api/muscle-groups/[id]
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer'])

        // Check if used in exercises
        const usageCount = await prisma.exerciseMuscleGroup.count({
            where: { muscleGroupId: id },
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
            where: { id },
        })

        logger.info({ muscleGroupId: id }, 'Muscle group deleted')

        return apiSuccess({
            message: 'Muscle group deleted successfully',
            messageKey: 'muscleGroup.deletedSuccess',
        })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting muscle group',
            message: 'Failed to delete muscle group',
            key: 'internal.default',
        })
    }
}
