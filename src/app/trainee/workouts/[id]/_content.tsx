'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { RestTime } from '@prisma/client'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { RPESelector, SkeletonDetail, WeekTypeBadge } from '@/components'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    Clock3,
    FileText,
    Gauge,
    PlayCircle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import YoutubeEmbed from '@/components/YoutubeEmbed'
import { useSwipe } from '@/lib/useSwipe'
import * as Sentry from '@sentry/nextjs'
import { useToast } from '@/components/ToastNotification'
import { Input } from '@/components/Input'

interface Exercise {
    id: string
    name: string
    description: string | null
    type: 'fundamental' | 'accessory'
    youtubeUrl: string | null
    notes: string | null
}

interface ExerciseFeedback {
    id: string
    workoutExerciseId: string
    traineeId: string
    date: string
    totalVolume: number
    avgRPE: number | null
    notes: string | null
    completed: boolean
    setsPerformed: SetPerformed[]
}

interface WorkoutExerciseWithWeight {
    id: string
    exercise: Exercise
    variant: string | null
    sets: number
    reps: string
    targetRpe: number
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
    weight: number | null
    effectiveWeight: number | null
    restTime: RestTime
    isWarmup: boolean
    notes: string | null
    order: number
    feedback: ExerciseFeedback | null
}

interface SetPerformed {
    setNumber: number
    weight: number
    reps: number
    completed?: boolean | null
}

interface ExerciseRPE {
    workoutExerciseId: string
    rpe: number | null
}

interface Workout {
    id: string
    dayIndex: number
    notes: string | null
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    program: {
        id: string
        title: string
    }
    exercises: WorkoutExerciseWithWeight[]
}

const parsePlannedReps = (plannedReps: string): number => {
    const match = plannedReps.match(/\d+/)
    return match ? parseInt(match[0], 10) : 0
}

const formatRestTime = (restTime: RestTime): string => {
    const labels: Record<RestTime, string> = {
        s30: '0:30',
        m1: '1:00',
        m2: '2:00',
        m3: '3:00',
        m5: '5:00',
    }
    return labels[restTime] ?? '-'
}

const formatWeightValue = (value: number): string => {
    if (!Number.isFinite(value)) {
        return '-'
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const formatWeightKg = (value: number | null | undefined): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-'
    }
    return `${formatWeightValue(value)} kg`
}

const RPE_OPTIONS = [
    { value: 5, labelKey: 'rpe5' },
    { value: 5.5, labelKey: 'rpe5_5' },
    { value: 6, labelKey: 'rpe6' },
    { value: 6.5, labelKey: 'rpe6_5' },
    { value: 7, labelKey: 'rpe7' },
    { value: 7.5, labelKey: 'rpe7_5' },
    { value: 8, labelKey: 'rpe8' },
    { value: 8.5, labelKey: 'rpe8_5' },
    { value: 9, labelKey: 'rpe9' },
    { value: 9.5, labelKey: 'rpe9_5' },
    { value: 10, labelKey: 'rpe10' },
] as const

export default function WorkoutDetailContent() {
    const { t } = useTranslation('trainee')
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const workoutId = params.id as string
    const fromParam = searchParams.get('from') ?? 'dashboard'

    // State
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [feedbackData, setFeedbackData] = useState<Record<string, SetPerformed[]>>({})
    const [exerciseRPE, setExerciseRPE] = useState<Record<string, number | null>>({})
    const [globalNotes, setGlobalNotes] = useState('')
    const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({})
    const [currentStep, setCurrentStep] = useState(0)


    const { showToast } = useToast()
    const draftSyncEnabledRef = useRef(false)
    const persistedExerciseIdsRef = useRef<Set<string>>(new Set())
    const touchedExerciseIdsRef = useRef<Set<string>>(new Set())
    const draftSyncTimeoutRef = useRef<number | null>(null)
    const draftSyncPromiseRef = useRef<Promise<void> | null>(null)
    const draftSyncPausedRef = useRef(false)

    const STORAGE_KEY = `workout_${workoutId}_feedback`

    const fetchWorkout = useCallback(async () => {
        try {
            setLoading(true)

            const res = await fetch(`/api/trainee/workouts/${workoutId}`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('workouts.errorLoading'), t))
            }

            setWorkout(data.data.workout)

            const initialFeedback: Record<string, SetPerformed[]> = {}
            const initialRPE: Record<string, number | null> = {}

            const orderedExercises = [...data.data.workout.exercises].sort(
                (left: WorkoutExerciseWithWeight, right: WorkoutExerciseWithWeight) => left.order - right.order
            )

            orderedExercises.forEach((we: WorkoutExerciseWithWeight) => {
                if (we.feedback) {
                    persistedExerciseIdsRef.current.add(we.id)
                    initialFeedback[we.id] = we.feedback.setsPerformed.map(sp => ({
                        setNumber: sp.setNumber,
                        weight: sp.weight,
                        reps: sp.reps,
                        completed: sp.completed ?? true,
                    }))
                    initialRPE[we.id] = we.feedback.avgRPE
                    if (we.feedback.notes) {
                        setGlobalNotes(we.feedback.notes)
                    }
                } else {
                    const plannedReps = parsePlannedReps(we.reps)
                    initialFeedback[we.id] = Array.from({ length: we.sets }, (_, i) => ({
                        setNumber: i + 1,
                        weight: we.effectiveWeight || 0,
                        reps: plannedReps,
                        completed: false,
                    }))
                    initialRPE[we.id] = we.targetRpe
                }
            })

            setFeedbackData(initialFeedback)
            setExerciseRPE(initialRPE)
            setCurrentStep(0)
            draftSyncEnabledRef.current = false
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('workouts.errorLoading'))
        } finally {
            setLoading(false)
        }
    }, [t, workoutId])

    const loadLocalData = useCallback(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                const normalizedFeedback = Object.fromEntries(
                    Object.entries(parsed.feedbackData || {}).map(([workoutExerciseId, sets]) => [
                        workoutExerciseId,
                        (sets as SetPerformed[]).map((set) => {
                            const legacyStatus = (set as SetPerformed & { status?: 'done' | 'not-done' | null }).status
                            return {
                                ...set,
                                completed: set.completed ?? (legacyStatus === 'done'),
                            }
                        }),
                    ])
                )
                setFeedbackData(normalizedFeedback)
                setExerciseRPE(parsed.exerciseRPE || {})
                setGlobalNotes(parsed.globalNotes || '')
            }
        } catch {
            // localStorage read failed; start with empty state
        }
    }, [STORAGE_KEY])

    const saveLocalData = useCallback(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    feedbackData,
                    exerciseRPE,
                    globalNotes,
                    savedAt: new Date().toISOString(),
                })
            )
        } catch {
            // localStorage write failed; in-memory state is still valid
        }
    }, [STORAGE_KEY, exerciseRPE, feedbackData, globalNotes])

    const clearLocalData = () => {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            // localStorage removal failed; non-critical
        }
    }

    const syncDraftFeedback = useCallback(async () => {
        if (!workout || draftSyncPausedRef.current) {
            return
        }

        const runSync = async () => {
            const exercisesToSync = workout.exercises.filter((exercise) => {
                const sets = feedbackData[exercise.id] || []
                const hasCompletedSets = sets.some((set) => !!set.completed)
                const hasTouchedDraft = touchedExerciseIdsRef.current.has(exercise.id)
                return hasCompletedSets || hasTouchedDraft || persistedExerciseIdsRef.current.has(exercise.id)
            })

            if (exercisesToSync.length === 0) {
                return
            }

            try {
                await Promise.all(
                    exercisesToSync.map(async (exercise) => {
                        const sets = feedbackData[exercise.id] || []
                        const payload = {
                            workoutExerciseId: exercise.id,
                            sets: sets.map((set) => ({
                                setNumber: set.setNumber,
                                completed: !!set.completed,
                                reps: set.reps,
                                weight: set.weight,
                            })),
                            completed: false,
                        }

                        const res = await fetch('/api/feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        })

                        if (!res.ok) {
                            throw new Error('Failed to persist workout draft')
                        }

                        persistedExerciseIdsRef.current.add(exercise.id)
                        touchedExerciseIdsRef.current.delete(exercise.id)
                    })
                )
            } catch (err) {
                Sentry.captureException(err)
            }
        }

        const pendingSync = (draftSyncPromiseRef.current ?? Promise.resolve())
            .then(runSync)
            .finally(() => {
                if (draftSyncPromiseRef.current === pendingSync) {
                    draftSyncPromiseRef.current = null
                }
            })

        draftSyncPromiseRef.current = pendingSync
        await pendingSync
    }, [feedbackData, workout])

    useEffect(() => {
        void fetchWorkout()
        loadLocalData()
    }, [fetchWorkout, loadLocalData])

    useEffect(() => {
        if (Object.keys(feedbackData).length > 0) {
            saveLocalData()
        }
    }, [feedbackData, exerciseRPE, globalNotes, saveLocalData])

    useEffect(() => {
        if (!workout || loading) {
            return
        }

        if (submitting || draftSyncPausedRef.current) {
            return
        }

        if (!draftSyncEnabledRef.current) {
            draftSyncEnabledRef.current = true
            return
        }

        draftSyncTimeoutRef.current = window.setTimeout(() => {
            void syncDraftFeedback()
        }, 800)

        return () => {
            if (draftSyncTimeoutRef.current !== null) {
                window.clearTimeout(draftSyncTimeoutRef.current)
                draftSyncTimeoutRef.current = null
            }
        }
    }, [feedbackData, loading, submitting, syncDraftFeedback, workout])

    const updateSet = (
        workoutExerciseId: string,
        setIndex: number,
        field: 'weight' | 'reps',
        value: number
    ) => {
        touchedExerciseIdsRef.current.add(workoutExerciseId)
        setFeedbackData((prev) => {
            const updated = { ...prev }
            updated[workoutExerciseId] = [...(prev[workoutExerciseId] || [])]
            updated[workoutExerciseId][setIndex] = {
                ...updated[workoutExerciseId][setIndex],
                [field]: value,
            }
            return updated
        })
    }

    const toggleSetCompleted = (workoutExerciseId: string, setIndex: number) => {
        if (!workout) return
        const we = workout.exercises.find((e) => e.id === workoutExerciseId)
        if (!we) return

        const currentSet = (feedbackData[workoutExerciseId] ?? [])[setIndex]
        if (!currentSet) return

        const isCompleting = !currentSet.completed

        // "8" → can auto-fill with planned value on first tap
        // "max", "6-8", "6/8" → can complete freely (reps entered by user or left as 0)
        const isPreciseReps = /^\d+$/.test(we.reps.trim())

        touchedExerciseIdsRef.current.add(workoutExerciseId)

        setFeedbackData((prev) => {
            const updated = { ...prev }
            updated[workoutExerciseId] = [...(prev[workoutExerciseId] ?? [])]

            const set = updated[workoutExerciseId][setIndex]
            const completing = !set.completed

            if (completing && !(set.reps > 0) && isPreciseReps) {
                // Auto-fill with planned value for precise-rep exercises only
                const plannedReps = parseInt(we.reps.trim(), 10)
                updated[workoutExerciseId][setIndex] = {
                    ...set,
                    completed: true,
                    reps: plannedReps,
                    weight: we.effectiveWeight ?? we.weight ?? 0,
                }
            } else {
                updated[workoutExerciseId][setIndex] = {
                    ...set,
                    completed: !set.completed,
                }
            }

            return updated
        })
    }

    const updateExerciseRPE = (workoutExerciseId: string, rpe: number | null) => {
        setExerciseRPE((prev) => ({
            ...prev,
            [workoutExerciseId]: rpe,
        }))
    }

    const toggleVideo = (workoutExerciseId: string) => {
        setExpandedVideos((prev) => ({
            ...prev,
            [workoutExerciseId]: !prev[workoutExerciseId],
        }))
    }

    const doSubmit = async () => {
        try {
            setSubmitting(true)
            draftSyncPausedRef.current = true

            if (draftSyncTimeoutRef.current !== null) {
                window.clearTimeout(draftSyncTimeoutRef.current)
                draftSyncTimeoutRef.current = null
            }

            await draftSyncPromiseRef.current

            const feedbackPromises = workout!.exercises.map(async (we) => {
                const sets = feedbackData[we.id] || []
                const payload = {
                    workoutExerciseId: we.id,
                    notes: globalNotes.trim() || null,
                    sets: sets.map(s => ({
                        setNumber: s.setNumber,
                        completed: !!s.completed,
                        reps: s.reps,
                        weight: s.weight,
                    })),
                    completed: true,
                    actualRpe: exerciseRPE[we.id] || null
                }

                const res = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })

                if (!res.ok) {
                    const data = await res.json()
                    throw new Error(getApiErrorMessage(data, t('workouts.errorFeedback'), t))
                }

                return res.json()
            })

            await Promise.all(feedbackPromises)

            clearLocalData()
            showToast(t('workouts.feedbackSuccess'), 'success')

            const navigateTo = fromParam === 'current' ? '/trainee/programs/current' : '/trainee/dashboard'
            router.push(navigateTo)
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('workouts.errorFeedback'), 'error')
            draftSyncPausedRef.current = false
            setSubmitting(false)
        }
    }

    const handleSubmit = () => {
        if (!workout) return
        void doSubmit()
    }

    // New focus mode helpers
    const sortedExercises = useMemo(
        () => (workout ? [...workout.exercises].sort((a, b) => a.order - b.order) : []),
        [workout]
    )

    const totalSteps = sortedExercises.length + 1
    const isFinalStep = currentStep === sortedExercises.length

    const goToStep = useCallback(
        (next: number) => {
            const clamped = Math.max(0, Math.min(next, sortedExercises.length))
            setCurrentStep(clamped)
        },
        [sortedExercises.length]
    )

    const completedExerciseCount = useMemo(
        () =>
            sortedExercises.reduce((acc, we) => {
                const sets = feedbackData[we.id] || []
                const isPreciseReps = /^\d+$/.test(we.reps.trim())
                // For non-numeric reps (max, ranges) only require the set to be checked + weight entered
                const hasData = isPreciseReps
                    ? sets.some((s) => s.completed && s.weight > 0 && s.reps > 0)
                    : sets.some((s) => s.completed)
                return acc + (hasData ? 1 : 0)
            }, 0),
        [feedbackData, sortedExercises]
    )

    const totalCompletedSets = useMemo(
        () =>
            sortedExercises.reduce((acc, we) => {
                const sets = feedbackData[we.id] || []
                return acc + sets.filter((s) => s.completed).length
            }, 0),
        [feedbackData, sortedExercises]
    )

    const totalPlannedSets = useMemo(
        () => sortedExercises.reduce((acc, we) => acc + we.sets, 0),
        [sortedExercises]
    )

    const workoutProgressPercent = totalPlannedSets > 0
        ? Math.round((totalCompletedSets / totalPlannedSets) * 100)
        : 0

    const emptyExerciseNames = useMemo(
        () =>
            sortedExercises
                .filter((we) => {
                    const sets = feedbackData[we.id] || []
                    const isPreciseReps = /^\d+$/.test(we.reps.trim())
                    // For non-numeric reps (max, ranges) only require the set to be checked
                    const hasDoneSet = isPreciseReps
                        ? sets.some((s) => s.completed && s.weight > 0 && s.reps > 0)
                        : sets.some((s) => s.completed)
                    return !hasDoneSet
                })
                .map((we) => we.exercise.name),
        [feedbackData, sortedExercises]
    )

    const { handlers: pageSwipeHandlers } = useSwipe({
        onSwipeLeft: () => goToStep(currentStep + 1),
        onSwipeRight: () => goToStep(currentStep - 1),
        threshold: 80,
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonDetail />
            </div>
        )
    }

    if (error || !workout) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || t('workouts.errorNotFound')}
                </div>
            </div>
        )
    }

    const rpeDescriptions = RPE_OPTIONS.reduce<Record<number, string>>((acc, option) => {
        acc[option.value] = t(`workouts.rpeOptions.${option.labelKey}`)
        return acc
    }, {})

    const currentExercise = !isFinalStep ? sortedExercises[currentStep] : null

    return (
        <div className="flex min-h-screen flex-col bg-gray-50" {...pageSwipeHandlers}>
            {/* Sticky top bar */}
            <nav data-testid="focus-mode-header" className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-brand-primary rounded-full" />
                        <div>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest leading-none mb-0.5">
                                {workout.program.title}
                            </p>
                            <p className="text-sm font-bold text-gray-900 leading-none">
                                {t('workouts.dayWeekLong', {
                                    day: workout.dayIndex,
                                    week: workout.weekNumber,
                                })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <WeekTypeBadge
                            weekType={workout.weekType}
                            labels={{
                                normal: t('weekType.normal'),
                                test: t('weekType.test'),
                                deload: t('weekType.deload'),
                            }}
                        />
                        <span className="text-xs text-gray-400 font-semibold tabular-nums w-9 text-right">
                            {workoutProgressPercent}%
                        </span>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-gray-100 -mx-4 sm:-mx-6 lg:-mx-8">
                    <div
                        className="h-1 bg-brand-primary transition-all duration-300 rounded-r-full"
                        style={{ width: `${workoutProgressPercent}%` }}
                    />
                </div>
            </nav>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="max-w-2xl mx-auto">
                    {!isFinalStep && currentExercise ? (
                        <ExerciseFocusCard
                            we={currentExercise}
                            sets={feedbackData[currentExercise.id] || []}
                            rpe={exerciseRPE[currentExercise.id] ?? null}
                            videoExpanded={expandedVideos[currentExercise.id] ?? false}
                            onToggleVideo={() => toggleVideo(currentExercise.id)}
                            onUpdateSet={(id, idx, field, value) => updateSet(id, idx, field, value)}
                            onToggleSet={(id, idx) => toggleSetCompleted(id, idx)}
                            onUpdateRpe={(rpe) => updateExerciseRPE(currentExercise.id, rpe)}
                            rpeDescriptions={rpeDescriptions}
                            t={t}
                        />
                    ) : (
                        <FinalStep
                            completed={completedExerciseCount}
                            total={sortedExercises.length}
                            totalSets={totalCompletedSets}
                            emptyExercises={emptyExerciseNames}
                            globalNotes={globalNotes}
                            onNotesChange={setGlobalNotes}
                            t={t}
                        />
                    )}
                </div>
            </div>

            {/* Sticky bottom nav */}
            <nav className="sticky bottom-0 z-20 bg-white border-t border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between h-16">
                <button
                    onClick={() => goToStep(currentStep - 1)}
                    disabled={currentStep === 0}
                    className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t('workouts.prev')}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {!isFinalStep && (
                    <span className="text-sm font-semibold text-gray-600">
                        {t('workouts.stepCounter', {
                            current: currentStep + 1,
                            total: sortedExercises.length,
                        })}
                    </span>
                )}

                {!isFinalStep ? (
                    <button
                        onClick={() => goToStep(currentStep + 1)}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label={t('workouts.next')}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-6 py-2 bg-brand-primary text-white rounded font-semibold hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {submitting && <LoadingSpinner size="sm" color="white" />}
                        {t('workouts.completeShort')}
                    </button>
                )}
            </nav>
        </div>
    )
}

interface ExerciseFocusCardProps {
    we: WorkoutExerciseWithWeight
    sets: SetPerformed[]
    rpe: number | null
    videoExpanded: boolean
    onToggleVideo: () => void
    onUpdateSet: (id: string, idx: number, field: 'weight' | 'reps', value: number) => void
    onToggleSet: (id: string, idx: number) => void
    onUpdateRpe: (rpe: number | null) => void
    rpeDescriptions: Record<number, string>
    t: (key: string, vars?: Record<string, unknown>) => string
}

function ExerciseFocusCard({
    we,
    sets,
    rpe,
    videoExpanded,
    onToggleVideo,
    onUpdateSet,
    onToggleSet,
    onUpdateRpe,
    rpeDescriptions,
    t,
}: ExerciseFocusCardProps) {
    const trainerSettingValue = (() => {
        if (typeof we.weight !== 'number' || !Number.isFinite(we.weight)) {
            return '-'
        }
        const formattedWeight = formatWeightValue(we.weight)
        switch (we.weightType) {
            case 'absolute':
                return `${formattedWeight} kg`
            case 'percentage_1rm':
                return `${formattedWeight}% 1RM`
            case 'percentage_rm':
                return `${formattedWeight}% RM`
            case 'percentage_previous':
                return `${we.weight > 0 ? '+' : ''}${formattedWeight}%`
            default:
                return formattedWeight
        }
    })()

    const calculatedWeightValue =
        we.weightType === 'absolute'
            ? formatWeightKg(we.effectiveWeight ?? we.weight)
            : formatWeightKg(we.effectiveWeight)
    const calculatedWeightMissing = calculatedWeightValue === '-'
    const compactWeightValue =
        we.weightType !== 'absolute'
            ? `${calculatedWeightMissing ? t('workouts.calculatedWeightMissing') : calculatedWeightValue} (${trainerSettingValue})`
            : calculatedWeightValue

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6">
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                we.exercise.type === 'fundamental'
                                    ? 'border-red-300 bg-white text-red-700'
                                    : 'border-blue-300 bg-white text-blue-700'
                            }`}
                        >
                            {we.exercise.type === 'fundamental'
                                ? t('workouts.tagFundamentalShort')
                                : t('workouts.tagAccessoryShort')}
                        </span>
                        <h2 className="text-2xl font-bold text-gray-900">{we.exercise.name}</h2>
                    </div>
                    {we.variant && (
                        <p className="text-sm text-gray-600">{we.variant}</p>
                    )}
                </div>

                {/* Big targets row */}
                <div className="flex gap-2 mb-4">
                    <div className="flex-1 rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-3 py-3 text-center">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary">
                            {t('workouts.sets')}
                        </span>
                        <span className="block text-2xl font-black text-gray-900 mt-1">
                            {we.sets}
                        </span>
                    </div>
                    <div className="flex-1 rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-3 py-3 text-center">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary">
                            {t('workouts.reps')}
                        </span>
                        <span className="block text-2xl font-black text-gray-900 mt-1">
                            {we.reps}
                        </span>
                    </div>
                    <div className="flex-1 rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-3 py-3 text-center">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary">
                            KG
                        </span>
                        <span
                            className={`block text-2xl font-black mt-1 leading-none whitespace-nowrap ${
                                calculatedWeightMissing ? 'text-gray-400' : 'text-gray-900'
                            }`}
                        >
                            {calculatedWeightMissing
                                ? '-'
                                : calculatedWeightValue}
                        </span>
                        {we.weightType !== 'absolute' && (
                            <span className="block text-[10px] text-gray-400 mt-1.5 leading-none">
                                {trainerSettingValue}
                            </span>
                        )}
                    </div>
                </div>

                {/* Secondary row - rest and RPE */}
                <div className="flex gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        <Clock3 className="w-3.5 h-3.5" />
                        {formatRestTime(we.restTime)}
                    </span>
                    {we.targetRpe !== null && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                            <Gauge className="w-3.5 h-3.5" />
                            RPE {we.targetRpe}
                        </span>
                    )}
                </div>

                {we.notes && (
                    <p className="text-sm text-gray-600 mb-4">
                        <FileText className="inline w-4 h-4 mr-1" />
                        {we.notes}
                    </p>
                )}
            </div>

            {/* Video */}
            {we.exercise.youtubeUrl && (
                <div className="border-t border-gray-200 p-4 sm:p-6 flex flex-col items-center" data-swipe-ignore="true">
                    <button
                        onClick={onToggleVideo}
                        className="inline-flex gap-2 items-center px-4 py-2 border border-gray-300 rounded-lg hover:border-brand-primary hover:text-brand-primary text-sm font-semibold transition-colors"
                    >
                        <PlayCircle className="w-4 h-4" />
                        {videoExpanded ? t('workouts.hideVideo') : t('workouts.showVideo')}
                        {videoExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </button>
                    {videoExpanded && (
                        <div className="mt-4 w-full">
                            <YoutubeEmbed videoUrl={we.exercise.youtubeUrl} />
                        </div>
                    )}
                </div>
            )}

            {/* Sets input */}
            <div className="border-t border-gray-200 p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
                    {t('workouts.setsHeading')}
                </h3>
                <div className="space-y-2 mb-4">
                    {sets.map((set, setIdx) => (
                        <div
                            key={setIdx}
                            className="grid grid-cols-[40px_1fr_1fr_48px] gap-2 items-center min-h-[56px] border-b border-gray-200 last:border-b-0 px-2"
                        >
                            <span className="text-center text-sm font-semibold text-gray-600">
                                #{set.setNumber}
                            </span>
                            <Input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                placeholder={/^\d+$/.test(we.reps.trim()) ? String(parsePlannedReps(we.reps)) : we.reps}
                                value={set.reps || ''}
                                onChange={(e) =>
                                    onUpdateSet(we.id, setIdx, 'reps', parseInt(e.target.value) || 0)
                                }
                                aria-label={`${t('workouts.reps')} ${set.setNumber}`}
                                inputSize="md"
                                className="text-center"
                            />
                            <Input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.5"
                                placeholder={String(we.effectiveWeight ?? we.weight ?? 0)}
                                value={set.weight || ''}
                                onChange={(e) =>
                                    onUpdateSet(we.id, setIdx, 'weight', parseFloat(e.target.value) || 0)
                                }
                                aria-label={`${t('workouts.weightKg')} ${set.setNumber}`}
                                inputSize="md"
                                className="text-center"
                            />
                            <button
                                type="button"
                                onClick={() => onToggleSet(we.id, setIdx)}
                                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                                    set.completed
                                        ? 'border-green-300 bg-green-100 text-green-700'
                                        : 'border-gray-300 bg-white text-gray-400 hover:border-green-300 hover:text-green-600'
                                }`}
                                aria-label={t('workouts.markSetDone')}
                            >
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Overall RPE */}
            <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-sm font-semibold text-gray-700">
                        {t('workouts.overallRpe')}
                    </label>
                    <RPESelector
                        value={rpe}
                        onChange={onUpdateRpe}
                        showLabel={false}
                        centeredMenu={true}
                        title={t('workouts.overallRpe')}
                        placeholder={t('workouts.selectRpe')}
                        descriptions={rpeDescriptions}
                        className="w-full sm:w-auto"
                    />
                </div>
            </div>
        </div>
    )
}

interface FinalStepProps {
    completed: number
    total: number
    totalSets: number
    emptyExercises: string[]
    globalNotes: string
    onNotesChange: (notes: string) => void
    t: (key: string, vars?: Record<string, unknown>) => string
}

function FinalStep({
    completed,
    total,
    totalSets,
    emptyExercises,
    globalNotes,
    onNotesChange,
    t,
}: FinalStepProps) {
    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {t('workouts.summaryTitle')}
                </h2>
                <p className="text-gray-600 mb-6">
                    {t('workouts.summaryStats', {
                        done: completed,
                        total,
                        sets: totalSets,
                    })}
                </p>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('workouts.notesLabel')}
                    </label>
                    <textarea
                        value={globalNotes}
                        onChange={(e) => onNotesChange(e.target.value)}
                        placeholder={t('workouts.notesPlaceholder')}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    />
                </div>
            </div>

            {/* Missing data warning */}
            {emptyExercises.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-800 text-sm">
                                {t('workouts.missingDataInline')}
                            </p>
                            <ul className="mt-2 space-y-1">
                                {emptyExercises.map((name) => (
                                    <li key={name} className="text-sm text-amber-700">
                                        • {name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
