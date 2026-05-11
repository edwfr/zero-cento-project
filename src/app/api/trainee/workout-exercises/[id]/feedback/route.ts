import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getTodayDateKey } from '@/lib/date-format'
import { cascadeCompletion } from '@/lib/completion-service'
import { workoutExerciseAutosaveSchema } from '@/schemas/feedback'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const session = await requireRole(['trainee'])
        const body = await request.json()
        const parsed = workoutExerciseAutosaveSchema.safeParse(body)

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
            select: { id: true, sets: true },
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
        const { actualRpe, notes, set } = parsed.data

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
                actualRpe: actualRpe ?? null,
                notes: notes ?? null,
            },
            update: {
                actualRpe: actualRpe ?? null,
                notes: notes ?? null,
            },
            select: {
                id: true,
                workoutExerciseId: true,
                actualRpe: true,
                notes: true,
                date: true,
                updatedAt: true,
            },
        })

        if (set) {
            await prisma.setPerformed.upsert({
                where: {
                    feedbackId_setNumber: {
                        feedbackId: feedback.id,
                        setNumber: set.setNumber,
                    },
                },
                create: {
                    feedbackId: feedback.id,
                    setNumber: set.setNumber,
                    completed: set.completed,
                    reps: set.reps,
                    weight: set.weight,
                },
                update: {
                    completed: set.completed,
                    reps: set.reps,
                    weight: set.weight,
                },
                select: { setNumber: true },
            })
        }

        const [completedPlannedSets, incompletePlannedSets] = await Promise.all([
            prisma.setPerformed.count({
                where: {
                    feedbackId: feedback.id,
                    setNumber: { lte: owns.sets },
                    completed: true,
                },
            }),
            prisma.setPerformed.count({
                where: {
                    feedbackId: feedback.id,
                    setNumber: { lte: owns.sets },
                    completed: false,
                },
            }),
        ])
        const allCompleted =
            owns.sets > 0 &&
            completedPlannedSets >= owns.sets &&
            incompletePlannedSets === 0

        const cascade = await cascadeCompletion(id, allCompleted)

        logger.info(
            {
                workoutExerciseId: id,
                traineeId: session.user.id,
                allSetsCompleted: cascade.workoutExercise.isCompleted,
            },
            'Workout exercise autosaved'
        )

        return apiSuccess({ feedback, cascade })
    } catch (error: any) {
        if (error instanceof Response) return error

        logger.error({ error, workoutExerciseId: id }, 'Error autosaving workout exercise')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to autosave workout exercise',
            500,
            undefined,
            'internal.default'
        )
    }
}
