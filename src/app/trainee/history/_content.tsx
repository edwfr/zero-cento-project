'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonList, Card } from '@/components'
import {
    ClipboardList,
    ChevronRight,
} from 'lucide-react'
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

const getProgramSortTime = (program: Program): number => {
    const relevantDate = program.lastWorkoutCompletedAt || program.completedAt || program.startDate || program.createdAt
    return new Date(relevantDate).getTime()
}

const getStatusAccentClass = (status: ProgramStatus): string => {
    switch (status) {
        case 'active':
            return 'border-l-brand-primary'
        case 'completed':
            return 'border-l-emerald-500'
        default:
            return 'border-l-gray-300'
    }
}

export default function HistoryContent() {
    const { t } = useTranslation('trainee')
    const [loading, setLoading] = useState(true)
    const [programs, setPrograms] = useState<Program[]>([])
    const [error, setError] = useState<string | null>(null)
    const [activeProgramProgress, setActiveProgramProgress] = useState<{
        programId: string
        completed: number
        total: number
    } | null>(null)

    const isPublishedProgram = (program: Program): boolean => program.status !== 'draft'

    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const res = await fetch('/api/programs?limit=100')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('history.loadingError'), t))
            }

            const publishedPrograms = (data.data.items ?? []).filter(isPublishedProgram) as Program[]
            setPrograms(publishedPrograms)

            const active = publishedPrograms.find((program) => program.status === 'active')
            if (active) {
                setActiveProgramProgress(null)
                try {
                    const progressRes = await fetch(`/api/programs/${active.id}/progress`)
                    const progressData = await progressRes.json()

                    if (progressRes.ok) {
                        setActiveProgramProgress({
                            programId: active.id,
                            completed: progressData.data.completedWorkouts ?? 0,
                            total: progressData.data.totalWorkouts ?? 0,
                        })
                    }
                } catch {
                    // Progress fetch failure is non-fatal; the card simply won't render the bar.
                }
            } else {
                setActiveProgramProgress(null)
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

    const getProgramEndDate = (program: Program): string | null => {
        if (program.status !== 'completed') {
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

    const activePrograms = programs.filter((program) => program.status === 'active').length
    const completedPrograms = programs.filter((program) => program.status === 'completed').length

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto py-8">
                <SkeletonList items={5} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-6xl mx-auto py-8">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-2xl">
                    {error}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">{t('history.title')}</h1>
                <p className="text-gray-500 mt-1 text-sm">
                    {t('history.description')}
                </p>
            </div>

            {programs.length === 0 ? (
                <Card variant="base" padding="none" className="border border-gray-200 rounded-2xl shadow-md">
                    <div className="p-12 text-center">
                        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/10">
                            <ClipboardList className="w-10 h-10 text-brand-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">
                            {t('history.noPrograms')}
                        </h2>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                            {t('history.noProgramsDesc')}
                        </p>
                        <Link
                            href="/trainee/dashboard"
                            className="inline-flex items-center gap-2 border border-brand-primary text-brand-primary hover:bg-brand-primary/10 font-semibold px-6 py-3 rounded-lg transition-colors"
                        >
                            {t('history.goToDashboard')}
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </Card>
            ) : (
                <>
                    <div className="mb-5 flex items-center gap-3 text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">{t('history.statsHeading')}</span>
                        <span className="text-gray-300">|</span>
                        <span>
                            {[
                                t('history.statsTotal', { count: programs.length }),
                                t('history.statsActive_count', { count: activePrograms }),
                                t('history.statsCompleted_count', { count: completedPrograms }),
                            ].join(' · ')}
                        </span>
                    </div>

                    <div className="mb-3">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">
                            {t('history.programsHeading')}
                        </h2>
                    </div>

                    <div className="space-y-2">
                        {programs
                            .sort((a, b) => getProgramSortTime(b) - getProgramSortTime(a))
                            .map((program) => {
                                const programStatus = program.status
                                const endDate = getProgramEndDate(program)
                                const accentClass = getStatusAccentClass(programStatus)
                                const progress = activeProgramProgress?.programId === program.id
                                    ? activeProgramProgress
                                    : null
                                const progressPercent = progress && progress.total > 0
                                    ? Math.round((progress.completed / progress.total) * 100)
                                    : null

                                return (
                                    <Link
                                        key={program.id}
                                        href={`/trainee/programs/${program.id}`}
                                        className={`group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md border-l-4 ${accentClass}`}
                                    >
                                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClasses(programStatus)}`}>
                                            {getStatusLabel(programStatus)}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-gray-900 text-sm">
                                                {program.title}
                                            </p>
                                            <p className="truncate text-xs text-gray-500 mt-0.5">
                                                {t('history.trainerWith', {
                                                    firstName: program.trainer.firstName,
                                                    lastName: program.trainer.lastName,
                                                })}
                                            </p>
                                            {program.startDate && (
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {endDate
                                                        ? t('history.programRowPeriod', {
                                                            start: formatDate(program.startDate),
                                                            end: formatDate(endDate),
                                                        })
                                                        : t('history.programRowStarted', {
                                                            date: formatDate(program.startDate),
                                                        })}
                                                    {' · '}
                                                    {t('history.programRowDuration', { count: program.durationWeeks })}
                                                </p>
                                            )}
                                            {progressPercent !== null && (
                                                <div className="mt-1.5">
                                                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                                                        <div
                                                            className="h-1.5 rounded-full bg-brand-primary transition-all"
                                                            style={{ width: `${progressPercent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-brand-primary" />
                                    </Link>
                                )
                            })}
                    </div>
                </>
            )}
        </div>
    )
}

