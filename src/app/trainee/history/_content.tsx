'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonList } from '@/components'
import { ClipboardList } from 'lucide-react'
import { formatDate } from '@/lib/date-format'

type ProgramStatus = 'draft' | 'active' | 'completed'

interface Program {
    id: string
    title: string
    status: ProgramStatus
    startDate: string | null
    completedAt: string | null
    lastWorkoutCompletedAt: string | null
    durationWeeks: number
    workoutsPerWeek: number
    createdAt: string
    trainer: {
        firstName: string
        lastName: string
    }
}

interface ProgramProgressSummary {
    completedWorkouts: number
    totalWorkouts: number
}

const getProgramSortTime = (program: Program): number => {
    const relevantDate = program.lastWorkoutCompletedAt || program.completedAt || program.startDate || program.createdAt
    return new Date(relevantDate).getTime()
}

export default function HistoryContent() {
    const { t } = useTranslation('trainee')
    const [loading, setLoading] = useState(true)
    const [programs, setPrograms] = useState<Program[]>([])
    const [progressByProgramId, setProgressByProgramId] = useState<Record<string, ProgramProgressSummary>>({})
    const [error, setError] = useState<string | null>(null)

    const isPublishedProgram = (program: Program): boolean => program.status !== 'draft'

    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true)

            const res = await fetch('/api/programs?limit=100')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('history.loadingError'), t))
            }

            const publishedPrograms = (data.data.items ?? []).filter(isPublishedProgram) as Program[]
            setPrograms(publishedPrograms)

            const activePrograms = publishedPrograms.filter((program) => program.status === 'active')

            if (activePrograms.length > 0) {
                const progressEntries = await Promise.all(
                    activePrograms.map(async (program) => {
                        try {
                            const progressRes = await fetch(`/api/programs/${program.id}/progress`)

                            if (!progressRes.ok) {
                                return null
                            }

                            const progressData = await progressRes.json()

                            return [
                                program.id,
                                {
                                    completedWorkouts: progressData.data.completedWorkouts ?? 0,
                                    totalWorkouts: progressData.data.totalWorkouts ?? 0,
                                },
                            ] as const
                        } catch {
                            return null
                        }
                    })
                )

                setProgressByProgramId(Object.fromEntries(progressEntries.filter((entry): entry is readonly [string, ProgramProgressSummary] => entry !== null)))
            } else {
                setProgressByProgramId({})
            }
        } catch (err: unknown) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchHistory()
    }, [fetchHistory])

    const getDisplayStatus = (program: Program): ProgramStatus => {
        if (program.status !== 'active') {
            return program.status
        }

        const progress = progressByProgramId[program.id]

        if (progress && progress.totalWorkouts > 0 && progress.completedWorkouts === progress.totalWorkouts) {
            return 'completed'
        }

        return 'active'
    }

    const getProgramEndDate = (program: Program, displayStatus: ProgramStatus): string | null => {
        if (displayStatus !== 'completed') {
            return null
        }

        return program.lastWorkoutCompletedAt || program.completedAt || null
    }

    const getStatusBadgeClasses = (status: ProgramStatus): string => {
        switch (status) {
            case 'active':
                return 'bg-brand-primary text-white'
            case 'completed':
                return 'bg-emerald-100 text-emerald-800'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const getStatusLabel = (status: ProgramStatus): string => {
        switch (status) {
            case 'active':
                return t('history.active')
            case 'completed':
                return t('history.completed')
            default:
                return t('history.draft')
        }
    }

    const activePrograms = programs.filter((program) => getDisplayStatus(program) === 'active').length
    const completedPrograms = programs.filter((program) => getDisplayStatus(program) === 'completed').length

    if (loading) {
        return (
            <div className="py-8">
                <SkeletonList items={5} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('history.title')}</h1>
                <p className="text-gray-600 mt-2">
                    {t('history.description')}
                </p>
            </div>

            {programs.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <div className="mb-4"><ClipboardList className="w-16 h-16 mx-auto text-gray-300" /></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t('history.noPrograms')}
                    </h2>
                    <p className="text-gray-600 mb-6">
                        {t('history.noProgramsDesc')}
                    </p>
                    <Link
                        href="/trainee/dashboard"
                        className="inline-block bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('history.goToDashboard')}
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {programs
                        .sort((a, b) => getProgramSortTime(b) - getProgramSortTime(a))
                        .map((program) => {
                            const displayStatus = getDisplayStatus(program)
                            const endDate = getProgramEndDate(program, displayStatus)

                            return (
                                <div
                                    key={program.id}
                                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <h3 className="text-2xl font-bold text-gray-900">
                                                    {program.title}
                                                </h3>
                                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClasses(displayStatus)}`}>
                                                    {getStatusLabel(displayStatus)}
                                                </span>
                                            </div>
                                            <p className="text-gray-600">
                                                {t('history.trainerWith', { firstName: program.trainer.firstName, lastName: program.trainer.lastName })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.status')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {getStatusLabel(displayStatus)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.startDate')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {formatDate(program.startDate)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.endDate')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {formatDate(endDate)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.duration')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {t('history.weeks', { count: program.durationWeeks })}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{t('history.workoutsPerWeek')}</p>
                                            <p className="font-semibold text-gray-900">
                                                {program.workoutsPerWeek}
                                            </p>
                                        </div>
                                    </div>

                                    {displayStatus === 'completed' && endDate && (
                                        <p className="text-sm text-gray-600">
                                            {t('history.completedOn', { date: formatDate(endDate) })}
                                        </p>
                                    )}
                                    {displayStatus === 'completed' && !endDate && (
                                        <p className="text-sm text-gray-600">
                                            {t('history.completedProgramHint')}
                                        </p>
                                    )}
                                    {displayStatus === 'active' && (
                                        <p className="text-sm text-gray-600">
                                            {t('history.activeProgramHint')}
                                        </p>
                                    )}
                                    {displayStatus === 'draft' && (
                                        <p className="text-sm text-gray-600">
                                            {t('history.draftProgramHint')}
                                        </p>
                                    )}
                                    <div className="mt-4">
                                        <Link
                                            href={`/trainee/programs/${program.id}`}
                                            className="inline-flex items-center rounded-lg border border-brand-primary px-4 py-2 font-semibold text-brand-primary transition-colors hover:bg-[#FFF7E5]"
                                        >
                                            {t('history.viewProgramDetails')}
                                        </Link>
                                    </div>
                                </div>
                            )
                        })}
                </div>
            )}

            {/* Stats Summary */}
            {programs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <p className="text-sm text-gray-600 mb-1">{t('history.statsTotalPrograms')}</p>
                        <p className="text-3xl font-bold text-brand-primary">{programs.length}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <p className="text-sm text-gray-600 mb-1">{t('history.statsCompleted')}</p>
                        <p className="text-3xl font-bold text-brand-primary">
                            {completedPrograms}
                        </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6 text-center">
                        <p className="text-sm text-gray-600 mb-1">{t('history.statsActive')}</p>
                        <p className="text-3xl font-bold text-brand-primary">
                            {activePrograms}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

