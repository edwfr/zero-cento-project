'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/LoadingSpinner'

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

export default function NewExercisePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
    const [movementPatterns, setMovementPatterns] = useState<MovementPattern[]>([])
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [youtubeUrl, setYoutubeUrl] = useState('')
    const [type, setType] = useState<'fundamental' | 'accessory'>('accessory')
    const [movementPatternId, setMovementPatternId] = useState('')
    const [notes, setNotes] = useState('')
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

            setMuscleGroups(mgData.data.muscleGroups)
            setMovementPatterns(mpData.data.movementPatterns)

            if (mpData.data.movementPatterns.length > 0) {
                setMovementPatternId(mpData.data.movementPatterns[0].id)
            }
        } catch (err: any) {
            setError('Errore nel caricamento dati')
        }
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
            setError('Il nome è obbligatorio')
            return
        }

        if (!movementPatternId) {
            setError('Seleziona uno schema motorio')
            return
        }

        if (selectedMuscleGroups.length === 0) {
            setError('Aggiungi almeno un gruppo muscolare')
            return
        }

        if (totalCoefficient > 1.0) {
            setError('La somma dei coefficienti non può superare 1.0')
            return
        }

        try {
            setLoading(true)

            const res = await fetch('/api/exercises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: description || undefined,
                    youtubeUrl: youtubeUrl || undefined,
                    type,
                    movementPatternId,
                    muscleGroups: selectedMuscleGroups,
                    notes: notes ? [notes] : [],
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore nella creazione esercizio')
            }

            // Redirect to exercises list
            router.push('/trainer/exercises')
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainer/exercises"
                        className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna alla libreria
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Nuovo Esercizio</h1>
                    <p className="text-gray-600 mt-2">Crea un nuovo esercizio per la tua libreria</p>
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
                            Nome Esercizio *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="es. Squat Back"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Descrizione
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descrizione dell'esercizio..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            URL Video YouTube
                        </label>
                        <input
                            type="url"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo *</label>
                        <div className="flex space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="fundamental"
                                    checked={type === 'fundamental'}
                                    onChange={(e) => setType('fundamental')}
                                    className="mr-2"
                                />
                                <span>Fondamentale (SBD)</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="accessory"
                                    checked={type === 'accessory'}
                                    onChange={(e) => setType('accessory')}
                                    className="mr-2"
                                />
                                <span>Accessorio</span>
                            </label>
                        </div>
                    </div>

                    {/* Movement Pattern */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Schema Motorio *
                        </label>
                        <select
                            value={movementPatternId}
                            onChange={(e) => setMovementPatternId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
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
                                Gruppi Muscolari * (Totale: {totalCoefficient.toFixed(2)} / 1.0)
                            </label>
                            <button
                                type="button"
                                onClick={addMuscleGroup}
                                className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
                            >
                                + Aggiungi
                            </button>
                        </div>

                        {selectedMuscleGroups.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">
                                Nessun gruppo muscolare aggiunto
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
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
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
                                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeMuscleGroup(index)}
                                            className="text-red-600 hover:text-red-700 font-semibold"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Note/Varianti
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Note aggiuntive sull'esercizio..."
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-4 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                        >
                            {loading ? <LoadingSpinner size="sm" color="white" /> : 'Crea Esercizio'}
                        </button>
                        <Link
                            href="/trainer/exercises"
                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            Annulla
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
