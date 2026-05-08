import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getTodayDateKey } from '@/lib/date-format'
import { workoutExerciseRpeSchema } from '@/schemas/feedback'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const session = await requireRole(['trainee'])
        const body = await request.json()
        const parsed = workoutExerciseRpeSchema.safeParse(body)

        if (!parsed.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid input',
                400,
                parsed.error.flatten(),
                'validation.invalid'
            )
        }

        const owns = await prisma.workoutExercise.findFirst({
            where: {
                id,
                workout: {
                    week: {
                        program: {
                            traineeId: session.user.id,
                        },
                    },
                },
            },
            select: { id: true },
        })

        if (!owns) {
            return apiError(
                'NOT_FOUND',
                'Workout exercise not found',
                404,
                undefined,
                'workoutExercise.notFound'
            )
        }

        const today = getTodayDateKey()
        const { actualRpe } = parsed.data

        const feedback = await prisma.exerciseFeedback.upsert({
            where: {
                workoutExerciseId_traineeId_date: {
                    workoutExerciseId: id,
                    traineeId: session.user.id,
                    date: today,
                },
            },
            create: {
                workoutExerciseId: id,
                traineeId: session.user.id,
                date: today,
                actualRpe,
            },
            update: {
                actualRpe,
            },
            select: {
                id: true,
                workoutExerciseId: true,
                actualRpe: true,
                date: true,
                updatedAt: true,
            },
        })

        logger.info(
            { workoutExerciseId: id, traineeId: session.user.id, actualRpe },
            'RPE autosaved'
        )

        return apiSuccess({ feedback })
    } catch (error: any) {
        if (error instanceof Response) return error

        logger.error({ error, workoutExerciseId: id }, 'Error autosaving RPE')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to autosave RPE',
            500,
            undefined,
            'internal.default'
        )
    }
}
