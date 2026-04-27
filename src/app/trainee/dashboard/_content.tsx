'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { NavigationCard, ProgressBar, SkeletonDashboard, WeekTypeBadge } from '@/components'
import { getApiErrorMessage } from '@/lib/api-error'
import { Dumbbell, Trophy, BarChart2, User, ClipboardList, Play } from 'lucide-react'

type ProgramStatus = 'draft' | 'active' | 'completed'

interface ProgramSummary {
    id: string
    title: string
    status: ProgramStatus
    startDate: string | null
    completedAt: string | null
    lastWorkoutCompletedAt: string | null
    createdAt: string
    durationWeeks: number
    workoutsPerWeek: number
    trainer: {
        firstName: string
        lastName: string
    }
}

interface ProgramProgress {
    completedWorkouts: number
    totalWorkouts: number
}

interface NextWorkout {
    id: string
    name: string
    dayOfWeek: number
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    exerciseCount: number
    completed: boolean
    started: boolean
}

const getProgramSortTime = (program: ProgramSummary): number => {
    const relevantDate = program.lastWorkoutCompletedAt || program.completedAt || program.startDate || program.createdAt
    return new Date(relevantDate).getTime()
}

const isPublishedProgram = (program: ProgramSummary): boolean => program.status !== 'draft'

export default function TraineeDashboardContent() {
    const { t } = useTranslation(['trainee', 'navigation', 'common'])
    const [loading, setLoading] = useState(true)
    const [activeProgram, setActiveProgram] = useState<ProgramSummary | null>(null)
    const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null)
    const [nextWorkout, setNextWorkout] = useState<NextWorkout | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true)

            const programsRes = await fetch('/api/programs?limit=10')
            const programsData = await programsRes.json()

            if (!programsRes.ok) {
                throw new Error(getApiErrorMessage(programsData, t('common:errors.loadingError'), t))
            }

            const programs = (programsData.data.items ?? []) as ProgramSummary[]
            const publishedPrograms = programs.filter(isPublishedProgram)
            const sortedPrograms = [...publishedPrograms].sort((a, b) => getProgramSortTime(b) - getProgramSortTime(a))
            const program = sortedPrograms.find((item) => item.status === 'active') ?? null

            setActiveProgram(program)

            if (program) {
                const progressRes = await fetch(`/api/programs/${program.id}/progress`)
                const progressData = await progressRes.json()

                if (!progressRes.ok) {
                    throw new Error(getApiErrorMessage(progressData, t('common:errors.loadingError'), t))
                }

                setProgramProgress({
                    completedWorkouts: progressData.data.completedWorkouts ?? 0,
                    totalWorkouts: progressData.data.totalWorkouts ?? 0,
                })
                setNextWorkout(progressData.data.nextWorkout ?? null)
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('common:errors.loadingError'))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchDashboardData()
    }, [fetchDashboardData])

    if (loading) {
        return (
            <div className="px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonDashboard cards={3} showTable={false} />
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

    // No active program
    if (!activeProgram) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('trainee:dashboard.title')}</h1>

                <div className="bg-white rounded-lg shadow-md p-12 text-center mb-8">
                    <div className="mb-6"><Dumbbell className="w-16 h-16 mx-auto text-gray-400" /></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t('trainee:dashboard.noActiveProgram')}
                    </h2>
                    <p className="text-gray-600 mb-6">
                        {t('trainee:dashboard.noActiveProgramDesc')}
                        <br />
                        {t('trainee:dashboard.contactTrainer')}
                    </p>
                    <Link
                        href="/trainee/records"
                        className="inline-block bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('trainee:dashboard.viewRecords')}
                    </Link>
                </div>

                {/* Navigation cards anche senza programma */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NavigationCard
                        href="/trainee/records"
                        icon="🏆"
                        title={t('navigation:navigation.myRecords')}
                        description={t('trainee:dashboard.recordsDescription')}
                        color="yellow"
                    />
                    <NavigationCard
                        href="/trainee/history"
                        icon="📊"
                        title={t('navigation:navigation.trainingHistory')}
                        description={t('trainee:dashboard.viewCompleted')}
                        color="blue"
                    />
                    <NavigationCard
                        href="/trainee/profile"
                        icon="👤"
                        title={t('navigation:navigation.myProfile')}
                        description={t('trainee:dashboard.profileDescription')}
                        color="secondary"
                    />
                </div>
            </div>
        )
    }

    const completedWorkouts = programProgress?.completedWorkouts ?? 0
    const totalWorkouts = programProgress?.totalWorkouts ?? 0
    const progressPercent = totalWorkouts > 0
        ? Math.round((completedWorkouts / totalWorkouts) * 100)
        : 0
    const nextWorkoutActionLabel = nextWorkout?.started
        ? t('trainee:currentProgram.resumeWorkout')
        : t('trainee:dashboard.startWorkout')

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('trainee:dashboard.title')}</h1>
                <p className="text-gray-600 mt-2">{t('trainee:dashboard.welcome')}</p>
            </div>

            {nextWorkout && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-8 mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-primary">
                            {t('trainee:dashboard.nextWorkout')}
                        </p>
                        {nextWorkout.weekType !== 'normal' && (
                            <WeekTypeBadge
                                weekType={nextWorkout.weekType}
                                labels={{
                                    normal: t('trainee:weekType.normal'),
                                    test: t('trainee:weekType.test'),
                                    deload: t('trainee:weekType.deload'),
                                }}
                            />
                        )}
                    </div>

                    <div className="flex items-end gap-6">
                        <div className="flex flex-col">
                            <span className="text-6xl sm:text-7xl font-black leading-none text-brand-primary">
                                {nextWorkout.dayOfWeek}
                            </span>
                            <span className="text-xs uppercase tracking-[0.12em] text-gray-500 mt-1">
                                {t('trainee:dashboard.dayLabel')}
                            </span>
                        </div>
                        <span className="text-4xl sm:text-5xl text-gray-300 self-center pb-2" aria-hidden="true">
                            ·
                        </span>
                        <div className="flex flex-col">
                            <span className="text-6xl sm:text-7xl font-black leading-none text-gray-900">
                                {nextWorkout.weekNumber}
                            </span>
                            <span className="text-xs uppercase tracking-[0.12em] text-gray-500 mt-1">
                                {t('trainee:dashboard.weekLabel')}
                            </span>
                        </div>
                    </div>

                    <p className="text-base text-gray-600 mt-4">
                        {t('trainee:dashboard.exercisesToComplete', { count: nextWorkout.exerciseCount })}
                    </p>

                    <div className="mt-6">
                        <Link
                            href={`/trainee/workouts/${nextWorkout.id}`}
                            aria-label={t('trainee:dashboard.startWorkoutAria', {
                                day: nextWorkout.dayOfWeek,
                                week: nextWorkout.weekNumber,
                            })}
                            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors"
                        >
                            <Play className="w-4 h-4" />
                            {nextWorkoutActionLabel}
                        </Link>
                    </div>
                </div>
            )}

            {/* Active Program Card */}
            <div className="bg-white border border-gray-200 border-l-4 border-l-brand-primary rounded-lg shadow-md p-8 mb-8">
                <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary mb-1">
                        {t('navigation:navigation.activeProgram')}
                    </p>
                    <h2 className="text-xl font-bold text-gray-900">{activeProgram.title}</h2>
                    <p className="text-sm text-gray-600">
                        {t('trainee:dashboard.trainerWith', {
                            firstName: activeProgram.trainer.firstName,
                            lastName: activeProgram.trainer.lastName,
                        })}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm mb-2">
                    <div>
                        <span className="text-gray-500">{t('trainee:dashboard.duration')}: </span>
                        <span className="font-semibold text-gray-900">
                            {t('trainee:dashboard.weeks', { count: activeProgram.durationWeeks })}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">{t('trainee:dashboard.progression')}: </span>
                        <span className="font-semibold text-gray-900">
                            {t('trainee:dashboard.workoutsProgress', {
                                completed: completedWorkouts,
                                total: totalWorkouts,
                            })}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500">{t('trainee:dashboard.completion')}: </span>
                        <span className="font-semibold text-brand-primary">{progressPercent}%</span>
                    </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-4">
                    <div
                        className="bg-brand-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                        role="progressbar"
                        aria-valuenow={progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('trainee:dashboard.completion')}
                    />
                </div>

                <div className="mt-2">
                    <Link
                        href="/trainee/programs/current"
                        className="inline-flex w-full items-center justify-center gap-2 border border-brand-primary text-brand-primary hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        <ClipboardList className="w-4 h-4" />
                        {t('trainee:dashboard.viewFullProgram')}
                    </Link>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('trainee:dashboard.sections')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NavigationCard
                        href="/trainee/records"
                        icon={<Trophy className="w-6 h-6" />}
                        title={t('navigation:navigation.myRecords')}
                        description={t('trainee:dashboard.recordsDescription')}
                        color="yellow"
                    />
                    <NavigationCard
                        href="/trainee/history"
                        icon={<BarChart2 className="w-6 h-6" />}
                        title={t('navigation:navigation.trainingHistory')}
                        description={t('trainee:dashboard.viewCompleted')}
                        color="blue"
                    />
                    <NavigationCard
                        href="/trainee/profile"
                        icon={<User className="w-6 h-6" />}
                        title={t('navigation:navigation.myProfile')}
                        description={t('trainee:dashboard.profileDescription')}
                        color="secondary"
                    />
                </div>
            </div>
        </div>
    )
}

