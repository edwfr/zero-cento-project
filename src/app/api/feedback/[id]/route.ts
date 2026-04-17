import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { feedbackSchema } from '@/schemas/feedback'
import { logger } from '@/lib/logger'

/**
 * GET /api/feedback/[id]
 * Get single feedback details with sets performed
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: feedbackId } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const feedback = await prisma.exerciseFeedback.findUnique({
            where: { id: feedbackId },
            include: {
                setsPerformed: {
                    orderBy: { setNumber: 'asc' },
                },
                workoutExercise: {
                    include: {
                        exercise: {
                            include: {
                                movementPattern: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
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
                                                trainerId: true,
                                                traineeId: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!feedback) {
            return apiError('NOT_FOUND', 'Feedback not found', 404, undefined, 'feedback.notFound')
        }

        // RBAC: Check access
        const program = feedback.workoutExercise.workout.week.program

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view feedback from your trainees', 403, undefined, 'feedback.viewDenied')
        }

        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own feedback', 403, undefined, 'feedback.viewOwnDenied')
        }

        return apiSuccess({ feedback })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, feedbackId }, 'Error fetching feedback')
        return apiError('INTERNAL_ERROR', 'Failed to fetch feedback', 500, undefined, 'internal.default')
    }
}

/**
 * PUT /api/feedback/[id]
 * Update feedback (trainee can modify only own feedback within 24h)
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: feedbackId } = await params
    try {
        const session = await requireRole(['trainee'])
        const body = await request.json()

        const validation = feedbackSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { workoutExerciseId, notes, sets, completed, actualRpe } = validation.data

        // Check if feedback exists
        const existing = await prisma.exerciseFeedback.findUnique({
            where: { id: feedbackId },
            include: {
                workoutExercise: {
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
                },
            },
        })

        if (!existing) {
            return apiError('NOT_FOUND', 'Feedback not found', 404, undefined, 'feedback.notFound')
        }

        // Verify trainee owns this feedback
        if (existing.workoutExercise.workout.week.program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own feedback', 403, undefined, 'feedback.modifyDenied')
        }

        // Check 24h time limit
        const now = new Date()
        const createdAt = new Date(existing.createdAt)
        const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)

        if (hoursSinceCreation > 24) {
            return apiError(
                'FORBIDDEN',
                'Cannot modify feedback: can only edit within 24 hours of creation',
                403,
                undefined,
                'feedback.cannotModifyAfter24h'
            )
        }

        // Delete old sets and create new ones
        await prisma.setPerformed.deleteMany({
            where: { feedbackId },
        })

        const feedback = await prisma.exerciseFeedback.update({
            where: { id: feedbackId },
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

        logger.info({ feedbackId, userId: session.user.id }, 'Feedback updated')

        return apiSuccess({ feedback })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, feedbackId }, 'Error updating feedback')
        return apiError('INTERNAL_ERROR', 'Failed to update feedback', 500, undefined, 'internal.default')
    }
}
