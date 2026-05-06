'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { RestTime, WeekType } from '@prisma/client'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonDashboard } from '@/components'
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Circle,
    PlayCircle,
} from 'lucide-react'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import WorkoutExerciseDisplayList, { type ExerciseDisplayItem } from '@/components/WorkoutExerciseDisplayList'
import { formatDate } from '@/lib/date-format'
import ProgramPdfExportButton from '@/components/ProgramPdfExportButton'
import {
    ProgramPdfData,
    ProgramPdfLabels,
} from '@/lib/program-pdf-export'
import type { TraineeProgramView } from '@/lib/trainee-program-data'

type WeightType = 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
type ProgramContentMode = 'current' | 'history'

interface ProgramDetailContentProps {
    mode?: ProgramContentMode
    programId?: string
    initialData?: TraineeProgramView
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
    traineeNote: string | null
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

const mapTraineeProgramViewToProgram = (view: TraineeProgramView): Program => {
    const workoutProgressById = new Map<string, WorkoutProgress>(
        (view.progress.workouts || []).map((workout) => [workout.id, workout])
    )

    const startDate = view.program.startDate
        ? typeof view.program.startDate === 'string'
            ? view.program.startDate
            : view.program.startDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

    return {
        id: view.program.id,
        title: view.program.title,
        startDate,
        durationWeeks: view.program.durationWeeks,
        trainee: view.program.trainee,
        trainer: view.program.trainer,
        weeks: view.program.weeks.map((week) => ({
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
                    exercisesPerformed: workoutProgress?.exercisesPerformed?.map((ep: {
                        workoutExerciseId: string
                        performedSets: Array<{ setNumber: number; reps: number; weight: number }>
                        traineeNote?: string | null
                    }) => ({
                        workoutExerciseId: ep.workoutExerciseId,
                        performedSets: ep.performedSets,
                        traineeNote: ep.traineeNote ?? null,
                    })) ?? [],
                }
            }),
        })),
    }
}

const mapProgramDetailToProgramInterface = (programDetail: ProgramDetail): Program => {
    // This is for API response mapping, where workoutProgress is in the data
    return {
        id: programDetail.id,
        title: programDetail.title,
        startDate: programDetail.startDate,
        durationWeeks: programDetail.durationWeeks,
        trainee: programDetail.trainee,
        trainer: programDetail.trainer,
        weeks: programDetail.weeks.map((week) => ({
            weekNumber: week.weekNumber,
            weekType: week.weekType,
            workouts: week.workouts.map((workout) => ({
                id: workout.id,
                dayOfWeek: workout.dayIndex,
                completed: false, // This will be set from progress query
                exerciseCount: workout.workoutExercises.length,
                feedbackSubmitted: false, // This will be set from progress query
                feedbackCount: 0, // This will be set from progress query
                exercises: workout.workoutExercises,
                exercisesPerformed: [],
            })),
        })),
    }
}

export default function ProgramDetailContent({
    mode = 'current',
    programId,
    initialData,
}: ProgramDetailContentProps) {
    const { t, i18n } = useTranslation('trainee')
    const [localWorkoutProgress, setLocalWorkoutProgress] = useState<Record<string, boolean>>({})
    const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({})
    const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({})

    // Initialize program and progress from initialData if available
    const initialProgram = useMemo(() => {
        return initialData ? mapTraineeProgramViewToProgram(initialData) : null
    }, [initialData])

    const initialProgress = useMemo(() => {
        return initialData
            ? {
                  completedWorkouts: initialData.progress.completedWorkouts,
                  totalWorkouts: initialData.progress.totalWorkouts,
                  workouts: initialData.progress.workouts,
              }
            : null
    }, [initialData])

    // Query for program details
    const {
        data: programData,
        isLoading: programLoading,
        error: programError,
    } = useQuery({
        queryKey: ['program', programId],
        queryFn: async () => {
            if (!programId) return null
            const res = await fetch(`/api/programs/${programId}`)
            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(
                    getApiErrorMessage(errorData, t('currentProgram.errorNotFound'), t)
                )
            }
            const data = await res.json()
            return mapProgramDetailToProgramInterface(data.data.program)
        },
        initialData: initialProgram,
        staleTime: 60_000,
        refetchOnWindowFocus: true,
        enabled: !!programId,
    })

    // Query for program progress
    const {
        data: progressData,
        isLoading: progressLoading,
        error: progressError,
    } = useQuery({
        queryKey: ['programProgress', programId],
        queryFn: async () => {
            if (!programId) return null
            const res = await fetch(`/api/programs/${programId}/progress`)
            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(
                    getApiErrorMessage(errorData, t('currentProgram.errorNotFound'), t)
                )
            }
            const data = await res.json()
            return {
                completedWorkouts: data.data.completedWorkouts ?? 0,
                totalWorkouts: data.data.totalWorkouts ?? 0,
                workouts: data.data.workouts ?? [],
            } as ProgramProgress
        },
        initialData: initialProgress,
        staleTime: 60_000,
        refetchOnWindowFocus: true,
        enabled: !!programId,
    })

    const program = programData
    const programProgress = progressData
    const loading = programLoading || progressLoading
    const error = programError?.message || progressError?.message || null
    const isHistoryMode = mode === 'history'

    // Merge program and progress data when both are available
    const mergedProgram = useMemo(() => {
        if (!program || !progressData) {
            return program
        }

        const workoutProgressById = new Map<string, WorkoutProgress>(
            (progressData.workouts || []).map((workout: WorkoutProgress) => [workout.id, workout])
        )

        return {
            ...program,
            weeks: program.weeks.map((week) => ({
                ...week,
                workouts: week.workouts.map((workout) => {
                    const workoutProgress = workoutProgressById.get(workout.id)
                    return {
                        ...workout,
                        completed: workoutProgress?.completed ?? false,
                        feedbackSubmitted: (workoutProgress?.feedbackCount ?? 0) > 0,
                        feedbackCount: workoutProgress?.feedbackCount ?? 0,
                        exercisesPerformed: workoutProgress?.exercisesPerformed?.map((ep: {
                            workoutExerciseId: string
                            performedSets: Array<{ setNumber: number; reps: number; weight: number }>
                            traineeNote?: string | null
                        }) => ({
                            workoutExerciseId: ep.workoutExerciseId,
                            performedSets: ep.performedSets,
                            traineeNote: ep.traineeNote ?? null,
                        })) ?? workout.exercisesPerformed,
                    }
                }),
            })),
        }
    }, [program, progressData])

    useEffect(() => {
        if (!mergedProgram) {
            return
        }

        const refreshLocalWorkoutProgress = () => {
            const progressByWorkoutId = Object.fromEntries(
                mergedProgram.weeks
                    .flatMap((week) => week.workouts)
                    .map((workout) => [workout.id, hasLocalWorkoutProgress(workout.id)])
            )

            setLocalWorkoutProgress(progressByWorkoutId)
        }

        refreshLocalWorkoutProgress()
        document.addEventListener('visibilitychange', refreshLocalWorkoutProgress)

        return () => {
            document.removeEventListener('visibilitychange', refreshLocalWorkoutProgress)
        }
    }, [mergedProgram])

    // Compute default expand state based on program completion
    const defaultExpandState = useMemo(() => {
        if (!mergedProgram || mergedProgram.weeks.length === 0) {
            return { weeks: {}, workouts: {} }
        }

        const firstIncompleteWeek = mergedProgram.weeks.find(
            (week) => !week.workouts.every((workout) => workout.completed)
        )

        const defaultWeekNumber =
            firstIncompleteWeek?.weekNumber ?? mergedProgram.weeks[0].weekNumber

        const weeks = Object.fromEntries(
            mergedProgram.weeks.map((week) => [
                week.weekNumber,
                week.weekNumber === defaultWeekNumber,
            ])
        ) as Record<number, boolean>

        const workouts = Object.fromEntries(
            mergedProgram.weeks.flatMap((week) =>
                week.workouts.map((workout) => [
                    workout.id,
                    week.weekNumber === defaultWeekNumber,
                ])
            )
        ) as Record<string, boolean>

        return { weeks, workouts }
    }, [mergedProgram])

    // Initialize expand state with defaults when program loads
    useEffect(() => {
        if (!mergedProgram) {
            return
        }
        setExpandedWeeks(defaultExpandState.weeks)
        setExpandedWorkouts(defaultExpandState.workouts)
    }, [mergedProgram, defaultExpandState.weeks, defaultExpandState.workouts])

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
                const labels: Record<WeekType, string> = {
                    tecnica: t('currentProgram.weekTypeTecnica'),
                    ipertrofia: t('currentProgram.weekTypeIpertrofia'),
                    volume: t('currentProgram.weekTypeVolume'),
                    forza_generale: t('currentProgram.weekTypeForzaGenerale'),
                    intensificazione: t('currentProgram.weekTypeIntensificazione'),
                    picco: t('currentProgram.weekTypePicco'),
                    test: t('currentProgram.weekTypeTest'),
                    deload: t('currentProgram.weekTypeDeload'),
                }
                return labels[weekType]
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
        if (!mergedProgram) {
            return null
        }

        return {
            title: mergedProgram.title,
            traineeName: mergedProgram.trainee
                ? `${mergedProgram.trainee.firstName} ${mergedProgram.trainee.lastName}`
                : t('currentProgram.pdfUnknownTrainee'),
            trainerName: `${mergedProgram.trainer.firstName} ${mergedProgram.trainer.lastName}`,
            startDate: mergedProgram.startDate,
            weeks: mergedProgram.weeks.map((week) => ({
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
    }, [mergedProgram, t])

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

    const buildExerciseDisplayItems = (workout: Workout): ExerciseDisplayItem[] => {
        return workout.exercises.map((exercise) => {
            const performed = workout.exercisesPerformed.find(
                (ep) => ep.workoutExerciseId === exercise.id
            )
            const completedSets = performed?.performedSets.map((s) => ({
                setNumber: s.setNumber,
                reps: s.reps,
                weight: s.weight,
                completed: true,
            })) ?? []

            return {
                id: exercise.id,
                exerciseName: exercise.exercise.name,
                variant: exercise.variant,
                isWarmup: exercise.isWarmup,
                scheme: `${exercise.sets} x ${exercise.reps}`,
                performedSets: completedSets,
                trainerNote: exercise.notes,
                traineeNote: performed?.traineeNote ?? null,
            }
        })
    }

    if (loading) {
        return (
            <div className="py-8">
                <SkeletonDashboard cards={0} showTable={false} />
            </div>
        )
    }

    if (error || !mergedProgram) {
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
                        <h1 className="text-3xl font-bold text-gray-900">{mergedProgram.title}</h1>
                        <p className="text-gray-600 mt-2">
                            {t('currentProgram.trainerWith', {
                                firstName: mergedProgram.trainer.firstName,
                                lastName: mergedProgram.trainer.lastName,
                            })}{' '}
                            - {t('currentProgram.startedOn')} {formatDate(mergedProgram.startDate)}
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
                {mergedProgram.weeks.map((week) => {
                    const weekCompleted = week.workouts.every((w) => w.completed)
                    const weekInProgress = !weekCompleted && week.workouts.some(
                        (w) => w.completed || localWorkoutProgress[w.id]
                    )
                    const WeekStatusIcon = weekCompleted ? CheckCircle2 : weekInProgress ? PlayCircle : Circle
                    const weekBadgeClass = weekCompleted
                        ? 'bg-green-100 text-green-700'
                        : weekInProgress
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    const weekIconClass = weekCompleted
                        ? 'text-green-600'
                        : weekInProgress
                        ? 'text-brand-primary'
                        : 'text-gray-400'
                    const weekStatusLabel = weekCompleted
                        ? t('currentProgram.completed')
                        : weekInProgress
                        ? t('currentProgram.inProgress')
                        : t('currentProgram.toDo')

                    return (
                        <div key={week.weekNumber} className="bg-white rounded-lg shadow-md p-6">
                            <div className="mb-4 flex items-start justify-between">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-4">
                                    <h3 className="text-xl font-bold text-gray-900 min-w-0">
                                        {t('currentProgram.week', { number: week.weekNumber })}
                                    </h3>
                                    <WeekTypeBadge
                                        weekType={week.weekType}
                                        labels={{
                                            tecnica: t('currentProgram.weekTypeTecnica'),
                                            ipertrofia: t('currentProgram.weekTypeIpertrofia'),
                                            volume: t('currentProgram.weekTypeVolume'),
                                            forza_generale: t('currentProgram.weekTypeForzaGenerale'),
                                            intensificazione: t('currentProgram.weekTypeIntensificazione'),
                                            picco: t('currentProgram.weekTypePicco'),
                                            test: t('currentProgram.weekTypeTest'),
                                            deload: t('currentProgram.weekTypeDeload'),
                                        }}
                                    />
                                    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${weekBadgeClass}`}>
                                        <WeekStatusIcon className={`h-4 w-4 ${weekIconClass}`} />
                                        <span>{weekStatusLabel}</span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {t('currentProgram.weekCompleted', { completed: week.workouts.filter((w) => w.completed).length, total: week.workouts.length })}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => toggleWeek(week.weekNumber)}
                                    aria-label={expandedWeeks[week.weekNumber]
                                        ? t('currentProgram.closeWeek')
                                        : t('currentProgram.openWeek')}
                                    aria-expanded={expandedWeeks[week.weekNumber] ?? false}
                                    className="ml-2 flex-shrink-0 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                                >
                                    {expandedWeeks[week.weekNumber]
                                        ? <ChevronUp className="h-5 w-5" />
                                        : <ChevronDown className="h-5 w-5" />}
                                </button>
                            </div>

                            {(expandedWeeks[week.weekNumber] ?? false) && (
                                <div className="space-y-4">
                                    {week.workouts
                                        .slice()
                                        .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
                                        .map((workout, workoutIndex) => {
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
                                                                    {t('currentProgram.day', { number: workoutIndex + 1 })}
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
                                                                    href={`/trainee/workouts/${workout.id}?programId=${encodeURIComponent(mergedProgram.id)}&from=${mode}`}
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
                                                        <div className="px-4 py-3">
                                                            {workout.exercises.length === 0 ? (
                                                                <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                                                                    {t('currentProgram.tableNoExercises')}
                                                                </p>
                                                            ) : (
                                                                <WorkoutExerciseDisplayList
                                                                    items={buildExerciseDisplayItems(workout)}
                                                                    emptyText={t('currentProgram.tableNoExercises')}
                                                                />
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

