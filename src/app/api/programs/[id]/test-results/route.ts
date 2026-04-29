import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface SetPerformedEntry {
    setNumber: number
    reps: number
    weight: number
    completed: boolean
}

const formatNumberList = (values: Array<number>): string => {
    if (values.length === 0) return '-'
    return values.map((value) => `${value}`).join(' / ')
}

const normalizeOptionalText = (value: string | null | undefined): string | null => {
    if (!value) return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
}

/**
 * GET /api/programs/[id]/test-results
 * Returns trainee test-week results grouped by week and workout.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: {
                id: true,
                title: true,
                trainerId: true,
                traineeId: true,
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                weeks: {
                    where: {
                        weekType: 'test',
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                    select: {
                        id: true,
                        weekNumber: true,
                        startDate: true,
                        workouts: {
                            orderBy: {
                                dayIndex: 'asc',
                            },
                            select: {
                                id: true,
                                dayIndex: true,
                                workoutExercises: {
                                    where: {
                                        isWarmup: false,
                                    },
                                    orderBy: {
                                        order: 'asc',
                                    },
                                    select: {
                                        id: true,
                                        sets: true,
                                        reps: true,
                                        targetRpe: true,
                                        weight: true,
                                        notes: true,
                                        exercise: {
                                            select: {
                                                name: true,
                                            },
                                        },
                                        exerciseFeedbacks: {
                                            orderBy: {
                                                date: 'desc',
                                            },
                                            select: {
                                                id: true,
                                                date: true,
                                                actualRpe: true,
                                                notes: true,
                                                setsPerformed: {
                                                    orderBy: {
                                                        setNumber: 'asc',
                                                    },
                                                    select: {
                                                        setNumber: true,
                                                        reps: true,
                                                        weight: true,
                                                        completed: true,
                                                    },
                                                },
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

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }

        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403, undefined, 'program.viewAssignedDenied')
        }

        const testWeeks = program.weeks.map((week) => ({
            weekId: week.id,
            weekNumber: week.weekNumber,
            startDate: week.startDate,
            workouts: week.workouts.map((workout) => {
                const rows = workout.workoutExercises.map((workoutExercise) => {
                    const latestFeedback = workoutExercise.exerciseFeedbacks[0] ?? null
                    const completedSets = (latestFeedback?.setsPerformed ?? []).filter(
                        (set: SetPerformedEntry) => set.completed
                    )

                    const repsFromFeedback = completedSets.map((set: SetPerformedEntry) => set.reps)
                    const weightsFromFeedback = completedSets.map((set: SetPerformedEntry) => set.weight)

                    const setsCount = completedSets.length > 0 ? completedSets.length : workoutExercise.sets
                    const repsValue =
                        repsFromFeedback.length > 0
                            ? formatNumberList(repsFromFeedback)
                            : workoutExercise.reps || '-'
                    const weightValue =
                        weightsFromFeedback.length > 0
                            ? formatNumberList(weightsFromFeedback)
                            : workoutExercise.weight !== null
                                ? `${workoutExercise.weight}`
                                : '-'

                    return {
                        workoutExerciseId: workoutExercise.id,
                        exerciseName: workoutExercise.exercise.name,
                        sets: setsCount,
                        reps: repsValue,
                        rpe: latestFeedback?.actualRpe ?? workoutExercise.targetRpe ?? null,
                        weightUsed: weightValue,
                        comments: normalizeOptionalText(latestFeedback?.notes),
                        feedbackDate: latestFeedback?.date ?? null,
                    }
                })

                const comments = Array.from(
                    new Set(
                        rows
                            .map((row) => row.comments)
                            .filter((comment): comment is string => comment !== null)
                    )
                )

                return {
                    workoutId: workout.id,
                    dayIndex: workout.dayIndex,
                    comments,
                    rows,
                }
            }),
        }))

        logger.info({ programId, userId: session.user.id }, 'Program test results fetched successfully')

        return apiSuccess({
            programId: program.id,
            programName: program.title,
            trainee: program.trainee,
            testWeeks,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error fetching program test results')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program test results', 500, undefined, 'internal.default')
    }
}
