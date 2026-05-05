import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * POST /api/programs/[id]/copy-first-week
 * Copy workout definitions from week 1 to all subsequent weeks.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        const [program, sourceWeek] = await Promise.all([
            prisma.trainingProgram.findUnique({
                where: { id: programId },
                select: { id: true, trainerId: true, status: true },
            }),
            prisma.week.findFirst({
                where: { programId },
                orderBy: { weekNumber: 'asc' },
                include: {
                    workouts: {
                        include: { workoutExercises: { orderBy: { order: 'asc' } } },
                        orderBy: { dayIndex: 'asc' },
                    },
                },
            }),
        ])

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (!sourceWeek) {
            return apiSuccess({ updatedWeeks: 0, updatedWorkouts: 0 })
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        const hasSourceExercises = sourceWeek.workouts.some(
            (workout) => workout.workoutExercises.length > 0
        )

        if (!hasSourceExercises) {
            return apiError(
                'VALIDATION_ERROR',
                'First week has no configured exercises to copy',
                400,
                undefined,
                'program.copyFirstWeekEmpty'
            )
        }

        // Load target weeks without exercise data — we delete and replace all exercises
        const targetWeeks = await prisma.week.findMany({
            where: { programId, weekNumber: { gt: sourceWeek.weekNumber } },
            include: {
                workouts: {
                    select: { id: true, dayIndex: true },
                    orderBy: { dayIndex: 'asc' },
                },
            },
            orderBy: { weekNumber: 'asc' },
        })

        if (targetWeeks.length === 0) {
            return apiSuccess({ updatedWeeks: 0, updatedWorkouts: 0 })
        }

        const sourceWorkoutMap = new Map(
            sourceWeek.workouts.map((workout) => [workout.dayIndex, workout])
        )

        await prisma.$transaction(async (tx) => {
            for (const targetWeek of targetWeeks) {
                for (const targetWorkout of targetWeek.workouts) {
                    const sourceWorkout = sourceWorkoutMap.get(targetWorkout.dayIndex)

                    if (!sourceWorkout) {
                        continue
                    }

                    await tx.workoutExercise.deleteMany({
                        where: { workoutId: targetWorkout.id },
                    })

                    if (sourceWorkout.workoutExercises.length === 0) {
                        continue
                    }

                    await tx.workoutExercise.createMany({
                        data: sourceWorkout.workoutExercises.map((exercise) => ({
                            workoutId: targetWorkout.id,
                            exerciseId: exercise.exerciseId,
                            variant: exercise.variant,
                            sets: exercise.sets,
                            reps: exercise.reps,
                            targetRpe: exercise.targetRpe,
                            weightType: exercise.weightType,
                            weight: exercise.weight,
                            effectiveWeight: exercise.effectiveWeight,
                            restTime: exercise.restTime,
                            isWarmup: exercise.isWarmup,
                            notes: exercise.notes,
                            order: exercise.order,
                        })),
                    })
                }
            }
        })

        logger.info(
            {
                programId,
                sourceWeekId: sourceWeek.id,
                copiedWeeks: targetWeeks.length,
                userId: session.user.id,
            },
            'Copied first week workouts to remaining weeks'
        )

        return apiSuccess({
            updatedWeeks: targetWeeks.length,
            updatedWorkouts: targetWeeks.reduce((total, week) => total + week.workouts.length, 0),
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error copying first week workouts')
        return apiError('INTERNAL_ERROR', 'Failed to copy first week workouts', 500, undefined, 'internal.default')
    }
}