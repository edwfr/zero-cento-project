import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
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

        // Pre-compute new WorkoutExercise rows per target workout with explicit
        // ids so the response can be built in-memory without re-querying the DB.
        const plannedRowsByWorkout = new Map<
            string,
            Array<{ id: string; sourceExercise: (typeof sourceWeek.workouts)[number]['workoutExercises'][number] }>
        >()

        for (const targetWorkout of targetWeek.workouts) {
            const sourceWorkout = sourceWorkoutMap.get(targetWorkout.dayIndex)
            if (!sourceWorkout || sourceWorkout.workoutExercises.length === 0) {
                plannedRowsByWorkout.set(targetWorkout.id, [])
                continue
            }
            plannedRowsByWorkout.set(
                targetWorkout.id,
                sourceWorkout.workoutExercises.map((sourceExercise) => ({
                    id: randomUUID(),
                    sourceExercise,
                }))
            )
        }

        await prisma.$transaction(async (tx) => {
            for (const targetWorkout of targetWeek.workouts) {
                const planned = plannedRowsByWorkout.get(targetWorkout.id) ?? []

                await tx.workoutExercise.deleteMany({
                    where: { workoutId: targetWorkout.id },
                })

                if (planned.length === 0) {
                    continue
                }

                await tx.workoutExercise.createMany({
                    data: planned.map(({ id, sourceExercise }) => ({
                        id,
                        workoutId: targetWorkout.id,
                        exerciseId: sourceExercise.exerciseId,
                        variant: sourceExercise.variant,
                        sets: sourceExercise.sets,
                        reps: sourceExercise.reps,
                        targetRpe: sourceExercise.targetRpe,
                        weightType: sourceExercise.weightType,
                        weight: sourceExercise.weight,
                        effectiveWeight: sourceExercise.effectiveWeight,
                        restTime: sourceExercise.restTime,
                        isWarmup: sourceExercise.isWarmup,
                        notes: sourceExercise.notes,
                        order: sourceExercise.order,
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

        // Build updated week in-memory from the enriched source data and the
        // freshly-inserted ids — no extra DB roundtrip needed.
        const updatedWeek = {
            id: targetWeek.id,
            programId: targetWeek.programId,
            weekNumber: targetWeek.weekNumber,
            startDate: targetWeek.startDate,
            weekType: targetWeek.weekType,
            feedbackRequested: targetWeek.feedbackRequested,
            generalFeedback: targetWeek.generalFeedback,
            workouts: targetWeek.workouts
                .slice()
                .sort((a, b) => a.dayIndex - b.dayIndex)
                .map((targetWorkout) => {
                    const planned = plannedRowsByWorkout.get(targetWorkout.id) ?? []
                    return {
                        id: targetWorkout.id,
                        weekId: targetWorkout.weekId,
                        dayIndex: targetWorkout.dayIndex,
                        notes: targetWorkout.notes,
                        workoutExercises: planned.map(({ id, sourceExercise }) => ({
                            id,
                            workoutId: targetWorkout.id,
                            exerciseId: sourceExercise.exerciseId,
                            variant: sourceExercise.variant,
                            sets: sourceExercise.sets,
                            reps: sourceExercise.reps,
                            targetRpe: sourceExercise.targetRpe,
                            weightType: sourceExercise.weightType,
                            weight: sourceExercise.weight,
                            effectiveWeight: sourceExercise.effectiveWeight,
                            restTime: sourceExercise.restTime,
                            isWarmup: sourceExercise.isWarmup,
                            isSkeletonExercise: false,
                            notes: sourceExercise.notes,
                            order: sourceExercise.order,
                            exercise: sourceExercise.exercise,
                        })),
                    }
                }),
        }

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