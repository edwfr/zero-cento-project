import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { calculateTrainingSets } from '@/lib/calculations'
import { logger } from '@/lib/logger'

type Params = {
    params: Promise<{ id: string }>
}

const formatDateKey = (date: Date) => date.toISOString().split('T')[0]

const getWeekStartDate = (
    week: { startDate: Date | null; weekNumber: number },
    programStartDate: Date | null
) => {
    if (week.startDate) {
        return week.startDate
    }

    if (!programStartDate) {
        return null
    }

    const nextDate = new Date(programStartDate)
    nextDate.setDate(nextDate.getDate() + (week.weekNumber - 1) * 7)
    return nextDate
}

export async function GET(request: Request, { params }: Params) {
    const { id } = await params
    try {
        const session = await requireAuth()

        if (session.user.role === 'trainer') {
            const association = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId: id,
                },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }

        if (session.user.role === 'trainee' && session.user.id !== id) {
            return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
        }

        const programs = await prisma.trainingProgram.findMany({
            where: {
                traineeId: id,
                status: { in: ['active', 'completed'] },
                startDate: { not: null },
            },
            select: {
                id: true,
                title: true,
                startDate: true,
                weeks: {
                    orderBy: { weekNumber: 'asc' },
                    select: {
                        id: true,
                        weekNumber: true,
                        startDate: true,
                        workouts: {
                            select: {
                                id: true,
                                workoutExercises: {
                                    select: {
                                        id: true,
                                        sets: true,
                                        isWarmup: true,
                                        exercise: {
                                            select: {
                                                exerciseMuscleGroups: {
                                                    select: {
                                                        coefficient: true,
                                                        muscleGroup: {
                                                            select: {
                                                                id: true,
                                                                name: true,
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
                },
            },
            orderBy: { startDate: 'asc' },
        })

        const muscleGroupCatalog = new Map<string, { id: string; name: string }>()
        const timelineMap = new Map<string, { date: string; values: Map<string, number> }>()

        programs.forEach((program) => {
            program.weeks.forEach((week) => {
                const weekStartDate = getWeekStartDate(week, program.startDate)

                if (!weekStartDate) {
                    return
                }

                const dateKey = formatDateKey(weekStartDate)
                const timelineEntry = timelineMap.get(dateKey) || {
                    date: dateKey,
                    values: new Map<string, number>(),
                }

                week.workouts.forEach((workout) => {
                    workout.workoutExercises.forEach((workoutExercise) => {
                        workoutExercise.exercise.exerciseMuscleGroups.forEach((entry) => {
                            muscleGroupCatalog.set(entry.muscleGroup.id, entry.muscleGroup)

                            const trainingSets = calculateTrainingSets(
                                workoutExercise.sets,
                                entry.coefficient,
                                workoutExercise.isWarmup
                            )

                            if (trainingSets <= 0) {
                                return
                            }

                            timelineEntry.values.set(
                                entry.muscleGroup.id,
                                Number(
                                    ((timelineEntry.values.get(entry.muscleGroup.id) || 0) + trainingSets).toFixed(1)
                                )
                            )
                        })
                    })
                })

                timelineMap.set(dateKey, timelineEntry)
            })
        })

        const muscleGroups = Array.from(muscleGroupCatalog.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
        )

        const points = Array.from(timelineMap.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((entry) => ({
                date: entry.date,
                totalTrainingSets: Number(
                    Array.from(entry.values.values())
                        .reduce((sum, value) => sum + value, 0)
                        .toFixed(1)
                ),
                muscleGroups: muscleGroups.map((muscleGroup) => ({
                    muscleGroupId: muscleGroup.id,
                    muscleGroupName: muscleGroup.name,
                    trainingSets: Number((entry.values.get(muscleGroup.id) || 0).toFixed(1)),
                })),
            }))

        return apiSuccess({
            traineeId: id,
            muscleGroups,
            points,
        })
    } catch (error: any) {
        if (error instanceof Response) {
            return error
        }

        logger.error({ error, traineeId: id }, 'Error fetching planned training sets report')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to fetch planned training sets report',
            500,
            undefined,
            'internal.default'
        )
    }
}