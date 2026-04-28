import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { loadProgressAggregates } from '@/lib/trainee-program-data'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/programs/[id]/progress
 * Get program progress and statistics using SQL aggregates
 * Response: currentWeek, totalWeeks, completedWorkouts, totalWorkouts, feedbackCount, avgRPE, totalVolume
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                durationWeeks: true,
                trainerId: true,
                traineeId: true,
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }
        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403, undefined, 'program.viewAssignedDenied')
        }

        const progress = await loadProgressAggregates(programId)
        return apiSuccess(progress)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error fetching program progress')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program progress', 500, undefined, 'internal.default')
    }
}
