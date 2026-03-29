'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import LoadingSpinner from '@/components/LoadingSpinner'
import Link from 'next/link'

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
    youtubeUrl: string | null
    movementPattern: {
        id: string
        name: string
    }
    exerciseMuscleGroups: Array<{
        coefficient: number
        muscleGroup: {
            id: string
            name: string
        }
    }>
    creator: {
        firstName: string
        lastName: string
    }
}

export default function TrainerExercisesPage() {
    const router = useRouter()
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'fundamental' | 'accessory'>('all')

    useEffect(() => {
        fetchExercises()
    }, [])

    const fetchExercises = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/exercises?limit=100')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore nel caricamento esercizi')
            }

            setExercises(data.data.exercises)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Sei sicuro di voler eliminare l'esercizio "${name}"?`)) {
            return
        }

        try {
            const res = await fetch(`/api/exercises/${id}`, {
                method: 'DELETE',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore eliminazione esercizio')
            }

            // Refresh list
            fetchExercises()
        } catch (err: any) {
            alert(err.message)
        }
    }

    const filteredExercises = exercises.filter((ex) => {
        const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = typeFilter === 'all' || ex.type === typeFilter
        return matchesSearch && matchesType
    })

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Libreria Esercizi</h1>
                    <p className="text-gray-600 mt-2">
                        Gestisci gli esercizi della tua libreria personale
                    </p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="🔍 Cerca esercizio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center space-x-4">
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value as any)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            >
                                <option value="all">Tutti i tipi</option>
                                <option value="fundamental">Fondamentali</option>
                                <option value="accessory">Accessori</option>
                            </select>

                            <Link
                                href="/trainer/exercises/new"
                                className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                            >
                                ➕ Nuovo Esercizio
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Exercises Grid */}
                {filteredExercises.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {searchTerm || typeFilter !== 'all'
                                ? 'Nessun esercizio trovato con questi filtri'
                                : 'Nessun esercizio creato. Inizia creandone uno!'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredExercises.map((exercise) => (
                            <div
                                key={exercise.id}
                                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                            >
                                {/* Video Thumbnail */}
                                {exercise.youtubeUrl && (
                                    <div className="aspect-video bg-gray-200">
                                        <img
                                            src={`https://img.youtube.com/vi/${exercise.youtubeUrl.match(
                                                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/
                                            )?.[1]
                                                }/mqdefault.jpg`}
                                            alt={exercise.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}

                                {/* Content */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {exercise.name}
                                        </h3>
                                        <span
                                            className={`text-xs font-semibold px-2 py-1 rounded ${exercise.type === 'fundamental'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-blue-100 text-blue-800'
                                                }`}
                                        >
                                            {exercise.type === 'fundamental'
                                                ? 'FONDAMENTALE'
                                                : 'ACCESSORIO'}
                                        </span>
                                    </div>

                                    {/* Movement Pattern */}
                                    <div className="mb-3">
                                        <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded">
                                            {exercise.movementPattern.name}
                                        </span>
                                    </div>

                                    {/* Muscle Groups */}
                                    <div className="mb-4">
                                        <p className="text-xs text-gray-500 mb-1">Muscoli:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {exercise.exerciseMuscleGroups
                                                .sort((a, b) => b.coefficient - a.coefficient)
                                                .map((emg) => (
                                                    <span
                                                        key={emg.muscleGroup.id}
                                                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                                                    >
                                                        {emg.muscleGroup.name} (
                                                        {Math.round(emg.coefficient * 100)}%)
                                                    </span>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Creator */}
                                    <p className="text-xs text-gray-500 mb-4">
                                        Creato da: {exercise.creator.firstName}{' '}
                                        {exercise.creator.lastName}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex space-x-2">
                                        <Link
                                            href={`/trainer/exercises/${exercise.id}/edit`}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg text-center transition-colors"
                                        >
                                            Modifica
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(exercise.id, exercise.name)}
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                                        >
                                            Elimina
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
