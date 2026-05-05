'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonList, StatCard, ProgressBar, Card } from '@/components'
import {
    ClipboardList,
    Calendar,
    CalendarCheck,
    Clock,
    Dumbbell,
    Trophy,
    Activity,
    FolderOpen,
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

interface MetaCellProps {
    icon: ReactNode
    label: string
    value: string
}

function MetaCell({ icon, label, value }: MetaCellProps) {
    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                {icon}
                <span className="text-xs uppercase tracking-wide">{label}</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">{value}</p>
        </div>
    )
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

    const getStatusHintText = (program: Program, endDate: string | null): string | null => {
        switch (program.status) {
            case 'completed':
                return endDate
                    ? t('history.completedOn', { date: formatDate(endDate) })
                    : t('history.completedProgramHint')
            case 'active':
                return t('history.activeProgramHint')
            case 'draft':
                return t('history.draftProgramHint')
            default:
                return null
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
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('history.title')}</h1>
                <p className="text-gray-600 mt-2">
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
                    <div className="mb-8">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500 mb-3">
                            {t('history.statsHeading')}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                title={t('history.statsTotalPrograms')}
                                value={programs.length}
                                icon={<FolderOpen className="w-6 h-6" />}
                                color="primary"
                            />
                            <StatCard
                                title={t('history.statsActive')}
                                value={activePrograms}
                                icon={<Activity className="w-6 h-6" />}
                                color="info"
                            />
                            <StatCard
                                title={t('history.statsCompleted')}
                                value={completedPrograms}
                                icon={<Trophy className="w-6 h-6" />}
                                color="success"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">
                            {t('history.programsHeading')}
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {programs
                            .sort((a, b) => getProgramSortTime(b) - getProgramSortTime(a))
                            .map((program) => {
                                const programStatus = program.status
                                const endDate = getProgramEndDate(program)
                                const accentClass = getStatusAccentClass(programStatus)
                                const hintText = getStatusHintText(program, endDate)

                                return (
                                    <Card
                                        key={program.id}
                                        variant="base"
                                        padding="none"
                                        className={`border border-gray-200 rounded-2xl shadow-md hover:shadow-lg transition-shadow border-l-4 ${accentClass}`}
                                    >
                                        <div className="p-6">
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                                        <h3 className="text-2xl font-bold text-gray-900 break-words">
                                                            {program.title}
                                                        </h3>
                                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusBadgeClasses(programStatus)}`}>
                                                            {getStatusLabel(programStatus)}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 text-sm">
                                                        {t('history.trainerWith', { firstName: program.trainer.firstName, lastName: program.trainer.lastName })}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                                <MetaCell
                                                    icon={<Calendar className="w-4 h-4" />}
                                                    label={t('history.startDate')}
                                                    value={formatDate(program.startDate)}
                                                />
                                                <MetaCell
                                                    icon={<CalendarCheck className="w-4 h-4" />}
                                                    label={t('history.endDate')}
                                                    value={endDate ? formatDate(endDate) : t('history.noEndDate')}
                                                />
                                                <MetaCell
                                                    icon={<Clock className="w-4 h-4" />}
                                                    label={t('history.duration')}
                                                    value={t('history.weeks', { count: program.durationWeeks })}
                                                />
                                                <MetaCell
                                                    icon={<Dumbbell className="w-4 h-4" />}
                                                    label={t('history.workoutsPerWeek')}
                                                    value={String(program.workoutsPerWeek)}
                                                />
                                            </div>

                                            {programStatus === 'active' && activeProgramProgress?.programId === program.id && activeProgramProgress.total > 0 && (
                                                <div className="mb-4">
                                                    <ProgressBar
                                                        current={activeProgramProgress.completed}
                                                        total={activeProgramProgress.total}
                                                        label={t('history.progressLabel')}
                                                        size="md"
                                                        color="primary"
                                                    />
                                                </div>
                                            )}

                                            {hintText && (
                                                <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 mb-4">
                                                    {hintText}
                                                </div>
                                            )}

                                            <div>
                                                <Link
                                                    href={`/trainee/programs/${program.id}`}
                                                    className="inline-flex items-center gap-2 border border-brand-primary text-brand-primary hover:bg-brand-primary/10 font-semibold px-4 py-2 rounded-lg transition-colors"
                                                >
                                                    {t('history.viewProgramDetails')}
                                                    <ChevronRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}
                    </div>
                </>
            )}
        </div>
    )
}

