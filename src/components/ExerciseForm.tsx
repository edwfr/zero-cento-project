'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import ExerciseTypeRadioGroup from '@/components/ExerciseTypeRadioGroup'
import { DEFAULT_EXERCISE_TYPE, type ExerciseType } from '@/lib/exercise-type'

interface MuscleGroup {
    id: string
    name: string
}

interface MovementPattern {
    id: string
    name: string
}

interface MuscleGroupInput {
    muscleGroupId: string
    coefficient: number
}

export interface CreatedExercise {
    id: string
    name: string
}

/** Cancel either navigates to `cancelHref` (a plain link) or calls `onCancel`. */
type ExerciseFormCancelProps =
    | { cancelHref: string; onCancel?: never }
    | { onCancel: () => void; cancelHref?: never }

export type ExerciseFormProps = ExerciseFormCancelProps & {
    onSuccess: (exercise: CreatedExercise) => void
    /** Called with `true` when the POST starts and `false` when it settles. */
    onSubmittingChange?: (submitting: boolean) => void
}

/**
 * Create-exercise form shared by `/trainer/exercises/new` and `ExerciseQuickCreateModal`.
 * Loads muscle groups and movement patterns, validates, POSTs to `/api/exercises`
 * and reports the created exercise through `onSuccess`.
 */
export default function ExerciseForm({ onSuccess, onCancel, cancelHref, onSubmittingChange }: ExerciseFormProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const [loading, setLoading] = useState(false)
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
    const [movementPatterns, setMovementPatterns] = useState<MovementPattern[]>([])
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [variants, setVariants] = useState<string[]>([])
    const [youtubeUrl, setYoutubeUrl] = useState('')
    const [type, setType] = useState<ExerciseType>(DEFAULT_EXERCISE_TYPE)
    const [isBodyweightLoaded, setIsBodyweightLoaded] = useState(false)
    const [movementPatternId, setMovementPatternId] = useState('')
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<MuscleGroupInput[]>([])

    useEffect(() => {
        onSubmittingChange?.(loading)
    }, [loading, onSubmittingChange])

    const fetchData = useCallback(async () => {
        try {
            const [mgRes, mpRes] = await Promise.all([
                fetch('/api/muscle-groups'),
                fetch('/api/movement-patterns'),
            ])

            const mgData = await mgRes.json()
            const mpData = await mpRes.json()

            setMuscleGroups(mgData.data.items)
            setMovementPatterns(mpData.data.items)

            if (mpData.data.items.length > 0) {
                setMovementPatternId(mpData.data.items[0].id)
            }
        } catch {
            setError(t('exercises.loadingDataError'))
        }
    }, [t])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

    const addVariant = () => setVariants([...variants, ''])
    const removeVariant = (index: number) => setVariants(variants.filter((_, i) => i !== index))
    const updateVariant = (index: number, value: string) => {
        const updated = [...variants]
        updated[index] = value
        setVariants(updated)
    }

    const addMuscleGroup = () => {
        if (muscleGroups.length > 0) {
            setSelectedMuscleGroups([
                ...selectedMuscleGroups,
                { muscleGroupId: muscleGroups[0].id, coefficient: 0.5 },
            ])
        }
    }

    const removeMuscleGroup = (index: number) => {
        setSelectedMuscleGroups(selectedMuscleGroups.filter((_, i) => i !== index))
    }

    const updateMuscleGroup = (index: number, field: 'muscleGroupId' | 'coefficient', value: string | number) => {
        const updated = [...selectedMuscleGroups]
        updated[index] = { ...updated[index], [field]: value }
        setSelectedMuscleGroups(updated)
    }

    const totalCoefficient = selectedMuscleGroups.reduce((sum, mg) => sum + mg.coefficient, 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validation
        if (!name.trim()) {
            setError(t('exercises.nameRequired'))
            return
        }

        if (!movementPatternId) {
            setError(t('exercises.movementPatternRequired'))
            return
        }

        try {
            setLoading(true)

            const res = await fetch('/api/exercises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    youtubeUrl: youtubeUrl || undefined,
                    type,
                    isBodyweightLoaded,
                    movementPatternId,
                    muscleGroups: selectedMuscleGroups,
                    notes: variants.filter((v) => v.trim()),
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('exercises.createError'), t))
            }

            // loading stays true: the caller navigates away or unmounts the form
            const exercise = data.data.exercise
            onSuccess({ id: exercise.id, name: exercise.name })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('exercises.createError'))
            setLoading(false)
        }
    }

    return (
        <>
            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                {/* Basic Info */}
                <div>
                    <FormLabel>
                        {t('exercises.exerciseNameLabel')}
                    </FormLabel>
                    <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                        placeholder={t('exercises.exerciseNamePlaceholder')}
                        inputSize="md"
                        required
                    />
                </div>

                {/* Variants */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-gray-700">
                            {t('exercises.notesVariantsLabel')}
                        </label>
                        <button
                            type="button"
                            onClick={addVariant}
                            disabled={loading}
                            className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('exercises.addVariant')}
                        </button>
                    </div>
                    {variants.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">{t('exercises.noVariants')}</p>
                    ) : (
                        <div className="space-y-2">
                            {variants.map((variant, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <div className="flex-1">
                                        <Input
                                            type="text"
                                            value={variant}
                                            onChange={(e) => updateVariant(index, e.target.value)}
                                            disabled={loading}
                                            placeholder={t('exercises.variantPlaceholder')}
                                            inputSize="md"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeVariant(index)}
                                        disabled={loading}
                                        className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <FormLabel>
                        {t('exercises.youtubeUrlLabel')}
                    </FormLabel>
                    <Input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        disabled={loading}
                        placeholder="https://www.youtube.com/watch?v=..."
                        inputSize="md"
                    />
                </div>

                {/* Type */}
                <div>
                    <FormLabel>{t('exercises.typeLabel')}</FormLabel>
                    <ExerciseTypeRadioGroup value={type} onChange={setType} disabled={loading} />
                </div>

                {/* Bodyweight loaded */}
                <div>
                    <label className="flex cursor-pointer items-center gap-3">
                        <input
                            type="checkbox"
                            checked={isBodyweightLoaded}
                            onChange={(e) => setIsBodyweightLoaded(e.target.checked)}
                            disabled={loading}
                            className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="text-sm font-medium text-gray-700">{t('exercises.bodyweightLoadedLabel')}</span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500">{t('exercises.bodyweightLoadedHelp')}</p>
                </div>

                {/* Movement Pattern */}
                <div>
                    <FormLabel required>
                        {t('exercises.movementPattern')}
                    </FormLabel>
                    <select
                        value={movementPatternId}
                        onChange={(e) => setMovementPatternId(e.target.value)}
                        disabled={loading}
                        aria-label={t('exercises.movementPattern')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        required
                    >
                        {movementPatterns.map((mp) => (
                            <option key={mp.id} value={mp.id}>
                                {mp.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Muscle Groups */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-gray-700">
                            {t('exercises.muscleGroupsLabel', { total: totalCoefficient.toFixed(2) })}
                        </label>
                        <button
                            type="button"
                            onClick={addMuscleGroup}
                            disabled={loading}
                            className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('exercises.addButton')}
                        </button>
                    </div>

                    {selectedMuscleGroups.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">
                            {t('exercises.noMuscleGroups')}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {selectedMuscleGroups.map((mg, index) => (
                                <div key={index} className="flex items-center space-x-3">
                                    <select
                                        value={mg.muscleGroupId}
                                        onChange={(e) =>
                                            updateMuscleGroup(index, 'muscleGroupId', e.target.value)
                                        }
                                        disabled={loading}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        {muscleGroups.map((muscle) => (
                                            <option key={muscle.id} value={muscle.id}>
                                                {muscle.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="w-24">
                                        <Input
                                            type="number"
                                            min="0.1"
                                            max="1.0"
                                            step="0.1"
                                            value={mg.coefficient}
                                            onChange={(e) =>
                                                updateMuscleGroup(
                                                    index,
                                                    'coefficient',
                                                    parseFloat(e.target.value)
                                                )
                                            }
                                            disabled={loading}
                                            inputSize="md"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeMuscleGroup(index)}
                                        disabled={loading}
                                        className="text-red-600 hover:text-red-700 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex space-x-4 pt-4">
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="flex-1"
                        disabled={loading}
                        isLoading={loading}
                        loadingText={t('common:common.loadingProgress')}
                    >
                        {t('exercises.createExercise')}
                    </Button>
                    {cancelHref ? (
                        <Link
                            href={cancelHref}
                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            {t('exercises.cancel')}
                        </Link>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            className="flex-1"
                            onClick={onCancel}
                            disabled={loading}
                        >
                            {t('exercises.cancel')}
                        </Button>
                    )}
                </div>
            </form>
        </>
    )
}
