'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Dumbbell, BarChart2, TrendingUp, GraduationCap, PersonStanding, ClipboardList, Info, Settings } from 'lucide-react'
import { StatCard, NavigationCard, SkeletonDashboard } from '@/components'
import { getApiErrorMessage } from '@/lib/api-error'

interface DashboardStats {
    totalUsers: number
    totalTrainers: number
    totalTrainees: number
    activePrograms: number
    totalExercises: number
    totalFeedback: number
}

export default function AdminDashboardContent() {
    const { t } = useTranslation(['admin', 'common'])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchDashboardStats = useCallback(async () => {
        try {
            setLoading(true)

            const [usersRes, programsRes, exercisesRes, feedbackRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/programs'),
                fetch('/api/exercises'),
                fetch('/api/feedback'),
            ])

            const [usersData, programsData, exercisesData, feedbackData] = await Promise.all([
                usersRes.json(),
                programsRes.json(),
                exercisesRes.json(),
                feedbackRes.json(),
            ])

            const failedResponse = [
                { response: usersRes, data: usersData },
                { response: programsRes, data: programsData },
                { response: exercisesRes, data: exercisesData },
                { response: feedbackRes, data: feedbackData },
            ].find(({ response }) => !response.ok)

            if (failedResponse) {
                throw new Error(getApiErrorMessage(failedResponse.data, t('common:errors.loadingError'), t))
            }

            const users = usersData.data.items
            const programs = programsData.data.items
            const exercises = exercisesData.data.items
            const feedback = feedbackData.data.items || []

            setStats({
                totalUsers: users.length,
                totalTrainers: users.filter((u: { role: string }) => u.role === 'trainer').length,
                totalTrainees: users.filter((u: { role: string }) => u.role === 'trainee').length,
                activePrograms: programs.filter((p: { status: string }) => p.status === 'active').length,
                totalExercises: exercises.length,
                totalFeedback: feedback.length,
            })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('common:errors.loadingError'))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchDashboardStats()
    }, [fetchDashboardStats])

    if (loading) {
        return <SkeletonDashboard cards={6} showTable={false} />
    }

    if (error || !stats) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                {error || t('dashboard.errorLoadDashboard')}
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.statsTitle')}</h1>
                <p className="text-gray-600 mt-2">{t('dashboard.statsDescription')}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard
                    title={t('dashboard.totalUsers')}
                    value={stats.totalUsers}
                    subtitle={t('dashboard.trainersSubCount', { trainers: stats.totalTrainers, trainees: stats.totalTrainees })}
                    icon={<Users className="w-5 h-5" />}
                    color="primary"
                    onClick={() => (window.location.href = '/admin/users')}
                />

                <StatCard
                    title={t('dashboard.activePrograms')}
                    value={stats.activePrograms}
                    subtitle={t('dashboard.activeProgramsSub')}
                    icon={<Dumbbell className="w-5 h-5" />}
                    color="success"
                />

                <StatCard
                    title={t('dashboard.exercisesLib')}
                    value={stats.totalExercises}
                    subtitle={t('dashboard.exercisesLibSub')}
                    icon={<Dumbbell className="w-5 h-5" />}
                    color="info"
                />

                <StatCard
                    title={t('dashboard.feedbackReceived')}
                    value={stats.totalFeedback}
                    subtitle={t('dashboard.feedbackSub')}
                    icon={<BarChart2 className="w-5 h-5" />}
                    color="warning"
                />

                <StatCard
                    title={t('dashboard.trainers')}
                    value={stats.totalTrainers}
                    subtitle={t('dashboard.trainersSub')}
                    icon={<GraduationCap className="w-5 h-5" />}
                    color="info"
                />

                <StatCard
                    title={t('dashboard.athletes')}
                    value={stats.totalTrainees}
                    subtitle={t('dashboard.athletesSub')}
                    icon={<PersonStanding className="w-5 h-5" />}
                    color="success"
                />
            </div>

            {/* Navigation Cards */}
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('dashboard.quickNav')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <NavigationCard
                        href="/admin/users"
                        icon={<Users className="w-6 h-6" />}
                        title={t('dashboard.navUsers')}
                        description={t('dashboard.navUsersDesc')}
                        color="blue"
                    />
                    <NavigationCard
                        href="/admin/exercises"
                        icon={<Dumbbell className="w-6 h-6" />}
                        title={t('dashboard.navExercises')}
                        description={t('dashboard.navExercisesDesc')}
                        color="primary"
                    />
                    <NavigationCard
                        href="/admin/programs"
                        icon={<ClipboardList className="w-6 h-6" />}
                        title={t('dashboard.navPrograms')}
                        description={t('dashboard.navProgramsDesc')}
                        color="green"
                    />
                    <NavigationCard
                        href="/admin/statistics"
                        icon={<BarChart2 className="w-6 h-6" />}
                        title={t('dashboard.navStats')}
                        description={t('dashboard.navStatsDesc')}
                        color="purple"
                    />
                    <NavigationCard
                        href="/admin/settings"
                        icon={<Settings className="w-6 h-6" />}
                        title={t('dashboard.navSettings')}
                        description={t('dashboard.navSettingsDesc')}
                        color="secondary"
                    />
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-900">
                    <span className="font-semibold"><Info className="w-4 h-4 inline mr-1" />{t('dashboard.infoNoteLabel')}</span> {t('dashboard.infoNote')}
                </p>
            </div>
        </div>
    )
}
