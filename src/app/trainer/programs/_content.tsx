'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ProgramTraineeTable } from '@/components'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'

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
        const prefetchControllers = prefetchControllersRef.current

        return () => {
            activeRequestControllerRef.current?.abort()

            for (const controller of prefetchControllers.values()) {
                controller.abort()
            }

            prefetchControllers.clear()
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
                <ProgramTraineeTable
                    programs={programs}
                    loading={loading}
                    error={error}
                    activeTab={activeTab}
                    statusCounts={statusCounts}
                    searchTerm={searchTerm}
                    appliedSearchTerm={appliedSearchTerm}
                    isRefreshing={isRefreshing}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    visiblePages={visiblePages}
                    newProgramHref="/trainer/programs/new"
                    emptyStateCtaHref="/trainer/programs/new"
                    onSearchChange={handleSearchChange}
                    onSearchSubmit={handleSearchSubmit}
                    onTabChange={handleTabChange}
                    onPageChange={setCurrentPage}
                    onDeleteProgram={handleDelete}
                    getEditHref={(program) => `/trainer/programs/${program.id}/edit`}
                    getViewHref={(program) => `/trainer/programs/${program.id}`}
                    getCloneHref={(program) => `/trainer/programs/new?cloneFromProgramId=${program.id}`}
                    getViewTestsHref={(program) =>
                        program.testsCompleted
                            ? `/trainer/programs/${program.id}/tests?backContext=programs`
                            : undefined
                    }
                />
            </div>
        </>
    )
}

