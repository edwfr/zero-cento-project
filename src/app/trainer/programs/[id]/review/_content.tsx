'use client'

import { Fragment, MouseEvent, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, ChevronUp, FileEdit } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import ProgramMuscleGroupCharts from '@/components/ProgramMuscleGroupCharts'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import { getApiErrorMessage } from '@/lib/api-error'

interface WorkoutExerciseSummary {
    id: string
    variant: string | null
    sets: number
    reps: string
    notes: string | null
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

interface WorkoutSlotRow {
    weekId: string
    weekNumber: number
    weekType: WeekSummary['weekType']
    exercise?: WorkoutExerciseSummary
    isEmpty: boolean
}

interface PersonalRecord {
    exerciseId: string
    reps: number
    weight: number
}

function parseRepsValue(repsValue: string): number {
    const match = repsValue.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

function estimateOneRMValue(weight: number, reps: number): number {
    if (reps <= 1) return weight
    return weight * (1 + reps / 30)
}

interface ReviewProgramContentProps {
    viewOnly?: boolean
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

        fetchProgram()
    }, [programId, t])

    const formatWeight = (exercise: WorkoutExerciseSummary) => {
        if (exercise.weight === null || exercise.weight === undefined) {
            return '-'
        }

        if (exercise.weightType === 'absolute') {
            return `${exercise.weight} kg`
        }

        if (exercise.weightType === 'percentage_1rm') {
            return `${exercise.weight}% 1RM`
        }

        if (exercise.weightType === 'percentage_rm') {
            return `${exercise.weight}% nRM`
        }

        return `${exercise.weight}% prev.`
    }

    const isDraft = program?.status === 'draft'
    const totalWorkouts = program ? program.durationWeeks * program.workoutsPerWeek : 0
    const configuredWorkouts = program?.weeks.reduce(
        (sum, week) => sum + week.workouts.filter((workout) => workout.workoutExercises.length > 0).length,
        0
    ) ?? 0
    const workoutSlots = Array.from({ length: program?.workoutsPerWeek ?? 0 }, (_, slotIndex) => ({
        slotNumber: slotIndex + 1,
        rows: (program?.weeks ?? []).flatMap<WorkoutSlotRow>((week) => {
            const sortedWorkouts = [...week.workouts].sort((left, right) => left.dayIndex - right.dayIndex)
            const workout = sortedWorkouts[slotIndex]

            if (!workout || workout.workoutExercises.length === 0) {
                return [
                    {
                        weekId: week.id,
                        weekNumber: week.weekNumber,
                        weekType: week.weekType,
                        isEmpty: true,
                    },
                ]
            }

            return workout.workoutExercises.map((exercise) => ({
                weekId: week.id,
                weekNumber: week.weekNumber,
                weekType: week.weekType,
                exercise,
                isEmpty: false,
            }))
        }),
    }))
    const shouldShowSbdReporting = program?.isSbdProgram ?? false

    const recordsByExercise = useMemo(() => personalRecords.reduce((acc, record) => {
        const key = record.exerciseId
        if (!acc[key]) {
            acc[key] = []
        }
        acc[key].push(record)
        return acc
    }, {} as Record<string, PersonalRecord[]>), [personalRecords])

    const bestPRs = useMemo(() => Object.values(recordsByExercise).map((records) =>
        records.reduce((best, current) => {
            const currentEstimatedOneRM = estimateOneRMValue(current.weight, current.reps)
            const bestEstimatedOneRM = estimateOneRMValue(best.weight, best.reps)
            return currentEstimatedOneRM > bestEstimatedOneRM ? current : best
        })
    ), [recordsByExercise])

    const estimatedOneRMByExercise = useMemo(() => bestPRs.reduce((acc, record) => {
        acc[record.exerciseId] = estimateOneRMValue(record.weight, record.reps)
        return acc
    }, {} as Record<string, number>), [bestPRs])

    const weekSbdMetrics = useMemo(() => (program?.weeks ?? []).reduce((acc, week) => {
        acc[week.id] = Object.values(
            week.workouts.reduce((weekAcc, workout) => {
                workout.workoutExercises
                    .filter((weekExercise) => weekExercise.exercise.type === 'fundamental' && !weekExercise.isWarmup)
                    .forEach((weekExercise) => {
                        const key = weekExercise.exercise.id
                        const plannedReps = parseRepsValue(weekExercise.reps)
                        const liftCount = weekExercise.sets * plannedReps

                        let intensity: number | null = null
                        if (weekExercise.weightType === 'percentage_1rm' && typeof weekExercise.weight === 'number') {
                            intensity = weekExercise.weight
                        } else if (weekExercise.weightType === 'absolute' && typeof weekExercise.weight === 'number') {
                            const estimatedOneRM = estimatedOneRMByExercise[weekExercise.exercise.id]
                            if (estimatedOneRM) {
                                intensity = (weekExercise.weight / estimatedOneRM) * 100
                            }
                        }

                        if (!weekAcc[key]) {
                            weekAcc[key] = {
                                exerciseId: weekExercise.exercise.id,
                                exerciseName: weekExercise.exercise.name,
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
            }, {} as Record<string, {
                exerciseId: string
                exerciseName: string
                workoutIds: Set<string>
                totalLifts: number
                weightedIntensitySum: number
                intensityLiftCount: number
            }>)
        )
            .map((metric) => ({
                exerciseId: metric.exerciseId,
                exerciseName: metric.exerciseName,
                frequency: metric.workoutIds.size,
                totalLifts: metric.totalLifts,
                averageIntensity: metric.intensityLiftCount > 0
                    ? metric.weightedIntensitySum / metric.intensityLiftCount
                    : null,
            }))
            .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName, 'it', { sensitivity: 'base' }))

        return acc
    }, {} as Record<string, Array<{
        exerciseId: string
        exerciseName: string
        frequency: number
        totalLifts: number
        averageIntensity: number | null
    }>>), [estimatedOneRMByExercise, program?.weeks])

    const sbdSummaryRows = useMemo(() => shouldShowSbdReporting
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
        : [], [program?.weeks, shouldShowSbdReporting, weekSbdMetrics])

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
                    {viewOnly && (
                        isDraft ? (
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
                        )
                    )}
                </div>

                <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
                    <div className="grid gap-6 md:grid-cols-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-600">{t('reviewProgram.summaryProgram')}</p>
                            <p className="mt-1 text-xl font-bold text-gray-900">{program.title}</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-600">{t('reviewProgram.summaryTrainee')}</p>
                            <p className="mt-1 text-xl font-bold text-gray-900">
                                {program.trainee.firstName} {program.trainee.lastName}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-600">{t('reviewProgram.summaryConfigured')}</p>
                            <p className="mt-1 text-xl font-bold text-gray-900">
                                {configuredWorkouts} / {totalWorkouts}
                            </p>
                        </div>
                    </div>
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
                                <h2 className="text-xl font-bold text-gray-900">Recap Reportistica SBD</h2>
                                <p className="mt-2 text-sm text-gray-600">
                                    Vista tabellare di FRQ, NBL e IM su tutte le settimane del programma.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                    {isSbdSummaryCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                </span>
                            </div>
                        </button>

                        {!isSbdSummaryCollapsed && (
                            <div className="mt-4 overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-500">
                                            <th className="px-3 py-3 font-semibold">Settimana</th>
                                            <th className="px-3 py-3 font-semibold">Esercizio</th>
                                            <th className="px-3 py-3 font-semibold">FRQ</th>
                                            <th className="px-3 py-3 font-semibold">NBL</th>
                                            <th className="px-3 py-3 font-semibold">IM</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sbdSummaryRows.map((row) => (
                                            <tr key={`${row.weekId}-${row.exerciseId}`} className="hover:bg-slate-50/70">
                                                <td className="px-3 py-3 font-semibold text-slate-900">Sett. {row.weekNumber}</td>
                                                <td className="px-3 py-3 text-slate-700">{row.exerciseName}</td>
                                                <td className="px-3 py-3 text-slate-700">{row.frequency}</td>
                                                <td className="px-3 py-3 text-slate-700">{row.totalLifts}</td>
                                                <td className="px-3 py-3 text-slate-700">
                                                    {row.averageIntensity !== null ? `${row.averageIntensity.toFixed(1)}%` : '-'}
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

                <div className="space-y-6">
                    {workoutSlots.map((workoutSlot) => (
                        <section key={workoutSlot.slotNumber} className="overflow-hidden rounded-lg bg-white shadow-md">
                            <div className="border-b border-gray-200 bg-white px-6 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {t('reviewProgram.workoutTitle', { number: workoutSlot.slotNumber })}
                                    </h2>
                                    <span className="text-sm font-semibold text-gray-600">
                                        {t('reviewProgram.workoutConfiguredWeeks', {
                                            done: program.weeks.filter((week) => {
                                                const sortedWorkouts = [...week.workouts].sort((left, right) => left.dayIndex - right.dayIndex)
                                                return (sortedWorkouts[workoutSlot.slotNumber - 1]?.workoutExercises.length || 0) > 0
                                            }).length,
                                            total: program.weeks.length,
                                        })}
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                        <tr>
                                            <th className="px-4 py-3">{t('reviewProgram.tableWeek')}</th>
                                            <th className="w-36 px-3 py-3 text-center">{t('reviewProgram.tableWeekType')}</th>
                                            <th className="px-4 py-3">{t('reviewProgram.tableExercise')}</th>
                                            <th className="px-4 py-3">{t('reviewProgram.tableNotes')}</th>
                                            <th className="px-4 py-3">{t('reviewProgram.tableScheme')}</th>
                                            <th className="px-4 py-3">{t('reviewProgram.tableWeight')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white text-gray-800">
                                        {workoutSlot.rows.map((row, index) => (
                                            <Fragment key={`${row.weekId}-${row.exercise?.id || `empty-${index}`}`}>
                                                {index > 0 && workoutSlot.rows[index - 1].weekId !== row.weekId && (
                                                    <tr className="bg-gray-50">
                                                        <td colSpan={6} className="border-t-4 border-gray-200 px-0 py-0">
                                                            <div className="h-3 bg-gray-50" />
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr>
                                                    <td className="px-4 py-3 align-top font-medium text-gray-900">
                                                        {t('reviewProgram.weekShort', { week: row.weekNumber })}
                                                    </td>
                                                    <td className="w-36 px-3 py-3 align-top">
                                                        <WeekTypeBadge weekType={row.weekType} />
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        {row.isEmpty ? (
                                                            <span className="text-sm text-gray-500">
                                                                {t('reviewProgram.noExercises')}
                                                            </span>
                                                        ) : (
                                                            <p className="font-semibold text-gray-900">{row.exercise?.exercise.name}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        {row.isEmpty ? (
                                                            <span className="text-sm text-gray-400">-</span>
                                                        ) : (
                                                            <>
                                                                <p className="whitespace-pre-wrap text-sm text-gray-700">
                                                                    {row.exercise?.variant || '-'}
                                                                </p>
                                                                {row.exercise?.notes && (
                                                                    <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">
                                                                        {row.exercise.notes}
                                                                    </p>
                                                                )}
                                                                {row.exercise?.isWarmup && !row.exercise.notes && !row.exercise.variant && (
                                                                    <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">
                                                                        {t('reviewProgram.warmupOnly')}
                                                                    </p>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 align-top font-medium text-gray-900">
                                                        {row.isEmpty ? '-' : `${row.exercise?.sets} x ${row.exercise?.reps}`}
                                                    </td>
                                                    <td className="px-4 py-3 align-top font-medium text-gray-900">
                                                        {row.isEmpty || !row.exercise ? '-' : formatWeight(row.exercise)}
                                                    </td>
                                                </tr>
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    ))}
                </div>

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