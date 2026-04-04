'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/date-format'

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    startDate: string | null
    endDate: string | null
    createdAt: string
    trainee: { id: string; firstName: string; lastName: string } | null
    trainer: { id: string; firstName: string; lastName: string } | null
}

const STATUS_BADGE: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
}

const PAGE_SIZE = 15

export default function AdminProgramsPageContent() {
    const { t } = useTranslation('admin')
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [page, setPage] = useState(1)

    useEffect(() => {
        const fetchPrograms = async () => {
            try {
                setLoading(true)
                const res = await fetch('/api/programs?limit=200')
                const data = await res.json()
                if (!res.ok) throw new Error(getApiErrorMessage(data, t('programsPage.loadingError'), t))
                setPrograms(data.data.items)
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : t('programsPage.loadingError'))
            } finally {
                setLoading(false)
            }
        }
        fetchPrograms()
    }, [t])

    useEffect(() => {
        setPage(1)
    }, [searchTerm, filterStatus])

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase()
        return programs.filter((p) => {
            const matchesSearch =
                !term ||
                p.title.toLowerCase().includes(term) ||
                `${p.trainee?.firstName} ${p.trainee?.lastName}`.toLowerCase().includes(term) ||
                `${p.trainer?.firstName} ${p.trainer?.lastName}`.toLowerCase().includes(term)
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus
            return matchesSearch && matchesStatus
        })
    }, [programs, searchTerm, filterStatus])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFA700]" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
            </div>
        )
    }

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-4 items-start md:items-center">
                <input
                    type="text"
                    placeholder={t('programsPage.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                />
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                >
                    <option value="all">{t('programsPage.filterAll')}</option>
                    <option value="draft">{t('programsPage.statusDraft')}</option>
                    <option value="active">{t('programsPage.statusActive')}</option>
                    <option value="completed">{t('programsPage.statusCompleted')}</option>
                </select>
            </div>

            <div className="text-sm text-gray-500 mb-4">
                {t('programsPage.foundCount', { found: filtered.length, total: programs.length })}
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {[
                                    t('programsPage.colTitle'),
                                    t('programsPage.colAthlete'),
                                    t('programsPage.colTrainer'),
                                    t('programsPage.colStatus'),
                                    t('programsPage.colStart'),
                                    t('programsPage.colEnd'),
                                    t('programsPage.colActions'),
                                ].map((h) => (
                                    <th
                                        key={h}
                                        className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginated.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-6 py-12 text-center text-gray-500 text-sm"
                                    >
                                        {t('programsPage.noResults')}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((program) => (
                                    <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900 text-sm">
                                                {program.title}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {program.trainee
                                                ? `${program.trainee.firstName} ${program.trainee.lastName}`
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {program.trainer
                                                ? `${program.trainer.firstName} ${program.trainer.lastName}`
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_BADGE[program.status]}`}
                                            >
                                                {t(`programsPage.status_${program.status}`)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(program.startDate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(program.endDate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex space-x-3">
                                                <Link
                                                    href={`/trainer/programs/${program.id}/reports`}
                                                    className="text-brand-primary hover:text-brand-primary/80 font-semibold"
                                                >
                                                    {t('programsPage.actionReport')}
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        {t('programsPage.page', { page, total: totalPages })}
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            «
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            ‹
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                            const p = start + i
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`px-3 py-1 text-sm border rounded-lg transition-colors ${p === page
                                        ? 'bg-[#FFA700] text-white border-[#FFA700]'
                                        : 'border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {p}
                                </button>
                            )
                        })}
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            ›
                        </button>
                        <button
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
