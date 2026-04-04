'use client'

import { useState, useEffect } from 'react'
import { SkeletonTable } from '@/components'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import MovementPatternTag from '@/components/MovementPatternTag'
import Link from 'next/link'
import { Plus, ArrowLeft, FileEdit, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/client'
import { getApiErrorMessage } from '@/lib/api-error'

interface Exercise {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
    youtubeUrl: string | null
    movementPattern: {
        id: string
        name: string
        color?: string
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

export default function TrainerExercisesContent() {
    const { showToast } = useToast()
    const { t } = useTranslation('trainer')
    const { t: tNav } = useTranslation('navigation')
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'fundamental' | 'accessory'>('all')
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
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
                throw new Error(getApiErrorMessage(data, 'Errore nel caricamento esercizi', t))
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
                        throw new Error(getApiErrorMessage(data, 'Errore eliminazione esercizio', t))
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

    const getTypeShortLabel = (type: Exercise['type']) => (type === 'fundamental' ? 'F' : 'A')

    const getTypeFullLabel = (type: Exercise['type']) => (type === 'fundamental' ? 'Fondamentale' : 'Accessorio')

    const getTypeBadgeClasses = (type: Exercise['type']) =>
        type === 'fundamental' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'

    const sortMuscleGroups = (muscleGroups: Exercise['exerciseMuscleGroups']) =>
        [...muscleGroups].sort((a, b) => b.coefficient - a.coefficient)

    const formatMuscleGroups = (muscleGroups: Exercise['exerciseMuscleGroups']) =>
        sortMuscleGroups(muscleGroups)
            .map((emg) => `${emg.muscleGroup.name} (${Math.round(emg.coefficient * 100)}%)`)
            .join(', ')

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
                {/* Back to Home Link */}
                <Link
                    href="/trainer/dashboard"
                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {tNav('breadcrumbs.backToHome')}
                </Link>

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
                                placeholder="Cerca esercizio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="inline-flex items-center rounded-lg bg-gray-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'grid'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Griglia
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'table'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Tabella
                                </button>
                            </div>

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
                                <Plus className="w-4 h-4 inline mr-2" />Nuovo Esercizio
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

                {/* Exercises */}
                {filteredExercises.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {searchTerm || typeFilter !== 'all'
                                ? 'Nessun esercizio trovato con questi filtri'
                                : 'Nessun esercizio creato. Inizia creandone uno!'}
                        </p>
                    </div>
                ) : viewMode === 'table' ? (
                    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
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
                                        Pattern
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Muscoli
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Azioni
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredExercises.map((exercise) => (
                                    <tr key={exercise.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {exercise.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${getTypeBadgeClasses(
                                                    exercise.type
                                                )}`}
                                                title={getTypeFullLabel(exercise.type)}
                                                aria-label={getTypeFullLabel(exercise.type)}
                                            >
                                                {getTypeShortLabel(exercise.type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <MovementPatternTag
                                                name={exercise.movementPattern.name}
                                                color={exercise.movementPattern.color}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-sm">
                                            {formatMuscleGroups(exercise.exerciseMuscleGroups)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/trainer/exercises/${exercise.id}/edit`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                                                    title="Modifica"
                                                    aria-label="Modifica"
                                                >
                                                    <FileEdit className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(exercise.id, exercise.name)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                                                    title="Elimina"
                                                    aria-label="Elimina"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredExercises.map((exercise) => (
                            <div
                                key={exercise.id}
                                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
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
                                <div className="p-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-base font-semibold text-gray-900">
                                            {exercise.name}
                                        </h3>
                                        <span
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${getTypeBadgeClasses(
                                                exercise.type
                                            )}`}
                                            title={getTypeFullLabel(exercise.type)}
                                            aria-label={getTypeFullLabel(exercise.type)}
                                        >
                                            {getTypeShortLabel(exercise.type)}
                                        </span>
                                    </div>

                                    {/* Movement Pattern */}
                                    <div className="mb-3">
                                        <MovementPatternTag
                                            name={exercise.movementPattern.name}
                                            color={exercise.movementPattern.color}
                                        />
                                    </div>

                                    {/* Muscle Groups */}
                                    <div className="mb-4">
                                        <p className="text-xs text-gray-500 mb-1">Muscoli:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {sortMuscleGroups(exercise.exerciseMuscleGroups).map((emg) => (
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

                                    {/* Actions */}
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/trainer/exercises/${exercise.id}/edit`}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                                            title="Modifica"
                                            aria-label="Modifica"
                                        >
                                            <FileEdit className="w-4 h-4" />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(exercise.id, exercise.name)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                                            title="Elimina"
                                            aria-label="Elimina"
                                        >
                                            <Trash2 className="w-4 h-4" />
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
