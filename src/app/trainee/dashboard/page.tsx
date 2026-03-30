'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NavigationCard, ProgressBar, SkeletonDashboard } from '@/components'

interface ActiveProgram {
    id: string
    title: string
    startDate: string
    durationWeeks: number
    completedWorkouts: number
    totalWorkouts: number
    trainer: {
        firstName: string
        lastName: string
    }
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

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export default function TraineeDashboard() {
    const [loading, setLoading] = useState(true)
    const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null)
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

            if (programsRes.ok && programsData.data.programs.length > 0) {
                const program = programsData.data.programs[0]
                setActiveProgram(program)

                // Fetch next workout
                const progressRes = await fetch(`/api/programs/${program.id}/progress`)
                const progressData = await progressRes.json()

                if (progressRes.ok && progressData.data.nextWorkout) {
                    setNextWorkout(progressData.data.nextWorkout)
                }
            }

            // Fetch recent PRs
            const prsRes = await fetch('/api/personal-records?limit=5')
            const prsData = await prsRes.json()

            if (prsRes.ok) {
                setRecentPRs(prsData.data.personalRecords)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonDashboard cards={3} showTable={false} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error}
                </div>
            </div>
        )
    }

    // No active program
    if (!activeProgram) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

                    <div className="bg-white rounded-lg shadow-md p-12 text-center mb-8">
                        <div className="text-6xl mb-6">💪</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Nessun Programma Attivo
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Il tuo trainer non ti ha ancora assegnato un programma di allenamento.
                            <br />
                            Contattalo per iniziare!
                        </p>
                        <Link
                            href="/trainee/records"
                            className="inline-block bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                        >
                            Visualizza i Tuoi Massimali
                        </Link>
                    </div>

                    {/* Navigation cards anche senza programma */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NavigationCard
                            href="/trainee/records"
                            icon="🏆"
                            title="I Miei Massimali"
                            description="Visualizza e aggiorna i tuoi personal record su ogni esercizio."
                            color="yellow"
                        />
                        <NavigationCard
                            href="/trainee/history"
                            icon="📊"
                            title="Storico Allenamenti"
                            description="Consulta i programmi completati e i feedback passati."
                            color="blue"
                        />
                        <NavigationCard
                            href="/trainee/profile"
                            icon="👤"
                            title="Il Mio Profilo"
                            description="Aggiorna le tue informazioni personali e le impostazioni."
                            color="secondary"
                        />
                    </div>
                </div>
            </div>
        )
    }

    const progressPercent = Math.round(
        (activeProgram.completedWorkouts / activeProgram.totalWorkouts) * 100
    )

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600 mt-2">Benvenuto, ecco il tuo programma attivo</p>
                </div>

                {/* Active Program Hero */}
                <div className="bg-gradient-to-r from-[#FFA700] to-[#FF9500] rounded-lg shadow-lg p-8 mb-8 text-white">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">{activeProgram.title}</h2>
                            <p className="text-white/90">
                                con {activeProgram.trainer.firstName}{' '}
                                {activeProgram.trainer.lastName}
                            </p>
                        </div>
                        <Link
                            href="/trainee/programs/current"
                            className="bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-3 rounded-lg transition-colors backdrop-blur-sm"
                        >
                            Vedi Programma Completo
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                            <p className="text-white/80 text-sm mb-1">Durata</p>
                            <p className="text-2xl font-bold">
                                {activeProgram.durationWeeks} settimane
                            </p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                            <p className="text-white/80 text-sm mb-1">Progressione</p>
                            <p className="text-2xl font-bold">
                                {activeProgram.completedWorkouts} / {activeProgram.totalWorkouts}{' '}
                                workout
                            </p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                            <p className="text-white/80 text-sm mb-1">Completamento</p>
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
                                <p className="text-sm text-gray-600 mb-1">Prossimo Allenamento</p>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                    {DAY_NAMES[nextWorkout.dayOfWeek]} - Settimana{' '}
                                    {nextWorkout.weekNumber}
                                </h3>
                                <p className="text-gray-700">
                                    {nextWorkout.exerciseCount} esercizi da completare
                                </p>
                            </div>
                            <Link
                                href={`/trainee/workouts/${nextWorkout.id}`}
                                className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-8 py-4 rounded-lg transition-colors text-lg"
                            >
                                Inizia Workout 🚀
                            </Link>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Sezioni</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NavigationCard
                            href="/trainee/programs/current"
                            icon="📅"
                            title="Programma Attivo"
                            description="Visualizza tutte le settimane, i workout e gli esercizi del tuo programma."
                            color="primary"
                        />
                        <NavigationCard
                            href="/trainee/records"
                            icon="🏆"
                            title="I Miei Massimali"
                            description="Visualizza e aggiorna i tuoi personal record su ogni esercizio."
                            color="yellow"
                        />
                        <NavigationCard
                            href="/trainee/history"
                            icon="📊"
                            title="Storico Allenamenti"
                            description="Consulta i programmi completati e i feedback passati."
                            color="blue"
                        />
                        <NavigationCard
                            href="/trainee/profile"
                            icon="👤"
                            title="Il Mio Profilo"
                            description="Aggiorna le tue informazioni personali e le impostazioni."
                            color="secondary"
                        />
                    </div>
                </div>

                {/* Recent Personal Records */}
                {recentPRs.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">
                                🏆 Ultimi Massimali
                            </h3>
                            <Link
                                href="/trainee/records"
                                className="text-[#FFA700] hover:text-[#FF9500] font-semibold text-sm"
                            >
                                Vedi Tutti →
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
                                        <p className="text-sm text-gray-600">x {pr.reps} reps</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
