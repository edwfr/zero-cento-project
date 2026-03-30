'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
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
    sets: number
    reps: string
    targetRpe: number
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
    weight: number | null
    effectiveWeight: number | null
    restTime: number
    isWarmup: boolean
    notes: string | null
    order: number
    feedback: ExerciseFeedback | null
}

interface SetPerformed {
    setNumber: number
    weight: number
    reps: number
}

interface ExerciseRPE {
    workoutExerciseId: string
    rpe: number | null
}

interface Workout {
    id: string
    dayLabel: string
    notes: string | null
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    program: {
        id: string
        title: string
    }
    exercises: WorkoutExerciseWithWeight[]
}

export default function WorkoutDetailPage() {
    const router = useRouter()
    const params = useParams()
    const workoutId = params.id as string

    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [workout, setWorkout] = useState<Workout | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Feedback state
    const [feedbackData, setFeedbackData] = useState<Record<string, SetPerformed[]>>({})
    const [exerciseRPE, setExerciseRPE] = useState<Record<string, number | null>>({})
    const [globalNotes, setGlobalNotes] = useState('')
    const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({})
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

    const fetchWorkout = async () => {
        try {
            setLoading(true)

            const res = await fetch(`/api/trainee/workouts/${workoutId}`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento workout')
            }

            setWorkout(data.data.workout)

            // Initialize feedback data structure
            const initialFeedback: Record<string, SetPerformed[]> = {}
            const initialRPE: Record<string, number | null> = {}

            data.data.workout.exercises.forEach((we: WorkoutExerciseWithWeight) => {
                // If feedback exists, load it
                if (we.feedback) {
                    initialFeedback[we.id] = we.feedback.setsPerformed.map(sp => ({
                        setNumber: sp.setNumber,
                        weight: sp.weight,
                        reps: sp.reps,
                    }))
                    initialRPE[we.id] = we.feedback.avgRPE
                    if (we.feedback.notes) {
                        setGlobalNotes(we.feedback.notes)
                    }
                } else {
                    // Initialize empty sets with effectiveWeight as default
                    initialFeedback[we.id] = Array.from({ length: we.sets }, (_, i) => ({
                        setNumber: i + 1,
                        weight: we.effectiveWeight || 0,
                        reps: 0,
                    }))
                    initialRPE[we.id] = we.targetRpe
                }
                // Expand all exercises by default
                setExpandedExercises((prev) => ({ ...prev, [we.id]: true }))
            })

            setFeedbackData(initialFeedback)
            setExerciseRPE(initialRPE)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const loadLocalData = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                setFeedbackData(parsed.feedbackData || {})
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

    const updateExerciseRPE = (workoutExerciseId: string, rpe: number) => {
        setExerciseRPE((prev) => ({
            ...prev,
            [workoutExerciseId]: rpe,
        }))
    }

    const calculateExerciseVolume = (workoutExerciseId: string): number => {
        const sets = feedbackData[workoutExerciseId] || []
        return sets.reduce((total, set) => total + set.weight * set.reps, 0)
    }

    const calculateTotalVolume = (): number => {
        return Object.keys(feedbackData).reduce(
            (total, weId) => total + calculateExerciseVolume(weId),
            0
        )
    }

    const calculateAverageRPE = (): number => {
        const rpeValues = Object.values(exerciseRPE).filter((rpe): rpe is number => rpe !== null && rpe > 0)
        if (rpeValues.length === 0) return 0
        const sum = rpeValues.reduce((total, rpe) => total + rpe, 0)
        return Math.round((sum / rpeValues.length) * 10) / 10
    }

    const doSubmit = async () => {
        setConfirmModal(null)
        try {
            setSubmitting(true)

            // Submit feedback for each exercise
            const feedbackPromises = workout!.exercises.map(async (we) => {
                const sets = feedbackData[we.id] || []

                // Skip exercises with no data
                if (sets.every(s => s.weight === 0 && s.reps === 0)) {
                    return null
                }

                const payload = {
                    workoutExerciseId: we.id,
                    notes: globalNotes.trim() || null,
                    sets: sets.map(s => ({
                        setNumber: s.setNumber,
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
                    throw new Error(data.error?.message || 'Errore invio feedback')
                }

                return res.json()
            })

            await Promise.all(feedbackPromises)

            // Clear local storage
            clearLocalData()

            showToast('Feedback inviato con successo!', 'success')
            router.push('/trainee/dashboard')
        } catch (err: any) {
            showToast(err.message, 'error')
            setSubmitting(false)
        }
    }

    const handleSubmit = () => {
        if (!workout) return

        // Validate all sets have data
        const emptyExercises: string[] = []
        workout.exercises.forEach((we) => {
            const sets = feedbackData[we.id] || []
            const hasData = sets.some((s) => s.weight > 0 && s.reps > 0)
            if (!hasData) {
                emptyExercises.push(we.exercise.name)
            }
        })

        if (emptyExercises.length > 0) {
            setConfirmModal({
                title: 'Dati Mancanti',
                message: `I seguenti esercizi non hanno dati: ${emptyExercises.join(', ')}. Vuoi continuare comunque?`,
                confirmText: 'Continua',
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !workout) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || 'Workout non trovato'}
                </div>
            </div>
        )
    }

    const sortedExercises = [...workout.exercises].sort((a, b) => a.order - b.order)
    const totalVolume = calculateTotalVolume()
    const avgRPE = calculateAverageRPE()

    return (
        <div className="min-h-screen bg-gray-50" {...pageSwipeHandlers}>
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText ?? 'Conferma'}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainee/programs/current"
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna al Programma
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {workout.dayLabel} - Settimana {workout.weekNumber}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {workout.program.title}
                    </p>
                    {workout.weekType === 'deload' && (
                        <div className="mt-3 inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                            🧘 Settimana Deload - Recupero
                        </div>
                    )}
                    {workout.weekType === 'test' && (
                        <div className="mt-3 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                            💪 Settimana Test - Massimali
                        </div>
                    )}
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Volume Totale</p>
                        <p className="text-2xl font-bold text-[#FFA700]">{totalVolume} kg</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">RPE Medio</p>
                        <p className="text-2xl font-bold text-[#FFA700]">{avgRPE || '-'}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Esercizi</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {sortedExercises.length}
                        </p>
                    </div>
                </div>

                {/* Auto-save indicator */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                    <p className="text-sm text-blue-900">
                        💾 <span className="font-semibold">Auto-Save Attivo:</span> I tuoi dati
                        vengono salvati automaticamente sul dispositivo
                    </p>
                </div>

                {/* Mobile swipe hint — shown only on touch devices */}
                {sortedExercises.length > 1 && (
                    <div className="flex items-center justify-center gap-2 mb-4 md:hidden">
                        <button
                            onClick={() => navigateToExercise(activeExerciseIndex - 1)}
                            disabled={activeExerciseIndex === 0}
                            className="p-2 rounded-full bg-white shadow disabled:opacity-30 text-gray-600"
                            aria-label="Esercizio precedente"
                        >
                            ‹
                        </button>
                        <span className="text-xs text-gray-500 select-none">
                            Scorri ← → per navigare tra gli esercizi ({activeExerciseIndex + 1}/{sortedExercises.length})
                        </span>
                        <button
                            onClick={() => navigateToExercise(activeExerciseIndex + 1)}
                            disabled={activeExerciseIndex === sortedExercises.length - 1}
                            className="p-2 rounded-full bg-white shadow disabled:opacity-30 text-gray-600"
                            aria-label="Prossimo esercizio"
                        >
                            ›
                        </button>
                    </div>
                )}

                {/* Exercises List */}
                <div className="space-y-4 mb-8">
                    {sortedExercises.map((we, idx) => {
                        const isExpanded = expandedExercises[we.id]
                        const volume = calculateExerciseVolume(we.id)

                        return (
                            <div
                                key={we.id}
                                ref={(el) => { exerciseRefs.current[we.id] = el }}
                                className={`bg-white rounded-lg shadow-md overflow-hidden transition-shadow ${idx === activeExerciseIndex ? 'ring-2 ring-[#FFA700]' : ''
                                    }`}
                            >
                                {/* Exercise Header */}
                                <div
                                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => toggleExercise(we.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <span className="text-2xl font-bold text-gray-400">
                                                    {idx + 1}
                                                </span>
                                                <h3 className="text-xl font-bold text-gray-900">
                                                    {we.exercise.name}
                                                </h3>
                                                <span
                                                    className={`px-2 py-1 text-xs font-semibold rounded ${we.exercise.type === 'fundamental'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                        }`}
                                                >
                                                    {we.exercise.type === 'fundamental'
                                                        ? 'Fondamentale'
                                                        : 'Accessorio'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-600">Serie</p>
                                                    <p className="font-semibold text-gray-900">
                                                        {we.sets}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">Reps</p>
                                                    <p className="font-semibold text-gray-900">
                                                        {we.reps}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">Peso</p>
                                                    <p className="font-semibold text-gray-900">
                                                        {we.effectiveWeight
                                                            ? `${we.effectiveWeight.toFixed(1)} kg`
                                                            : we.weight
                                                                ? `${we.weight} ${we.weightType === 'absolute' ? 'kg' : '%'}`
                                                                : '-'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">Riposo</p>
                                                    <p className="font-semibold text-gray-900">
                                                        {Math.floor(we.restTime / 60)}:
                                                        {(we.restTime % 60)
                                                            .toString()
                                                            .padStart(2, '0')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">RPE Target</p>
                                                    <p className="font-semibold text-gray-900">
                                                        {we.targetRpe}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600">Volume</p>
                                                    <p className="font-semibold text-[#FFA700]">
                                                        {volume} kg
                                                    </p>
                                                </div>
                                            </div>

                                            {we.notes && (
                                                <p className="text-sm text-gray-600 mt-3 italic">
                                                    📝 {we.notes}
                                                </p>
                                            )}
                                        </div>

                                        <button className="ml-4 text-gray-400 hover:text-gray-600">
                                            {isExpanded ? '▲' : '▼'}
                                        </button>
                                    </div>
                                </div>

                                {/* Exercise Details (Expandable) */}
                                {isExpanded && (
                                    <div className="border-t border-gray-200 p-6 bg-gray-50">
                                        {/* YouTube Video */}
                                        {we.exercise.youtubeUrl && (
                                            <div className="mb-6">
                                                <YoutubeEmbed videoUrl={we.exercise.youtubeUrl} />
                                            </div>
                                        )}

                                        {/* Sets Input Table */}
                                        <div className="overflow-x-auto mb-4">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-300">
                                                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                                                            Serie
                                                        </th>
                                                        <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">
                                                            Peso (kg)
                                                        </th>
                                                        <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">
                                                            Reps
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
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                                                />
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
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Overall Exercise RPE */}
                                        <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg">
                                            <label className="text-sm font-semibold text-gray-700">
                                                RPE Complessivo:
                                            </label>
                                            <select
                                                value={exerciseRPE[we.id] || ''}
                                                onChange={(e) =>
                                                    updateExerciseRPE(we.id, parseFloat(e.target.value))
                                                }
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                            >
                                                <option value="">Seleziona RPE</option>
                                                {[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((rpe) => (
                                                    <option key={rpe} value={rpe}>
                                                        {rpe}
                                                    </option>
                                                ))}
                                            </select>
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
                        Note Workout (opzionali)
                    </label>
                    <textarea
                        value={globalNotes}
                        onChange={(e) => setGlobalNotes(e.target.value)}
                        placeholder="Come ti sei sentito? Difficoltà? Note per il trainer..."
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg flex items-center justify-center"
                >
                    {submitting ? (
                        <LoadingSpinner size="sm" color="white" />
                    ) : (
                        '✅ Completa Workout e Invia Feedback'
                    )}
                </button>
            </div>
        </div>
    )
}
