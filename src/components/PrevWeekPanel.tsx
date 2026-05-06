'use client'

import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'
import WorkoutExerciseDisplayList, { type ExerciseDisplayItem } from './WorkoutExerciseDisplayList'

const prevWeekCache = new Map<string, PrevWeekExerciseItem[]>()

export function __resetPrevWeekCacheForTests() {
    prevWeekCache.clear()
}

interface PrevWeekPanelProps {
    workoutId: string
}

export default function PrevWeekPanel({ workoutId }: PrevWeekPanelProps) {
    const { t } = useTranslation('trainee')
    const prevWeekErrorText = t('workouts.prevWeekError')
    const [expanded, setExpanded] = useState(false)
    const [exercises, setExercises] = useState<PrevWeekExerciseItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!expanded) return
        const cached = prevWeekCache.get(workoutId)
        if (cached) {
            setExercises(cached)
            setError(null)
            return
        }
        if (exercises.length > 0 || error) return // already loaded
        let cancelled = false

        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/trainee/workouts/${workoutId}/prev-week`)
                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data?.error?.message ?? prevWeekErrorText)
                }

                if (!cancelled) {
                    const fetchedExercises = data?.data?.exercises ?? []
                    prevWeekCache.set(workoutId, fetchedExercises)
                    setExercises(fetchedExercises)
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : prevWeekErrorText)
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
    }, [expanded, workoutId, prevWeekErrorText, exercises.length, error])

    const displayItems: ExerciseDisplayItem[] = exercises.map((ex) => ({
        id: ex.id,
        exerciseName: ex.exerciseName,
        scheme: `${ex.targetSets} x ${ex.targetReps}`,
        performedSets: ex.sets,
        traineeNote: ex.exerciseNote,
    }))

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Header / toggle */}
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
                <History className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="flex-1 text-sm font-semibold text-gray-700">
                    {t('workouts.prevWeekTitle')}
                </span>
                {expanded
                    ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                }
            </button>

            {/* Collapsible body */}
            {expanded && (
                <div className="border-t border-gray-100 px-4 py-3">
                    {loading && (
                        <p className="py-4 text-center text-sm text-gray-500">{t('workouts.prevWeekLoading')}</p>
                    )}

                    {error && (
                        <p className="py-4 text-center text-sm text-red-600">{error}</p>
                    )}

                    {!loading && !error && (
                        <WorkoutExerciseDisplayList
                            items={displayItems}
                            emptyText={t('workouts.prevWeekNoData')}
                            setRowLabel={(set, reps, weight) =>
                                t('workouts.prevWeekSetRow', { set, reps, weight })
                            }
                        />
                    )}
                </div>
            )}
        </div>
    )
}
