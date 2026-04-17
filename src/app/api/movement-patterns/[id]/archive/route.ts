import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

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
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error archiving movement pattern')
        return apiError('INTERNAL_ERROR', 'Failed to archive movement pattern', 500, undefined, 'internal.default')
    }
}
