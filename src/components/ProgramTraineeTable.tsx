'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock3, FileEdit, FlagTriangleRight, Minus, Plus } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { ActionIconButton, InlineActions } from './ActionIconButton'
import { Button } from './Button'
import { Input } from './Input'
import { SkeletonTable } from './Skeleton'

export type ProgramStatusTab = 'draft' | 'active' | 'completed'

export interface ProgramTraineeTableProgram {
    id: string
    title: string
    status: ProgramStatusTab
    durationWeeks: number
    workoutsPerWeek: number
    startDate: string | null
    completedAt?: string | null
    lastWorkoutCompletedAt?: string | null
    updatedAt?: string | null
    trainee?: {
        firstName: string
        lastName: string
    }
    weeks?: Array<{
        id: string
        weekNumber: number
        weekType: 'normal' | 'test' | 'deload'
    }>
    testWeeks?: number[]
    hasTestWeeks?: boolean
    testsCompleted?: boolean
}

export interface ProgramTraineeTableStatusCounts {
    draft: number
    active: number
    completed: number
}

export interface ProgramTraineeTableProps {
    programs: ProgramTraineeTableProgram[]
    loading: boolean
    error: string | null
    activeTab: ProgramStatusTab
    statusCounts: ProgramTraineeTableStatusCounts
    searchTerm: string
    appliedSearchTerm: string
    isRefreshing: boolean
    currentPage: number
    totalPages: number
    totalItems: number
    visiblePages: number[]
    newProgramHref: string
    emptyStateCtaHref: string
    onSearchChange: (value: string) => void
    onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    onTabChange: (tab: ProgramStatusTab) => void
    onPageChange: (page: number) => void
    onDeleteProgram: (id: string, title: string) => void
    getEditHref: (program: ProgramTraineeTableProgram) => string
    getViewHref: (program: ProgramTraineeTableProgram) => string
    getCloneHref: (program: ProgramTraineeTableProgram) => string
    getViewTestsHref: (program: ProgramTraineeTableProgram) => string
    getAthleteName?: (program: ProgramTraineeTableProgram) => string
}

export default function ProgramTraineeTable({
    programs,
    loading,
    error,
    activeTab,
    statusCounts,
    searchTerm,
    appliedSearchTerm,
    isRefreshing,
    currentPage,
    totalPages,
    totalItems,
    visiblePages,
    newProgramHref,
    emptyStateCtaHref,
    onSearchChange,
    onSearchSubmit,
    onTabChange,
    onPageChange,
    onDeleteProgram,
    getEditHref,
    getViewHref,
    getCloneHref,
    getViewTestsHref,
    getAthleteName,
}: ProgramTraineeTableProps) {
    const { t } = useTranslation(['trainer', 'components', 'common'])

    const getTestWeeks = (program: ProgramTraineeTableProgram) => {
        if (program.testWeeks && program.testWeeks.length > 0) {
            return program.testWeeks
        }

        return (program.weeks ?? [])
            .filter((week) => week.weekType === 'test')
            .map((week) => week.weekNumber)
    }

    const getHasTestWeeks = (program: ProgramTraineeTableProgram) => {
        if (typeof program.hasTestWeeks === 'boolean') {
            return program.hasTestWeeks
        }

        return getTestWeeks(program).length > 0
    }

    const getTestsCompleted = (program: ProgramTraineeTableProgram) => {
        return Boolean(program.testsCompleted)
    }

    const getPlannedCompletionDate = (program: ProgramTraineeTableProgram) => {
        if (!program.startDate) {
            return null
        }

        const plannedEndDate = new Date(program.startDate)
        plannedEndDate.setDate(plannedEndDate.getDate() + program.durationWeeks * 7 - 1)
        return plannedEndDate
    }

    const getEffectiveCompletionDate = (program: ProgramTraineeTableProgram) => {
        return program.lastWorkoutCompletedAt || program.completedAt || null
    }

    const getLastModifiedDate = (program: ProgramTraineeTableProgram) => {
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

    return (
        <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 max-w-md">
                        <form className="flex items-center gap-2" onSubmit={onSearchSubmit}>
                            <Input
                                type="text"
                                placeholder={t('programs.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(event) => onSearchChange(event.target.value)}
                                inputSize="md"
                            />
                            <Button type="submit" variant="secondary" size="md" isLoading={isRefreshing}>
                                {t('common:common.search')}
                            </Button>
                        </form>
                    </div>

                    <Link
                        href={newProgramHref}
                        className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4 inline mr-2" />{t('programs.newProgram')}
                    </Link>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => onTabChange('draft')}
                            className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'draft'
                                ? 'border-brand-primary text-brand-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <FileEdit className="w-4 h-4 inline mr-1" />{t('programs.tabDraft')} ({statusCounts.draft})
                        </button>
                        <button
                            onClick={() => onTabChange('active')}
                            className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'active'
                                ? 'border-brand-primary text-brand-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <CheckCircle2 className="w-4 h-4 inline mr-1" />{t('programs.tabActive')} ({statusCounts.active})
                        </button>
                        <button
                            onClick={() => onTabChange('completed')}
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

            {loading ? (
                <div className="bg-white rounded-lg shadow-md p-4">
                    <SkeletonTable rows={6} columns={7} />
                </div>
            ) : programs.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <p className="text-gray-500 text-lg mb-4">
                        {appliedSearchTerm
                            ? t('programs.noProgramsFound')
                            : activeTab === 'draft'
                                ? t('programs.noDraftPrograms')
                                : activeTab === 'active'
                                    ? t('programs.noActivePrograms')
                                    : t('programs.noCompletedPrograms')}
                    </p>
                    <Link
                        href={emptyStateCtaHref}
                        className="inline-block bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                    >
                        {t('athletes.createNewProgram')}
                    </Link>
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
                                                {getAthleteName
                                                    ? getAthleteName(program)
                                                    : `${program.trainee?.firstName ?? '-'} ${program.trainee?.lastName ?? ''}`.trim()}
                                            </td>
                                            <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                <div>{t('programs.durationWeeks', { count: program.durationWeeks })}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {program.workoutsPerWeek} {t('programs.workoutsPerWeek')}
                                                </div>
                                            </td>
                                            {showStartDateColumn && (
                                                <td className="px-4 py-4 align-top text-sm text-gray-700 whitespace-nowrap">
                                                    {formatDate(program.startDate)}
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
                                                                href={getEditHref(program)}
                                                            />
                                                            <ActionIconButton
                                                                variant="view"
                                                                label={t('programs.viewProgram')}
                                                                href={getViewHref(program)}
                                                            />
                                                            <ActionIconButton
                                                                variant="clone"
                                                                label={t('programs.cloneProgram')}
                                                                href={getCloneHref(program)}
                                                            />
                                                            <ActionIconButton
                                                                variant="delete"
                                                                label={t('programs.delete')}
                                                                onClick={() => onDeleteProgram(program.id, program.title)}
                                                            />
                                                        </InlineActions>
                                                    ) : (
                                                        <InlineActions>
                                                            {program.status === 'active' && (
                                                                <ActionIconButton
                                                                    variant="edit"
                                                                    label={t('programs.editProgramAction')}
                                                                    href={getEditHref(program)}
                                                                />
                                                            )}
                                                            <ActionIconButton
                                                                variant="view"
                                                                label={t('programs.viewProgram')}
                                                                href={getViewHref(program)}
                                                            />
                                                            <ActionIconButton
                                                                variant="clone"
                                                                label={t('programs.cloneProgram')}
                                                                href={getCloneHref(program)}
                                                            />
                                                            <ActionIconButton
                                                                variant="view-test"
                                                                label={t('programs.viewTests')}
                                                                href={getViewTestsHref(program)}
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
                                    onClick={() => onPageChange(1)}
                                    disabled={isRefreshing || currentPage === 1}
                                >
                                    {t('components:pagination.first')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                    disabled={isRefreshing || currentPage === 1}
                                >
                                    {t('components:pagination.previous')}
                                </Button>

                                {visiblePages.map((pageNumber) => (
                                    <Button
                                        key={pageNumber}
                                        variant={pageNumber === currentPage ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => onPageChange(pageNumber)}
                                        disabled={isRefreshing || pageNumber === currentPage}
                                    >
                                        {pageNumber}
                                    </Button>
                                ))}

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                    disabled={isRefreshing || currentPage === totalPages}
                                >
                                    {t('components:pagination.next')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onPageChange(totalPages)}
                                    disabled={isRefreshing || currentPage === totalPages}
                                >
                                    {t('components:pagination.last')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    )
}
