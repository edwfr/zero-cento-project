'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { SkeletonTable, ActionIconButton, InlineActions, Button } from '@/components'
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

interface TraineesApiResponse {
    data: {
        items: Trainee[]
        statusCounts?: {
            all: number
            active: number
            inactive: number
        }
        pagination?: {
            nextCursor: string | null
            hasMore: boolean
            currentPage?: number
            totalPages?: number
            totalItems?: number
            limit?: number
        }
    }
}

const PAGE_SIZE = 20
const MAX_VISIBLE_PAGES = 5

export default function TrainerTraineesContent() {
    const { t } = useTranslation(['trainer', 'components', 'common'])
    const { showToast } = useToast()
    const hasLoadedOnceRef = useRef(false)
    const [trainees, setTrainees] = useState<Trainee[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [statusCounts, setStatusCounts] = useState({
        all: 0,
        active: 0,
        inactive: 0,
    })

    const fetchTrainees = useCallback(async (page: number, signal?: AbortSignal) => {
        let shouldFinalizeLoad = true

        try {
            if (hasLoadedOnceRef.current) {
                setIsRefreshing(true)
            }

            setError(null)

            const params = new URLSearchParams({
                role: 'trainee',
                includeInactive: 'true',
                status: statusFilter,
                page: String(page),
                limit: String(PAGE_SIZE),
            })

            const trimmedSearch = appliedSearchTerm.trim()
            if (trimmedSearch.length >= 2) {
                params.set('search', trimmedSearch)
            }

            const res = await fetch(`/api/users?${params.toString()}`, { signal })
            const data = (await res.json()) as TraineesApiResponse

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('athletes.loadingError'), t))
            }

            const items = data.data.items ?? []
            const pagination = data.data.pagination

            const nextTotalPages = Math.max(1, pagination?.totalPages ?? 1)
            const nextCurrentPage = Math.min(pagination?.currentPage ?? page, nextTotalPages)
            const nextTotalItems = pagination?.totalItems ?? items.length

            if (items.length === 0 && nextCurrentPage > 1 && nextTotalItems > 0) {
                setCurrentPage(nextCurrentPage - 1)
                return
            }

            setTrainees(items)
            setCurrentPage(nextCurrentPage)
            setTotalPages(nextTotalPages)
            setTotalItems(nextTotalItems)

            if (data.data.statusCounts) {
                setStatusCounts(data.data.statusCounts)
            }
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                shouldFinalizeLoad = false
                return
            }

            setError(err instanceof Error ? err.message : String(err))
        } finally {
            if (shouldFinalizeLoad) {
                setLoading(false)
                hasLoadedOnceRef.current = true
            }

            setIsRefreshing(false)
        }
    }, [appliedSearchTerm, statusFilter, t])

    useEffect(() => {
        const controller = new AbortController()
        void fetchTrainees(currentPage, controller.signal)

        return () => {
            controller.abort()
        }
    }, [currentPage, fetchTrainees])

    const handleStatusChange = (value: 'all' | 'active' | 'inactive') => {
        setStatusFilter(value)
        setCurrentPage(1)
    }

    const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const nextSearch = searchTerm.trim()
        if (nextSearch === appliedSearchTerm && currentPage === 1) {
            return
        }

        setAppliedSearchTerm(nextSearch)
        setCurrentPage(1)
    }

    const visiblePagesCount = Math.min(MAX_VISIBLE_PAGES, totalPages)
    const firstVisiblePage = Math.max(
        1,
        Math.min(currentPage - Math.floor(visiblePagesCount / 2), totalPages - visiblePagesCount + 1)
    )
    const visiblePages = Array.from({ length: visiblePagesCount }, (_, idx) => firstVisiblePage + idx)

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

            await fetchTrainees(currentPage)
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : String(err), 'error')
        }
    }

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
                        <form className="flex-1 max-w-md" onSubmit={handleSearchSubmit}>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="text"
                                    placeholder={t('athletes.searchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    inputSize="md"
                                />
                                <Button
                                    type="submit"
                                    variant="secondary"
                                    size="md"
                                    disabled={isRefreshing}
                                >
                                    {t('common:common.search')}
                                </Button>
                            </div>
                        </form>

                        {/* Filters */}
                        <div className="flex items-center space-x-4">
                            <select
                                value={statusFilter}
                                onChange={(e) => handleStatusChange(e.target.value as 'all' | 'active' | 'inactive')}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            >
                                <option value="all">{t('athletes.allStatuses')} ({statusCounts.all})</option>
                                <option value="active">{t('athletes.active')} ({statusCounts.active})</option>
                                <option value="inactive">{t('athletes.deactivated')} ({statusCounts.inactive})</option>
                            </select>

                            <Link
                                href="/trainer/trainees/new"
                                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />{t('athletes.newAthlete')}
                            </Link>
                        </div>
                    </div>

                    {isRefreshing && (
                        <p className="mt-3 text-sm text-gray-500">{t('common:common.loading')}</p>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Trainees Table */}
                {trainees.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {appliedSearchTerm || statusFilter !== 'all'
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
                                {trainees.map((trainee) => (
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

                        {totalPages > 1 && (
                            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-gray-600">
                                    {t('components:pagination.pageOf', { current: currentPage, total: totalPages })}
                                    <span className="ml-2 text-gray-500">({totalItems})</span>
                                </p>

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setCurrentPage(1)}
                                        disabled={isRefreshing || currentPage === 1}
                                    >
                                        {t('components:pagination.first')}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={isRefreshing || currentPage === 1}
                                    >
                                        {t('components:pagination.previous')}
                                    </Button>

                                    {visiblePages.map((pageNumber) => (
                                        <Button
                                            key={pageNumber}
                                            variant={pageNumber === currentPage ? 'primary' : 'secondary'}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNumber)}
                                            disabled={isRefreshing || pageNumber === currentPage}
                                        >
                                            {pageNumber}
                                        </Button>
                                    ))}

                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                        disabled={isRefreshing || currentPage === totalPages}
                                    >
                                        {t('components:pagination.next')}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={isRefreshing || currentPage === totalPages}
                                    >
                                        {t('components:pagination.last')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
