import { prisma } from '@/lib/prisma'
import { apiError, apiSuccess } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import {
    calculateTrainingSets,
    loadTraineePrMap,
    normalizedOneRM,
    parseReps,
} from '@/lib/calculations'
import {
    aggregateWeekMetrics,
    computeWeekSbdMetrics,
    FUNDAMENTAL_LIFT_ORDER,
    matchFundamentalLift,
    type AggregatedSbdMetric,
    type FundamentalLift,
    type LiftLabels,
    type WeekSbdMetric,
} from '@/lib/program-sbd-metrics'
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

// Neutral labels: the client applies its own i18n keys downstream.
const LIFT_LABELS: LiftLabels = {
    squat: 'squat',
    bench: 'bench',
    deadlift: 'deadlift',
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

        const [programs, prMap] = await Promise.all([
            prisma.trainingProgram.findMany({
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
                                            reps: true,
                                            isWarmup: true,
                                            weightType: true,
                                            weight: true,
                                            targetRpe: true,
                                            exercise: {
                                                select: {
                                                    id: true,
                                                    name: true,
                                                    type: true,
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
            }),
            loadTraineePrMap(id),
        ])

        const normalizedOneRMByExercise: Record<string, number> = {}
        for (const [key, weight] of prMap.entries()) {
            const separatorIndex = key.indexOf(':')
            if (separatorIndex < 0) continue
            const exerciseId = key.slice(0, separatorIndex)
            const reps = Number(key.slice(separatorIndex + 1))
            if (!Number.isFinite(reps) || reps <= 0) continue
            const candidate = normalizedOneRM(weight, reps)
            const existing = normalizedOneRMByExercise[exerciseId]
            if (existing === undefined || candidate > existing) {
                normalizedOneRMByExercise[exerciseId] = candidate
            }
        }

        const muscleGroupCatalog = new Map<string, { id: string; name: string }>()
        const timelineMap = new Map<
            string,
            {
                date: string
                values: Map<string, number>
                fundamentalValues: Record<FundamentalLift, number>
                fundamentalLifts: Record<FundamentalLift, number>
                fundamentalMetrics: Record<FundamentalLift, WeekSbdMetric[]>
            }
        >()

        const createFundamentalMetricsAcc = (): Record<FundamentalLift, WeekSbdMetric[]> => ({
            squat: [],
            bench: [],
            deadlift: [],
        })

        programs.forEach((program) => {
            const perWeekMetrics = computeWeekSbdMetrics({
                weeks: program.weeks.map((week) => ({
                    id: week.id,
                    workouts: week.workouts.map((workout) => ({
                        id: workout.id,
                        workoutExercises: workout.workoutExercises.map((we) => ({
                            sets: we.sets,
                            reps: we.reps,
                            isWarmup: we.isWarmup,
                            weightType: we.weightType,
                            weight: we.weight,
                            targetRpe: we.targetRpe,
                            exercise: {
                                id: we.exercise.id,
                                name: we.exercise.name,
                                type: we.exercise.type,
                            },
                        })),
                    })),
                })),
                oneRmByExerciseId: normalizedOneRMByExercise,
                liftLabels: LIFT_LABELS,
            })

            program.weeks.forEach((week) => {
                const weekStartDate = getWeekStartDate(week, program.startDate)

                if (!weekStartDate) {
                    return
                }

                const dateKey = formatDateKey(weekStartDate)
                const timelineEntry = timelineMap.get(dateKey) || {
                    date: dateKey,
                    values: new Map<string, number>(),
                    fundamentalValues: { squat: 0, bench: 0, deadlift: 0 },
                    fundamentalLifts: { squat: 0, bench: 0, deadlift: 0 },
                    fundamentalMetrics: createFundamentalMetricsAcc(),
                }

                const weekMetrics = perWeekMetrics[week.id] ?? []
                weekMetrics.forEach((metric) => {
                    timelineEntry.fundamentalMetrics[metric.lift].push(metric)
                })

                week.workouts.forEach((workout) => {
                    workout.workoutExercises.forEach((workoutExercise) => {
                        const baseTrainingSets = calculateTrainingSets(
                            workoutExercise.sets,
                            1,
                            workoutExercise.isWarmup
                        )

                        const liftCount = workoutExercise.isWarmup
                            ? 0
                            : workoutExercise.sets * parseReps(workoutExercise.reps)

                        if (workoutExercise.exercise.type === 'fundamental') {
                            const fundamentalLift = matchFundamentalLift(
                                workoutExercise.exercise.name
                            )

                            if (fundamentalLift) {
                                if (baseTrainingSets > 0) {
                                    timelineEntry.fundamentalValues[fundamentalLift] = Number(
                                        (
                                            timelineEntry.fundamentalValues[fundamentalLift] +
                                            baseTrainingSets
                                        ).toFixed(1)
                                    )
                                }

                                if (liftCount > 0) {
                                    timelineEntry.fundamentalLifts[fundamentalLift] = Number(
                                        (
                                            timelineEntry.fundamentalLifts[fundamentalLift] +
                                            liftCount
                                        ).toFixed(1)
                                    )
                                }
                            }
                        }

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

        const serializeAggregate = (aggregate: AggregatedSbdMetric | null) => {
            if (!aggregate) return null
            return {
                frequency: aggregate.frequency,
                totalLifts: Number(aggregate.totalLifts.toFixed(1)),
                averageIntensity:
                    aggregate.averageIntensity !== null
                        ? Number(aggregate.averageIntensity.toFixed(1))
                        : null,
            }
        }

        const points = Array.from(timelineMap.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((entry) => {
                const fundamentalMetrics = FUNDAMENTAL_LIFT_ORDER.reduce((acc, lift) => {
                    const bucket = entry.fundamentalMetrics[lift]
                    acc[lift] = bucket.length > 0 ? serializeAggregate(aggregateWeekMetrics(bucket)) : null
                    return acc
                }, {} as Record<FundamentalLift, ReturnType<typeof serializeAggregate>>)

                return {
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
                    fundamentalSets: {
                        squat: Number(entry.fundamentalValues.squat.toFixed(1)),
                        bench: Number(entry.fundamentalValues.bench.toFixed(1)),
                        deadlift: Number(entry.fundamentalValues.deadlift.toFixed(1)),
                    },
                    fundamentalLifts: {
                        squat: Number(entry.fundamentalLifts.squat.toFixed(1)),
                        bench: Number(entry.fundamentalLifts.bench.toFixed(1)),
                        deadlift: Number(entry.fundamentalLifts.deadlift.toFixed(1)),
                    },
                    fundamentalMetrics,
                }
            })

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