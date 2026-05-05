import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(_request: NextRequest) {
    try {
        const session = await requireRole(['trainee'])

        const program = await prisma.trainingProgram.findFirst({
            where: { traineeId: session.user.id, status: 'active' },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'No active program', 404, undefined, 'program.notFound')
        }

        return apiSuccess({ programId: program.id })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching active program')
        return apiError('INTERNAL_ERROR', 'Failed to fetch active program', 500, undefined, 'internal.default')
    }
}
