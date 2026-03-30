'use client'

import { useState, useEffect } from 'react'
import { StatCard, NavigationCard, SkeletonDashboard } from '@/components'

interface DashboardStats {
    totalUsers: number
    totalTrainers: number
    totalTrainees: number
    activePrograms: number
    totalExercises: number
    totalFeedback: number
}

export default function AdminDashboardContent() {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchDashboardStats()
    }, [])

    const fetchDashboardStats = async () => {
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

            if (!usersRes.ok || !programsRes.ok || !exercisesRes.ok || !feedbackRes.ok) {
                throw new Error('Errore caricamento statistiche')
            }

            const users = usersData.data.items
            const programs = programsData.data.items
            const exercises = exercisesData.data.items
            const feedback = feedbackData.data.items || []

            setStats({
                totalUsers: users.length,
                totalTrainers: users.filter((u: any) => u.role === 'trainer').length,
                totalTrainees: users.filter((u: any) => u.role === 'trainee').length,
                activePrograms: programs.filter((p: any) => p.status === 'active').length,
                totalExercises: exercises.length,
                totalFeedback: feedback.length,
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <SkeletonDashboard cards={6} showTable={false} />
    }

    if (error || !stats) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                {error || 'Errore caricamento dashboard'}
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Amministratore</h1>
                <p className="text-gray-600 mt-2">Panoramica statistiche piattaforma</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard
                    title="Utenti Totali"
                    value={stats.totalUsers}
                    subtitle={`${stats.totalTrainers} trainer • ${stats.totalTrainees} atleti`}
                    icon="👥"
                    color="primary"
                    onClick={() => (window.location.href = '/admin/users')}
                />

                <StatCard
                    title="Programmi Attivi"
                    value={stats.activePrograms}
                    subtitle="In corso di esecuzione"
                    icon="🏋️"
                    color="success"
                />

                <StatCard
                    title="Esercizi Libreria"
                    value={stats.totalExercises}
                    subtitle="Disponibili per i trainer"
                    icon="💪"
                    color="info"
                />

                <StatCard
                    title="Feedback Ricevuti"
                    value={stats.totalFeedback}
                    subtitle="Workout completati"
                    icon="📊"
                    color="warning"
                />

                <StatCard
                    title="Trainer Attivi"
                    value={stats.totalTrainers}
                    subtitle="Professionisti registrati"
                    icon="👨‍🏫"
                    color="info"
                />

                <StatCard
                    title="Atleti"
                    value={stats.totalTrainees}
                    subtitle="Utenti in allenamento"
                    icon="🏃"
                    color="success"
                />
            </div>

            {/* Navigation Cards */}
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Navigazione Rapida</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <NavigationCard
                        href="/admin/users"
                        icon="👥"
                        title="Gestione Utenti"
                        description="Visualizza e gestisci trainer e atleti. Crea, modifica ed elimina profili."
                        color="blue"
                    />
                    <NavigationCard
                        href="/admin/exercises"
                        icon="💪"
                        title="Libreria Esercizi"
                        description="Gestisci la libreria globale di esercizi con pattern motori e gruppi muscolari."
                        color="primary"
                    />
                    <NavigationCard
                        href="/admin/programs"
                        icon="📋"
                        title="Programmi Globali"
                        description="Visualizza tutti i programmi di allenamento attivi in piattaforma."
                        color="green"
                    />
                    <NavigationCard
                        href="/admin/statistics"
                        icon="📊"
                        title="Statistiche & Report"
                        description="Analisi avanzate sull'utilizzo della piattaforma e performance degli atleti."
                        color="purple"
                    />
                    <NavigationCard
                        href="/admin/settings"
                        icon="⚙️"
                        title="Impostazioni"
                        description="Configurazione generale dell'applicazione e preferenze di sistema."
                        color="secondary"
                    />
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-900">
                    <span className="font-semibold">ℹ️ Nota:</span> Come amministratore hai accesso
                    completo a tutte le funzionalità della piattaforma. Usa i link sopra per
                    gestire utenti, visualizzare programmi e accedere ai report.
                </p>
            </div>
        </div>
    )
}
