'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SkeletonTable, ActionIconButton, InlineActions } from '@/components'
import { useToast } from '@/components/ToastNotification'
import { formatDate } from '@/lib/date-format'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { Plus } from 'lucide-react'
import { Input } from '@/components/Input'

interface Trainee {
    id: string
    firstName: string
    lastName: string
    email: string
    isActive: boolean
    createdAt: string
}

export default function TrainerTraineesContent() {
    const { t } = useTranslation('trainer')
    const { showToast } = useToast()
    const [trainees, setTrainees] = useState<Trainee[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')

    const fetchTrainees = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/users?role=trainee&includeInactive=true')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('athletes.loadingError'), t))
            }

            setTrainees(data.data.items)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchTrainees()
    }, [fetchTrainees])

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const endpoint = currentStatus
                ? `/api/users/${id}/deactivate`
                : `/api/users/${id}/activate`

            const res = await fetch(endpoint, { method: 'PATCH' })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('athletes.statusUpdateError'), t))
            }

            fetchTrainees()
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : String(err), 'error')
        }
    }

    const filteredTrainees = trainees.filter((trainee) => {
        const matchesSearch =
            trainee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            trainee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            trainee.email.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && trainee.isActive) ||
            (statusFilter === 'inactive' && !trainee.isActive)

        return matchesSearch && matchesStatus
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonTable rows={6} columns={4} />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">{t('athletes.title')}</h1>
                    <p className="text-gray-600 mt-2">
                        {t('athletes.description')}
                    </p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <Input
                                type="text"
                                placeholder={t('athletes.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                inputSize="md"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center space-x-4">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            >
                                <option value="all">{t('athletes.allStatuses')}</option>
                                <option value="active">{t('athletes.active')}</option>
                                <option value="inactive">{t('athletes.deactivated')}</option>
                            </select>

                            <Link
                                href="/trainer/trainees/new"
                                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />{t('athletes.newAthlete')}
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

                {/* Trainees Table */}
                {filteredTrainees.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {searchTerm || statusFilter !== 'all'
                                ? t('athletes.noAthletesFound')
                                : t('athletes.noAthletesAssigned')}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('athletes.athleteColumn')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('athletes.email')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('athletes.status')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('athletes.creationDate')}
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {t('athletes.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredTrainees.map((trainee) => (
                                    <tr key={trainee.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900">
                                                {trainee.firstName} {trainee.lastName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">
                                                {trainee.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-3 py-1 text-xs font-semibold rounded-full ${trainee.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {trainee.isActive ? t('athletes.activeStatus') : t('athletes.inactiveStatus')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatDate(trainee.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <InlineActions>
                                                <ActionIconButton
                                                    variant="view"
                                                    label={t('athletes.details')}
                                                    href={`/trainer/trainees/${trainee.id}`}
                                                />
                                                <ActionIconButton
                                                    variant={trainee.isActive ? 'deactivate' : 'activate'}
                                                    label={trainee.isActive ? t('athletes.deactivate') : t('athletes.activate')}
                                                    onClick={() => handleToggleStatus(trainee.id, trainee.isActive)}
                                                />
                                            </InlineActions>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
