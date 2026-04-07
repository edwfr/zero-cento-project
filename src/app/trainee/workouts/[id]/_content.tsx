'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { RestTime } from '@prisma/client'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { RPESelector, SkeletonDetail, WeekTypeBanner } from '@/components'
import LoadingSpinner from '@/components/LoadingSpinner'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Clock3, FileText, Gauge, PlayCircle } from 'lucide-react'
import YoutubeEmbed from '@/components/YoutubeEmbed'
import { useSwipe } from '@/lib/useSwipe'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'

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
    const source = searchParams.get('from')
    const sourceProgramId = searchParams.get('programId')
    const backToProgramHref = source === 'history' && sourceProgramId
        ? `/trainee/programs/${sourceProgramId}`
        : '/trainee/programs/current'

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Feedback state
    const [feedbackData, setFeedbackData] = useState<Record<string, SetPerformed[]>>({})
    const [exerciseRPE, setExerciseRPE] = useState<Record<string, number | null>>({})
    const [globalNotes, setGlobalNotes] = useState('')
    const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({})
    const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({})
    const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)
    const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const { showToast } = useToast()
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)
    const draftSyncEnabledRef = useRef(false)
    const persistedExerciseIdsRef = useRef<Set<string>>(new Set())
    const touchedExerciseIdsRef = useRef<Set<string>>(new Set())
    const draftSyncTimeoutRef = useRef<number | null>(null)
    const draftSyncPromiseRef = useRef<Promise<void> | null>(null)
    const draftSyncPausedRef = useRef(false)

    const STORAGE_KEY = `workout_${workoutId}_feedback`

    useEffect(() => {
        fetchWorkout()
        loadLocalData()
    }, [workoutId])

    useEffect(() => {
        // Auto-save to localStorage every time feedbackData changes
        if (Object.keys(feedbackData).length > 0) {
            saveLocalData()
        }
    }, [feedbackData, exerciseRPE, globalNotes])

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
    }, [feedbackData, workout, loading, submitting])

    const fetchWorkout = async () => {
        try {
            setLoading(true)

            const res = await fetch(`/api/trainee/workouts/${workoutId}`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('workouts.errorLoading'), t))
            }

            setWorkout(data.data.workout)

            // Initialize feedback data structure
            const initialFeedback: Record<string, SetPerformed[]> = {}
            const initialRPE: Record<string, number | null> = {}

            const initialExpanded: Record<string, boolean> = {}
            const orderedExercises = [...data.data.workout.exercises].sort(
                (left: WorkoutExerciseWithWeight, right: WorkoutExerciseWithWeight) => left.order - right.order
            )

            orderedExercises.forEach((we: WorkoutExerciseWithWeight, index: number) => {
                // If feedback exists, load it
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

                    // Initialize empty sets with planned reps and effective weight as defaults
                    initialFeedback[we.id] = Array.from({ length: we.sets }, (_, i) => ({
                        setNumber: i + 1,
                        weight: we.effectiveWeight || 0,
                        reps: plannedReps,
                        completed: false,
                    }))
                    initialRPE[we.id] = we.targetRpe
                }

                // Open first exercise by default for quicker mobile usage
                initialExpanded[we.id] = index === 0
            })

            setFeedbackData(initialFeedback)
            setExerciseRPE(initialRPE)
            setExpandedExercises(initialExpanded)
            setActiveExerciseIndex(0)
            draftSyncEnabledRef.current = false
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('workouts.errorLoading'))
        } finally {
            setLoading(false)
        }
    }

    const loadLocalData = () => {
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
        } catch (err) {
            console.error('Error loading local data:', err)
        }
    }

    const saveLocalData = () => {
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
        } catch (err) {
            console.error('Error saving local data:', err)
        }
    }

    const clearLocalData = () => {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch (err) {
            console.error('Error clearing local data:', err)
        }
    }

    const syncDraftFeedback = async () => {
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
                console.error('Error syncing workout draft:', err)
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
    }

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

    const toggleSetCompleted = (
        workoutExerciseId: string,
        setIndex: number
    ) => {
        touchedExerciseIdsRef.current.add(workoutExerciseId)

        setFeedbackData((prev) => {
            const updated = { ...prev }
            updated[workoutExerciseId] = [...(prev[workoutExerciseId] || [])]

            const currentSet = updated[workoutExerciseId][setIndex]
            updated[workoutExerciseId][setIndex] = {
                ...currentSet,
                completed: !currentSet.completed,
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

    const calculateExerciseVolume = (workoutExerciseId: string): number => {
        const sets = feedbackData[workoutExerciseId] || []
        return sets.reduce((total, set) => total + set.weight * set.reps, 0)
    }

    const doSubmit = async () => {
        setConfirmModal(null)
        try {
            setSubmitting(true)
            draftSyncPausedRef.current = true

            if (draftSyncTimeoutRef.current !== null) {
                window.clearTimeout(draftSyncTimeoutRef.current)
                draftSyncTimeoutRef.current = null
            }

            await draftSyncPromiseRef.current

            // Submit feedback for each exercise
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

            // Clear local storage
            clearLocalData()

            showToast(t('workouts.feedbackSuccess'), 'success')
            router.push('/trainee/dashboard')
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('workouts.errorFeedback'), 'error')
            draftSyncPausedRef.current = false
            setSubmitting(false)
        }
    }

    const handleSubmit = () => {
        if (!workout) return

        // Validate all sets have data
        const emptyExercises: string[] = []
        workout.exercises.forEach((we) => {
            const sets = feedbackData[we.id] || []
            const hasData = sets.some((s) => s.completed && s.weight > 0 && s.reps > 0)
            if (!hasData) {
                emptyExercises.push(we.exercise.name)
            }
        })

        if (emptyExercises.length > 0) {
            setConfirmModal({
                title: t('workouts.missingDataTitle'),
                message: t('workouts.confirmContinue', { exercises: emptyExercises.join(', ') }),
                confirmText: t('workouts.continueBtn'),
                variant: 'warning',
                onConfirm: doSubmit,
            })
            return
        }

        doSubmit()
    }

    const toggleExercise = (workoutExerciseId: string) => {
        setExpandedExercises((prev) => ({
            ...prev,
            [workoutExerciseId]: !prev[workoutExerciseId],
        }))
    }

    const navigateToExercise = useCallback(
        (index: number) => {
            if (!workout) return
            const sorted = [...workout.exercises].sort((a, b) => a.order - b.order)
            const clamped = Math.max(0, Math.min(index, sorted.length - 1))
            setActiveExerciseIndex(clamped)
            const target = sorted[clamped]
            if (target) {
                // Expand the target exercise and scroll to it
                setExpandedExercises((prev) => ({ ...prev, [target.id]: true }))
                setTimeout(() => {
                    exerciseRefs.current[target.id]?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    })
                }, 50)
            }
        },
        [workout]
    )

    // Page-level swipe: left = next exercise, right = previous exercise
    const { handlers: pageSwipeHandlers } = useSwipe({
        onSwipeLeft: () => navigateToExercise(activeExerciseIndex + 1),
        onSwipeRight: () => navigateToExercise(activeExerciseIndex - 1),
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

    const sortedExercises = [...workout.exercises].sort((a, b) => a.order - b.order)
    const rpeDescriptions = RPE_OPTIONS.reduce<Record<number, string>>((accumulator, option) => {
        accumulator[option.value] = t(`workouts.rpeOptions.${option.labelKey}`)
        return accumulator
    }, {})

    return (
        <div className="min-h-screen bg-gray-50" {...pageSwipeHandlers}>
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText ?? t('workouts.confirmBtn')}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
            <div className="max-w-5xl mx-auto px-4 pb-8 pt-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={backToProgramHref}
                        className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('workouts.backToProgram')}
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {`Giorno ${workout.dayIndex}`} - {t('workouts.weekLabel', { number: workout.weekNumber })}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {workout.program.title}
                    </p>
                    <WeekTypeBanner
                        weekType={workout.weekType}
                        weekNumber={workout.weekNumber}
                        className="mt-4"
                    />
                </div>

                {/* Mobile swipe hint — shown only on touch devices */}
                {sortedExercises.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mb-4 md:hidden">
                        <button
                            onClick={() => navigateToExercise(activeExerciseIndex - 1)}
                            disabled={activeExerciseIndex === 0}
                            className="p-2 rounded-full bg-white shadow disabled:opacity-30 text-gray-600"
                            aria-label={t('workouts.prevExercise')}
                        >
                            ‹
                        </button>
                        <span className="text-xs text-gray-500 select-none">
                            {t('workouts.swipeHint', { current: activeExerciseIndex + 1, total: sortedExercises.length })}
                        </span>
                        <button
                            onClick={() => navigateToExercise(activeExerciseIndex + 1)}
                            disabled={activeExerciseIndex === sortedExercises.length - 1}
                            className="p-2 rounded-full bg-white shadow disabled:opacity-30 text-gray-600"
                            aria-label={t('workouts.nextExercise')}
                        >
                            ›
                        </button>
                    </div>
                )}

                {/* Exercises List */}
                <div className="space-y-4 mb-8">
                    {sortedExercises.map((we, idx) => {
                        const isExpanded = expandedExercises[we.id]
                        const isVideoExpanded = expandedVideos[we.id] ?? false
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
                                case 'percentage_previous': {
                                    const sign = we.weight > 0 ? '+' : ''
                                    return `${sign}${formattedWeight}% ${t('workouts.previousExerciseShort')}`
                                }
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
                            <div
                                key={we.id}
                                ref={(el) => { exerciseRefs.current[we.id] = el }}
                                className={`bg-white rounded-lg shadow-md overflow-hidden transition-shadow ${idx === activeExerciseIndex ? 'ring-2 ring-[#FFA700]' : ''
                                    }`}
                            >
                                {/* Exercise Header */}
                                <div
                                    className="relative cursor-pointer p-4 transition-colors hover:bg-gray-50 sm:p-6"
                                    onClick={() => toggleExercise(we.id)}
                                >
                                    <div className="mb-3 flex items-start gap-3 pr-8 sm:pr-10">
                                        <span className="text-xl font-bold text-gray-400 sm:text-2xl">
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${we.exercise.type === 'fundamental'
                                                        ? 'border-red-300 bg-white text-red-700'
                                                        : 'border-blue-300 bg-white text-blue-700'
                                                        }`}
                                                >
                                                    {we.exercise.type === 'fundamental'
                                                        ? t('workouts.tagFundamentalShort')
                                                        : t('workouts.tagAccessoryShort')}
                                                </span>
                                                <h3 className="text-lg font-bold text-gray-900 sm:text-xl">
                                                    {we.exercise.name}
                                                </h3>
                                            </div>
                                            {we.variant && (
                                                <p className="mt-1 text-sm font-medium text-gray-600">
                                                    {we.variant}
                                                </p>
                                            )}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {we.targetRpe !== null && we.targetRpe !== undefined && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                                                        <Gauge className="h-3.5 w-3.5" />
                                                        {we.targetRpe}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                    <Clock3 className="h-3.5 w-3.5" />
                                                    {formatRestTime(we.restTime)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2 flex justify-center">
                                        <div className="grid w-fit grid-cols-3 gap-2">
                                            <div className="rounded-lg bg-gray-100 px-3 py-2 text-center">
                                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                    {t('workouts.sets')}
                                                </span>
                                                <span className="mt-1 block text-lg font-bold text-gray-900">
                                                    {we.sets}
                                                </span>
                                            </div>
                                            <div className="rounded-lg bg-gray-100 px-3 py-2 text-center">
                                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                    {t('workouts.reps')}
                                                </span>
                                                <span className="mt-1 block text-lg font-bold text-gray-900">
                                                    {we.reps}
                                                </span>
                                            </div>
                                            <div className="min-w-0 rounded-lg bg-gray-100 px-3 py-2 text-center">
                                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                    KG
                                                </span>
                                                <span className={`mt-1 block text-sm font-bold leading-snug ${calculatedWeightMissing ? 'text-gray-500' : 'text-gray-900'}`}>
                                                    {compactWeightValue}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {we.notes && (
                                        <p className="mt-3 text-sm italic text-gray-600">
                                            <FileText className="mr-1 inline h-4 w-4" />{we.notes}
                                        </p>
                                    )}

                                    <button className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 sm:right-6 sm:top-6">
                                        {isExpanded ? '▲' : '▼'}
                                    </button>
                                </div>

                                {/* Exercise Details (Expandable) */}
                                {isExpanded && (
                                    <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6">
                                        {/* YouTube Video */}
                                        {we.exercise.youtubeUrl && (
                                            <div className="mb-6" data-swipe-ignore="true">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleVideo(we.id)}
                                                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-[#FFA700] hover:text-[#FFA700] sm:w-auto"
                                                >
                                                    <PlayCircle className="h-4 w-4" />
                                                    {isVideoExpanded
                                                        ? t('workouts.hideVideo')
                                                        : t('workouts.showVideo')}
                                                    {isVideoExpanded
                                                        ? <ChevronUp className="h-4 w-4" />
                                                        : <ChevronDown className="h-4 w-4" />}
                                                </button>

                                                {isVideoExpanded && (
                                                    <div className="mt-4">
                                                        <YoutubeEmbed videoUrl={we.exercise.youtubeUrl} />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Sets Input Table */}
                                        <div className="mb-4 space-y-2 md:hidden">
                                            <div className="grid grid-cols-[52px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                <span className="text-center">{t('workouts.sets')}</span>
                                                <span className="text-center">{t('workouts.reps')}</span>
                                                <span className="text-center">KG</span>
                                                <span className="sr-only">{t('workouts.markSetDone')}</span>
                                            </div>
                                            {feedbackData[we.id]?.map((set, setIdx) => (
                                                <div
                                                    key={setIdx}
                                                    className="grid grid-cols-[52px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 rounded-lg border border-gray-200 bg-white p-2"
                                                >
                                                    <p className="text-center text-sm font-semibold text-gray-900">
                                                        #{set.setNumber}
                                                    </p>

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={set.reps || ''}
                                                        onChange={(e) =>
                                                            updateSet(
                                                                we.id,
                                                                setIdx,
                                                                'reps',
                                                                parseInt(e.target.value) || 0
                                                            )
                                                        }
                                                        disabled={!!set.completed}
                                                        aria-label={`${t('workouts.reps')} ${set.setNumber}`}
                                                        className="h-10 w-full rounded-lg border border-gray-300 px-2 text-center focus:border-transparent focus:ring-2 focus:ring-[#FFA700]"
                                                    />

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={set.weight || ''}
                                                        onChange={(e) =>
                                                            updateSet(
                                                                we.id,
                                                                setIdx,
                                                                'weight',
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        disabled={!!set.completed}
                                                        aria-label={`${t('workouts.weightKg')} ${set.setNumber}`}
                                                        className="h-10 w-full rounded-lg border border-gray-300 px-2 text-center focus:border-transparent focus:ring-2 focus:ring-[#FFA700]"
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSetCompleted(we.id, setIdx)}
                                                        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${set.completed
                                                            ? 'border-green-300 bg-green-100 text-green-700'
                                                            : 'border-gray-300 bg-white text-gray-400 hover:border-green-300 hover:text-green-600'
                                                            }`}
                                                        aria-label={set.completed ? t('workouts.markSetUndone') : t('workouts.markSetDone')}
                                                        title={set.completed ? t('workouts.markSetUndone') : t('workouts.markSetDone')}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mb-4 hidden overflow-x-auto md:block">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-300">
                                                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                            {t('workouts.sets')}
                                                        </th>
                                                        <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">
                                                            {t('workouts.reps')}
                                                        </th>
                                                        <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">
                                                            {t('workouts.weightKg')}
                                                        </th>
                                                        <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">
                                                            <Check className="mx-auto h-4 w-4 text-gray-500" />
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {feedbackData[we.id]?.map((set, setIdx) => (
                                                        <tr
                                                            key={setIdx}
                                                            className="border-b border-gray-200"
                                                        >
                                                            <td className="py-3 px-3 font-semibold text-gray-900">
                                                                #{set.setNumber}
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={set.reps || ''}
                                                                    onChange={(e) =>
                                                                        updateSet(
                                                                            we.id,
                                                                            setIdx,
                                                                            'reps',
                                                                            parseInt(
                                                                                e.target.value
                                                                            ) || 0
                                                                        )
                                                                    }
                                                                    disabled={!!set.completed}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                                                />
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.5"
                                                                    value={set.weight || ''}
                                                                    onChange={(e) =>
                                                                        updateSet(
                                                                            we.id,
                                                                            setIdx,
                                                                            'weight',
                                                                            parseFloat(
                                                                                e.target.value
                                                                            ) || 0
                                                                        )
                                                                    }
                                                                    disabled={!!set.completed}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                                                />
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleSetCompleted(we.id, setIdx)}
                                                                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${set.completed
                                                                        ? 'border-green-300 bg-green-100 text-green-700'
                                                                        : 'border-gray-300 bg-white text-gray-400 hover:border-green-300 hover:text-green-600'
                                                                        }`}
                                                                    aria-label={set.completed ? t('workouts.markSetUndone') : t('workouts.markSetDone')}
                                                                    title={set.completed ? t('workouts.markSetUndone') : t('workouts.markSetDone')}
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Overall Exercise RPE */}
                                        <div className="rounded-lg bg-gray-100 p-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <label className="text-sm font-semibold text-gray-700">
                                                    {t('workouts.overallRpe')}
                                                </label>
                                                <RPESelector
                                                    value={exerciseRPE[we.id] ?? null}
                                                    onChange={(value) => updateExerciseRPE(we.id, value)}
                                                    showLabel={false}
                                                    centeredMenu={true}
                                                    title={t('workouts.overallRpe')}
                                                    placeholder={t('workouts.selectRpe')}
                                                    descriptions={rpeDescriptions}
                                                    className="min-w-0 w-full sm:w-auto sm:min-w-[240px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Global Notes */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <label className="block text-lg font-bold text-gray-900 mb-3">
                        {t('workouts.notesLabel')}
                    </label>
                    <textarea
                        value={globalNotes}
                        onChange={(e) => setGlobalNotes(e.target.value)}
                        placeholder={t('workouts.notesPlaceholder')}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex w-full items-center justify-center rounded-lg bg-green-500 px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-green-600 disabled:bg-gray-400"
                >
                    {submitting ? (
                        <LoadingSpinner size="sm" color="white" />
                    ) : (
                        t('workouts.completeWorkout')
                    )}
                </button>
            </div>
        </div>
    )
}
