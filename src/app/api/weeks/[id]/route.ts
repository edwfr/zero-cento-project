import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { updateWeekSchema } from '@/schemas/week'
import { logger } from '@/lib/logger'

/**
 * PATCH /api/weeks/[id]
 * Configure week type (normal/test/deload) and feedback settings
 * Allows modification post-publication for flexibility
 * RBAC: only trainer owner or admin
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const weekId = params.id
        const body = await request.json()

        // Validate input
        const validation = updateWeekSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { weekType, feedbackRequested } = validation.data

        // Check if at least one field is being updated
        if (weekType === undefined && feedbackRequested === undefined) {
            return apiError(
                'VALIDATION_ERROR',
                'At least one field (weekType or feedbackRequested) must be provided',
                400,
                undefined,
                'validation.atLeastOneField'
            )
        }

        // Fetch week with program to check ownership
        const week = await prisma.week.findUnique({
            where: { id: weekId },
            include: {
                program: {
                    select: {
                        id: true,
                        trainerId: true,
                        status: true,
                        title: true,
                    },
                },
            },
        })

        if (!week) {
            return apiError('NOT_FOUND', 'Week not found', 404, undefined, 'week.notFound')
        }

        // RBAC: Check ownership (admin can modify any, trainer only their own)
        if (session.user.role === 'trainer' && week.program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify weeks from your own programs', 403, undefined, 'week.modifyDenied')
        }

        // Update week configuration
        const updatedWeek = await prisma.week.update({
            where: { id: weekId },
            data: {
                ...(weekType !== undefined && { weekType }),
                ...(feedbackRequested !== undefined && { feedbackRequested }),
            },
            include: {
                program: {
                    select: {
                        id: true,
                        title: true,
                        trainerId: true,
                        traineeId: true,
                        status: true,
                    },
                },
                workouts: {
                    select: {
                        id: true,
                        dayIndex: true,
                    },
                    orderBy: {
                        dayIndex: 'asc',
                    },
                },
            },
        })

        logger.info(
            {
                weekId,
                programId: week.program.id,
                trainerId: session.user.id,
                changes: { weekType, feedbackRequested },
            },
            'Week configuration updated'
        )

        return apiSuccess({ week: updatedWeek })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, weekId: params.id }, 'Error updating week configuration')
        return apiError('INTERNAL_ERROR', 'Failed to update week configuration', 500, undefined, 'internal.default')
    }
}
