'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'

interface MuscleGroup {
    id: string
    name: string
}

interface MovementPattern {
    id: string
    name: string
}

interface MuscleGroupAssignment {
    muscleGroupId: string
    coefficient: number
}

interface ExerciseCreateModalProps {
    onClose: () => void
    onExerciseCreated: () => void
}

export default function ExerciseCreateModal({ onClose, onExerciseCreated }: ExerciseCreateModalProps) {
    const { t } = useTranslation('trainer')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
    const [movementPatterns, setMovementPatterns] = useState<MovementPattern[]>([])
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        youtubeUrl: '',
        type: 'accessory' as 'fundamental' | 'accessory',
        movementPatternId: '',
    })
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<MuscleGroupAssignment[]>([])

    const dialogRef = useRef<HTMLDivElement>(null)
    const firstInputRef = useRef<HTMLInputElement>(null)

    // Generate unique IDs for ARIA labels
    const titleId = useRef(`exercise-create-title-${Math.random().toString(36).substr(2, 9)}`).current

    // Focus management and keyboard handling
    useEffect(() => {
        // Store currently focused element
        const previouslyFocused = document.activeElement as HTMLElement

        // Focus the first input when modal opens
        setTimeout(() => {
            firstInputRef.current?.focus()
        }, 100)

        // Handle ESC key to close
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                onClose()
            }
        }

        // Focus trap
        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !dialogRef.current) return

            const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault()
                lastElement?.focus()
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault()
                firstElement?.focus()
            }
        }

        document.addEventListener('keydown', handleEscape)
        document.addEventListener('keydown', handleTab)

        // Cleanup and restore focus
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.removeEventListener('keydown', handleTab)
            previouslyFocused?.focus()
        }
    }, [loading, onClose])

    useEffect(() => {
        // Load muscle groups and movement patterns
        const fetchData = async () => {
            try {
                const [mgResponse, mpResponse] = await Promise.all([
                    fetch('/api/muscle-groups'),
                    fetch('/api/movement-patterns'),
                ])

                const mgData = await mgResponse.json()
                const mpData = await mpResponse.json()

                if (mgResponse.ok) {
                    setMuscleGroups(mgData.data.items)
                }
                if (mpResponse.ok) {
                    setMovementPatterns(mpData.data.items)
                }
            } catch (err) {
                console.error('Error loading data:', err)
            }
        }

        fetchData()
    }, [])

    const handleAddMuscleGroup = () => {
        if (selectedMuscleGroups.length < 5) {
            setSelectedMuscleGroups([
                ...selectedMuscleGroups,
                { muscleGroupId: '', coefficient: 0.5 },
            ])
        }
    }

    const handleRemoveMuscleGroup = (index: number) => {
        setSelectedMuscleGroups(selectedMuscleGroups.filter((_, i) => i !== index))
    }

    const handleMuscleGroupChange = (index: number, field: 'muscleGroupId' | 'coefficient', value: any) => {
        const updated = [...selectedMuscleGroups]
        updated[index] = { ...updated[index], [field]: value }
        setSelectedMuscleGroups(updated)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        // Validation
        if (selectedMuscleGroups.some((mg) => !mg.muscleGroupId)) {
            setError('Completa tutti i gruppi muscolari selezionati')
            setLoading(false)
            return
        }

        try {
            const response = await fetch('/api/exercises', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    muscleGroups: selectedMuscleGroups,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, 'Errore durante la creazione', t))
            }

            onExerciseCreated()
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="presentation">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
                <h2 id={titleId} className="text-2xl font-bold text-gray-900 mb-4">
                    Crea Nuovo Esercizio
                </h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Nome Esercizio *
                        </label>
                        <input
                            ref={firstInputRef}
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                            placeholder="es. Bench Press"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            Descrizione
                        </label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            rows={3}
                            placeholder="Descrizione dell'esercizio..."
                        />
                    </div>

                    <div>
                        <label htmlFor="youtubeUrl" className="block text-sm font-medium text-gray-700 mb-1">
                            URL YouTube *
                        </label>
                        <input
                            type="url"
                            id="youtubeUrl"
                            value={formData.youtubeUrl}
                            onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                            placeholder="https://www.youtube.com/watch?v=..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo *
                            </label>
                            <select
                                id="type"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'fundamental' | 'accessory' })}
                                disabled={loading}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                required
                            >
                                <option value="fundamental" className="text-gray-900">Fondamentale</option>
                                <option value="accessory" className="text-gray-900">Accessorio</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="movementPattern" className="block text-sm font-medium text-gray-700 mb-1">
                                Schema Motorio *
                            </label>
                            <select
                                id="movementPattern"
                                value={formData.movementPatternId}
                                onChange={(e) => setFormData({ ...formData, movementPatternId: e.target.value })}
                                disabled={loading}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                required
                            >
                                <option value="" className="text-gray-900">Seleziona schema...</option>
                                {movementPatterns.map((mp) => (
                                    <option key={mp.id} value={mp.id} className="text-gray-900">
                                        {mp.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Gruppi Muscolari * (min 1, max 5)
                            </label>
                            <button
                                type="button"
                                onClick={handleAddMuscleGroup}
                                disabled={selectedMuscleGroups.length >= 5 || loading}
                                className="text-sm px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                + Aggiungi
                            </button>
                        </div>

                        <div className="space-y-2">
                            {selectedMuscleGroups.map((mg, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <select
                                        value={mg.muscleGroupId}
                                        onChange={(e) => handleMuscleGroupChange(index, 'muscleGroupId', e.target.value)}
                                        disabled={loading}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        required
                                    >
                                        <option value="" className="text-gray-900">Seleziona gruppo...</option>
                                        {muscleGroups.map((group) => (
                                            <option key={group.id} value={group.id} className="text-gray-900">
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={mg.coefficient}
                                        onChange={(e) => handleMuscleGroupChange(index, 'coefficient', parseFloat(e.target.value))}
                                        disabled={loading}
                                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        placeholder="0.0-1.0"
                                        required
                                    />

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveMuscleGroup(index)}
                                        disabled={loading}
                                        className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}

                            {selectedMuscleGroups.length === 0 && (
                                <p className="text-sm text-gray-500 italic">
                                    Nessun gruppo muscolare selezionato. Clicca &quot;+ Aggiungi&quot; per iniziare.
                                </p>
                            )}
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                            Il coefficiente indica l&apos;intensità di coinvolgimento (0.0 = minimo, 1.0 = massimo)
                        </p>
                    </div>

                    <div className="flex space-x-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Creando...' : 'Crea Esercizio'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                        >
                            Annulla
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
