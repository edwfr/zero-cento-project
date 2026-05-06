'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, Circle, Clock, FileText } from 'lucide-react'
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
    const [workoutNote, setWorkoutNote] = useState<string | null>(null)
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
                    setWorkoutNote(data?.data?.workoutNote ?? null)
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
                className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-xl"
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

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                    {loading && (
                        <p className="py-8 text-center text-sm text-gray-500">{t('workouts.recapLoading')}</p>
                    )}

                    {error && (
                        <p className="py-8 text-center text-sm text-red-600">{error}</p>
                    )}

                    {!loading && !error && (
                        <>
                            <ul className="space-y-2">
                                {exercises.map((exercise) => (
                                    <li key={exercise.id} className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                                        {/* Exercise header row — tappable to navigate */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSelectExercise?.(exercise.id)
                                                onClose()
                                            }}
                                            disabled={!onSelectExercise}
                                            className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-100 disabled:cursor-default"
                                        >
                                            <StatusIcon status={exercise.status} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-gray-800">
                                                    {exercise.exerciseName}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {exercise.targetSets} × {exercise.reps}
                                                    {exercise.effectiveWeight != null ? ` × ${exercise.effectiveWeight} kg` : ''}
                                                </p>
                                            </div>
                                            <span className="shrink-0 tabular-nums text-xs font-semibold text-gray-500">
                                                {t('workouts.recapSets', {
                                                    completed: exercise.completedSets,
                                                    target: exercise.targetSets,
                                                })}
                                            </span>
                                        </button>

                                        {/* Sets performed */}
                                        {exercise.sets.length > 0 && (
                                            <div className="border-t border-gray-100 px-3 pt-2 pb-2">
                                                <ul className="space-y-0.5">
                                                    {exercise.sets.map((set) => (
                                                        <li
                                                            key={set.setNumber}
                                                            className={`flex items-center gap-2 text-xs tabular-nums ${set.completed ? 'text-gray-700' : 'text-gray-400 line-through'}`}
                                                        >
                                                            <span className="w-12 shrink-0 font-medium text-gray-400">
                                                                {t('workouts.recapSetLabel', { set: set.setNumber })}
                                                            </span>
                                                            <span>
                                                                {set.reps} {t('workouts.recapRepsUnit')} × {set.weight} kg
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>

                                                {/* RPE */}
                                                {exercise.actualRpe != null && (
                                                    <p className="mt-1.5 text-xs text-gray-500">
                                                        <span className="font-semibold">RPE:</span> {exercise.actualRpe}
                                                    </p>
                                                )}

                                                {/* Exercise note */}
                                                {exercise.exerciseNote && (
                                                    <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500 italic">
                                                        <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                                                        {exercise.exerciseNote}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            {/* Workout note */}
                            {workoutNote && (
                                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                        {t('workouts.recapWorkoutNote')}
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{workoutNote}</p>
                                </div>
                            )}
                        </>
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