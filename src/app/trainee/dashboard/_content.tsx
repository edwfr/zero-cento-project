'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { NavigationCard, ProgressBar, SkeletonDashboard } from '@/components'
import { Dumbbell, Trophy, BarChart2, User, CalendarDays } from 'lucide-react'
import { formatDate } from '@/lib/date-format'

interface ActiveProgram {
    id: string
    title: string
    startDate: string
    durationWeeks: number
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
    dayOfWeek: number
    weekNumber: number
    exerciseCount: number
    completed: boolean
}

interface PersonalRecord {
    id: string
    exercise: {
        name: string
        type: string
    }
    weight: number
    reps: number
    achievedAt: string
}

export default function TraineeDashboardContent() {
    const { t } = useTranslation(['trainee', 'navigation'])
    const dayNames = t('trainee:dashboard.dayNames', { returnObjects: true }) as string[]
    const [loading, setLoading] = useState(true)
    const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null)
    const [programProgress, setProgramProgress] = useState<ProgramProgress | null>(null)
    const [nextWorkout, setNextWorkout] = useState<NextWorkout | null>(null)
    const [recentPRs, setRecentPRs] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const fetchDashboardData = async () => {
        try {
            setLoading(true)

            // Fetch active program
            const programsRes = await fetch('/api/programs?status=active')
            const programsData = await programsRes.json()

            if (programsRes.ok && programsData.data.items.length > 0) {
                const program = programsData.data.items[0]
                setActiveProgram(program)

                // Fetch progress summary for counts and next workout
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

            // Fetch recent PRs
            const prsRes = await fetch('/api/personal-records?limit=5')
            const prsData = await prsRes.json()

            if (prsRes.ok) {
                setRecentPRs(prsData.data.items)
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

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('trainee:dashboard.title')}</h1>
                <p className="text-gray-600 mt-2">{t('trainee:dashboard.welcome')}</p>
            </div>

            {/* Active Program Hero */}
            <div className="bg-gradient-to-r from-[#FFA700] to-[#FF9500] rounded-lg shadow-lg p-8 mb-8 text-white">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">{activeProgram.title}</h2>
                        <p className="text-white/90">
                            {t('trainee:dashboard.trainerWith', {
                                firstName: activeProgram.trainer.firstName,
                                lastName: activeProgram.trainer.lastName,
                            })}
                        </p>
                    </div>
                    <Link
                        href="/trainee/programs/current"
                        className="bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-3 rounded-lg transition-colors backdrop-blur-sm"
                    >
                        {t('trainee:dashboard.viewFullProgram')}
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                        <p className="text-white/80 text-sm mb-1">{t('trainee:dashboard.duration')}</p>
                        <p className="text-2xl font-bold">
                            {t('trainee:dashboard.weeks', { count: activeProgram.durationWeeks })}
                        </p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                        <p className="text-white/80 text-sm mb-1">{t('trainee:dashboard.progression')}</p>
                        <p className="text-2xl font-bold">
                            {t('trainee:dashboard.workoutsProgress', {
                                completed: completedWorkouts,
                                total: totalWorkouts,
                            })}
                        </p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                        <p className="text-white/80 text-sm mb-1">{t('trainee:dashboard.completion')}</p>
                        <p className="text-2xl font-bold">{progressPercent}%</p>
                    </div>
                </div>

                <div className="w-full bg-white/20 rounded-full h-3">
                    <div
                        className="bg-white h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Next Workout */}
            {nextWorkout && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 mb-1">{t('trainee:dashboard.nextWorkout')}</p>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {t('trainee:dashboard.workoutDay', {
                                    day: dayNames[nextWorkout.dayOfWeek],
                                    week: nextWorkout.weekNumber,
                                })}
                            </h3>
                            <p className="text-gray-700">
                                {t('trainee:dashboard.exercisesToComplete', { count: nextWorkout.exerciseCount })}
                            </p>
                        </div>
                        <Link
                            href={`/trainee/workouts/${nextWorkout.id}`}
                            className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                        >
                            {t('trainee:dashboard.startWorkout')}
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

            {/* Recent Personal Records */}
            {recentPRs.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900">
                            {t('trainee:dashboard.latestRecords')}
                        </h3>
                        <Link
                            href="/trainee/records"
                            className="text-[#FFA700] hover:text-[#FF9500] font-semibold text-sm"
                        >
                            {t('trainee:dashboard.viewAll')}
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {recentPRs.map((pr) => (
                            <div
                                key={pr.id}
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                            >
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        {pr.exercise.name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {formatDate(pr.achievedAt)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-[#FFA700]">
                                        {pr.weight}kg
                                    </p>
                                    <p className="text-sm text-gray-600">{t('trainee:dashboard.reps', { count: pr.reps })}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
