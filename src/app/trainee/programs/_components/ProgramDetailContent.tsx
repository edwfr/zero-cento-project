'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonDashboard } from '@/components'
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock3,
    Circle,
    Gauge,
    PlayCircle,
} from 'lucide-react'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import { formatDate } from '@/lib/date-format'
import ProgramPdfExportButton from '@/components/ProgramPdfExportButton'
import {
    ProgramPdfData,
    ProgramPdfLabels,
} from '@/lib/program-pdf-export'

type WeekType = 'normal' | 'test' | 'deload'
type WeightType = 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
type RestTime = 's30' | 'm1' | 'm2' | 'm3' | 'm5'
type ProgramContentMode = 'current' | 'history'

interface ProgramDetailContentProps {
    mode?: ProgramContentMode
    programId?: string
}

interface WorkoutExercise {
    id: string
    variant: string | null
    sets: number
    reps: string
    targetRpe: number | null
    weightType: WeightType
    weight: number | null
    effectiveWeight: number | null
    restTime: RestTime
    isWarmup: boolean
    isSkeletonExercise: boolean
    notes: string | null
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

interface PerformedSet {
    setNumber: number
    reps: number
    weight: number
}

interface ExercisePerformed {
    workoutExerciseId: string
    performedSets: PerformedSet[]
}

interface Workout {
    id: string
    dayOfWeek: number
    completed: boolean
    exerciseCount: number
    feedbackSubmitted: boolean
    feedbackCount: number
    exercises: WorkoutExercise[]
    exercisesPerformed: ExercisePerformed[]
}

interface Week {
    weekNumber: number
    weekType: WeekType
    workouts: Workout[]
}

interface ProgramDetailWorkout {
    id: string
    dayIndex: number
    workoutExercises: WorkoutExercise[]
}

interface ProgramDetailWeek {
    weekNumber: number
    weekType: WeekType
    workouts: ProgramDetailWorkout[]
}

interface Program {
    id: string
    title: string
    startDate: string
    durationWeeks: number
    trainee?: {
        firstName: string
        lastName: string
    }
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
    trainee?: {
        firstName: string
        lastName: string
    }
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
    exercisesPerformed?: ExercisePerformed[]
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

interface WorkoutStatus {
    icon: typeof CheckCircle2
    iconClassName: string
    badgeClassName: string
    label: string
    helperText: string
    buttonClassName: string
}

const REST_TIME_LABELS: Record<RestTime, string> = {
    s30: '0:30',
    m1: '1:00',
    m2: '2:00',
    m3: '3:00',
    m5: '5:00',
}

const formatWeightValue = (value: number): string => {
    if (!Number.isFinite(value)) {
        return '-'
    }

    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const formatWeightKg = (value: number | null | undefined, fallback: string): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback
    }

    return `${formatWeightValue(value)} kg`
}

const formatAssignedWeight = (
    weightType: WeightType,
    weight: number | null,
    previousExerciseLabel: string,
    fallback: string
): string => {
    if (typeof weight !== 'number' || !Number.isFinite(weight)) {
        return fallback
    }

    const formattedWeight = formatWeightValue(weight)

    if (weightType === 'absolute') {
        return `${formattedWeight} kg`
    }

    if (weightType === 'percentage_1rm') {
        return `${formattedWeight}% 1RM`
    }

    if (weightType === 'percentage_rm') {
        return `${formattedWeight}% RM`
    }

    const sign = weight > 0 ? '+' : ''
    return `${sign}${formattedWeight}% ${previousExerciseLabel}`
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

export default function ProgramDetailContent({
    mode = 'current',
    programId,
}: ProgramDetailContentProps) {
    const { t, i18n } = useTranslation('trainee')
    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<Program | null>(null)
    const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null)
    const [localWorkoutProgress, setLocalWorkoutProgress] = useState<Record<string, boolean>>({})
    const [error, setError] = useState<string | null>(null)
    const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({})
    const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({})
    const isHistoryMode = mode === 'history'

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

    useEffect(() => {
        if (!program || program.weeks.length === 0) {
            return
        }

        const firstIncompleteWeek = program.weeks.find(
            (week) => !week.workouts.every((workout) => workout.completed)
        )

        const defaultWeekNumber =
            firstIncompleteWeek?.weekNumber ?? program.weeks[0].weekNumber

        setExpandedWeeks(
            Object.fromEntries(
                program.weeks.map((week) => [
                    week.weekNumber,
                    week.weekNumber === defaultWeekNumber,
                ])
            ) as Record<number, boolean>
        )

        setExpandedWorkouts(
            Object.fromEntries(
                program.weeks.flatMap((week) =>
                    week.workouts.map((workout) => [
                        workout.id,
                        week.weekNumber === defaultWeekNumber,
                    ])
                )
            ) as Record<string, boolean>
        )
    }, [program])

    const dayNames = useMemo(() => {
        const value = t('currentProgram.dayNames', { returnObjects: true })
        return Array.isArray(value) ? value : []
    }, [t])

    const pdfLabels = useMemo<ProgramPdfLabels>(
        () => ({
            trainerLabel: t('currentProgram.pdfTrainerLabel'),
            startDateLabel: t('currentProgram.pdfStartDateLabel'),
            generatedAtLabel: t('currentProgram.pdfGeneratedAtLabel'),
            weekLabel: (week: number) => t('currentProgram.week', { number: week }),
            weekTypeLabel: (weekType: WeekType) => {
                if (weekType === 'test') {
                    return t('currentProgram.weekTypeTest')
                }

                if (weekType === 'deload') {
                    return t('currentProgram.weekTypeDeload')
                }

                return t('currentProgram.weekTypeStandard')
            },
            workoutLabel: (dayIndex: number) =>
                t('currentProgram.day', {
                    number: dayIndex,
                }),
            tableExercise: t('currentProgram.tableExercise'),
            tableVariant: t('currentProgram.tableVariant'),
            tableScheme: t('currentProgram.tableScheme'),
            tableWeight: t('currentProgram.tableWeight'),
            tableRest: t('currentProgram.tableRest'),
            tableRpe: t('currentProgram.tableRpe'),
            tableNoExercises: t('currentProgram.tableNoExercises'),
            tableWeightAssigned: (weight: string) =>
                t('currentProgram.tableWeightAssigned', { weight }),
            tableWeightEffective: (weight: string) =>
                t('currentProgram.tableWeightEffective', { weight }),
            warmupYesShort: t('currentProgram.warmupYesShort'),
            warmupNoShort: t('currentProgram.warmupNoShort'),
            fundamentalShort: t('currentProgram.fundamentalShort'),
            accessoryShort: t('currentProgram.accessoryShort'),
            previousExerciseShort: t('workouts.previousExerciseShort'),
            missingValue: t('currentProgram.tableMissingValue'),
        }),
        [t]
    )

    const pdfProgramData = useMemo<ProgramPdfData | null>(() => {
        if (!program) {
            return null
        }

        return {
            title: program.title,
            traineeName: program.trainee
                ? `${program.trainee.firstName} ${program.trainee.lastName}`
                : t('currentProgram.pdfUnknownTrainee'),
            trainerName: `${program.trainer.firstName} ${program.trainer.lastName}`,
            startDate: program.startDate,
            weeks: program.weeks.map((week) => ({
                weekNumber: week.weekNumber,
                weekType: week.weekType,
                workouts: week.workouts.map((workout) => ({
                    id: workout.id,
                    dayIndex: workout.dayOfWeek,
                    exercises: workout.exercises.map((exercise) => ({
                        id: exercise.id,
                        name: exercise.exercise.name,
                        variant: exercise.variant,
                        type: exercise.exercise.type,
                        isWarmup: exercise.isWarmup,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        targetRpe: exercise.targetRpe,
                        weightType: exercise.weightType,
                        weight: exercise.weight,
                        effectiveWeight: exercise.effectiveWeight,
                        restTime: exercise.restTime,
                    })),
                })),
            })),
        }
    }, [program, t])

    const toggleWeek = (weekNumber: number) => {
        setExpandedWeeks((previous) => ({
            ...previous,
            [weekNumber]: !previous[weekNumber],
        }))
    }

    const toggleWorkout = (workoutId: string) => {
        setExpandedWorkouts((previous) => ({
            ...previous,
            [workoutId]: !previous[workoutId],
        }))
    }

    const getWorkoutDayLabel = (dayIndex: number): string => {
        const dayName = dayNames[dayIndex - 1]

        if (typeof dayName === 'string' && dayName.length > 0) {
            return dayName
        }

        return t('currentProgram.day', { number: dayIndex })
    }

    const getWorkoutStatus = (workout: Workout): WorkoutStatus => {
        const workoutInProgress =
            !workout.completed &&
            (workout.feedbackCount > 0 || localWorkoutProgress[workout.id])

        if (workout.completed) {
            return {
                icon: CheckCircle2,
                iconClassName: 'text-green-600',
                badgeClassName: 'bg-green-100 text-green-700',
                label: t('currentProgram.completed'),
                helperText: workout.feedbackSubmitted
                    ? t('currentProgram.feedbackSent')
                    : t('currentProgram.reviewFeedback'),
                buttonClassName:
                    'border-green-300 bg-green-50 text-green-700 hover:border-green-400',
            }
        }

        if (workoutInProgress) {
            return {
                icon: PlayCircle,
                iconClassName: 'text-brand-primary',
                badgeClassName: 'bg-amber-100 text-amber-700',
                label: t('currentProgram.inProgress'),
                helperText: t('currentProgram.resumeWorkout'),
                buttonClassName:
                    'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400',
            }
        }

        return {
            icon: Circle,
            iconClassName: 'text-gray-400',
            badgeClassName: 'bg-gray-100 text-gray-600',
            label: t('currentProgram.toDo'),
            helperText: t('currentProgram.startWorkout'),
            buttonClassName:
                'border-brand-primary bg-white text-brand-primary hover:bg-[#FFF7E5]',
        }
    }

    const resolveWeightLabels = (exercise: WorkoutExercise) => {
        const fallback = t('currentProgram.tableMissingValue')
        const assigned = formatAssignedWeight(
            exercise.weightType,
            exercise.weight,
            t('workouts.previousExerciseShort'),
            fallback
        )

        const resolvedEffectiveWeight =
            exercise.weightType === 'absolute'
                ? exercise.effectiveWeight ?? exercise.weight
                : exercise.effectiveWeight

        const effective = formatWeightKg(resolvedEffectiveWeight, fallback)

        return {
            assigned,
            effective,
        }
    }

    const formatRestTime = (restTime: RestTime): string => {
        return REST_TIME_LABELS[restTime] ?? t('currentProgram.tableMissingValue')
    }

    const getDisplayScheme = (workout: Workout, exercise: WorkoutExercise): string => {
        if (workout.completed) {
            const performed = workout.exercisesPerformed.find(
                (entry) => entry.workoutExerciseId === exercise.id
            )

            if (performed && performed.performedSets.length > 0) {
                const repsList = performed.performedSets.map((set) => set.reps)
                const allEqual = repsList.every((reps) => reps === repsList[0])
                const repsLabel = allEqual ? String(repsList[0]) : repsList.join(', ')
                return `${performed.performedSets.length} x ${repsLabel}`
            }
        }

        return `${exercise.sets} x ${exercise.reps}`
    }

    const fetchProgram = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            let targetProgramId = programId

            if (!targetProgramId) {
                const activeProgramRes = await fetch('/api/programs?status=active&limit=1')
                const activeProgramData = await activeProgramRes.json()

                if (!activeProgramRes.ok) {
                    throw new Error(
                        getApiErrorMessage(activeProgramData, t('currentProgram.errorNotFound'), t)
                    )
                }

                if ((activeProgramData.data.items?.length ?? 0) === 0) {
                    throw new Error(t('currentProgram.errorNotFound'))
                }

                targetProgramId = activeProgramData.data.items[0].id as string
            }

            const [programRes, progressRes] = await Promise.all([
                fetch(`/api/programs/${targetProgramId}`),
                fetch(`/api/programs/${targetProgramId}/progress`),
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
                trainee: programDetail.trainee,
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
                            exercises: workout.workoutExercises,
                            exercisesPerformed: workoutProgress?.exercisesPerformed ?? [],
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
    }, [programId, t])

    useEffect(() => {
        void fetchProgram()
    }, [fetchProgram])

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

    const locale = i18n.language === 'en' ? 'en-US' : 'it-IT'

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
                        <p className="text-gray-600 mt-2">
                            {t('currentProgram.trainerWith', {
                                firstName: program.trainer.firstName,
                                lastName: program.trainer.lastName,
                            })}{' '}
                            - {t('currentProgram.startedOn')} {formatDate(program.startDate)}
                        </p>
                    </div>

                    <ProgramPdfExportButton
                        program={pdfProgramData}
                        labels={pdfLabels}
                        buttonLabel={t('currentProgram.exportPdf')}
                        loadingLabel={t('currentProgram.exportingPdf')}
                        errorLabel={t('currentProgram.exportPdfError')}
                        fileNamePrefix={t('currentProgram.pdfFileNamePrefix')}
                        locale={locale}
                        className="md:self-start"
                    />
                </div>
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
                        <p className="text-3xl font-bold text-brand-primary">{progressPercent}%</p>
                        <p className="text-sm text-gray-600">{t('currentProgram.completion')}</p>
                    </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                        className="bg-brand-primary h-3 rounded-full transition-all duration-500"
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
                                    <h3 className="text-xl font-bold text-gray-900 min-w-0">
                                        {t('currentProgram.week', { number: week.weekNumber })}
                                    </h3>
                                    <WeekTypeBadge
                                        weekType={week.weekType}
                                        labels={{
                                            normal: t('currentProgram.weekTypeStandard'),
                                            test: t('currentProgram.weekTypeTest'),
                                            deload: t('currentProgram.weekTypeDeload'),
                                        }}
                                    />
                                    {weekCompleted && (
                                        <span className="text-green-600 text-sm font-semibold">
                                            {t('currentProgram.completed')}
                                        </span>
                                    )}
                                    {weekInProgress && !weekCompleted && (
                                        <span className="text-brand-primary text-sm font-semibold">
                                            {t('currentProgram.inProgress')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 sm:text-right">
                                    {t('currentProgram.weekCompleted', { completed: week.workouts.filter((w) => w.completed).length, total: week.workouts.length })}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => toggleWeek(week.weekNumber)}
                                    aria-expanded={expandedWeeks[week.weekNumber] ?? false}
                                    className="inline-flex items-center gap-1 self-start rounded-lg border border-brand-primary bg-white px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-[#FFF7E5]"
                                >
                                    {expandedWeeks[week.weekNumber]
                                        ? t('currentProgram.closeWeek')
                                        : t('currentProgram.openWeek')}
                                    {expandedWeeks[week.weekNumber]
                                        ? <ChevronUp className="h-4 w-4" />
                                        : <ChevronDown className="h-4 w-4" />}
                                </button>
                            </div>

                            {(expandedWeeks[week.weekNumber] ?? false) && (
                                <div className="space-y-4">
                                    {week.workouts
                                        .slice()
                                        .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
                                        .map((workout) => {
                                            const workoutStatus = getWorkoutStatus(workout)
                                            const StatusIcon = workoutStatus.icon

                                            return (
                                                <div
                                                    key={workout.id}
                                                    className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                                                >
                                                    <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h4 className="text-base font-bold text-gray-900">
                                                                    {getWorkoutDayLabel(workout.dayOfWeek)}
                                                                </h4>
                                                                <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${workoutStatus.badgeClassName}`}>
                                                                    <StatusIcon className={`h-4 w-4 ${workoutStatus.iconClassName}`} />
                                                                    <span>{workoutStatus.label}</span>
                                                                </div>
                                                            </div>

                                                            <p className="mt-1 text-sm text-gray-600">
                                                                {t('currentProgram.exercises', {
                                                                    count: workout.exerciseCount,
                                                                })}
                                                            </p>
                                                        </div>

                                                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                                                            {workout.completed ? (
                                                                <span
                                                                    className={`inline-flex cursor-default items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold ${workoutStatus.buttonClassName}`}
                                                                >
                                                                    {workoutStatus.helperText}
                                                                </span>
                                                            ) : (
                                                                <Link
                                                                    href={`/trainee/workouts/${workout.id}?programId=${encodeURIComponent(program.id)}&from=${mode}`}
                                                                    className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${workoutStatus.buttonClassName}`}
                                                                >
                                                                    {workoutStatus.helperText}
                                                                </Link>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => toggleWorkout(workout.id)}
                                                                aria-expanded={expandedWorkouts[workout.id] ?? false}
                                                                className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-800"
                                                            >
                                                                {(expandedWorkouts[workout.id] ?? false)
                                                                    ? t('currentProgram.closeWorkoutDetails')
                                                                    : t('currentProgram.openWorkoutDetails')}
                                                                {(expandedWorkouts[workout.id] ?? false)
                                                                    ? <ChevronUp className="h-4 w-4" />
                                                                    : <ChevronDown className="h-4 w-4" />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {(expandedWorkouts[workout.id] ?? false) && (
                                                        <div className="p-4">
                                                            {workout.exercises.length === 0 ? (
                                                                <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                                                                    {t('currentProgram.tableNoExercises')}
                                                                </p>
                                                            ) : (
                                                                <>
                                                                    <div className="space-y-3 md:hidden">
                                                                        {workout.exercises.map((exercise) => {
                                                                            const weightLabels = resolveWeightLabels(exercise)

                                                                            return (
                                                                                <article
                                                                                    key={exercise.id}
                                                                                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                                                                                >
                                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                                        <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${exercise.exercise.type === 'fundamental'
                                                                                            ? 'border-red-300 bg-white text-red-700'
                                                                                            : 'border-blue-300 bg-white text-blue-700'
                                                                                            }`}>
                                                                                            {exercise.exercise.type === 'fundamental'
                                                                                                ? t('currentProgram.fundamentalShort')
                                                                                                : t('currentProgram.accessoryShort')}
                                                                                        </span>

                                                                                        {exercise.isWarmup && (
                                                                                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                                                                {t('currentProgram.warmupShort')}
                                                                                            </span>
                                                                                        )}

                                                                                        <h5 className="font-semibold text-gray-900">
                                                                                            {exercise.exercise.name}
                                                                                        </h5>
                                                                                    </div>

                                                                                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                                                                                        <div className="inline-flex min-w-0 items-center rounded-lg bg-gray-100 px-3 py-1.5">
                                                                                            <span className="text-base font-bold text-gray-900">
                                                                                                {getDisplayScheme(workout, exercise)}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="inline-flex min-w-0 items-center rounded-lg bg-gray-100 px-3 py-1.5">
                                                                                            <span className="text-base font-bold text-gray-900">
                                                                                                {weightLabels.effective}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex flex-col gap-1">
                                                                                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                                                                <Clock3 className="h-3.5 w-3.5" />
                                                                                                {formatRestTime(exercise.restTime)}
                                                                                            </span>
                                                                                            {exercise.targetRpe !== null && exercise.targetRpe !== undefined && (
                                                                                                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                                                                                                    <Gauge className="h-3.5 w-3.5" />
                                                                                                    {exercise.targetRpe}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    {exercise.notes && (
                                                                                        <div className="mt-2 space-y-1 text-xs text-gray-700">
                                                                                            <p className="italic text-gray-600">
                                                                                                {exercise.notes}
                                                                                            </p>
                                                                                        </div>
                                                                                    )}
                                                                                </article>
                                                                            )
                                                                        })}
                                                                    </div>

                                                                    <div className="hidden overflow-x-auto md:block">
                                                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                                            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                                                <tr>
                                                                                    <th className="px-3 py-3">
                                                                                        {t('currentProgram.tableExercise')}
                                                                                    </th>
                                                                                    <th className="px-3 py-3">
                                                                                        {t('currentProgram.tableScheme')}
                                                                                    </th>
                                                                                    <th className="px-3 py-3">
                                                                                        {t('currentProgram.tableWeight')}
                                                                                    </th>
                                                                                    <th className="px-3 py-3">
                                                                                        {t('currentProgram.tableRest')}
                                                                                    </th>
                                                                                    <th className="px-3 py-3">
                                                                                        {t('currentProgram.tableRpe')}
                                                                                    </th>
                                                                                    <th className="px-3 py-3">
                                                                                        {t('currentProgram.tableNotes')}
                                                                                    </th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                                                {workout.exercises.map((exercise) => {
                                                                                    const weightLabels = resolveWeightLabels(exercise)

                                                                                    return (
                                                                                        <tr key={exercise.id}>
                                                                                            <td className="px-3 py-3 align-top">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${exercise.exercise.type === 'fundamental'
                                                                                                        ? 'bg-red-100 text-red-700'
                                                                                                        : 'bg-blue-100 text-blue-700'
                                                                                                        }`}>
                                                                                                        {exercise.exercise.type === 'fundamental'
                                                                                                            ? t('currentProgram.fundamentalShort')
                                                                                                            : t('currentProgram.accessoryShort')}
                                                                                                    </span>

                                                                                                    <span className="font-medium text-gray-900">
                                                                                                        {exercise.exercise.name}
                                                                                                    </span>

                                                                                                    {exercise.isWarmup && (
                                                                                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                                                                            {t('currentProgram.warmupShort')}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {exercise.variant && (
                                                                                                    <p className="mt-1 text-xs text-gray-500">
                                                                                                        {exercise.variant}
                                                                                                    </p>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-3 py-3 align-top text-gray-700">
                                                                                                {getDisplayScheme(workout, exercise)}
                                                                                            </td>
                                                                                            <td className="px-3 py-3 align-top text-gray-700">
                                                                                                <p className="text-xs font-semibold text-emerald-700">
                                                                                                    {t('currentProgram.tableWeightEffective', {
                                                                                                        weight: weightLabels.effective,
                                                                                                    })}
                                                                                                </p>
                                                                                                <p className="text-xs text-gray-500">
                                                                                                    {t('currentProgram.tableWeightAssigned', {
                                                                                                        weight: weightLabels.assigned,
                                                                                                    })}
                                                                                                </p>
                                                                                            </td>
                                                                                            <td className="px-3 py-3 align-top text-gray-700">
                                                                                                {formatRestTime(exercise.restTime)}
                                                                                            </td>
                                                                                            <td className="px-3 py-3 align-top text-gray-700">
                                                                                                {exercise.targetRpe ?? t('currentProgram.tableMissingValue')}
                                                                                            </td>
                                                                                            <td className="px-3 py-3 align-top text-xs italic text-gray-600">
                                                                                                {exercise.notes || t('currentProgram.tableMissingValue')}
                                                                                            </td>
                                                                                        </tr>
                                                                                    )
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

