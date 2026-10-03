import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error-handler'

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
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching feedback',
            message: 'Failed to fetch feedback',
            key: 'internal.default',
            context: { feedbackId },
        })
    }
}
