'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Workout {
    id: string
    dayOfWeek: number
    completed: boolean
    exerciseCount: number
    feedbackSubmitted: boolean
}

interface Week {
    weekNumber: number
    weekType: 'loading' | 'deload'
    workouts: Workout[]
}

interface Program {
    id: string
    title: string
    startDate: string
    durationWeeks: number
    trainer: {
        firstName: string
        lastName: string
    }
    weeks: Week[]
}

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export default function CurrentProgramPage() {
    const [loading, setLoading] = useState(true)
    const [program, setProgram] = useState<Program | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchProgram()
    }, [])

    const fetchProgram = async () => {
        try {
            setLoading(true)

            const res = await fetch('/api/programs?status=active')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento programma')
            }

            if (data.data.programs.length === 0) {
                throw new Error('Nessun programma attivo trovato')
            }

            setProgram(data.data.programs[0])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !program) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || 'Programma non trovato'}
                </div>
            </div>
        )
    }

    const completedWorkouts = program.weeks.reduce(
        (total, week) => total + week.workouts.filter((w) => w.completed).length,
        0
    )
    const totalWorkouts = program.weeks.reduce((total, week) => total + week.workouts.length, 0)
    const progressPercent = Math.round((completedWorkouts / totalWorkouts) * 100)

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainee/dashboard"
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna alla Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
                    <p className="text-gray-600 mt-2">
                        con {program.trainer.firstName} {program.trainer.lastName} • Iniziato il{' '}
                        {new Date(program.startDate).toLocaleDateString('it-IT')}
                    </p>
                </div>

                {/* Progress Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">
                                Progressione Programma
                            </p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {completedWorkouts} / {totalWorkouts} workout completati
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-[#FFA700]">{progressPercent}%</p>
                            <p className="text-sm text-gray-600">completamento</p>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className="bg-[#FFA700] h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Weeks List */}
                <div className="space-y-6">
                    {program.weeks.map((week) => {
                        const weekCompleted = week.workouts.every((w) => w.completed)
                        const weekInProgress = week.workouts.some(
                            (w) => w.completed && !weekCompleted
                        )

                        return (
                            <div key={week.weekNumber} className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-4">
                                        <h3 className="text-xl font-bold text-gray-900">
                                            Settimana {week.weekNumber}
                                        </h3>
                                        <span
                                            className={`px-3 py-1 text-xs font-semibold rounded-full ${week.weekType === 'loading'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-green-100 text-green-800'
                                                }`}
                                        >
                                            {week.weekType === 'loading'
                                                ? '📈 Loading'
                                                : '🧘 Deload'}
                                        </span>
                                        {weekCompleted && (
                                            <span className="text-green-600 text-sm font-semibold">
                                                ✓ Completata
                                            </span>
                                        )}
                                        {weekInProgress && !weekCompleted && (
                                            <span className="text-[#FFA700] text-sm font-semibold">
                                                ⏳ In Corso
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {week.workouts.filter((w) => w.completed).length} /{' '}
                                        {week.workouts.length} completati
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {week.workouts.map((workout) => (
                                        <Link
                                            key={workout.id}
                                            href={`/trainee/workouts/${workout.id}`}
                                            className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${workout.completed
                                                ? 'border-green-300 bg-green-50 hover:border-green-400'
                                                : 'border-gray-300 bg-white hover:border-[#FFA700]'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="font-semibold text-gray-900">
                                                    {DAY_NAMES[workout.dayOfWeek]}
                                                </p>
                                                {workout.completed ? (
                                                    <span className="text-green-600 text-lg">
                                                        ✓
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">○</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-3">
                                                {workout.exerciseCount} esercizi
                                            </p>
                                            {workout.completed ? (
                                                workout.feedbackSubmitted ? (
                                                    <p className="text-xs text-green-600 font-semibold">
                                                        ✓ Feedback inviato
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-[#FFA700] font-semibold">
                                                        Rivedi Feedback →
                                                    </p>
                                                )
                                            ) : (
                                                <p className="text-xs text-[#FFA700] font-semibold">
                                                    Inizia Workout →
                                                </p>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
