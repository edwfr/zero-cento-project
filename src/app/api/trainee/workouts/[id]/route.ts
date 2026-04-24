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
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workoutId } = await params
    try {
        const session = await requireRole(['trainee'])

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

        // Prepare date range for feedback query
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Parallelize: fetch feedback and calculate effective weights concurrently
        const [existingFeedback, exercisesWithWeights] = await Promise.all([
            prisma.exerciseFeedback.findMany({
                where: {
                    workoutExerciseId: {
                        in: workout.workoutExercises.map((we) => we.id),
                    },
                    traineeId: session.user.id,
                    date: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
                include: {
                    setsPerformed: {
                        orderBy: {
                            setNumber: 'asc',
                        },
                    },
                },
                orderBy: {
                    updatedAt: 'desc',
                },
            }),
            // Calculate effective weight for each exercise in parallel
            Promise.all(
                workout.workoutExercises.map(async (we) => {
                    let effectiveWeight: number | null =
                        typeof we.effectiveWeight === 'number'
                            ? we.effectiveWeight
                            : we.weightType === 'absolute'
                                ? we.weight
                                : null

                    if (effectiveWeight === null) {
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
                    }

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
                    }
                })
            ),
        ])

        // Create a map for quick lookup of feedback
        const feedbackMap = new Map<string, any>()
        existingFeedback.forEach((fb) => {
            if (!feedbackMap.has(fb.workoutExerciseId)) {
                feedbackMap.set(fb.workoutExerciseId, fb)
            }
        })

        // Attach feedback to exercises
        const exercisesWithFeedback = exercisesWithWeights.map((ex) => ({
            ...ex,
            feedback: feedbackMap.get(ex.id) || null,
        }))

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
                exercises: exercisesWithFeedback,
            },
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId }, 'Error fetching workout details')
        return apiError('INTERNAL_ERROR', 'Failed to fetch workout details', 500, undefined, 'internal.default')
    }
}
