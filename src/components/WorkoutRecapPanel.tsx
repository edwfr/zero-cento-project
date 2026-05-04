'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, Circle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ExerciseRecapItem, ExerciseStatus } from '@/lib/workout-recap'

interface WorkoutRecapPanelProps {
    workoutId: string
    isOpen: boolean
    onClose: () => void
    onSelectExercise?: (workoutExerciseId: string) => void
}

export default function WorkoutRecapPanel({ workoutId, isOpen, onClose, onSelectExercise }: WorkoutRecapPanelProps) {
    const { t } = useTranslation('trainee')
    const [exercises, setExercises] = useState<ExerciseRecapItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/trainee/workouts/${workoutId}/recap`)
                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data?.error?.message ?? t('workouts.recapError'))
                }

                if (!cancelled) {
                    setExercises(data?.data?.exercises ?? [])
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t('workouts.recapError'))
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        void load()
        return () => {
            cancelled = true
        }
    }, [isOpen, workoutId, t])

    if (!isOpen) return null

    return (
        <>
            <div
                className="fixed inset-0 z-30 bg-black/40"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                role="dialog"
                aria-label={t('workouts.recapTitle')}
                className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-xl"
            >
                <div className="flex justify-center pb-1 pt-3">
                    <div className="h-1 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <h2 className="text-base font-bold text-gray-900">{t('workouts.recapTitle')}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('workouts.recapClose')}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {loading && (
                        <p className="py-8 text-center text-sm text-gray-500">{t('workouts.recapLoading')}</p>
                    )}

                    {error && (
                        <p className="py-8 text-center text-sm text-red-600">{error}</p>
                    )}

                    {!loading && !error && (
                        <ul className="space-y-0">
                            {exercises.map((exercise) => (
                                <li key={exercise.id} className="border-b border-gray-100 last:border-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelectExercise?.(exercise.id)
                                            onClose()
                                        }}
                                        disabled={!onSelectExercise}
                                        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-default"
                                    >
                                        <StatusIcon status={exercise.status} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-800">
                                                {exercise.exerciseName}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {exercise.targetSets} × {exercise.reps} × {exercise.effectiveWeight != null ? `${exercise.effectiveWeight} kg` : '-'}
                                            </p>
                                        </div>
                                        <span className="shrink-0 tabular-nums text-xs text-gray-400">
                                            {t('workouts.recapSets', {
                                                completed: exercise.completedSets,
                                                target: exercise.targetSets,
                                            })}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    )
}

function StatusIcon({ status }: { status: ExerciseStatus }) {
    if (status === 'done') {
        return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
    }
    if (status === 'in_progress') {
        return <Clock className="h-5 w-5 shrink-0 text-amber-500" />
    }
    return <Circle className="h-5 w-5 shrink-0 text-gray-300" />
}

function getStatusLabel(
    t: (key: string, options?: Record<string, unknown>) => string,
    status: ExerciseStatus
) {
    if (status === 'done') return t('workouts.recapStatusDone')
    if (status === 'in_progress') return t('workouts.recapStatusInProgress')
    return t('workouts.recapStatusNotStarted')
}