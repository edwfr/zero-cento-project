'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { SkeletonTable, ActionIconButton, InlineActions } from '@/components'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import MovementPatternTag from '@/components/MovementPatternTag'
import Link from 'next/link'
import { Plus, ArrowLeft, FileEdit, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Input } from '@/components/Input'

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

const getYoutubeThumbnailUrl = (youtubeUrl: string | null): string | null => {
    if (!youtubeUrl) {
        return null
    }

    const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1]
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null
}

export default function TrainerExercisesContent() {
    const router = useRouter()
    const { showToast } = useToast()
    const { t } = useTranslation(['trainer', 'common'])
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

    const fetchExercises = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/exercises?limit=100')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('exercises.loadingExercisesError'), t))
            }

            setExercises(data.data.items)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchExercises()
    }, [fetchExercises])

    const handleDelete = (id: string, name: string) => {
        setConfirmModal({
            title: t('exercises.deleteExercise'),
            message: t('exercises.confirmDeleteWithName', { name }),
            confirmText: t('common:common.delete'),
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    const res = await fetch(`/api/exercises/${id}`, {
                        method: 'DELETE',
                    })

                    const data = await res.json()

                    if (!res.ok) {
                        throw new Error(getApiErrorMessage(data, t('exercises.deleteError'), t))
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
                    confirmText={confirmModal.confirmText ?? t('common:common.confirm')}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {tNav('navigation.back')}
                </button>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">{t('exercises.title')}</h1>
                    <p className="text-gray-600 mt-2">
                        {t('dashboard.exercisesDescription')}
                    </p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <Input
                                type="text"
                                placeholder={t('exercises.searchExercise')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                inputSize="md"
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
                                    {t('exercises.viewGrid')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'table'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    {t('exercises.viewTable')}
                                </button>
                            </div>

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value as any)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            >
                                <option value="all">{t('exercises.allTypes')}</option>
                                <option value="fundamental">{t('exercises.fundamentalPlural')}</option>
                                <option value="accessory">{t('exercises.accessoryPlural')}</option>
                            </select>

                            <Link
                                href="/trainer/exercises/new"
                                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                            >
                                <Plus className="w-4 h-4 inline mr-2" />{t('exercises.createNew')}
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
                                ? t('exercises.noExercisesFoundWithFilters')
                                : t('exercises.noExercisesCreated')}
                        </p>
                    </div>
                ) : viewMode === 'table' ? (
                    <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('exercises.exerciseName')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('exercises.typeLabelTable')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('exercises.movementPattern')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('exercises.muscleGroups')}
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('common:common.actions')}
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
                                            <InlineActions>
                                                <ActionIconButton
                                                    variant="edit"
                                                    label={t('common:common.edit')}
                                                    href={`/trainer/exercises/${exercise.id}/edit`}
                                                />
                                                <ActionIconButton
                                                    variant="delete"
                                                    label={t('common:common.delete')}
                                                    onClick={() => handleDelete(exercise.id, exercise.name)}
                                                />
                                            </InlineActions>
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
                                {(() => {
                                    const thumbnailUrl = getYoutubeThumbnailUrl(exercise.youtubeUrl)
                                    if (!thumbnailUrl) {
                                        return null
                                    }

                                    return (
                                        <div className="relative aspect-video bg-gray-200">
                                            <Image
                                                src={thumbnailUrl}
                                                alt={exercise.name}
                                                fill
                                                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                                                className="object-cover"
                                            />
                                        </div>
                                    )
                                })()}

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
                                        <p className="text-xs text-gray-500 mb-1">{t('exercises.musclesLabel')}</p>
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
                                    <InlineActions>
                                        <ActionIconButton
                                            variant="edit"
                                            label={t('common:common.edit')}
                                            href={`/trainer/exercises/${exercise.id}/edit`}
                                        />
                                        <ActionIconButton
                                            variant="delete"
                                            label={t('common:common.delete')}
                                            onClick={() => handleDelete(exercise.id, exercise.name)}
                                        />
                                    </InlineActions>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
