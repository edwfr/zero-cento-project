import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const hasStartedFeedback = (feedbacks: Array<{ setsPerformed: Array<{ completed: boolean }> }>): boolean => {
    return feedbacks.some((feedback) =>
        feedback.setsPerformed.some((set) => set.completed)
    )
}

const hasCompletedFeedback = (feedbacks: Array<{ completed: boolean }>): boolean => {
    return feedbacks.some((feedback) => feedback.completed)
}

/**
 * GET /api/programs/[id]/progress
 * Get program progress and statistics
 * Response: currentWeek, totalWeeks, completedWorkouts, totalWorkouts, feedbackCount, avgRPE, totalVolume
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        // Fetch program with full structure
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                weeks: {
                    include: {
                        workouts: {
                            include: {
                                workoutExercises: {
                                    include: {
                                        exerciseFeedbacks: {
                                            include: {
                                                setsPerformed: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { weekNumber: 'asc' },
                },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // RBAC: Check access
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }

        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403, undefined, 'program.viewAssignedDenied')
        }

        // Calculate current week (based on today's date)
        let currentWeek = 1
        if (program.startDate && program.status === 'active') {
            const today = new Date()
            const startDate = new Date(program.startDate)
            const daysSinceStart = Math.floor(
                (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            )
            currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, program.durationWeeks)
        }

        // Calculate workout completion
        const allWorkouts = program.weeks.flatMap((week) => week.workouts)
        const totalWorkouts = allWorkouts.length

        // A workout is completed if all its exercises have feedback
        const completedWorkouts = allWorkouts.filter((workout) => {
            const exercises = workout.workoutExercises
            if (exercises.length === 0) return false
            return exercises.every((ex) => hasCompletedFeedback(ex.exerciseFeedbacks))
        })

        const completedWorkoutsCount = completedWorkouts.length

        // Calculate total feedback count
        const feedbackCount = program.weeks
            .flatMap((week) => week.workouts)
            .flatMap((workout) => workout.workoutExercises)
            .flatMap((ex) => ex.exerciseFeedbacks.filter((feedback) => hasStartedFeedback([feedback]))).length

        // Calculate average RPE across all feedback
        const allFeedbacks = program.weeks
            .flatMap((week) => week.workouts)
            .flatMap((workout) => workout.workoutExercises)
            .flatMap((ex) => ex.exerciseFeedbacks)
            .filter((feedback) => feedback.completed)

        const rpeValues = allFeedbacks.filter((f) => f.actualRpe !== null).map((f) => f.actualRpe!)
        const avgRPE =
            rpeValues.length > 0 ? rpeValues.reduce((a: number, b: number) => a + b, 0) / rpeValues.length : null

        // Calculate total volume from all setsPerformed
        const totalVolume = allFeedbacks.reduce((sum: number, f) => {
            const feedbackVolume = f.setsPerformed.reduce(
                (setSum: number, set) => setSum + set.reps * set.weight,
                0
            )
            return sum + feedbackVolume
        }, 0)

        // Build workout list with completion status
        const workoutsList = program.weeks.flatMap((week) =>
            week.workouts.map((workout) => {
                const hasAllFeedback =
                    workout.workoutExercises.length > 0 &&
                    workout.workoutExercises.every((ex) => hasCompletedFeedback(ex.exerciseFeedbacks))

                const hasStartedWorkout = workout.workoutExercises.some((ex) =>
                    hasStartedFeedback(ex.exerciseFeedbacks)
                )

                const exercisesPerformed = workout.workoutExercises.map((ex) => {
                    const latestCompletedFeedback = ex.exerciseFeedbacks
                        .filter((feedback) => feedback.completed)
                        .sort((a, b) => b.date.getTime() - a.date.getTime())[0]

                    const performedSets = latestCompletedFeedback
                        ? latestCompletedFeedback.setsPerformed
                            .filter((set) => set.completed)
                            .sort((a, b) => a.setNumber - b.setNumber)
                            .map((set) => ({
                                setNumber: set.setNumber,
                                reps: set.reps,
                                weight: set.weight,
                            }))
                        : []

                    return {
                        workoutExerciseId: ex.id,
                        performedSets,
                    }
                })

                return {
                    id: workout.id,
                    name: `Giorno ${workout.dayIndex}`,
                    weekNumber: week.weekNumber,
                    weekType: week.weekType,
                    dayOfWeek: workout.dayIndex,
                    exerciseCount: workout.workoutExercises.length,
                    completed: hasAllFeedback,
                    started: hasStartedWorkout,
                    feedbackCount: workout.workoutExercises.flatMap((ex) =>
                        ex.exerciseFeedbacks.filter((feedback) => hasStartedFeedback([feedback]))
                    ).length,
                    exercisesPerformed,
                }
            })
        )

        const nextWorkout = workoutsList.find((workout) => !workout.completed) ?? null

        // Calculate weekly statistics for charts
        const weeklyStats = program.weeks.map((week) => {
            const weekWorkouts = week.workouts
            const weekFeedbacks = weekWorkouts
                .flatMap((w) => w.workoutExercises)
                .flatMap((ex) => ex.exerciseFeedbacks)

            // Calculate volume for this week
            const weekVolume = weekFeedbacks.reduce((sum, f) => {
                const feedbackVolume = f.setsPerformed.reduce(
                    (setSum, set) => setSum + set.reps * set.weight,
                    0
                )
                return sum + feedbackVolume
            }, 0)

            // Calculate avg RPE for this week
            const weekRpeValues = weekFeedbacks
                .filter((f) => f.actualRpe !== null)
                .map((f) => f.actualRpe!)
            const weekAvgRPE =
                weekRpeValues.length > 0
                    ? weekRpeValues.reduce((a, b) => a + b, 0) / weekRpeValues.length
                    : null

            // Count completed workouts for this week
            const weekCompletedWorkouts = weekWorkouts.filter((w) => {
                return (
                    w.workoutExercises.length > 0 &&
                    w.workoutExercises.every((ex) => hasCompletedFeedback(ex.exerciseFeedbacks))
                )
            }).length

            return {
                weekNumber: week.weekNumber,
                weekType: week.weekType,
                totalVolume: Math.round(weekVolume),
                avgRPE: weekAvgRPE !== null ? Math.round(weekAvgRPE * 10) / 10 : null,
                completedWorkouts: weekCompletedWorkouts,
                totalWorkouts: weekWorkouts.length,
                feedbackCount: weekFeedbacks.length,
            }
        })

        return apiSuccess({
            programId: program.id,
            programName: program.title,
            status: program.status,
            currentWeek,
            totalWeeks: program.durationWeeks,
            completedWorkouts: completedWorkoutsCount,
            totalWorkouts,
            feedbackCount,
            avgRPE: avgRPE !== null ? Math.round(avgRPE * 10) / 10 : null,
            totalVolume: Math.round(totalVolume),
            nextWorkout,
            workouts: workoutsList,
            weeklyStats,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error fetching program progress')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program progress', 500, undefined, 'internal.default')
    }
}
