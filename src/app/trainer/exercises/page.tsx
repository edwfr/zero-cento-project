'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { SkeletonTable } from '@/components'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
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
    const { showToast } = useToast()
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'fundamental' | 'accessory'>('all')
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

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

            setExercises(data.data.items)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = (id: string, name: string) => {
        setConfirmModal({
            title: 'Elimina Esercizio',
            message: `Sei sicuro di voler eliminare l'esercizio "${name}"?`,
            confirmText: 'Elimina',
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    const res = await fetch(`/api/exercises/${id}`, {
                        method: 'DELETE',
                    })

                    const data = await res.json()

                    if (!res.ok) {
                        throw new Error(data.error?.message || 'Errore eliminazione esercizio')
                    }

                    fetchExercises()
                } catch (err: any) {
                    showToast(err.message, 'error')
                }
            },
        })
    }

    const filteredExercises = exercises.filter((ex) => {
        const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = typeFilter === 'all' || ex.type === typeFilter
        return matchesSearch && matchesType
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonTable rows={8} columns={5} />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText ?? 'Conferma'}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
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
                                            className="flex-1 flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white text-sm font-semibold py-2 px-4 rounded-lg text-center transition-colors"
                                            title="Modifica"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(exercise.id, exercise.name)}
                                            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                                            title="Elimina"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
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
