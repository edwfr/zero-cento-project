'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Workout {
    id: string
    dayOfWeek: number
    order: number
    exerciseCount: number
}

interface Week {
    id: string
    weekNumber: number
    weekType: 'loading' | 'deload'
    workouts: Workout[]
}

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    trainee: {
        firstName: string
        lastName: string
    }
    durationWeeks: number
    workoutsPerWeek: number
    weeks: Week[]
}

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export default function EditProgramPage() {
    const router = useRouter()
    const params = useParams()
    const programId = params.id as string

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [program, setProgram] = useState<Program | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchProgram()
    }, [programId])

    const fetchProgram = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento programma')
            }

            setProgram(data.data.program)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleWeekType = async (weekId: string, currentType: string) => {
        if (!program) return

        const newType = currentType === 'loading' ? 'deload' : 'loading'

        try {
            setSaving(true)

            const res = await fetch(`/api/programs/${programId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    weeks: program.weeks.map((w) =>
                        w.id === weekId ? { ...w, weekType: newType } : w
                    ),
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore modifica settimana')
            }

            // Update local state
            setProgram({
                ...program,
                weeks: program.weeks.map((w) =>
                    w.id === weekId ? { ...w, weekType: newType } : w
                ),
            })
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSaving(false)
        }
    }

    const getTotalExercises = () => {
        if (!program) return 0
        return program.weeks.reduce(
            (total, week) =>
                total + week.workouts.reduce((sum, w) => sum + w.exerciseCount, 0),
            0
        )
    }

    const getCompletedWorkouts = () => {
        if (!program) return 0
        return program.weeks.reduce(
            (total, week) => total + week.workouts.filter((w) => w.exerciseCount > 0).length,
            0
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="orange" />
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

    const totalWorkouts = program.durationWeeks * program.workoutsPerWeek
    const completedWorkouts = getCompletedWorkouts()
    const progressPercent = Math.round((completedWorkouts / totalWorkouts) * 100)

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Progress Indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-center space-x-4 mb-4">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                ✓
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">Setup</span>
                        </div>
                        <div className="w-16 h-1 bg-[#FFA700]"></div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-[#FFA700] text-white rounded-full flex items-center justify-center font-bold">
                                2
                            </div>
                            <span className="ml-2 font-semibold text-gray-900">Esercizi</span>
                        </div>
                        <div className="w-16 h-1 bg-gray-300"></div>
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                                3
                            </div>
                            <span className="ml-2 text-gray-500">Pubblica</span>
                        </div>
                    </div>
                </div>

                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainer/programs"
                        className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna ai programmi
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
                    <p className="text-gray-600 mt-2">
                        per {program.trainee.firstName} {program.trainee.lastName} •{' '}
                        {program.durationWeeks} settimane • {program.workoutsPerWeek}{' '}
                        allenamenti/settimana
                    </p>
                </div>

                {/* Progress Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">
                                Progressione Configurazione
                            </p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {completedWorkouts} / {totalWorkouts} workout configurati
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
                    <p className="text-sm text-gray-600 mt-4">
                        Totale esercizi configurati: <span className="font-semibold">{getTotalExercises()}</span>
                    </p>
                </div>

                {/* Weeks Overview */}
                <div className="space-y-6">
                    {program.weeks.map((week) => (
                        <div key={week.id} className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                    <h3 className="text-xl font-bold text-gray-900">
                                        Settimana {week.weekNumber}
                                    </h3>
                                    <button
                                        onClick={() => handleToggleWeekType(week.id, week.weekType)}
                                        disabled={saving}
                                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                            week.weekType === 'loading'
                                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                                        }`}
                                    >
                                        {week.weekType === 'loading' ? '📈 Loading' : '🧘 Deload'}
                                    </button>
                                </div>
                                <p className="text-sm text-gray-600">
                                    {week.workouts.filter((w) => w.exerciseCount > 0).length} /{' '}
                                    {week.workouts.length} workout configurati
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {week.workouts.map((workout) => (
                                    <Link
                                        key={workout.id}
                                        href={`/trainer/programs/${programId}/workouts/${workout.id}`}
                                        className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                                            workout.exerciseCount > 0
                                                ? 'border-green-300 bg-green-50 hover:border-green-400'
                                                : 'border-gray-300 bg-white hover:border-[#FFA700]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-semibold text-gray-900">
                                                {DAY_NAMES[workout.dayOfWeek]}
                                            </p>
                                            {workout.exerciseCount > 0 ? (
                                                <span className="text-green-600 text-sm font-semibold">
                                                    ✓
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">⚠️</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            {workout.exerciseCount > 0
                                                ? `${workout.exerciseCount} esercizi`
                                                : 'Nessun esercizio'}
                                        </p>
                                        <p className="text-xs text-[#FFA700] font-semibold mt-2">
                                            {workout.exerciseCount > 0
                                                ? 'Modifica →'
                                                : 'Configura →'}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 mt-8">
                    <Link
                        href={`/trainer/programs/${programId}/publish`}
                        className={`flex-1 py-3 px-6 rounded-lg font-semibold text-center transition-colors ${
                            completedWorkouts === totalWorkouts
                                ? 'bg-[#FFA700] hover:bg-[#FF9500] text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                            if (completedWorkouts < totalWorkouts) {
                                e.preventDefault()
                                alert('Configura tutti i workout prima di pubblicare')
                            }
                        }}
                    >
                        Avanti: Pubblica Programma →
                    </Link>
                    <Link
                        href="/trainer/programs"
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                        Salva Bozza
                    </Link>
                </div>
            </div>
        </div>
    )
}
