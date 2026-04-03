'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { NavigationCard, ProgressBar, SkeletonDashboard } from '@/components'
import { Dumbbell, Trophy, BarChart2, User, CalendarDays, ClipboardList, Play } from 'lucide-react'

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
    const { t } = useTranslation(['trainee', 'navigation'])
    const [loading, setLoading] = useState(true)
    const [activeProgram, setActiveProgram] = useState<ProgramSummary | null>(null)
    const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null)
    const [nextWorkout, setNextWorkout] = useState<NextWorkout | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const fetchDashboardData = async () => {
        try {
            setLoading(true)

            const programsRes = await fetch('/api/programs?limit=10')
            const programsData = await programsRes.json()

            if (programsRes.ok) {
                const programs = (programsData.data.items ?? []) as ProgramSummary[]
                const publishedPrograms = programs.filter(isPublishedProgram)
                const sortedPrograms = [...publishedPrograms].sort((a, b) => getProgramSortTime(b) - getProgramSortTime(a))
                const program = sortedPrograms.find((item) => item.status === 'active') ?? null

                setActiveProgram(program)

                if (program) {
                    const progressRes = await fetch(`/api/programs/${program.id}/progress`)
                    const progressData = await progressRes.json()

                    if (progressRes.ok) {
                        setProgramProgress({
                            completedWorkouts: progressData.data.completedWorkouts ?? 0,
                            totalWorkouts: progressData.data.totalWorkouts ?? 0,
                        })
                        setNextWorkout(progressData.data.nextWorkout ?? null)
                    }
                }
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

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
                        className="inline-block bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
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

            {/* Active Program Card */}
            <div className="bg-white border border-gray-200 border-l-4 border-l-[#FFA700] rounded-lg shadow-md p-8 mb-8">
                <div className="flex flex-col items-start justify-between mb-6 gap-4 sm:flex-row">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#FFA700] mb-2">
                            {t('navigation:navigation.activeProgram')}
                        </p>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{activeProgram.title}</h2>
                        <p className="text-gray-600">
                            {t('trainee:dashboard.trainerWith', {
                                firstName: activeProgram.trainer.firstName,
                                lastName: activeProgram.trainer.lastName,
                            })}
                        </p>
                    </div>
                    <Link
                        href="/trainee/programs/current"
                        className="inline-flex w-full items-center justify-center gap-2 border border-[#FFA700] text-[#FFA700] hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors sm:w-auto"
                    >
                        <ClipboardList className="w-4 h-4" />
                        {t('trainee:dashboard.viewFullProgram')}
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-gray-600 text-sm mb-1">{t('trainee:dashboard.duration')}</p>
                        <p className="text-2xl font-bold text-[#FFA700]">
                            {t('trainee:dashboard.weeks', { count: activeProgram.durationWeeks })}
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-gray-600 text-sm mb-1">{t('trainee:dashboard.progression')}</p>
                        <p className="text-2xl font-bold text-[#FFA700]">
                            {t('trainee:dashboard.workoutsProgress', {
                                completed: completedWorkouts,
                                total: totalWorkouts,
                            })}
                        </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <p className="text-gray-600 text-sm mb-1">{t('trainee:dashboard.completion')}</p>
                        <p className="text-2xl font-bold text-[#FFA700]">{progressPercent}%</p>
                    </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-[#FFA700] h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {nextWorkout && (
                <div className="bg-white border border-gray-200 border-l-4 border-l-[#FFA700] rounded-lg shadow-md p-8 mb-8">
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#FFA700] mb-2">
                                {t('trainee:dashboard.nextWorkout')}
                            </p>
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                {t('trainee:dashboard.workoutDay', {
                                    day: nextWorkout.name,
                                    week: nextWorkout.weekNumber,
                                })}
                            </h2>
                            <p className="text-gray-600">{t('trainee:dashboard.exercisesToComplete', { count: nextWorkout.exerciseCount })}</p>
                        </div>
                        <Link
                            href={`/trainee/workouts/${nextWorkout.id}`}
                            className="inline-flex w-full items-center justify-center gap-2 border border-[#FFA700] text-[#FFA700] hover:bg-[#FFF7E5] font-semibold px-6 py-3 rounded-lg transition-colors sm:w-auto"
                        >
                            <Play className="w-4 h-4" />
                            {nextWorkoutActionLabel}
                        </Link>
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('trainee:dashboard.sections')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NavigationCard
                        href="/trainee/programs/current"
                        icon={<CalendarDays className="w-6 h-6" />}
                        title={t('navigation:navigation.activeProgram')}
                        description={t('trainee:dashboard.activeProgramDesc')}
                        color="primary"
                    />
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
