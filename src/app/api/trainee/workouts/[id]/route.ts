import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { calculateEffectiveWeight } from '@/lib/calculations'
import { logger } from '@/lib/logger'

/**
 * GET /api/trainee/workouts/[id]
 * Get workout details with pre-calculated effective weights
 * RBAC: Only the trainee who owns this workout can access it
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['trainee'])
        const workoutId = params.id

        // Fetch workout with all relations
        const workout = await prisma.workout.findUnique({
            where: { id: workoutId },
            include: {
                week: {
                    include: {
                        program: {
                            select: {
                                id: true,
                                title: true,
                                traineeId: true,
                                trainerId: true,
                            },
                        },
                    },
                },
                workoutExercises: {
                    include: {
                        exercise: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                youtubeUrl: true,
                                type: true,
                                notes: true,
                            },
                        },
                    },
                    orderBy: {
                        order: 'asc',
                    },
                },
            },
        })

        if (!workout) {
            return apiError('NOT_FOUND', 'Workout not found', 404, undefined, 'workout.notFound')
        }

        // RBAC: Verify trainee owns this workout
        if (workout.week.program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only access your own workouts', 403, undefined, 'workout.accessDenied')
        }

        // Fetch existing feedback for all exercises in this workout
        // The feedback is scoped to today's date for idempotency
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const feedbackMap = new Map<string, any>()

        const existingFeedback = await prisma.exerciseFeedback.findMany({
            where: {
                workoutExerciseId: {
                    in: workout.workoutExercises.map((we) => we.id),
                },
                traineeId: session.user.id,
                date: today,
            },
            include: {
                setsPerformed: {
                    orderBy: {
                        setNumber: 'asc',
                    },
                },
            },
        })

        // Create a map for quick lookup
        existingFeedback.forEach((fb) => {
            feedbackMap.set(fb.workoutExerciseId, fb)
        })

        // Calculate effective weight for each exercise
        const exercisesWithWeights = await Promise.all(
            workout.workoutExercises.map(async (we) => {
                let effectiveWeight: number | null = null

                try {
                    effectiveWeight = await calculateEffectiveWeight(
                        we,
                        session.user.id
                    )
                } catch (error) {
                    // If calculation fails (e.g., missing 1RM), effectiveWeight remains null
                    logger.warn(
                        {
                            workoutExerciseId: we.id,
                            exerciseId: we.exerciseId,
                            weightType: we.weightType,
                            error: error instanceof Error ? error.message : String(error),
                        },
                        'Failed to calculate effective weight'
                    )
                }

                // Get feedback for this exercise if exists
                const feedback = feedbackMap.get(we.id) || null

                return {
                    id: we.id,
                    exercise: we.exercise,
                    variant: we.variant,
                    sets: we.sets,
                    reps: we.reps,
                    targetRpe: we.targetRpe,
                    weightType: we.weightType,
                    weight: we.weight,
                    effectiveWeight, // Calculated server-side
                    restTime: we.restTime,
                    isWarmup: we.isWarmup,
                    notes: we.notes,
                    order: we.order,
                    feedback, // Include existing feedback if present
                }
            })
        )

        logger.info(
            { workoutId, traineeId: session.user.id },
            'Trainee fetched workout details'
        )

        return apiSuccess({
            workout: {
                id: workout.id,
                dayIndex: workout.dayIndex,
                notes: workout.notes,
                weekNumber: workout.week.weekNumber,
                weekType: workout.week.weekType,
                program: {
                    id: workout.week.program.id,
                    title: workout.week.program.title,
                },
                exercises: exercisesWithWeights,
            },
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId: params.id }, 'Error fetching workout details')
        return apiError('INTERNAL_ERROR', 'Failed to fetch workout details', 500, undefined, 'internal.default')
    }
}
