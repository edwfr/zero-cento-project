'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle2, Circle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ExerciseRecapItem, ExerciseStatus } from '@/lib/workout-recap'

interface WorkoutRecapPanelProps {
    workoutId: string
    closeSignal?: number
    refreshSignal?: number
    onSelectExercise?: (workoutExerciseId: string) => void
}

export default function WorkoutRecapPanel({
    workoutId,
    closeSignal,
    refreshSignal,
    onSelectExercise,
}: WorkoutRecapPanelProps) {
    const { t } = useTranslation('trainee')
    const recapErrorText = t('workouts.recapError')
    const [expanded, setExpanded] = useState(false)
    const [exercises, setExercises] = useState<ExerciseRecapItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (closeSignal === undefined) return
        setExpanded(false)
    }, [closeSignal])

    useEffect(() => {
        if (!expanded) return
        let cancelled = false

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/trainee/workouts/${workoutId}/recap`)
                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data?.error?.message ?? recapErrorText)
                }

                if (!cancelled) {
                    const fetchedExercises = data?.data?.exercises ?? []
                    setExercises(fetchedExercises)
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : recapErrorText)
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
    }, [expanded, workoutId, recapErrorText, refreshSignal])

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
                <ClipboardList className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="flex-1 text-sm font-semibold text-gray-700">{t('workouts.recapTitle')}</span>
                {expanded
                    ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
            </button>

            {expanded && (
                <div className="space-y-2 border-t border-gray-100 px-4 py-3">
                    {loading && (
                        <p className="py-4 text-center text-sm text-gray-500">{t('workouts.recapLoading')}</p>
                    )}

                    {error && (
                        <p className="py-4 text-center text-sm text-red-600">{error}</p>
                    )}

                    {!loading && !error && (
                        <>
                            <ul className="space-y-2">
                                {exercises.map((exercise) => (
                                    <li key={exercise.id} className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSelectExercise?.(exercise.id)
                                                setExpanded(false)
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
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
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