'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button, SkeletonTable } from '@/components'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import { formatDate } from '@/lib/date-format'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { Plus, FileEdit, CheckCircle2, FlagTriangleRight, Clock3, Minus } from 'lucide-react'
import { Input } from '@/components/Input'
import { ActionIconButton, InlineActions } from '@/components'

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    durationWeeks: number
    workoutsPerWeek: number
    startDate: string | null
    completedAt?: string | null
    lastWorkoutCompletedAt?: string | null
    trainee: {
        firstName: string
        lastName: string
    }
    weeks: Array<{
        id: string
        weekNumber: number
        weekType: 'normal' | 'test' | 'deload'
    }>
    testWeeks?: number[]
    hasTestWeeks?: boolean
    testsCompleted?: boolean
    updatedAt?: string | null
    createdAt: string
}

interface ProgramsApiResponse {
    data: {
        items: Program[]
        statusCounts?: {
            draft: number
            active: number
            completed: number
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

type ProgramStatusTab = 'draft' | 'active' | 'completed'

interface ProgramStatusCounts {
    draft: number
    active: number
    completed: number
}

interface ProgramListSnapshot {
    items: Program[]
    currentPage: number
    totalPages: number
    totalItems: number
    statusCounts: ProgramStatusCounts
}

const PAGE_SIZE = 20
const MAX_VISIBLE_PAGES = 5
const PROGRAM_STATUS_TABS: ProgramStatusTab[] = ['draft', 'active', 'completed']
const INITIAL_STATUS_COUNTS: ProgramStatusCounts = {
    draft: 0,
    active: 0,
    completed: 0,
}

export default function TrainerProgramsContent() {
    const { t } = useTranslation(['trainer', 'components', 'common'])
    const { showToast } = useToast()
    const hasLoadedOnceRef = useRef(false)
    const programsCacheRef = useRef(new Map<string, ProgramListSnapshot>())
    const activeRequestControllerRef = useRef<AbortController | null>(null)
    const activeRequestSeqRef = useRef(0)
    const prefetchControllersRef = useRef(new Map<string, AbortController>())
    const statusCountsRef = useRef<ProgramStatusCounts>(INITIAL_STATUS_COUNTS)
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<ProgramStatusTab>('active')
    const [searchTerm, setSearchTerm] = useState('')
    const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [statusCounts, setStatusCounts] = useState<ProgramStatusCounts>(INITIAL_STATUS_COUNTS)
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    const getViewCacheKey = useCallback((status: ProgramStatusTab, page: number, search: string) => {
        const normalizedSearch = search.trim().toLowerCase()
        return `${status}|${page}|${normalizedSearch}`
    }, [])

    const applySnapshot = useCallback((snapshot: ProgramListSnapshot) => {
        setPrograms(snapshot.items)
        setCurrentPage(snapshot.currentPage)
        setTotalPages(snapshot.totalPages)
        setTotalItems(snapshot.totalItems)
        setStatusCounts(snapshot.statusCounts)
    }, [])

    const clearVisibleRows = useCallback(() => {
        setPrograms([])
        setCurrentPage(1)
        setTotalPages(1)
        setTotalItems(0)
    }, [])

    const getCachedSnapshot = useCallback((status: ProgramStatusTab, page: number, search: string) => {
        const viewKey = getViewCacheKey(status, page, search)
        return programsCacheRef.current.get(viewKey) ?? null
    }, [getViewCacheKey])

    const fetchProgramsSnapshot = useCallback(async (
        status: ProgramStatusTab,
        page: number,
        search: string,
        signal?: AbortSignal
    ): Promise<ProgramListSnapshot> => {
        const params = new URLSearchParams({
            status,
            page: String(page),
            limit: String(PAGE_SIZE),
        })

        const trimmedSearch = search.trim()
        if (trimmedSearch.length >= 2) {
            params.set('search', trimmedSearch)
        }

        const res = await fetch(`/api/programs?${params.toString()}`, { signal })
        const data = (await res.json()) as ProgramsApiResponse

        if (!res.ok) {
            throw new Error(getApiErrorMessage(data, t('programs.loadingError'), t))
        }

        const items = data.data.items ?? []
        const pagination = data.data.pagination

        const nextTotalPages = Math.max(1, pagination?.totalPages ?? 1)
        const nextCurrentPage = Math.min(pagination?.currentPage ?? page, nextTotalPages)
        const nextTotalItems = pagination?.totalItems ?? items.length

        return {
            items,
            currentPage: nextCurrentPage,
            totalPages: nextTotalPages,
            totalItems: nextTotalItems,
            statusCounts: data.data.statusCounts ?? statusCountsRef.current,
        }
    }, [t])

    const runForegroundFetch = useCallback(async ({
        status,
        page,
        search,
        silent,
    }: {
        status: ProgramStatusTab
        page: number
        search: string
        silent: boolean
    }) => {
        activeRequestControllerRef.current?.abort()
        const controller = new AbortController()
        activeRequestControllerRef.current = controller
        const requestSeq = ++activeRequestSeqRef.current

        if (hasLoadedOnceRef.current && !silent) {
            setIsRefreshing(true)
        } else {
            setIsRefreshing(false)
        }

        try {
            const snapshot = await fetchProgramsSnapshot(status, page, search, controller.signal)

            if (requestSeq !== activeRequestSeqRef.current) {
                return
            }

            // If a mutation removed the last row of a non-first page, fallback to previous page.
            if (snapshot.items.length === 0 && snapshot.currentPage > 1 && snapshot.totalItems > 0) {
                setCurrentPage(snapshot.currentPage - 1)
                return
            }

            programsCacheRef.current.set(getViewCacheKey(status, snapshot.currentPage, search), snapshot)
            applySnapshot(snapshot)
            setError(null)
            setLoading(false)
            hasLoadedOnceRef.current = true
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return
            }

            if (!silent && requestSeq === activeRequestSeqRef.current) {
                setError(err instanceof Error ? err.message : t('programs.loadingError'))
            }
        } finally {
            if (requestSeq === activeRequestSeqRef.current) {
                setLoading(false)
                setIsRefreshing(false)
            }
        }
    }, [applySnapshot, fetchProgramsSnapshot, getViewCacheKey, t])

    const prefetchView = useCallback(async (status: ProgramStatusTab, page: number, search: string) => {
        const viewKey = getViewCacheKey(status, page, search)
        if (programsCacheRef.current.has(viewKey) || prefetchControllersRef.current.has(viewKey)) {
            return
        }

        const controller = new AbortController()
        prefetchControllersRef.current.set(viewKey, controller)

        try {
            const snapshot = await fetchProgramsSnapshot(status, page, search, controller.signal)
            programsCacheRef.current.set(getViewCacheKey(status, snapshot.currentPage, search), snapshot)
        } catch (err: unknown) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
                return
            }
        } finally {
            prefetchControllersRef.current.delete(viewKey)
        }
    }, [fetchProgramsSnapshot, getViewCacheKey])

    useEffect(() => {
        statusCountsRef.current = statusCounts
    }, [statusCounts])

    useEffect(() => {
        const cachedSnapshot = getCachedSnapshot(activeTab, currentPage, appliedSearchTerm)
        if (cachedSnapshot) {
            applySnapshot(cachedSnapshot)
            setLoading(false)
            hasLoadedOnceRef.current = true
        }

        setError(null)
        void runForegroundFetch({
            status: activeTab,
            page: currentPage,
            search: appliedSearchTerm,
            silent: Boolean(cachedSnapshot),
        })
    }, [activeTab, appliedSearchTerm, applySnapshot, currentPage, getCachedSnapshot, runForegroundFetch])

    useEffect(() => {
        if (loading || !hasLoadedOnceRef.current) {
            return
        }

        for (const tab of PROGRAM_STATUS_TABS) {
            if (tab === activeTab) {
                continue
            }

            void prefetchView(tab, 1, appliedSearchTerm)
        }
    }, [activeTab, appliedSearchTerm, loading, prefetchView])

    useEffect(() => {
        return () => {
            activeRequestControllerRef.current?.abort()

            for (const controller of prefetchControllersRef.current.values()) {
                controller.abort()
            }

            prefetchControllersRef.current.clear()
        }
    }, [])

    const handleTabChange = (tab: ProgramStatusTab) => {
        const targetPage = 1
        if (tab === activeTab && currentPage === targetPage) {
            return
        }

        const cachedSnapshot = getCachedSnapshot(tab, targetPage, appliedSearchTerm)
        if (cachedSnapshot) {
            applySnapshot(cachedSnapshot)
            setLoading(false)
            hasLoadedOnceRef.current = true
        } else if (hasLoadedOnceRef.current) {
            clearVisibleRows()
        }

        activeRequestControllerRef.current?.abort()
        setIsRefreshing(false)
        setError(null)
        setActiveTab(tab)
        setCurrentPage(targetPage)
    }

    const handleSearchChange = (value: string) => {
        setSearchTerm(value)
    }

    const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const nextSearch = searchTerm.trim()
        if (nextSearch === appliedSearchTerm && currentPage === 1) {
            return
        }

        const targetPage = 1
        const cachedSnapshot = getCachedSnapshot(activeTab, targetPage, nextSearch)
        if (cachedSnapshot) {
            applySnapshot(cachedSnapshot)
            setLoading(false)
            hasLoadedOnceRef.current = true
        } else if (hasLoadedOnceRef.current) {
            clearVisibleRows()
        }

        activeRequestControllerRef.current?.abort()
        setIsRefreshing(false)
        setError(null)
        setAppliedSearchTerm(nextSearch)
        setCurrentPage(targetPage)
    }

    const visiblePagesCount = Math.min(MAX_VISIBLE_PAGES, totalPages)
    const firstVisiblePage = Math.max(
        1,
        Math.min(currentPage - Math.floor(visiblePagesCount / 2), totalPages - visiblePagesCount + 1)
    )
    const visiblePages = Array.from({ length: visiblePagesCount }, (_, idx) => firstVisiblePage + idx)

    const handleDelete = (id: string, title: string) => {
        setConfirmModal({
            title: t('programs.deleteProgram'),
            message: `${t('programs.confirmDeleteProgram')} "${title}"?`,
            confirmText: t('programs.delete'),
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    const res = await fetch(`/api/programs/${id}`, {
                        method: 'DELETE',
                    })

                    const data = await res.json()

                    if (!res.ok) {
                        throw new Error(getApiErrorMessage(data, t('programs.deleteError'), t))
                    }

                    programsCacheRef.current.clear()
                    void runForegroundFetch({
                        status: activeTab,
                        page: currentPage,
                        search: appliedSearchTerm,
                        silent: false,
                    })
                } catch (err: unknown) {
                    showToast(err instanceof Error ? err.message : t('programs.deleteError'), 'error')
                }
            },
        })
    }

    const getTestWeeks = (program: Program) => {
        if (program.testWeeks && program.testWeeks.length > 0) {
            return program.testWeeks
        }

        return program.weeks
            .filter((week) => week.weekType === 'test')
            .map((week) => week.weekNumber)
    }

    const getHasTestWeeks = (program: Program) => {
        if (typeof program.hasTestWeeks === 'boolean') {
            return program.hasTestWeeks
        }

        return getTestWeeks(program).length > 0
    }

    const getTestsCompleted = (program: Program) => {
        return Boolean(program.testsCompleted)
    }

    const getPlannedCompletionDate = (program: Program) => {
        if (!program.startDate) {
            return null
        }

        const plannedEndDate = new Date(program.startDate)
        plannedEndDate.setDate(plannedEndDate.getDate() + program.durationWeeks * 7 - 1)
        return plannedEndDate
    }

    const getEffectiveCompletionDate = (program: Program) => {
        return program.lastWorkoutCompletedAt || program.completedAt || null
    }

    const getLastModifiedDate = (program: Program) => {
        return program.updatedAt ?? null
    }

    const showStartDateColumn = activeTab !== 'draft'
    const showCompletionDateColumn = activeTab === 'active' || activeTab === 'completed'
    const showTestStatusColumn = activeTab !== 'draft'
    const showLastModifiedColumn = activeTab === 'draft'
    const completionDateColumnLabel =
        activeTab === 'active'
            ? t('programs.plannedCompletionDateColumn')
            : t('programs.actualCompletionDateColumn')

    if (loading) {
        return (
            <div className="px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonTable rows={6} columns={7} />
            </div>
        )
    }

    return (
        <>
            {confirmModal && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText ?? t('programs.confirm')}
                    variant={confirmModal.variant ?? 'danger'}
                />
            )}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">{t('programs.title')}</h1>
                    <p className="text-gray-600 mt-2">
                        {t('programs.description')}
                    </p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <form className="flex items-center gap-2" onSubmit={handleSearchSubmit}>
                                <Input
                                    type="text"
                                    placeholder={t('programs.searchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    inputSize="md"
                                />
                                <Button type="submit" variant="secondary" size="md" isLoading={isRefreshing}>
                                    {t('common:common.search')}
                                </Button>
                            </form>
                        </div>

                        {/* New Program Button */}
                        <Link
                            href="/trainer/programs/new"
                            className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4 inline mr-2" />{t('programs.newProgram')}
                        </Link>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Tabs */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => handleTabChange('draft')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'draft'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <FileEdit className="w-4 h-4 inline mr-1" />{t('programs.tabDraft')} ({statusCounts.draft})
                            </button>
                            <button
                                onClick={() => handleTabChange('active')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'active'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <CheckCircle2 className="w-4 h-4 inline mr-1" />{t('programs.tabActive')} ({statusCounts.active})
                            </button>
                            <button
                                onClick={() => handleTabChange('completed')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'completed'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <FlagTriangleRight className="w-4 h-4 inline mr-1" />{t('programs.tabCompleted')} ({statusCounts.completed})
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Programs Table */}
                {programs.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {appliedSearchTerm
                                ? t('programs.noProgramsFound')
                                : activeTab === 'draft' ? t('programs.noDraftPrograms') : activeTab === 'active' ? t('programs.noActivePrograms') : t('programs.noCompletedPrograms')}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.program')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.athlete')}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.durationLabel')}
                                        </th>
                                        {showStartDateColumn && (
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {t('programs.startDate')}
                                            </th>
                                        )}
                                        {showCompletionDateColumn && (
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {completionDateColumnLabel}
                                            </th>
                                        )}
                                        {showTestStatusColumn && (
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {t('programs.testStatusColumn')}
                                            </th>
                                        )}
                                        {showLastModifiedColumn && (
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {t('programs.lastModifiedColumn')}
                                            </th>
                                        )}
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.actionsColumn')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {programs.map((program) => {
                                        const hasTestWeeks = getHasTestWeeks(program)
                                        const testsCompleted = getTestsCompleted(program)
                                        const TestStatusIcon = !hasTestWeeks ? Minus : testsCompleted ? CheckCircle2 : Clock3
                                        const testStatusLabel = !hasTestWeeks
                                            ? t('programs.testStatusNoTestsTooltip')
                                            : testsCompleted
                                                ? t('programs.testStatusCompletedTooltip')
                                                : t('programs.testStatusPendingTooltip')
                                        const testStatusClasses = !hasTestWeeks
                                            ? 'bg-gray-100 text-gray-500'
                                            : testsCompleted
                                                ? 'bg-green-100 text-state-success'
                                                : 'bg-yellow-100 text-state-warning'

                                        return (
                                            <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-4 align-top">
                                                    <div className="font-semibold text-gray-900 max-w-[260px] truncate">
                                                        {program.title}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {program.status === 'draft'
                                                            ? t('programs.draft')
                                                            : program.status === 'active'
                                                                ? t('programs.tabActive')
                                                                : t('programs.statusCompleted')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-gray-700">
                                                    {program.trainee.firstName} {program.trainee.lastName}
                                                </td>
                                                <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                    <div>{t('programs.durationWeeks', { count: program.durationWeeks })}</div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {program.workoutsPerWeek} {t('programs.workoutsPerWeek')}
                                                    </div>
                                                </td>
                                                {showStartDateColumn && (
                                                    <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                        {program.startDate ? formatDate(program.startDate) : '-'}
                                                    </td>
                                                )}
                                                {showCompletionDateColumn && (
                                                    <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                        {activeTab === 'active'
                                                            ? formatDate(getPlannedCompletionDate(program))
                                                            : formatDate(getEffectiveCompletionDate(program))}
                                                    </td>
                                                )}
                                                {showTestStatusColumn && (
                                                    <td className="px-4 py-4 align-top">
                                                        <span
                                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${testStatusClasses}`}
                                                            title={testStatusLabel}
                                                            aria-label={testStatusLabel}
                                                        >
                                                            <TestStatusIcon className="h-4 w-4" aria-hidden="true" />
                                                        </span>
                                                    </td>
                                                )}
                                                {showLastModifiedColumn && (
                                                    <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                        {formatDate(getLastModifiedDate(program))}
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 align-top">
                                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                                        {program.status === 'draft' ? (
                                                            <InlineActions>
                                                                <ActionIconButton
                                                                    variant="edit"
                                                                    label={t('programs.editProgramAction')}
                                                                    href={`/trainer/programs/${program.id}/edit`}
                                                                />
                                                                <ActionIconButton
                                                                    variant="view"
                                                                    label={t('programs.viewProgram')}
                                                                    href={`/trainer/programs/${program.id}`}
                                                                />
                                                                <ActionIconButton
                                                                    variant="clone"
                                                                    label={t('programs.cloneProgram')}
                                                                    href={`/trainer/programs/new?cloneFromProgramId=${program.id}`}
                                                                />
                                                                <ActionIconButton
                                                                    variant="delete"
                                                                    label={t('programs.delete')}
                                                                    onClick={() =>
                                                                        handleDelete(program.id, program.title)
                                                                    }
                                                                />
                                                            </InlineActions>
                                                        ) : (
                                                            <InlineActions>
                                                                <ActionIconButton
                                                                    variant="view"
                                                                    label={t('programs.viewProgram')}
                                                                    href={`/trainer/programs/${program.id}`}
                                                                />
                                                                <ActionIconButton
                                                                    variant="clone"
                                                                    label={t('programs.cloneProgram')}
                                                                    href={`/trainer/programs/new?cloneFromProgramId=${program.id}`}
                                                                />
                                                                <ActionIconButton
                                                                    variant="view-test"
                                                                    label={testsCompleted ? t('programs.viewTests') : t('programs.testsButtonDisabledTooltip')}
                                                                    href={testsCompleted ? `/trainer/programs/${program.id}/tests?backContext=programs` : undefined}
                                                                    disabled={!testsCompleted}
                                                                />
                                                            </InlineActions>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

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
        </>
    )
}

