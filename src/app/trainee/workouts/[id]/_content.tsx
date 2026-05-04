'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import type { RestTime } from '@prisma/client'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { FloatingRestTimer, RPESelector, SkeletonDetail, WeekTypeBadge } from '@/components'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Clock3,
    FileText,
    GripVertical,
    History,
    PlayCircle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import YoutubeEmbed from '@/components/YoutubeEmbed'
import { useSwipe } from '@/lib/useSwipe'
import { useToast } from '@/components/ToastNotification'
import { Input } from '@/components/Input'
import WorkoutRecapPanel from '@/components/WorkoutRecapPanel'
import PrevWeekPanel from '@/components/PrevWeekPanel'
import { useRestTimer } from '@/lib/useRestTimer'

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
    isCompleted: boolean
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
        m1s30: '1:30',
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

const DOCK_STORAGE_KEY = 'workout_dock_pos'
const DOCK_VIEWPORT_MARGIN = 8

const REST_TO_SECONDS: Record<RestTime, number> = {
    s30: 30,
    m1: 60,
    m1s30: 90,
    m2: 120,
    m3: 180,
    m5: 300,
}

function playSound(): void {
    try {
        const audioContextClass = window.AudioContext || (window as typeof window & {
            webkitAudioContext?: typeof AudioContext
        }).webkitAudioContext
        if (!audioContextClass) {
            return
        }

        const ctx = new audioContextClass()
        const now = ctx.currentTime

        const scheduleTone = (frequency: number, startDelay: number, duration: number) => {
            const oscillator = ctx.createOscillator()
            const gain = ctx.createGain()

            oscillator.type = 'sine'
            oscillator.frequency.value = frequency
            gain.gain.setValueAtTime(0.2, now + startDelay)
            gain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + duration)

            oscillator.connect(gain)
            gain.connect(ctx.destination)

            oscillator.start(now + startDelay)
            oscillator.stop(now + startDelay + duration)
        }

        scheduleTone(880, 0, 0.2)
        scheduleTone(440, 0.25, 0.15)
        setTimeout(() => void ctx.close(), 700)
    } catch {
        // Audio may be unavailable on some devices/browser states.
    }
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
    const sourceProgramId = searchParams.get('programId')

    // State
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [feedbackData, setFeedbackData] = useState<Record<string, SetPerformed[]>>({})
    const [exerciseRPE, setExerciseRPE] = useState<Record<string, number | null>>({})
    const [exerciseCompleted, setExerciseCompleted] = useState<Record<string, boolean>>({})
    const [globalNotes, setGlobalNotes] = useState('')
    const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({})
    const [currentStep, setCurrentStep] = useState(0)
    const [recapOpen, setRecapOpen] = useState(false)
    const [prevWeekOpen, setPrevWeekOpen] = useState(false)
    const [dockPos, setDockPos] = useState<{ top: number; left: number } | null>(null)
    const dockRef = useRef<HTMLElement | null>(null)
    const dockDragRef = useRef<{
        startX: number
        startY: number
        origTop: number
        origLeft: number
        moved: boolean
    } | null>(null)


    const { showToast } = useToast()
    const notificationPermissionRequested = useRef(false)

    const requestNotificationPermission = useCallback(() => {
        if (notificationPermissionRequested.current) {
            return
        }

        if (typeof Notification === 'undefined' || Notification.permission !== 'default') {
            return
        }

        notificationPermissionRequested.current = true
        void Notification.requestPermission()
    }, [])

    const onTimerExpire = useCallback(() => {
        playSound()

        if (
            typeof document !== 'undefined' &&
            document.hidden &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
        ) {
            new Notification(t('workouts.restDone'), { silent: true })
            return
        }

        showToast(t('workouts.restDone'), 'success')
    }, [showToast, t])

    const timer = useRestTimer({ onExpire: onTimerExpire })

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
            const initialCompleted: Record<string, boolean> = {}

            const orderedExercises = [...data.data.workout.exercises].sort(
                (left: WorkoutExerciseWithWeight, right: WorkoutExerciseWithWeight) => left.order - right.order
            )

            orderedExercises.forEach((we: WorkoutExerciseWithWeight) => {
                initialCompleted[we.id] = we.isCompleted
                if (we.feedback) {
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
                    initialFeedback[we.id] = Array.from({ length: we.sets }, (_, i) => ({
                        setNumber: i + 1,
                        weight: we.effectiveWeight || 0,
                        reps: 0,
                        completed: false,
                    }))
                    initialRPE[we.id] = we.targetRpe
                }
            })

            setFeedbackData(initialFeedback)
            setExerciseRPE(initialRPE)
            setExerciseCompleted(initialCompleted)
            setCurrentStep(0)
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
        try {
            const saved = localStorage.getItem(DOCK_STORAGE_KEY)
            if (!saved) return
            const parsed = JSON.parse(saved)
            if (typeof parsed?.top === 'number' && typeof parsed?.left === 'number') {
                setDockPos({ top: parsed.top, left: parsed.left })
            }
        } catch {
            // ignore corrupt entry
        }
    }, [])

    useEffect(() => {
        const clampToViewport = () => {
            const el = dockRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            const maxLeft = window.innerWidth - rect.width - DOCK_VIEWPORT_MARGIN
            const maxTop = window.innerHeight - rect.height - DOCK_VIEWPORT_MARGIN
            setDockPos((prev) => {
                if (!prev) return prev
                const next = {
                    top: Math.max(DOCK_VIEWPORT_MARGIN, Math.min(prev.top, maxTop)),
                    left: Math.max(DOCK_VIEWPORT_MARGIN, Math.min(prev.left, maxLeft)),
                }
                return next.top === prev.top && next.left === prev.left ? prev : next
            })
        }
        window.addEventListener('resize', clampToViewport)
        return () => window.removeEventListener('resize', clampToViewport)
    }, [])

    const handleDockPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const el = dockRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        dockDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origTop: rect.top,
            origLeft: rect.left,
            moved: false,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
    }, [])

    const handleDockPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const drag = dockDragRef.current
        if (!drag) return
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (!drag.moved && Math.hypot(dx, dy) < 4) return
        drag.moved = true
        const el = dockRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const maxLeft = window.innerWidth - rect.width - DOCK_VIEWPORT_MARGIN
        const maxTop = window.innerHeight - rect.height - DOCK_VIEWPORT_MARGIN
        const top = Math.max(DOCK_VIEWPORT_MARGIN, Math.min(drag.origTop + dy, maxTop))
        const left = Math.max(DOCK_VIEWPORT_MARGIN, Math.min(drag.origLeft + dx, maxLeft))
        setDockPos({ top, left })
    }, [])

    const handleDockPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const drag = dockDragRef.current
        if (!drag) return
        if (drag.moved) {
            try {
                const el = dockRef.current
                if (el) {
                    const rect = el.getBoundingClientRect()
                    localStorage.setItem(
                        DOCK_STORAGE_KEY,
                        JSON.stringify({ top: rect.top, left: rect.left })
                    )
                }
            } catch {
                // ignore persistence failure
            }
        }
        dockDragRef.current = null
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
        }
    }, [])

    const updateSet = (
        workoutExerciseId: string,
        setIndex: number,
        field: 'weight' | 'reps',
        value: number
    ) => {
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

    const persistExerciseFeedback = useCallback(async (input: {
        workoutExerciseId: string
        nextSets: SetPerformed[]
        previousSets: SetPerformed[]
        previousExerciseCompleted: boolean
    }) => {
        const { workoutExerciseId, nextSets, previousSets, previousExerciseCompleted } = input

        try {
            const res = await fetch(`/api/trainee/workout-exercises/${workoutExerciseId}/feedback`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actualRpe: exerciseRPE[workoutExerciseId] ?? null,
                    sets: nextSets.map((set) => ({
                        setNumber: set.setNumber,
                        completed: !!set.completed,
                        reps: set.reps,
                        weight: set.weight,
                    })),
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('workouts.errorFeedback'), t))
            }

            const cascade = data.data.cascade

            setExerciseCompleted((prev) => ({
                ...prev,
                [workoutExerciseId]: cascade.workoutExercise.isCompleted,
            }))

            if (!cascade.workoutExercise.isCompleted) {
                return
            }

            let toastDelay = 0

            if (cascade.workout.isCompleted) {
                setTimeout(() => {
                    showToast(t('workouts.workoutCompletedToast'), 'success')
                }, toastDelay)
                toastDelay += 200
            }

            if (cascade.week.isCompleted) {
                setTimeout(() => {
                    showToast(
                        t('workouts.weekCompletedToast', { week: cascade.week.weekNumber }),
                        'success'
                    )
                }, toastDelay)
                toastDelay += 200
            }

            if (cascade.program.status === 'completed') {
                setTimeout(() => {
                    showToast(t('workouts.programCompletedToast'), 'success')
                }, toastDelay)
            }
        } catch (err: unknown) {
            setFeedbackData((prev) => ({
                ...prev,
                [workoutExerciseId]: previousSets,
            }))
            setExerciseCompleted((prev) => ({
                ...prev,
                [workoutExerciseId]: previousExerciseCompleted,
            }))
            showToast(err instanceof Error ? err.message : t('workouts.errorFeedback'), 'error')
        }
    }, [exerciseRPE, showToast, t])

    const toggleSetCompleted = (workoutExerciseId: string, setIndex: number) => {
        if (!workout) return
        const we = workout.exercises.find((e) => e.id === workoutExerciseId)
        if (!we) return

        const currentSets = feedbackData[workoutExerciseId] ?? []
        const currentSet = currentSets[setIndex]
        if (!currentSet) return

        const isCompleting = !currentSet.completed

        if (isCompleting) {
            requestNotificationPermission()
            timer.start(REST_TO_SECONDS[we.restTime])
        }

        // "8" → can auto-fill with planned value on first tap
        // "max" → user must enter actual reps (how many they achieved)
        // "6-8", "6/8" → can complete freely (no strict block)
        const isPreciseReps = /^\d+$/.test(we.reps.trim())
        const isMaxReps = we.reps.trim() === 'max'

        if (isCompleting && isMaxReps && !(currentSet.reps > 0)) {
            showToast(t('workouts.errorRepsRequired'), 'error')
            return
        }

        const previousSets = currentSets.map((set) => ({ ...set }))
        const previousExerciseCompleted = exerciseCompleted[workoutExerciseId] ?? false

        // Compute new set state before updating React state
        let newSet: SetPerformed
        if (isCompleting) {
            const effectiveReps = currentSet.reps > 0
                ? currentSet.reps
                : isPreciseReps
                    ? parseInt(we.reps.trim(), 10)
                    : 0
            const effectiveWeight = currentSet.weight > 0
                ? currentSet.weight
                : (we.effectiveWeight ?? we.weight ?? 0)
            newSet = { ...currentSet, completed: true, reps: effectiveReps, weight: effectiveWeight }
        } else {
            newSet = { ...currentSet, completed: false, reps: 0, weight: 0 }
        }

        const newSets = currentSets.map((s, i) => (i === setIndex ? newSet : s))
        const allSetsCompleted = newSets.every((s) => s.completed)

        setFeedbackData((prev) => {
            const updated = { ...prev }
            updated[workoutExerciseId] = newSets
            return updated
        })

        setExerciseCompleted((prev) => ({
            ...prev,
            [workoutExerciseId]: allSetsCompleted,
        }))

        void persistExerciseFeedback({
            workoutExerciseId,
            nextSets: newSets,
            previousSets,
            previousExerciseCompleted,
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

            const payload = {
                notes: globalNotes.trim() || null,
                exercises: workout!.exercises.map((we) => {
                    const sets = feedbackData[we.id] || []
                    return {
                        workoutExerciseId: we.id,
                        actualRpe: exerciseRPE[we.id] ?? null,
                        sets: sets.map((s) => ({
                            setNumber: s.setNumber,
                            completed: !!s.completed,
                            reps: s.reps,
                            weight: s.weight,
                        })),
                    }
                }),
            }

            const res = await fetch(`/api/trainee/workouts/${workout!.id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(getApiErrorMessage(data, t('workouts.errorFeedback'), t))
            }

            clearLocalData()
            showToast(t('workouts.feedbackSuccess'), 'success')

            const navigateTo = fromParam === 'current'
                ? sourceProgramId
                    ? `/trainee/programs/current?programId=${encodeURIComponent(sourceProgramId)}`
                    : '/trainee/programs/current'
                : '/trainee/dashboard'
            router.push(navigateTo)
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('workouts.errorFeedback'), 'error')
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
                const isMaxReps = we.reps.trim() === 'max'
                // precise or max: require reps > 0 to count; ranges: just require checked
                const hasData = (isPreciseReps || isMaxReps)
                    ? sets.some((s) => s.completed && s.reps > 0)
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
            {/* Sticky top bar + floating action dock */}
            <div data-testid="focus-mode-header">
                <nav className="sticky top-0 z-20 bg-white border-b border-gray-200">
                    <div className="flex items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
                        <div className="w-1 h-5 bg-brand-primary rounded-full flex-shrink-0" />
                        <div className="min-w-0 flex-1 leading-tight">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                                {t('workouts.dayWeekShort', {
                                    day: workout.dayIndex,
                                    week: workout.weekNumber,
                                })}
                            </span>
                            <span className="block text-base font-bold text-gray-900 truncate">
                                {workout.program.title}
                            </span>
                        </div>
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
                    <div className="h-1 bg-gray-100">
                        <div
                            className="h-1 bg-brand-primary transition-all duration-300 rounded-r-full"
                            style={{ width: `${workoutProgressPercent}%` }}
                        />
                    </div>
                </nav>

                <aside
                    ref={dockRef}
                    aria-label={t('workouts.quickActionsLabel')}
                    data-swipe-ignore="true"
                    className={`fixed z-20 flex flex-col items-center gap-1 rounded-full border border-gray-200 bg-white/90 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/75 ${
                        dockPos ? '' : 'right-3 top-1/3'
                    }`}
                    style={dockPos ? { top: dockPos.top, left: dockPos.left } : undefined}
                >
                    <button
                        type="button"
                        onPointerDown={handleDockPointerDown}
                        onPointerMove={handleDockPointerMove}
                        onPointerUp={handleDockPointerUp}
                        onPointerCancel={handleDockPointerUp}
                        aria-label={t('workouts.dockDragLabel')}
                        title={t('workouts.dockDragLabel')}
                        className="flex h-6 w-9 cursor-grab touch-none items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    {workout.weekNumber > 1 && (
                        <button
                            type="button"
                            onClick={() => setPrevWeekOpen(true)}
                            aria-label={t('workouts.prevWeekTitle')}
                            className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-primary"
                        >
                            <History className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setRecapOpen(true)}
                        aria-label={t('workouts.recapTitle')}
                        className="rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-primary"
                    >
                        <ClipboardList className="h-5 w-5" />
                    </button>
                    <div className="w-full px-1 pt-1">
                        <FloatingRestTimer
                            mode="dock"
                            secondsLeft={timer.secondsLeft}
                            totalSeconds={timer.totalSeconds}
                            onStop={timer.stop}
                        />
                    </div>
                </aside>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-32">
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
                            exercises={sortedExercises}
                            feedbackData={feedbackData}
                            globalNotes={globalNotes}
                            onNotesChange={setGlobalNotes}
                            onSelectExercise={goToStep}
                            t={t}
                        />
                    )}
                </div>
            </div>

            {/* Sticky bottom nav */}
            <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 pb-[env(safe-area-inset-bottom)] sm:px-6 lg:px-8">
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
                </div>
            </nav>

            <WorkoutRecapPanel
                workoutId={workoutId}
                isOpen={recapOpen}
                onClose={() => setRecapOpen(false)}
                onSelectExercise={(exerciseId) => {
                    const idx = sortedExercises.findIndex((e) => e.id === exerciseId)
                    if (idx !== -1) goToStep(idx)
                }}
            />
            <PrevWeekPanel
                workoutId={workoutId}
                isOpen={prevWeekOpen}
                onClose={() => setPrevWeekOpen(false)}
            />
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
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        <span
                            className={`mr-1.5 text-sm font-bold align-middle ${
                                we.exercise.type === 'fundamental' ? 'text-red-600' : 'text-blue-600'
                            }`}
                        >
                            {we.exercise.type === 'fundamental' ? 'F' : 'A'}
                        </span>
                        {we.exercise.name}
                    </h2>
                    {we.variant && (
                        <p className="text-sm text-gray-600 mb-2">{we.variant}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <Clock3 className="w-3 h-3" />
                            <span className="font-semibold">{t('workouts.rest')}:</span>
                            {formatRestTime(we.restTime)}
                        </span>
                    </div>
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
                    <div className="flex-[0.75] rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-3 py-3 text-center">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary">
                            RPE
                        </span>
                        <span className="mt-1 block text-2xl font-black text-gray-900">
                            {we.targetRpe ?? '—'}
                        </span>
                    </div>
                </div>

                {/* Secondary row - rest and RPE */}
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
                <div className="grid grid-cols-[40px_1fr_1fr_48px] gap-x-2 px-2 mb-4">
                    <span />
                    <span className="pb-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {t('workouts.repsShort')}
                    </span>
                    <span className="pb-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {t('workouts.kgShort')}
                    </span>
                    <span />
                    {sets.map((set, setIdx) => {
                        const border = setIdx < sets.length - 1 ? 'border-b border-gray-200' : ''
                        return (
                            <Fragment key={setIdx}>
                                <div className={`flex items-center justify-center ${border}`}>
                                    <span className="text-sm font-semibold text-gray-600">#{set.setNumber}</span>
                                </div>
                                <div className={`flex items-center py-2 ${border}`}>
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        placeholder={/^\d+$/.test(we.reps.trim()) ? String(parsePlannedReps(we.reps)) : we.reps}
                                        value={set.reps || ''}
                                        onChange={(e) =>
                                            onUpdateSet(we.id, setIdx, 'reps', parseInt(e.target.value) || 0)
                                        }
                                        disabled={!!set.completed}
                                        aria-label={`${t('workouts.reps')} ${set.setNumber}`}
                                        inputSize="md"
                                        className="text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                                <div className={`flex items-center py-2 ${border}`}>
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
                                        disabled={!!set.completed}
                                        aria-label={`${t('workouts.weightKg')} ${set.setNumber}`}
                                        inputSize="md"
                                        className="text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                                <div className={`flex items-center justify-center ${border}`}>
                                    <button
                                        type="button"
                                        onClick={() => onToggleSet(we.id, setIdx)}
                                        className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                                            set.completed
                                                ? 'border-green-300 bg-green-100 text-green-700'
                                                : 'border-gray-300 bg-white text-gray-400 hover:border-green-300 hover:text-green-600'
                                        }`}
                                        aria-label={t('workouts.markSetDone')}
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </Fragment>
                        )
                    })}
                </div>
            </div>

            {/* Footer: overall RPE */}
            <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="flex flex-row items-center justify-end gap-2">
                    <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        {t('workouts.overallRpe')}
                    </label>
                    <RPESelector
                        value={rpe}
                        onChange={onUpdateRpe}
                        showLabel={false}
                        showDescription={false}
                        centeredMenu={true}
                        title={t('workouts.overallRpe')}
                        placeholder={t('workouts.selectRpe')}
                        descriptions={rpeDescriptions}
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
    exercises: WorkoutExerciseWithWeight[]
    feedbackData: Record<string, SetPerformed[]>
    globalNotes: string
    onNotesChange: (notes: string) => void
    onSelectExercise: (stepIndex: number) => void
    t: (key: string, vars?: Record<string, unknown>) => string
}

function FinalStep({
    completed,
    total,
    totalSets,
    exercises,
    feedbackData,
    globalNotes,
    onNotesChange,
    onSelectExercise,
    t,
}: FinalStepProps) {
    const incompleteExercises = exercises.filter((we) => {
        const completedSets = (feedbackData[we.id] || []).filter((s) => s.completed).length
        return completedSets < we.sets
    })

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {t('workouts.summaryTitle')}
                </h2>
                <p className="text-gray-600 mb-4">
                    {t('workouts.summaryStats', {
                        done: completed,
                        total,
                        sets: totalSets,
                    })}
                </p>

                {incompleteExercises.length > 0 && (
                    <div className="space-y-2 mb-6">
                        {incompleteExercises.map((we) => {
                            const idx = exercises.indexOf(we)
                            const sets = feedbackData[we.id] || []
                            const completedSets = sets.filter((s) => s.completed).length
                            const weight = formatWeightKg(we.effectiveWeight ?? we.weight)

                            return (
                                <button
                                    key={we.id}
                                    type="button"
                                    onClick={() => onSelectExercise(idx)}
                                    className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {we.exercise.name}
                                                {we.variant && (
                                                    <span className="ml-1.5 text-xs font-normal text-gray-500">
                                                        {we.variant}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-500">
                                                {t('workouts.summaryExerciseSpec', {
                                                    sets: we.sets,
                                                    reps: we.reps,
                                                    weight,
                                                })}
                                            </p>
                                        </div>
                                        <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums bg-amber-100 text-amber-700">
                                            {t('workouts.summaryExerciseSets', {
                                                completed: completedSets,
                                                total: we.sets,
                                            })}
                                        </span>
                                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-amber-500" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}

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
        </div>
    )
}
