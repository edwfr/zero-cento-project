import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/programs/[id]/workouts/[workoutId]
 * Remove a workout from a week. Cascades to workoutExercises.
 * Only allowed on draft programs by the owning trainer (or admin).
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
    const { id: programId, workoutId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        const workout = await prisma.workout.findUnique({
            where: { id: workoutId },
            select: { id: true, week: { select: { programId: true } } },
        })

        if (!workout || workout.week.programId !== programId) {
            return apiError('NOT_FOUND', 'Workout not found', 404, undefined, 'workout.notFound')
        }

        await prisma.workout.delete({ where: { id: workoutId } })

        logger.info({ workoutId, programId, userId: session.user.id }, 'Workout deleted')

        return apiSuccess({ message: 'Workout deleted successfully' })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId, workoutId }, 'Error deleting workout')
        return apiError('INTERNAL_ERROR', 'Failed to delete workout', 500, undefined, 'internal.default')
    }
}
