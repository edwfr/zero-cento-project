'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SkeletonTable } from '@/components'
import { useToast } from '@/components/ToastNotification'
import ConfirmationModal from '@/components/ConfirmationModal'
import { formatDate } from '@/lib/date-format'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { Plus, FileEdit, CheckCircle2, Trash2, FlagTriangleRight, Eye, FlaskConical } from 'lucide-react'
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

export default function TrainerProgramsContent() {
    const { t } = useTranslation('trainer')
    const { showToast } = useToast()
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'draft' | 'active' | 'completed'>('active')
    const [searchTerm, setSearchTerm] = useState('')
    const [confirmModal, setConfirmModal] = useState<{
        title: string
        message: string
        onConfirm: () => void
        confirmText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null)

    const fetchPrograms = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/programs')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('programs.loadingError'), t))
            }

            setPrograms(data.data.items)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('programs.loadingError'))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchPrograms()
    }, [fetchPrograms])

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

                    void fetchPrograms()
                } catch (err: unknown) {
                    showToast(err instanceof Error ? err.message : t('programs.deleteError'), 'error')
                }
            },
        })
    }

    const filteredPrograms = programs.filter((prog) => {
        const matchesTab = prog.status === activeTab
        const matchesSearch =
            prog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${prog.trainee.firstName} ${prog.trainee.lastName}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase())

        return matchesTab && matchesSearch
    })

    const statusCounts = {
        draft: programs.filter((p) => p.status === 'draft').length,
        active: programs.filter((p) => p.status === 'active').length,
        completed: programs.filter((p) => p.status === 'completed').length,
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
                            <Input
                                type="text"
                                placeholder={t('programs.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                inputSize="md"
                            />
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
                                onClick={() => setActiveTab('draft')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'draft'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <FileEdit className="w-4 h-4 inline mr-1" />{t('programs.tabDraft')} ({statusCounts.draft})
                            </button>
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'active'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <CheckCircle2 className="w-4 h-4 inline mr-1" />{t('programs.tabActive')} ({statusCounts.active})
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
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
                {filteredPrograms.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {searchTerm
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
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.program')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.athlete')}
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.durationLabel')}
                                        </th>
                                        {showStartDateColumn && (
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {t('programs.startDate')}
                                            </th>
                                        )}
                                        {showCompletionDateColumn && (
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {completionDateColumnLabel}
                                            </th>
                                        )}
                                        {showTestStatusColumn && (
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {t('programs.testStatusColumn')}
                                            </th>
                                        )}
                                        {showLastModifiedColumn && (
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {t('programs.lastModifiedColumn')}
                                            </th>
                                        )}
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {t('programs.actionsColumn')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredPrograms.map((program) => {
                                        const hasTestWeeks = getHasTestWeeks(program)
                                        const testsCompleted = getTestsCompleted(program)

                                        return (
                                            <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 align-top">
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
                                                <td className="px-6 py-4 align-top whitespace-nowrap text-sm text-gray-700">
                                                    {program.trainee.firstName} {program.trainee.lastName}
                                                </td>
                                                <td className="px-6 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                    <div>{t('programs.durationWeeks', { count: program.durationWeeks })}</div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {program.workoutsPerWeek} {t('programs.workoutsPerWeek')}
                                                    </div>
                                                </td>
                                                {showStartDateColumn && (
                                                    <td className="px-6 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                        {program.startDate ? formatDate(program.startDate) : '-'}
                                                    </td>
                                                )}
                                                {showCompletionDateColumn && (
                                                    <td className="px-6 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                        {activeTab === 'active'
                                                            ? formatDate(getPlannedCompletionDate(program))
                                                            : formatDate(getEffectiveCompletionDate(program))}
                                                    </td>
                                                )}
                                                {showTestStatusColumn && (
                                                    <td className="px-6 py-4 align-top">
                                                        {!hasTestWeeks ? (
                                                            <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                                                                {t('programs.noTestWeeks')}
                                                            </span>
                                                        ) : testsCompleted ? (
                                                            <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                                                {t('programs.testsCompleted')}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                                                                {t('programs.testsPending')}
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                {showLastModifiedColumn && (
                                                    <td className="px-6 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                        {formatDate(getLastModifiedDate(program))}
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 align-top">
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
                    </div>
                )}
            </div>
        </>
    )
}

