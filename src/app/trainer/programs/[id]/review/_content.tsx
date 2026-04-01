'use client'

import { Fragment, MouseEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ClipboardList, Flame, Wind } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
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
        name: string
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
    trainee: {
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

export default function ReviewProgramContent() {
    const params = useParams()
    const programId = params.id as string
    const { t } = useTranslation('trainer')

    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<ProgramSummary | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchProgram = async () => {
            try {
                setLoading(true)
                const res = await fetch(`/api/programs/${programId}`)
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(getApiErrorMessage(data, t('reviewProgram.errorLoading'), t))
                }

                setProgram(data.data.program)
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

    const getWeekTypeBadge = (weekType: WeekSummary['weekType']) => {
        if (weekType === 'test') {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-week-test bg-week-test px-3 py-1 text-xs font-semibold text-white">
                    <Flame className="h-3.5 w-3.5" />
                    Test
                </span>
            )
        }

        if (weekType === 'deload') {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-week-deload bg-week-deload px-3 py-1 text-xs font-semibold text-white">
                    <Wind className="h-3.5 w-3.5" />
                    Scarico
                </span>
            )
        }

        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-gray-500 bg-gray-500 px-3 py-1 text-xs font-semibold text-white">
                <ClipboardList className="h-3.5 w-3.5" />
                Standard
            </span>
        )
    }

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

    const totalWorkouts = program.durationWeeks * program.workoutsPerWeek
    const configuredWorkouts = program.weeks.reduce(
        (sum, week) => sum + week.workouts.filter((workout) => workout.workoutExercises.length > 0).length,
        0
    )
    const workoutSlots = Array.from({ length: program.workoutsPerWeek }, (_, slotIndex) => ({
        slotNumber: slotIndex + 1,
        rows: program.weeks.flatMap((week) => {
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

                <div className="mb-8">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:text-brand-primary/80"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t('reviewProgram.backToEdit')}
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">{t('reviewProgram.title')}</h1>
                    <p className="mt-2 text-gray-600">
                        {t('reviewProgram.description', {
                            name: `${program.trainee.firstName} ${program.trainee.lastName}`,
                        })}
                    </p>
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
                                            <th className="px-4 py-3">{t('reviewProgram.tableWeekType')}</th>
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
                                                    <td className="px-4 py-3 align-top">
                                                        {getWeekTypeBadge(row.weekType)}
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

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Link
                        href={`/trainer/programs/${programId}/edit`}
                        className="flex-1 rounded-lg bg-gray-300 px-6 py-3 text-center font-semibold text-gray-800 transition-colors hover:bg-gray-400"
                    >
                        {t('reviewProgram.backToEdit')}
                    </Link>
                    <Link
                        href={`/trainer/programs/${programId}/publish`}
                        className={`flex-1 rounded-lg px-6 py-3 text-center font-semibold transition-colors ${configuredWorkouts === totalWorkouts
                            ? 'bg-[#FFA700] text-white hover:bg-[#FF9500]'
                            : 'cursor-not-allowed bg-gray-300 text-gray-500'
                            }`}
                        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                            if (configuredWorkouts < totalWorkouts) {
                                event.preventDefault()
                            }
                        }}
                    >
                        {t('reviewProgram.continueToPublish')}
                    </Link>
                </div>
            </div>
        </div>
    )
}