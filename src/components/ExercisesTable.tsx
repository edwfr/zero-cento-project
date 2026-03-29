'use client'

import { useState, useEffect } from 'react'
import ExerciseCreateModal from './ExerciseCreateModal'

interface MuscleGroupAssignment {
    muscleGroup: {
        id: string
        name: string
    }
    coefficient: number
}

interface Exercise {
    id: string
    name: string
    description: string | null
    youtubeUrl: string
    type: 'fundamental' | 'accessory'
    movementPattern: {
        id: string
        name: string
    }
    exerciseMuscleGroups: MuscleGroupAssignment[]
    creator: {
        firstName: string
        lastName: string
    }
    createdAt: string
}

export default function ExercisesTable() {
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const fetchExercises = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()

            if (filterType !== 'all') {
                params.append('type', filterType)
            }

            if (searchQuery) {
                params.append('search', searchQuery)
            }

            params.append('limit', '100') // Fetch more for simplicity

            const response = await fetch(`/api/exercises?${params.toString()}`)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error?.message || 'Errore durante il caricamento')
            }

            setExercises(data.data.exercises)
            setError('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchExercises()
    }, [filterType, searchQuery])

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'fundamental':
                return 'Fondamentale'
            case 'accessory':
                return 'Accessorio'
            default:
                return type
        }
    }

    const getTypeBadgeColor = (type: string) => {
        switch (type) {
            case 'fundamental':
                return 'bg-purple-100 text-purple-800'
            case 'accessory':
                return 'bg-blue-100 text-blue-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const formatMuscleGroups = (muscleGroups: MuscleGroupAssignment[]) => {
        return muscleGroups
            .map((mg) => `${mg.muscleGroup.name} (${Math.round(mg.coefficient * 100)}%)`)
            .join(', ')
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
            </div>
        )
    }

    return (
        <div>
            {/* Filters and Actions */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium text-gray-700">Filtra per tipo:</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                            <option value="all" className="text-gray-900">Tutti</option>
                            <option value="fundamental" className="text-gray-900">Fondamentali</option>
                            <option value="accessory" className="text-gray-900">Accessori</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            placeholder="Cerca esercizio..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    </div>
                </div>

                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2 justify-center sm:justify-start"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Crea Esercizio</span>
                </button>
            </div>

            {/* Exercises Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nome
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Schema Motorio
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Gruppi Muscolari
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Creato da
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Azioni
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {exercises.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                    Nessun esercizio trovato
                                </td>
                            </tr>
                        ) : (
                            exercises.map((exercise) => (
                                <tr key={exercise.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <div className="text-sm font-medium text-gray-900">
                                                {exercise.name}
                                            </div>
                                            {exercise.description && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {exercise.description.substring(0, 80)}
                                                    {exercise.description.length > 80 ? '...' : ''}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(
                                                exercise.type
                                            )}`}
                                        >
                                            {getTypeLabel(exercise.type)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {exercise.movementPattern.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-600 max-w-xs">
                                            {formatMuscleGroups(exercise.exerciseMuscleGroups)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-600">
                                            {exercise.creator.firstName} {exercise.creator.lastName}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <a
                                            href={exercise.youtubeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            Video
                                        </a>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <ExerciseCreateModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onExerciseCreated={() => {
                        setIsCreateModalOpen(false)
                        fetchExercises()
                    }}
                />
            )}
        </div>
    )
}
