import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * POST /api/programs/[id]/copy-week
 * Copy workout definitions from one week to the next week only.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()
        const sourceWeekId = body?.sourceWeekId

        if (!sourceWeekId || typeof sourceWeekId !== 'string') {
            return apiError('VALIDATION_ERROR', 'Source week is required', 400, undefined, 'validation.sourceWeekRequired')
        }

        const [program, sourceWeek] = await Promise.all([
            prisma.trainingProgram.findUnique({
                where: { id: programId },
                select: { id: true, trainerId: true, status: true },
            }),
            prisma.week.findUnique({
                where: { id: sourceWeekId },
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

        if (!sourceWeek || sourceWeek.programId !== programId) {
            return apiError('NOT_FOUND', 'Source week not found', 404, undefined, 'week.sourceNotFound')
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
                'Source week has no configured exercises to copy',
                400
            )
        }

        const targetWeek = await prisma.week.findFirst({
            where: { programId, weekNumber: { gt: sourceWeek.weekNumber } },
            orderBy: { weekNumber: 'asc' },
            include: { workouts: { orderBy: { dayIndex: 'asc' } } },
        })

        if (!targetWeek) {
            return apiError('VALIDATION_ERROR', 'Source week has no following week to copy into', 400, undefined, 'program.noFollowingWeek')
        }

        const sourceWorkoutMap = new Map(
            sourceWeek.workouts.map((workout) => [workout.dayIndex, workout])
        )

        await prisma.$transaction(async (tx) => {
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
        })

        logger.info(
            {
                programId,
                sourceWeekId: sourceWeek.id,
                targetWeekId: targetWeek.id,
                userId: session.user.id,
            },
            'Copied workouts from a week to the next week'
        )

        // Fetch updated target week with full exercise data for client local state update
        const updatedWeek = await prisma.week.findUnique({
            where: { id: targetWeek.id },
            include: {
                workouts: {
                    include: {
                        workoutExercises: {
                            orderBy: { order: 'asc' },
                            include: {
                                exercise: {
                                    select: {
                                        id: true,
                                        name: true,
                                        type: true,
                                        notes: true,
                                        movementPattern: {
                                            select: {
                                                id: true,
                                                name: true,
                                                movementPatternColors: {
                                                    select: { trainerId: true, color: true },
                                                },
                                            },
                                        },
                                        exerciseMuscleGroups: {
                                            select: {
                                                coefficient: true,
                                                muscleGroup: { select: { id: true, name: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { dayIndex: 'asc' },
                },
            },
        })

        return apiSuccess({
            sourceWeek: sourceWeek.weekNumber,
            targetWeek: targetWeek.weekNumber,
            updatedWorkouts: targetWeek.workouts.length,
            updatedWeek,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error copying workouts to next week')
        return apiError('INTERNAL_ERROR', 'Failed to copy workouts to next week', 500, undefined, 'internal.default')
    }
}