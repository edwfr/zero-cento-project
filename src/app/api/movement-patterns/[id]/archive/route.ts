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
 * PATCH /api/movement-patterns/[id]/archive
 * Archive movement pattern (set isActive = false)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const { id } = await params
    try {
        await requireRole(['admin', 'trainer'])

        const movementPattern = await prisma.movementPattern.update({
            where: { id },
            data: { isActive: false },
        })

        logger.info({ movementPatternId: id }, 'Movement pattern archived')

        return apiSuccess({ movementPattern })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error archiving movement pattern',
            message: 'Failed to archive movement pattern',
            key: 'internal.default',
        })
    }
}
