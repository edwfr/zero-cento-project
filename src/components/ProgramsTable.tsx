'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    durationWeeks: number
    workoutsPerWeek: number
    startDate: string | null
    endDate: string | null
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    trainer?: {
        id: string
        firstName: string
        lastName: string
    }
    weeks: Array<{ id: string }>
    createdAt: string
}

interface ProgramsTableProps {
    /** Optionally pass programs from parent; if omitted the component self-fetches */
    programs?: Program[]
    /** Show trainer column (useful for admin view) */
    showTrainer?: boolean
    /** Base path for program links, default: /trainer/programs */
    basePath?: string
    /** Called after a successful delete so the parent can refresh its state */
    onRefresh?: () => void
}

export default function ProgramsTable({
    programs: externalPrograms,
    showTrainer = false,
    basePath = '/trainer/programs',
    onRefresh,
}: ProgramsTableProps) {
    const { t } = useTranslation(['trainer', 'common'])
    
    const STATUS_LABELS: Record<string, string> = {
        draft: t('trainer:programs.draft'),
        active: t('common:common.active'),
        completed: t('common:common.completed'),
    }
    const STATUS_LABELS: Record<string, string> = {
        draft: t('trainer:programs.draft'),
        active: t('common:common.active'),
        completed: t('common:common.completed'),
    }
    
    const STATUS_BADGE: Record<string, string> = {
        draft: 'bg-yellow-100 text-yellow-800',
        active: 'bg-green-100 text-green-800',
        completed: 'bg-gray-100 text-gray-600',
    }
    
    const [programs, setPrograms] = useState<Program[]>(externalPrograms ?? [])
    const [loading, setLoading] = useState(!externalPrograms)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'draft' | 'active' | 'completed'>('active')
    const [searchTerm, setSearchTerm] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const { showToast } = useToast()
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    const fetchPrograms = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/programs')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error?.message || t('trainer:programs.loadingError'))
            setPrograms(data.data.programs)
            setError(null)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!externalPrograms) {
            fetchPrograms()
        }
    }, [externalPrograms])

    // Sync when parent updates props
    useEffect(() => {
        if (externalPrograms) {
            setPrograms(externalPrograms)
        }
    }, [externalPrograms])

    const handleDelete = (id: string, title: string) => {
        setConfirmModal({
            title: t('trainer:programs.deleteProgram'),
            message: `${t('trainer:programs.confirmDeleteProgram')} "${title}"?`,
            confirmText: t('common:common.delete'),
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    setDeleting(id)
                    const res = await fetch(`/api/programs/${id}`, { method: 'DELETE' })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error?.message || t('common:errors.deletionError'))
                    if (externalPrograms && onRefresh) {
                        onRefresh()
                    } else {
                        fetchPrograms()
                    }
                } catch (err: any) {
                    showToast(err.message, 'error')
                } finally {
                    setDeleting(null)
                }
            },
        })
    }

    const filtered = programs.filter((p) => {
        const matchesTab = p.status === activeTab
        const search = searchTerm.toLowerCase()
        const matchesSearch =
            !search ||
            p.title.toLowerCase().includes(search) ||
            `${p.trainee.firstName} ${p.trainee.lastName}`.toLowerCase().includes(search) ||
            (p.trainer &&
                `${p.trainer.firstName} ${p.trainer.lastName}`.toLowerCase().includes(search))
        return matchesTab && matchesSearch
    })

    const counts = {
        draft: programs.filter((p) => p.status === 'draft').length,
        active: programs.filter((p) => p.status === 'active').length,
        completed: programs.filter((p) => p.status === 'completed').length,
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
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
            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder={`🔍 ${t('trainer:programs.searchPlaceholder')}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                />
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    {(['draft', 'active', 'completed'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 px-1 border-b-2 font-semibold text-sm whitespace-nowrap ${activeTab === tab
                                ? 'border-[#FFA700] text-[#FFA700]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab === 'draft' ? '📝' : tab === 'active' ? '✅' : '🏁'}{' '}
                            {STATUS_LABELS[tab]} ({counts[tab]})
                        </button>
                    ))}
                </nav>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <p className="text-gray-500 text-lg">
                        {searchTerm
                            ? t('trainer:programs.noProgramsFound')
                            : activeTab === 'draft'
                            ? t('trainer:programs.noDraftPrograms')
                            : activeTab === 'active'
                            ? t('trainer:programs.noActivePrograms')
                            : t('trainer:programs.noCompletedPrograms')}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('trainer:programs.program')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('trainer:programs.athlete')}
                                    </th>
                                    {showTrainer && (
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('trainer:programs.trainer')}
                                        </th>
                                    )}
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('common:common.status')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('common:common.duration')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('common:common.start')}
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('common:common.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filtered.map((program) => (
                                    <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900 truncate max-w-[200px]">
                                                {program.title}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {program.workoutsPerWeek} {t('trainer:programs.workoutsPerWeek')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {program.trainee.firstName} {program.trainee.lastName}
                                        </td>
                                        {showTrainer && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {program.trainer
                                                    ? `${program.trainer.firstName} ${program.trainer.lastName}`
                                                    : '—'}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_BADGE[program.status]}`}
                                            >
                                                {STATUS_LABELS[program.status]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {program.durationWeeks} {t('trainer:programs.weeksShort')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {program.startDate
                                                ? new Date(program.startDate).toLocaleDateString('it-IT')
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <Link
                                                    href={`${basePath}/${program.id}`}
                                                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold"
                                                >
                                                    {t('common:common.view')}
                                                </Link>
                                                {program.status === 'draft' && (
                                                    <>
                                                        <Link
                                                            href={`${basePath}/${program.id}/edit`}
                                                            className="text-green-600 hover:text-green-800"
                                                            title={t('common:common.edit')}
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </Link>
                                                        <button
                                                            onClick={() =>
                                                                handleDelete(program.id, program.title)
                                                            }
                                                            disabled={deleting === program.id}
                                                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                                                            title={t('common:common.delete')}
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                                {program.status === 'active' && (
                                                    <>
                                                        <span className="text-gray-300">|</span>
                                                        <Link
                                                            href={`${basePath}/${program.id}/progress`}
                                                            className="text-purple-600 hover:text-purple-800 text-sm font-semibold"
                                                        >
                                                            Progress
                                                        </Link>
                                                    </>
                                                )}
                                                {(program.status === 'active' ||
                                                    program.status === 'completed') && (
                                                        <>
                                                            <span className="text-gray-300">|</span>
                                                            <Link
                                                                href={`${basePath}/${program.id}/reports`}
                                                                className="text-orange-600 hover:text-orange-800 text-sm font-semibold"
                                                            >
                                                                Report
                                                            </Link>
                                                        </>
                                                    )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
