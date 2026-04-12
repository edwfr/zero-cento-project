'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RPESelector from './RPESelector'
import { Button } from '@/components/Button'

interface SetPerformed {
    setNumber: number
    reps: number
    weight: number
}

interface FeedbackFormProps {
    workoutExerciseName: string
    prescribedSets: number
    prescribedReps: string
    prescribedWeight?: number
    onSubmit: (data: {
        sets: SetPerformed[]
        actualRpe: number | null
        notes: string
        completed: boolean
    }) => void
    onCancel?: () => void
    isSubmitting?: boolean
}

export default function FeedbackForm({
    workoutExerciseName,
    prescribedSets,
    prescribedReps,
    prescribedWeight,
    onSubmit,
    onCancel,
    isSubmitting = false,
}: FeedbackFormProps) {
    const { t } = useTranslation(['components', 'common'])
    const [sets, setSets] = useState<SetPerformed[]>(
        Array.from({ length: prescribedSets }, (_, i) => ({
            setNumber: i + 1,
            reps: 0,
            weight: prescribedWeight || 0,
        }))
    )
    const [actualRpe, setActualRpe] = useState<number | null>(null)
    const [notes, setNotes] = useState('')
    const [completed, setCompleted] = useState(true)

    const handleSetChange = (index: number, field: 'reps' | 'weight', value: number) => {
        const newSets = [...sets]
        newSets[index][field] = value
        setSets(newSets)
    }

    const addSet = () => {
        setSets([
            ...sets,
            {
                setNumber: sets.length + 1,
                reps: 0,
                weight: sets[sets.length - 1]?.weight || prescribedWeight || 0,
            },
        ])
    }

    const removeSet = (index: number) => {
        if (sets.length <= 1) return
        const newSets = sets.filter((_, i) => i !== index)
        // Renumber sets
        newSets.forEach((set, i) => {
            set.setNumber = i + 1
        })
        setSets(newSets)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSubmit({ sets, actualRpe, notes, completed })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-lg">
            {/* Header */}
            <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-bold text-gray-900">{workoutExerciseName}</h3>
                <p className="text-sm text-gray-600">
                    {t('components:feedbackForm.prescribed')}: {prescribedSets} {t('components:feedbackForm.sets')} × {prescribedReps} {t('components:feedbackForm.reps')}
                    {prescribedWeight && ` @ ${prescribedWeight}kg`}
                </p>
            </div>

            {/* Completed Toggle */}
            <label className="flex cursor-pointer items-center gap-3">
                <input
                    type="checkbox"
                    checked={completed}
                    onChange={(e) => setCompleted(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm font-medium text-gray-700">{t('components:feedbackForm.completed')}</span>
            </label>

            {/* Sets Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">{t('components:feedbackForm.set')}</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">{t('components:feedbackForm.reps')}</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">{t('components:feedbackForm.weight')}</th>
                            <th className="px-2 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sets.map((set, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-2 py-2 font-medium text-gray-900">{set.setNumber}</td>
                                <td className="px-2 py-2">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        max="50"
                                        value={set.reps || ''}
                                        onChange={(e) =>
                                            handleSetChange(index, 'reps', parseInt(e.target.value) || 0)
                                        }
                                        className="w-16 rounded border border-gray-300 px-2 py-1 text-center focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        max="500"
                                        step="0.5"
                                        value={set.weight || ''}
                                        onChange={(e) =>
                                            handleSetChange(index, 'weight', parseFloat(e.target.value) || 0)
                                        }
                                        className="w-20 rounded border border-gray-300 px-2 py-1 text-center focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    {sets.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeSet(index)}
                                            className="text-red-500 hover:text-red-700"
                                            title={t('components:feedbackForm.removeSet')}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                            <td className="px-2 py-2">{t('components:feedbackForm.total')}</td>
                            <td className="px-2 py-2">{sets.reduce((sum, s) => sum + s.reps, 0)}</td>
                            <td className="px-2 py-2">-</td>
                            <td className="px-2 py-2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Add Set Button */}
            <button
                type="button"
                onClick={addSet}
                className="self-start rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-brand-primary hover:text-brand-primary"
            >
                + {t('components:feedbackForm.addSet')}
            </button>

            {/* RPE Selector */}
            <RPESelector value={actualRpe} onChange={setActualRpe} />

            {/* Notes */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">{t('components:feedbackForm.notes')}</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder={t('components:feedbackForm.notesPlaceholder')}
                    className="rounded-lg border-2 border-gray-300 px-4 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
                <span className="text-xs text-gray-500">{notes.length}/1000 {t('common:common.characters')}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-gray-200 pt-4">
                {onCancel && (
                    <Button
                        type="button"
                        onClick={onCancel}
                        variant="secondary"
                        size="md"
                        className="flex-1"
                        disabled={isSubmitting}
                    >
                        {t('common:common.cancel')}
                    </Button>
                )}
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="flex-1 shadow-md"
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    loadingText={t('common:common.submitting')}
                >
                    {t('components:feedbackForm.saveFeedback')}
                </Button>
            </div>
        </form>
    )
}
