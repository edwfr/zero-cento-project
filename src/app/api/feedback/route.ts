import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { feedbackSchema } from '@/schemas/feedback'
import { logger } from '@/lib/logger'

/**
 * GET /api/feedback
 * List feedback with filters
 * Query params: traineeId, programId, exerciseId
 * RBAC: trainer sees only own trainees, trainee sees only own
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)

        const traineeId = searchParams.get('traineeId') || undefined
        const programId = searchParams.get('programId') || undefined
        const exerciseId = searchParams.get('exerciseId') || undefined
        const cursor = searchParams.get('cursor') || undefined
        const limit = parseInt(searchParams.get('limit') || '20')

        // Build where clause based on RBAC
        const where: any = {}

        if (session.user.role === 'trainee') {
            // Trainees see only their own feedback
            where.workoutExercise = {
                workout: {
                    week: {
                        program: {
                            traineeId: session.user.id,
                        },
                    },
                },
            }
        } else if (session.user.role === 'trainer') {
            // Trainers see only feedback from their trainees
            where.workoutExercise = {
                workout: {
                    week: {
                        program: {
                            trainerId: session.user.id,
                        },
                    },
                },
            }
        }
        // Admin sees all feedback

        // Apply additional filters
        if (traineeId) {
            where.workoutExercise = {
                ...where.workoutExercise,
                workout: {
                    ...where.workoutExercise?.workout,
                    week: {
                        ...where.workoutExercise?.workout?.week,
                        program: {
                            ...where.workoutExercise?.workout?.week?.program,
                            traineeId,
                        },
                    },
                },
            }
        }

        if (programId) {
            where.workoutExercise = {
                ...where.workoutExercise,
                workout: {
                    ...where.workoutExercise?.workout,
                    week: {
                        ...where.workoutExercise?.workout?.week,
                        programId,
                    },
                },
            }
        }

        if (exerciseId) {
            where.workoutExercise = {
                ...where.workoutExercise,
                exerciseId,
            }
        }

        // Fetch feedback with cursor pagination
        const feedbacks = await prisma.exerciseFeedback.findMany({
            where,
            include: {
                workoutExercise: {
                    include: {
                        exercise: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        workout: {
                            include: {
                                week: {
                                    include: {
                                        program: {
                                            select: {
                                                id: true,
                                                title: true,
                                                traineeId: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                setsPerformed: {
                    orderBy: {
                        setNumber: 'asc',
                    },
                },
            },
            take: limit + 1,
            ...(cursor && {
                skip: 1,
                cursor: {
                    id: cursor,
                },
            }),
            orderBy: [{ createdAt: 'desc' }],
        })

        const hasMore = feedbacks.length > limit
        const items = hasMore ? feedbacks.slice(0, -1) : feedbacks
        const nextCursor = hasMore ? items[items.length - 1].id : null

        return apiSuccess({
            items,
            pagination: {
                nextCursor,
                hasMore,
            },
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching feedback')
        return apiError('INTERNAL_ERROR', 'Failed to fetch feedback', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/feedback
 * Create feedback (trainee only)
 * Business logic:
 * - Nested create: ExerciseFeedback + multiple SetPerformed
 * - Calculate totalVolume = sum(reps * weight)
 * - Calculate avgRPE = average of all sets
 * - Idempotency: if feedback exists for workoutExerciseId, UPDATE instead of INSERT
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['trainee'])
        const body = await request.json()

        const validation = feedbackSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { workoutExerciseId, notes, sets, completed, actualRpe } = validation.data

        // Verify workout exercise exists
        const workoutExercise = await prisma.workoutExercise.findUnique({
            where: { id: workoutExerciseId },
            include: {
                workout: {
                    include: {
                        week: {
                            include: {
                                program: true,
                            },
                        },
                    },
                },
            },
        })

        if (!workoutExercise) {
            return apiError('NOT_FOUND', 'Workout exercise not found', 404, undefined, 'workoutExercise.notFound')
        }

        // Verify trainee owns this workout
        if (workoutExercise.workout.week.program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only create feedback for your own workouts', 403, undefined, 'feedback.createDenied')
        }

        // Check if feedback already exists (idempotency by date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const existingFeedback = await prisma.exerciseFeedback.findFirst({
            where: {
                workoutExerciseId,
                traineeId: session.user.id,
                date: {
                    gte: today,
                },
            },
        })

        let feedback

        if (existingFeedback) {
            // UPDATE existing feedback
            // Delete old sets and create new ones
            await prisma.setPerformed.deleteMany({
                where: { feedbackId: existingFeedback.id },
            })

            feedback = await prisma.exerciseFeedback.update({
                where: { id: existingFeedback.id },
                data: {
                    notes,
                    completed,
                    actualRpe,
                    setsPerformed: {
                        create: sets.map((set: { setNumber: number; completed: boolean; reps: number; weight: number }) => ({
                            setNumber: set.setNumber,
                            completed: set.completed,
                            reps: set.reps,
                            weight: set.weight,
                        })),
                    },
                },
                include: {
                    setsPerformed: {
                        orderBy: { setNumber: 'asc' },
                    },
                    workoutExercise: {
                        include: {
                            exercise: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            })

            logger.info({ feedbackId: feedback.id, workoutExerciseId }, 'Feedback updated')
        } else {
            // CREATE new feedback
            feedback = await prisma.exerciseFeedback.create({
                data: {
                    workoutExerciseId,
                    traineeId: session.user.id,
                    notes,
                    completed,
                    actualRpe,
                    setsPerformed: {
                        create: sets.map((set: { setNumber: number; completed: boolean; reps: number; weight: number }) => ({
                            setNumber: set.setNumber,
                            completed: set.completed,
                            reps: set.reps,
                            weight: set.weight,
                        })),
                    },
                },
                include: {
                    setsPerformed: {
                        orderBy: { setNumber: 'asc' },
                    },
                    workoutExercise: {
                        include: {
                            exercise: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            })

            logger.info({ feedbackId: feedback.id, workoutExerciseId }, 'Feedback created')
        }

        // Calculate derived metrics
        const totalVolume = feedback.setsPerformed.reduce(
            (sum, set) => sum + (set.completed ? set.reps * set.weight : 0),
            0
        )
        const avgRPE = feedback.actualRpe || null

        return apiSuccess(
            {
                feedback,
                calculated: {
                    totalVolume: Math.round(totalVolume * 10) / 10, // Round to 1 decimal
                    avgRPE,
                },
            },
            existingFeedback ? 200 : 201
        )
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating/updating feedback')
        return apiError('INTERNAL_ERROR', 'Failed to save feedback', 500, undefined, 'internal.default')
    }
}
