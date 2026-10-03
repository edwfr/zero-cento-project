import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'

type Params = {
    params: Promise<{ id: string }>
}

/**
 * PATCH /api/muscle-groups/[id]/archive
 * Archive muscle group (set isActive = false)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer'])

        const muscleGroup = await prisma.muscleGroup.update({
            where: { id },
            data: { isActive: false },
        })

        logger.info({ muscleGroupId: id }, 'Muscle group archived')

        return apiSuccess({ muscleGroup })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error archiving muscle group',
            message: 'Failed to archive muscle group',
            key: 'internal.default',
        })
    }
}
