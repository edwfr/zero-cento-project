'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import ProgressBar from '@/components/ProgressBar'

interface ProgressData {
    programId: string
    programName: string
    status: 'draft' | 'active' | 'completed'
    currentWeek: number
    totalWeeks: number
    completedWorkouts: number
    totalWorkouts: number
    feedbackCount: number
    avgRPE: number | null
    totalVolume: number
    workouts: Array<{
        id: string
        name: string
        weekNumber: number
        dayOfWeek: string
        completed: boolean
        feedbackCount: number
    }>
}

export default function ProgramProgressPage() {
    const params = useParams<{ id: string }>()
    const programId = params.id

    const [loading, setLoading] = useState(true)
    const [progress, setProgress] = useState<ProgressData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null)

    useEffect(() => {
        fetchProgress()
    }, [programId])

    const fetchProgress = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}/progress`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento progress')
            }

            setProgress(data.data)
            if (data.data.currentWeek) {
                setSelectedWeek(data.data.currentWeek)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (error || !progress) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                        {error || 'Dati non disponibili'}
                    </div>
                </div>
            </div>
        )
    }

    const completionPercentage =
        progress.totalWorkouts > 0
            ? Math.round((progress.completedWorkouts / progress.totalWorkouts) * 100)
            : 0

    const weeksList = Array.from({ length: progress.totalWeeks }, (_, i) => i + 1)
    const filteredWorkouts = selectedWeek
        ? progress.workouts.filter((w) => w.weekNumber === selectedWeek)
        : progress.workouts

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href={`/trainer/programs/${programId}`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna al programma
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                📊 Monitoraggio Avanzamento
                            </h1>
                            <p className="text-gray-600 mt-2">{progress.programName}</p>
                        </div>
                        <Link
                            href={`/trainer/programs/${programId}/reports`}
                            className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                        >
                            📈 Vedi Report
                        </Link>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Settimana Corrente</div>
                        <div className="text-3xl font-bold text-gray-900">
                            {progress.currentWeek} / {progress.totalWeeks}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Allenamenti Completati</div>
                        <div className="text-3xl font-bold text-green-600">
                            {progress.completedWorkouts} / {progress.totalWorkouts}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{completionPercentage}%</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">RPE Medio</div>
                        <div className="text-3xl font-bold text-[#FFA700]">
                            {progress.avgRPE !== null ? progress.avgRPE.toFixed(1) : '—'}
                        </div>
                        {progress.avgRPE !== null && (
                            <div className="text-xs text-gray-500 mt-1">su 10.0</div>
                        )}
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Volume Totale</div>
                        <div className="text-3xl font-bold text-purple-600">
                            {progress.totalVolume.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">kg sollevati</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <ProgressBar
                        current={progress.completedWorkouts}
                        total={progress.totalWorkouts}
                        label="Avanzamento Programma"
                        showPercentage={true}
                        size="lg"
                        color="success"
                    />
                </div>

                {/* Week Filter */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-900">
                            Allenamenti per Settimana
                        </h2>
                        <select
                            value={selectedWeek || ''}
                            onChange={(e) =>
                                setSelectedWeek(e.target.value ? parseInt(e.target.value) : null)
                            }
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                        >
                            <option value="">Tutte le settimane</option>
                            {weeksList.map((week) => (
                                <option key={week} value={week}>
                                    Settimana {week}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Workouts Table */}
                    {filteredWorkouts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Nessun allenamento trovato
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Settimana
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Allenamento
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Stato
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                            Feedback
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                            Azioni
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredWorkouts.map((workout) => (
                                        <tr key={workout.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                Settimana {workout.weekNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-semibold text-gray-900">
                                                    {workout.dayOfWeek}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {workout.completed ? (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                                        ✓ Completato
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                                                        In corso
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {workout.feedbackCount} feedback
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <Link
                                                    href={`/trainer/programs/${programId}`}
                                                    className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                                                >
                                                    Dettagli →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            Status Programma
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Stato:</span>
                                <span
                                    className={`font-semibold ${progress.status === 'active'
                                            ? 'text-green-600'
                                            : progress.status === 'completed'
                                                ? 'text-gray-600'
                                                : 'text-yellow-600'
                                        }`}
                                >
                                    {progress.status === 'active'
                                        ? 'Attivo'
                                        : progress.status === 'completed'
                                            ? 'Completato'
                                            : 'Bozza'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Durata:</span>
                                <span className="font-semibold text-gray-900">
                                    {progress.totalWeeks} settimane
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Feedback</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Totale Feedback:</span>
                                <span className="font-semibold text-gray-900">
                                    {progress.feedbackCount}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Media per workout:</span>
                                <span className="font-semibold text-gray-900">
                                    {progress.completedWorkouts > 0
                                        ? (
                                            progress.feedbackCount / progress.completedWorkouts
                                        ).toFixed(1)
                                        : '0'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Completamento:</span>
                                <span className="font-semibold text-green-600">
                                    {completionPercentage}%
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Volume medio:</span>
                                <span className="font-semibold text-purple-600">
                                    {progress.completedWorkouts > 0
                                        ? Math.round(
                                            progress.totalVolume / progress.completedWorkouts
                                        ).toLocaleString()
                                        : '0'}{' '}
                                    kg
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
