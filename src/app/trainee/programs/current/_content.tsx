'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonDashboard } from '@/components'
import { ArrowLeft, CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import { formatDate } from '@/lib/date-format'

interface Workout {
    id: string
    dayOfWeek: number
    completed: boolean
    exerciseCount: number
    feedbackSubmitted: boolean
    feedbackCount: number
}

interface Week {
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: Workout[]
}

interface ProgramDetailWorkout {
    id: string
    dayIndex: number
    workoutExercises: Array<unknown>
}

interface ProgramDetailWeek {
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: ProgramDetailWorkout[]
}

interface Program {
    id: string
    title: string
    startDate: string
    durationWeeks: number
    trainer: {
        firstName: string
        lastName: string
    }
    weeks: Week[]
}

interface ProgramDetail {
    id: string
    title: string
    startDate: string
    durationWeeks: number
    trainer: {
        firstName: string
        lastName: string
    }
    weeks: ProgramDetailWeek[]
}

interface WorkoutProgress {
    id: string
    completed: boolean
    feedbackCount: number
}

interface ProgramProgress {
    completedWorkouts: number
    totalWorkouts: number
    workouts: WorkoutProgress[]
}

interface SavedSetPerformed {
    completed?: boolean | null
    status?: 'done' | 'not-done' | null
}

interface SavedWorkoutDraft {
    feedbackData?: Record<string, SavedSetPerformed[]>
}

const hasLocalWorkoutProgress = (workoutId: string): boolean => {
    if (typeof window === 'undefined') {
        return false
    }

    try {
        const saved = localStorage.getItem(`workout_${workoutId}_feedback`)
        if (!saved) {
            return false
        }

        const parsed = JSON.parse(saved) as SavedWorkoutDraft
        const allSets = Object.values(parsed.feedbackData || {}).flat()

        return allSets.some((set) => {
            if (set.completed !== undefined && set.completed !== null) {
                return set.completed
            }

            return set.status === 'done'
        })
    } catch {
        return false
    }
}

export default function CurrentProgramContent() {
    const { t } = useTranslation('trainee')
    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<Program | null>(null)
    const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null)
    const [localWorkoutProgress, setLocalWorkoutProgress] = useState<Record<string, boolean>>({})
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchProgram()
    }, [])

    useEffect(() => {
        if (!program) {
            return
        }

        const refreshLocalWorkoutProgress = () => {
            const progressByWorkoutId = Object.fromEntries(
                program.weeks
                    .flatMap((week) => week.workouts)
                    .map((workout) => [workout.id, hasLocalWorkoutProgress(workout.id)])
            )

            setLocalWorkoutProgress(progressByWorkoutId)
        }

        refreshLocalWorkoutProgress()
        window.addEventListener('focus', refreshLocalWorkoutProgress)
        document.addEventListener('visibilitychange', refreshLocalWorkoutProgress)

        return () => {
            window.removeEventListener('focus', refreshLocalWorkoutProgress)
            document.removeEventListener('visibilitychange', refreshLocalWorkoutProgress)
        }
    }, [program])

    const fetchProgram = async () => {
        try {
            setLoading(true)

            const res = await fetch('/api/programs?status=active')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('currentProgram.errorNotFound'), t))
            }

            if (data.data.items.length === 0) {
                throw new Error(t('currentProgram.errorNotFound'))
            }

            const activeProgramId = data.data.items[0].id

            const [programRes, progressRes] = await Promise.all([
                fetch(`/api/programs/${activeProgramId}`),
                fetch(`/api/programs/${activeProgramId}/progress`),
            ])

            const [programData, progressData] = await Promise.all([
                programRes.json(),
                progressRes.json(),
            ])

            if (!programRes.ok) {
                throw new Error(getApiErrorMessage(programData, t('currentProgram.errorNotFound'), t))
            }

            if (!progressRes.ok) {
                throw new Error(getApiErrorMessage(progressData, t('currentProgram.errorNotFound'), t))
            }

            const workoutProgressById = new Map<string, WorkoutProgress>(
                (progressData.data.workouts || []).map((workout: WorkoutProgress) => [workout.id, workout])
            )

            const programDetail = programData.data.program as ProgramDetail
            const mappedProgram: Program = {
                id: programDetail.id,
                title: programDetail.title,
                startDate: programDetail.startDate,
                durationWeeks: programDetail.durationWeeks,
                trainer: programDetail.trainer,
                weeks: programDetail.weeks.map((week) => ({
                    weekNumber: week.weekNumber,
                    weekType: week.weekType,
                    workouts: week.workouts.map((workout) => {
                        const workoutProgress = workoutProgressById.get(workout.id)

                        return {
                            id: workout.id,
                            dayOfWeek: workout.dayIndex,
                            completed: workoutProgress?.completed ?? false,
                            exerciseCount: workout.workoutExercises.length,
                            feedbackSubmitted: (workoutProgress?.feedbackCount ?? 0) > 0,
                            feedbackCount: workoutProgress?.feedbackCount ?? 0,
                        }
                    }),
                })),
            }

            setProgram(mappedProgram)
            setProgramProgress({
                completedWorkouts: progressData.data.completedWorkouts ?? 0,
                totalWorkouts: progressData.data.totalWorkouts ?? 0,
                workouts: progressData.data.workouts ?? [],
            })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('currentProgram.errorNotFound'))
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="py-8">
                <SkeletonDashboard cards={0} showTable={false} />
            </div>
        )
    }

    if (error || !program) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || t('currentProgram.errorNotFound')}
                </div>
            </div>
        )
    }

    const completedWorkouts = programProgress?.completedWorkouts ?? 0
    const totalWorkouts = programProgress?.totalWorkouts ?? 0
    const progressPercent = totalWorkouts > 0
        ? Math.round((completedWorkouts / totalWorkouts) * 100)
        : 0

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/trainee/dashboard"
                    className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('currentProgram.backToDashboard')}
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
                <p className="text-gray-600 mt-2">
                    {t('currentProgram.trainerWith', { firstName: program.trainer.firstName, lastName: program.trainer.lastName })} • {t('currentProgram.startedOn')}{' '}
                    {formatDate(program.startDate)}
                </p>
            </div>

            {/* Progress Card */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-semibold text-gray-700">
                            {t('currentProgram.programProgress')}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                            {t('currentProgram.workoutsCompleted', { completed: completedWorkouts, total: totalWorkouts })}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-[#FFA700]">{progressPercent}%</p>
                        <p className="text-sm text-gray-600">{t('currentProgram.completion')}</p>
                    </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                        className="bg-[#FFA700] h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Weeks List */}
            <div className="space-y-6">
                {program.weeks.map((week) => {
                    const weekCompleted = week.workouts.every((w) => w.completed)
                    const weekInProgress = week.workouts.some(
                        (w) => w.completed && !weekCompleted
                    )

                    return (
                        <div key={week.weekNumber} className="bg-white rounded-lg shadow-md p-6">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
                                    <h3 className="text-xl font-bold text-gray-900">
                                        {t('currentProgram.week', { number: week.weekNumber })}
                                    </h3>
                                    <WeekTypeBadge weekType={week.weekType} />
                                    {weekCompleted && (
                                        <span className="text-green-600 text-sm font-semibold">
                                            {t('currentProgram.completed')}
                                        </span>
                                    )}
                                    {weekInProgress && !weekCompleted && (
                                        <span className="text-[#FFA700] text-sm font-semibold">
                                            {t('currentProgram.inProgress')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 sm:text-right">
                                    {t('currentProgram.weekCompleted', { completed: week.workouts.filter((w) => w.completed).length, total: week.workouts.length })}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {week.workouts.map((workout) => {
                                    const workoutInProgress = !workout.completed
                                        && (workout.feedbackCount > 0 || localWorkoutProgress[workout.id])

                                    const workoutStatus = workout.completed
                                        ? {
                                            icon: CheckCircle2,
                                            iconClassName: 'text-green-600',
                                            badgeClassName: 'bg-green-100 text-green-700',
                                            label: t('currentProgram.completed'),
                                            cardClassName: 'border-green-300 bg-green-50 hover:border-green-400',
                                            helperText: workout.feedbackSubmitted
                                                ? t('currentProgram.feedbackSent')
                                                : t('currentProgram.reviewFeedback'),
                                            helperClassName: workout.feedbackSubmitted
                                                ? 'text-green-600'
                                                : 'text-[#FFA700]',
                                        }
                                        : workoutInProgress
                                            ? {
                                                icon: PlayCircle,
                                                iconClassName: 'text-[#FFA700]',
                                                badgeClassName: 'bg-amber-100 text-amber-700',
                                                label: t('currentProgram.inProgress'),
                                                cardClassName: 'border-amber-300 bg-amber-50 hover:border-amber-400',
                                                helperText: t('currentProgram.resumeWorkout'),
                                                helperClassName: 'text-[#FFA700]',
                                            }
                                            : {
                                                icon: Circle,
                                                iconClassName: 'text-gray-400',
                                                badgeClassName: 'bg-gray-100 text-gray-600',
                                                label: t('currentProgram.toDo'),
                                                cardClassName: 'border-gray-300 bg-white hover:border-[#FFA700]',
                                                helperText: t('currentProgram.startWorkout'),
                                                helperClassName: 'text-[#FFA700]',
                                            }

                                    const StatusIcon = workoutStatus.icon

                                    return (
                                        <Link
                                            key={workout.id}
                                            href={`/trainee/workouts/${workout.id}`}
                                            className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${workoutStatus.cardClassName}`}
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div>
                                                    <p className="font-semibold text-gray-900">
                                                        Giorno {workout.dayOfWeek}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {t('currentProgram.exercises', { count: workout.exerciseCount })}
                                                    </p>
                                                </div>
                                                <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${workoutStatus.badgeClassName}`}>
                                                    <StatusIcon className={`h-4 w-4 ${workoutStatus.iconClassName}`} />
                                                    <span>{workoutStatus.label}</span>
                                                </div>
                                            </div>
                                            <p className={`text-xs font-semibold ${workoutStatus.helperClassName}`}>
                                                {workoutStatus.helperText}
                                            </p>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
