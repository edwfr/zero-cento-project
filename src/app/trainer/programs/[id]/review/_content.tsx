'use client'

import { MouseEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, ChevronUp, FileEdit } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import ProgramMuscleGroupCharts from '@/components/ProgramMuscleGroupCharts'
import { getApiErrorMessage } from '@/lib/api-error'

interface WorkoutExerciseSummary {
    id: string
    sets: number
    reps: string
    targetRpe: number | null
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
    weight: number | null
    isWarmup: boolean
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
        exerciseMuscleGroups: {
            coefficient: number
            muscleGroup: {
                id: string
                name: string
            }
        }[]
    }
}

interface WorkoutSummary {
    id: string
    dayIndex: number
    workoutExercises: WorkoutExerciseSummary[]
}

interface WeekSummary {
    id: string
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: WorkoutSummary[]
}

interface ProgramSummary {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    isSbdProgram: boolean
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    durationWeeks: number
    workoutsPerWeek: number
    weeks: WeekSummary[]
}

interface PersonalRecord {
    exerciseId: string
    reps: number
    weight: number
}

interface ReviewProgramContentProps {
    viewOnly?: boolean
}

function parseRepsValue(repsValue: string): number {
    const match = repsValue.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

function estimateOneRMValue(weight: number, reps: number): number {
    if (reps <= 1) return weight
    return weight * (1 + reps / 30)
}

export default function ReviewProgramContent({ viewOnly = false }: ReviewProgramContentProps) {
    const params = useParams()
    const programId = params.id as string
    const { t } = useTranslation('trainer')

    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<ProgramSummary | null>(null)
    const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isSbdSummaryCollapsed, setIsSbdSummaryCollapsed] = useState(false)

    useEffect(() => {
        const fetchProgram = async () => {
            try {
                setLoading(true)
                const res = await fetch(`/api/programs/${programId}`, {
                    cache: 'no-store',
                })
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(getApiErrorMessage(data, t('reviewProgram.errorLoading'), t))
                }

                setProgram(data.data.program)

                const traineeId = data.data.program.trainee.id
                const recordsRes = await fetch(`/api/personal-records?traineeId=${traineeId}`)

                if (recordsRes.ok) {
                    const recordsData = await recordsRes.json()
                    setPersonalRecords(recordsData.data.items || [])
                } else {
                    setPersonalRecords([])
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : t('reviewProgram.errorLoading'))
            } finally {
                setLoading(false)
            }
        }

        void fetchProgram()
    }, [programId, t])

    const isDraft = program?.status === 'draft'
    const totalWorkouts = program ? program.durationWeeks * program.workoutsPerWeek : 0
    const configuredWorkouts =
        program?.weeks.reduce(
            (sum, week) =>
                sum + week.workouts.filter((workout) => workout.workoutExercises.length > 0).length,
            0
        ) ?? 0

    const shouldShowSbdReporting = program?.isSbdProgram ?? false

    const recordsByExercise = useMemo(
        () =>
            personalRecords.reduce((acc, record) => {
                const key = record.exerciseId
                if (!acc[key]) {
                    acc[key] = []
                }
                acc[key].push(record)
                return acc
            }, {} as Record<string, PersonalRecord[]>),
        [personalRecords]
    )

    const bestPRs = useMemo(
        () =>
            Object.values(recordsByExercise).map((records) =>
                records.reduce((best, current) => {
                    const currentEstimatedOneRM = estimateOneRMValue(current.weight, current.reps)
                    const bestEstimatedOneRM = estimateOneRMValue(best.weight, best.reps)
                    return currentEstimatedOneRM > bestEstimatedOneRM ? current : best
                })
            ),
        [recordsByExercise]
    )

    const estimatedOneRMByExercise = useMemo(
        () =>
            bestPRs.reduce((acc, record) => {
                acc[record.exerciseId] = estimateOneRMValue(record.weight, record.reps)
                return acc
            }, {} as Record<string, number>),
        [bestPRs]
    )

    const weekSbdMetrics = useMemo(
        () =>
            (program?.weeks ?? []).reduce((acc, week) => {
                acc[week.id] = Object.values(
                    week.workouts.reduce(
                        (weekAcc, workout) => {
                            workout.workoutExercises
                                .filter(
                                    (workoutExercise) =>
                                        workoutExercise.exercise.type === 'fundamental' &&
                                        !workoutExercise.isWarmup
                                )
                                .forEach((workoutExercise) => {
                                    const key = workoutExercise.exercise.id
                                    const plannedReps = parseRepsValue(workoutExercise.reps)
                                    const liftCount = workoutExercise.sets * plannedReps

                                    let intensity: number | null = null
                                    if (
                                        workoutExercise.weightType === 'percentage_1rm' &&
                                        typeof workoutExercise.weight === 'number'
                                    ) {
                                        intensity = workoutExercise.weight
                                    } else if (
                                        workoutExercise.weightType === 'absolute' &&
                                        typeof workoutExercise.weight === 'number'
                                    ) {
                                        const estimatedOneRM =
                                            estimatedOneRMByExercise[workoutExercise.exercise.id]
                                        if (estimatedOneRM) {
                                            intensity = (workoutExercise.weight / estimatedOneRM) * 100
                                        }
                                    }

                                    if (!weekAcc[key]) {
                                        weekAcc[key] = {
                                            exerciseId: workoutExercise.exercise.id,
                                            exerciseName: workoutExercise.exercise.name,
                                            workoutIds: new Set<string>(),
                                            totalLifts: 0,
                                            weightedIntensitySum: 0,
                                            intensityLiftCount: 0,
                                        }
                                    }

                                    weekAcc[key].workoutIds.add(workout.id)
                                    weekAcc[key].totalLifts += liftCount

                                    if (intensity !== null && liftCount > 0) {
                                        weekAcc[key].weightedIntensitySum += intensity * liftCount
                                        weekAcc[key].intensityLiftCount += liftCount
                                    }
                                })

                            return weekAcc
                        },
                        {} as Record<
                            string,
                            {
                                exerciseId: string
                                exerciseName: string
                                workoutIds: Set<string>
                                totalLifts: number
                                weightedIntensitySum: number
                                intensityLiftCount: number
                            }
                        >
                    )
                )
                    .map((metric) => ({
                        exerciseId: metric.exerciseId,
                        exerciseName: metric.exerciseName,
                        frequency: metric.workoutIds.size,
                        totalLifts: metric.totalLifts,
                        averageIntensity:
                            metric.intensityLiftCount > 0
                                ? metric.weightedIntensitySum / metric.intensityLiftCount
                                : null,
                    }))
                    .sort((left, right) =>
                        left.exerciseName.localeCompare(right.exerciseName, 'it', {
                            sensitivity: 'base',
                        })
                    )

                return acc
            }, {} as Record<string, Array<{ exerciseId: string; exerciseName: string; frequency: number; totalLifts: number; averageIntensity: number | null }>>),
        [estimatedOneRMByExercise, program?.weeks]
    )

    const sbdSummaryRows = useMemo(
        () =>
            shouldShowSbdReporting
                ? (program?.weeks ?? []).flatMap((week) =>
                    (weekSbdMetrics[week.id] || []).map((metric) => ({
                        weekId: week.id,
                        weekNumber: week.weekNumber,
                        exerciseId: metric.exerciseId,
                        exerciseName: metric.exerciseName,
                        frequency: metric.frequency,
                        totalLifts: metric.totalLifts,
                        averageIntensity: metric.averageIntensity,
                    }))
                )
                : [],
        [program?.weeks, shouldShowSbdReporting, weekSbdMetrics]
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !program) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-800">
                    {error || t('reviewProgram.notFound')}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 xl:px-10 2xl:px-12">
                <div className="mb-8">
                    <div className="mb-4 flex items-center justify-center space-x-4">
                        <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 font-bold text-white">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepSetup')}</span>
                        </div>
                        <div className="h-1 w-16 bg-green-500"></div>
                        <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 font-bold text-white">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepExercises')}</span>
                        </div>
                        <div className="h-1 w-16 bg-[#FFA700]"></div>
                        <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFA700] font-bold text-white">
                                3
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepReview')}</span>
                        </div>
                        <div className="h-1 w-16 bg-gray-300"></div>
                        <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 font-bold text-gray-600">
                                4
                            </div>
                            <span className="ml-2 text-gray-500">{t('editProgram.stepPublish')}</span>
                        </div>
                    </div>
                </div>

                <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <Link
                            href={viewOnly ? '/trainer/programs' : `/trainer/programs/${programId}/edit`}
                            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:text-brand-primary/80"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {viewOnly ? t('editProgram.backToPrograms') : t('reviewProgram.backToEdit')}
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">{t('reviewProgram.title')}</h1>
                        <p className="mt-2 text-gray-600">
                            {t('reviewProgram.description', {
                                name: `${program.trainee.firstName} ${program.trainee.lastName}`,
                            })}
                        </p>
                    </div>
                    {viewOnly &&
                        (isDraft ? (
                            <Link
                                href={`/trainer/programs/${programId}/edit`}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#FFA700] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#FF9500]"
                            >
                                <FileEdit className="h-4 w-4" />
                                {t('editProgram.edit')}
                            </Link>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-300 px-4 py-2 font-semibold text-gray-500"
                            >
                                <FileEdit className="h-4 w-4" />
                                {t('editProgram.edit')}
                            </button>
                        ))}
                </div>

                {shouldShowSbdReporting && sbdSummaryRows.length > 0 && (
                    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
                        <button
                            type="button"
                            onClick={() => setIsSbdSummaryCollapsed((current) => !current)}
                            className="group flex w-full items-start justify-between gap-4 text-left"
                            aria-expanded={!isSbdSummaryCollapsed}
                        >
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{t('reviewProgram.sbdSummaryTitle')}</h2>
                                <p className="mt-2 text-sm text-gray-600">
                                    {t('reviewProgram.sbdSummaryDescription')}
                                </p>
                            </div>
                            <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                {isSbdSummaryCollapsed ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronUp className="h-4 w-4" />
                                )}
                            </span>
                        </button>

                        {!isSbdSummaryCollapsed && (
                            <div className="mt-4 overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-500">
                                            <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdWeekCol')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdExerciseCol')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdFrqCol')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdNblCol')}</th>
                                            <th className="px-3 py-3 font-semibold">{t('reviewProgram.sbdImCol')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sbdSummaryRows.map((row) => (
                                            <tr key={`${row.weekId}-${row.exerciseId}`} className="hover:bg-slate-50/70">
                                                <td className="px-3 py-3 font-semibold text-slate-900">
                                                    {t('reviewProgram.sbdWeekShort', { week: row.weekNumber })}
                                                </td>
                                                <td className="px-3 py-3 text-slate-700">{row.exerciseName}</td>
                                                <td className="px-3 py-3 text-slate-700">{row.frequency}</td>
                                                <td className="px-3 py-3 text-slate-700">{row.totalLifts}</td>
                                                <td className="px-3 py-3 text-slate-700">
                                                    {row.averageIntensity !== null
                                                        ? `${row.averageIntensity.toFixed(1)}%`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <ProgramMuscleGroupCharts weeks={program.weeks} />

                {!viewOnly && (
                    <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                        {isDraft ? (
                            <Link
                                href={`/trainer/programs/${programId}/edit`}
                                className="flex-1 rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-gray-800 transition-colors hover:bg-gray-400"
                            >
                                {t('reviewProgram.backToEdit')}
                            </Link>
                        ) : (
                            <button
                                type="button"
                                disabled
                                className="flex-1 cursor-not-allowed rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-gray-500"
                            >
                                {t('reviewProgram.backToEdit')}
                            </button>
                        )}
                        <Link
                            href={`/trainer/programs/${programId}/publish`}
                            className={`flex-1 rounded-lg px-6 py-3 text-center font-semibold transition-colors ${isDraft && configuredWorkouts === totalWorkouts
                                ? 'bg-[#FFA700] text-white hover:bg-[#FF9500]'
                                : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                }`}
                            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                                if (!isDraft || configuredWorkouts < totalWorkouts) {
                                    event.preventDefault()
                                }
                            }}
                        >
                            {t('reviewProgram.continueToPublish')}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
