import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
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
