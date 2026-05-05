'use client'

import { useEffect, useState } from 'react'
import { X, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'

interface PrevWeekPanelProps {
    workoutId: string
    isOpen: boolean
    onClose: () => void
}

export default function PrevWeekPanel({ workoutId, isOpen, onClose }: PrevWeekPanelProps) {
    const { t } = useTranslation('trainee')
    const prevWeekErrorText = t('workouts.prevWeekError')
    const [exercises, setExercises] = useState<PrevWeekExerciseItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return
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
                    setExercises(data?.data?.exercises ?? [])
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
    }, [isOpen, workoutId, prevWeekErrorText])

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
                aria-label={t('workouts.prevWeekTitle')}
                className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-xl"
            >
                <div className="flex justify-center pb-1 pt-3">
                    <div className="h-1 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-gray-400" />
                        <h2 className="text-base font-bold text-gray-900">{t('workouts.prevWeekTitle')}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('workouts.prevWeekClose')}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {loading && (
                        <p className="py-8 text-center text-sm text-gray-500">{t('workouts.prevWeekLoading')}</p>
                    )}

                    {error && (
                        <p className="py-8 text-center text-sm text-red-600">{error}</p>
                    )}

                    {!loading && !error && (
                        <ul className="space-y-0">
                            {exercises.map((exercise) => (
                                <li
                                    key={exercise.id}
                                    className="border-b border-gray-100 py-3 last:border-0"
                                >
                                    <p className="mb-1 truncate text-sm font-semibold text-gray-800">
                                        {exercise.exerciseName}
                                    </p>
                                    {exercise.sets.length === 0 ? (
                                        <p className="text-xs text-gray-400">{t('workouts.prevWeekNoData')}</p>
                                    ) : (
                                        <ul className="space-y-0.5">
                                            {exercise.sets.map((set) => (
                                                <li
                                                    key={set.setNumber}
                                                    className="text-xs text-gray-500 tabular-nums"
                                                >
                                                    {t('workouts.prevWeekSetRow', {
                                                        set: set.setNumber,
                                                        reps: set.reps,
                                                        weight: set.weight,
                                                    })}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    )
}
