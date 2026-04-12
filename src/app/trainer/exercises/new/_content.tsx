'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/client'
import { getApiErrorMessage } from '@/lib/api-error'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/Button'

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

export default function NewExerciseContent() {
    const router = useRouter()
    const { t } = useTranslation('trainer')
    const [loading, setLoading] = useState(false)
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
    const [movementPatterns, setMovementPatterns] = useState<MovementPattern[]>([])
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [variants, setVariants] = useState<string[]>([])
    const [youtubeUrl, setYoutubeUrl] = useState('')
    const [type, setType] = useState<'fundamental' | 'accessory'>('accessory')
    const [movementPatternId, setMovementPatternId] = useState('')
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<MuscleGroupInput[]>([])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
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
        } catch (err: unknown) {
            setError(t('exercises.loadingDataError'))
        }
    }

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

    const updateMuscleGroup = (index: number, field: 'muscleGroupId' | 'coefficient', value: any) => {
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

        if (selectedMuscleGroups.length > 0 && (totalCoefficient < 0.1 || totalCoefficient > 3.0)) {
            setError(t('exercises.coefficientRangeError'))
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
                    movementPatternId,
                    muscleGroups: selectedMuscleGroups,
                    notes: variants.filter((v) => v.trim()),
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('exercises.createError'), t))
            }

            // Invalidate cache and redirect to exercises list
            router.refresh()
            router.push('/trainer/exercises')
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('exercises.createError'))
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/trainer/exercises"
                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('exercises.backToLibrary')}
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{t('exercises.newExerciseTitle')}</h1>
                <p className="text-gray-600 mt-2">{t('exercises.newExerciseDescription')}</p>
            </div>

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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('exercises.exerciseNameLabel')}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                        placeholder={t('exercises.exerciseNamePlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                                    <input
                                        type="text"
                                        value={variant}
                                        onChange={(e) => updateVariant(index, e.target.value)}
                                        disabled={loading}
                                        placeholder={t('exercises.variantPlaceholder')}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('exercises.youtubeUrlLabel')}
                    </label>
                    <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        disabled={loading}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                </div>

                {/* Type */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('exercises.typeLabel')}</label>
                    <div className="flex space-x-4">
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="fundamental"
                                checked={type === 'fundamental'}
                                onChange={(e) => setType('fundamental')}
                                disabled={loading}
                                className="mr-2 disabled:cursor-not-allowed"
                            />
                            <span>{t('exercises.fundamentalSBD')}</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="accessory"
                                checked={type === 'accessory'}
                                onChange={(e) => setType('accessory')}
                                disabled={loading}
                                className="mr-2 disabled:cursor-not-allowed"
                            />
                            <span>{t('exercises.accessory')}</span>
                        </label>
                    </div>
                </div>

                {/* Movement Pattern */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('exercises.movementPattern')} *
                    </label>
                    <select
                        value={movementPatternId}
                        onChange={(e) => setMovementPatternId(e.target.value)}
                        disabled={loading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                                    <input
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
                                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
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
                    <Link
                        href="/trainer/exercises"
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                    >
                        {t('exercises.cancel')}
                    </Link>
                </div>
            </form>
        </div>
    )
}
