'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import ExerciseCreateModal from './ExerciseCreateModal'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

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
    createdAt: string
}

export default function ExercisesTable() {
    const { t } = useTranslation(['trainer', 'common'])
    const [exercises, setExercises] = useState<Exercise[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    const fetchExercises = useCallback(async () => {
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
                throw new Error(getApiErrorMessage(data, t('common:errors.loadingError'), t))
            }

            setExercises(data.data.items)
            setError('')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [filterType, searchQuery, t])

    useEffect(() => {
        void fetchExercises()
    }, [fetchExercises])

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'fundamental':
                return t('trainer:exercises.fundamental')
            case 'accessory':
                return t('trainer:exercises.accessory')
            default:
                return type
        }
    }

    const getFilterOptionLabel = (type: string) => {
        switch (type) {
            case 'fundamental':
                return t('trainer:exercises.fundamentalPlural')
            case 'accessory':
                return t('trainer:exercises.accessoryPlural')
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
                        <FormLabel className="inline mb-0">{t('trainer:exercises.filterByType')}</FormLabel>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary text-gray-900"
                        >
                            <option value="all" className="text-gray-900">{t('common:common.all')}</option>
                            <option value="fundamental" className="text-gray-900">{getFilterOptionLabel('fundamental')}</option>
                            <option value="accessory" className="text-gray-900">{getFilterOptionLabel('accessory')}</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Input
                            type="text"
                            placeholder={t('trainer:exercises.searchExercise')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            inputSize="md"
                            className="text-gray-900"
                        />
                    </div>
                </div>

                <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    variant="primary"
                    size="md"
                    className="justify-center sm:justify-start"
                    icon={(
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    )}
                >
                    {t('trainer:exercises.createExercise')}
                </Button>
            </div>

            {/* Exercises Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('common:common.name')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('trainer:exercises.exerciseType')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('trainer:exercises.movementPattern')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('trainer:exercises.muscleGroups')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('common:common.actions')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {exercises.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                    {t('trainer:exercises.noExercisesFound')}
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
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <a
                                            href={exercise.youtubeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-brand-primary hover:text-brand-primary/80"
                                        >
                                            {t('trainer:exercises.video')}
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

