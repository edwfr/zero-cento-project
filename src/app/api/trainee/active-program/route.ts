import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error-handler'
import { traineeVisibleProgramWhere } from '@/lib/program-visibility'

export async function GET(_request: NextRequest) {
    try {
        const session = await requireRole(['trainee'])

        const program = await prisma.trainingProgram.findFirst({
            where: { traineeId: session.user.id, status: 'active', ...traineeVisibleProgramWhere() },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'No active program', 404, undefined, 'program.notFound')
        }

        return apiSuccess({ programId: program.id })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching active program',
            message: 'Failed to fetch active program',
            key: 'internal.default',
        })
    }
}
