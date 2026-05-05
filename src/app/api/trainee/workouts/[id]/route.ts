import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { loadTraineePrMap, resolveEffectiveWeight } from '@/lib/calculations'
import { logger } from '@/lib/logger'

interface FeedbackSetSnapshot {
    setNumber: number
    completed: boolean
    reps: number
    weight: number
}

interface FeedbackSnapshot {
    id: string
    workoutExerciseId: string
    traineeId: string
    date: Date
    updatedAt: Date
    actualRpe: number | null
    notes: string | null
    setsPerformed: FeedbackSetSnapshot[]
}

const mergeFeedbackRows = (rows: FeedbackSnapshot[]) => {
    const mergedByExerciseId = new Map<string, {
        id: string
        workoutExerciseId: string
        traineeId: string
        date: Date
        updatedAt: Date
        avgRPE: number | null
        actualRpe: number | null
        notes: string | null
        setsPerformed: FeedbackSetSnapshot[]
    }>()
    const mergedSetsByExerciseId = new Map<string, Map<number, FeedbackSetSnapshot>>()

    for (const row of rows) {
        if (!mergedByExerciseId.has(row.workoutExerciseId)) {
            mergedByExerciseId.set(row.workoutExerciseId, {
                id: row.id,
                workoutExerciseId: row.workoutExerciseId,
                traineeId: row.traineeId,
                date: row.date,
                updatedAt: row.updatedAt,
                avgRPE: row.actualRpe,
                actualRpe: row.actualRpe,
                notes: row.notes,
                setsPerformed: [],
            })
            mergedSetsByExerciseId.set(row.workoutExerciseId, new Map())
        } else {
            const merged = mergedByExerciseId.get(row.workoutExerciseId)!
            if (merged.notes === null && row.notes !== null) {
                merged.notes = row.notes
            }
            if (merged.avgRPE === null && row.actualRpe !== null) {
                merged.avgRPE = row.actualRpe
                merged.actualRpe = row.actualRpe
            }
        }

        const setsByNumber = mergedSetsByExerciseId.get(row.workoutExerciseId)!
        for (const set of row.setsPerformed) {
            const existing = setsByNumber.get(set.setNumber)
            if (!existing || (!existing.completed && set.completed)) {
                setsByNumber.set(set.setNumber, {
                    setNumber: set.setNumber,
                    completed: set.completed,
                    reps: set.reps,
                    weight: set.weight,
                })
            }
        }
    }

    for (const [workoutExerciseId, merged] of mergedByExerciseId) {
        merged.setsPerformed = Array.from(mergedSetsByExerciseId.get(workoutExerciseId)?.values() ?? [])
            .sort((left, right) => left.setNumber - right.setNumber)
    }

    return mergedByExerciseId
}

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

        // Parallelize: fetch the latest feedback rows and trainee PR map concurrently.
        // Feedback is stored by calendar day, so the workout detail must hydrate the
        // most recent row per exercise instead of restricting the read to "today".
        const [existingFeedback, prMap] = await Promise.all([
            prisma.exerciseFeedback.findMany({
                where: {
                    workoutExerciseId: {
                        in: workout.workoutExercises.map((we) => we.id),
                    },
                    traineeId: session.user.id,
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
            loadTraineePrMap(session.user.id),
        ])

        const siblings = workout.workoutExercises
        const exercisesWithWeights = workout.workoutExercises.map((we) => {
            let effectiveWeight: number | null =
                typeof we.effectiveWeight === 'number'
                    ? we.effectiveWeight
                    : we.weightType === 'absolute'
                        ? we.weight
                        : null

            if (effectiveWeight === null) {
                try {
                    effectiveWeight = resolveEffectiveWeight(we, prMap, siblings)
                } catch (error) {
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
                effectiveWeight,
                restTime: we.restTime,
                isWarmup: we.isWarmup,
                notes: we.notes,
                order: we.order,
                isCompleted: we.isCompleted,
            }
        })

        // Create a map for quick lookup of feedback
        const feedbackMap = mergeFeedbackRows(existingFeedback as FeedbackSnapshot[])

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
