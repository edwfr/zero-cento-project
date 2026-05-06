import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/programs/[id]/workouts/[workoutId]/trainee-notes
 * Returns trainee-authored notes for a completed workout (trainer-facing).
 * Ownership check: trainer must own the program.
 * Only returns notes when non-null; fetch failure hides section silently on client.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
    const { id: programId, workoutId } = await params

    try {
        const session = await requireRole(['trainer', 'admin'])

        // Ownership check: single findFirst scoped to this trainer
        const program = await prisma.trainingProgram.findFirst({
            where: {
                id: programId,
                ...(session.user.role === 'trainer' ? { trainerId: session.user.id } : {}),
            },
            select: { id: true },
        })

        if (!program) {
            return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
        }

        // Fetch workout traineeNotes + latest ExerciseFeedback.notes per workoutExercise
        const workout = await prisma.workout.findFirst({
            where: { id: workoutId, week: { programId } },
            select: {
                traineeNotes: true,
                workoutExercises: {
                    select: {
                        id: true,
                        exercise: { select: { name: true } },
                        exerciseFeedbacks: {
                            select: { notes: true },
                            orderBy: { updatedAt: 'desc' },
                            take: 1,
                        },
                    },
                    orderBy: { order: 'asc' },
                },
            },
        })

        if (!workout) {
            return apiError('NOT_FOUND', 'Workout not found', 404, undefined, 'workout.notFound')
        }

        const exercises = workout.workoutExercises
            .filter((we) => we.exerciseFeedbacks[0]?.notes != null)
            .map((we) => ({
                workoutExerciseId: we.id,
                exerciseName: we.exercise.name,
                note: we.exerciseFeedbacks[0].notes as string,
            }))

        logger.info({ programId, workoutId }, 'Trainer fetched trainee notes')

        return apiSuccess({
            workoutNote: workout.traineeNotes ?? null,
            exercises,
        })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, programId, workoutId }, 'Error fetching trainee notes')
        return apiError('INTERNAL_ERROR', 'Failed to fetch trainee notes', 500, undefined, 'internal.default')
    }
}
