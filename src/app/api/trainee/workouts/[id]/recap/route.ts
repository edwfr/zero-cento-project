import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { computeExerciseStatus } from '@/lib/workout-recap'
import type { ExerciseRecapItem } from '@/lib/workout-recap'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workoutId } = await params

    try {
        const session = await requireRole(['trainee'])

        const workout = await prisma.workout.findFirst({
            where: {
                id: workoutId,
                week: { program: { traineeId: session.user.id } },
            },
            select: {
                traineeNotes: true,
                workoutExercises: {
                    orderBy: { order: 'asc' },
                    select: {
                        id: true,
                        order: true,
                        isCompleted: true,
                        sets: true,
                        reps: true,
                        effectiveWeight: true,
                        exercise: { select: { name: true } },
                        exerciseFeedbacks: {
                            where: { traineeId: session.user.id },
                            orderBy: { date: 'desc' },
                            take: 1,
                            select: {
                                actualRpe: true,
                                notes: true,
                                setsPerformed: {
                                    orderBy: { setNumber: 'asc' },
                                    select: {
                                        setNumber: true,
                                        reps: true,
                                        weight: true,
                                        completed: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!workout) {
            return apiError('NOT_FOUND', 'Workout not found', 404, undefined, 'workout.notFound')
        }

        const exercises: ExerciseRecapItem[] = workout.workoutExercises.map((we) => {
            const feedback = we.exerciseFeedbacks[0] ?? null
            const setsPerformed = feedback?.setsPerformed ?? []
            const completedSets = setsPerformed.filter((s) => s.completed).length
            const hasAnyCompletedSet = setsPerformed.some((s) => s.completed)

            return {
                id: we.id,
                exerciseName: we.exercise.name,
                order: we.order,
                targetSets: we.sets,
                completedSets,
                reps: we.reps,
                effectiveWeight: we.effectiveWeight,
                status: computeExerciseStatus(we.isCompleted, hasAnyCompletedSet),
                actualRpe: feedback?.actualRpe ?? null,
                exerciseNote: feedback?.notes ?? null,
                sets: setsPerformed.map((s) => ({
                    setNumber: s.setNumber,
                    reps: s.reps,
                    weight: s.weight,
                    completed: s.completed,
                })),
            }
        })

        return apiSuccess({ exercises, workoutNote: workout.traineeNotes ?? null })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId }, 'Error fetching workout recap')
        return apiError('INTERNAL_ERROR', 'Failed to fetch workout recap', 500, undefined, 'internal.default')
    }
}