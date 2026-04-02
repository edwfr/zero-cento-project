'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { SkeletonDashboard } from '@/components'
import ProgressBar from '@/components/ProgressBar'
import { formatNumber } from '@/lib/date-format'
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'

interface WeeklyStat {
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    totalVolume: number
    avgRPE: number | null
    completedWorkouts: number
    totalWorkouts: number
    feedbackCount: number
}

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
    weeklyStats: WeeklyStat[]
}

export default function ProgramProgressContent() {
    const params = useParams<{ id: string }>()
    const programId = params.id
    const { t } = useTranslation('trainer')

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
                throw new Error(getApiErrorMessage(data, 'Errore caricamento progress', t))
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
            <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonDashboard cards={3} showTable={true} />
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
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-block"
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
                            {formatNumber(progress.totalVolume)}
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

                {/* Charts Section */}
                {progress.weeklyStats && progress.weeklyStats.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Volume per Settimana */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                📊 Volume per Settimana
                            </h2>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={progress.weeklyStats}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="weekNumber"
                                            label={{
                                                value: 'Settimana',
                                                position: 'insideBottom',
                                                offset: -5,
                                            }}
                                        />
                                        <YAxis
                                            label={{
                                                value: 'Volume (kg)',
                                                angle: -90,
                                                position: 'insideLeft',
                                            }}
                                        />
                                        <Tooltip
                                            formatter={(value: any) =>
                                                value ? `${formatNumber(Number(value))} kg` : '0 kg'
                                            }
                                            labelFormatter={(label) => `Settimana ${label}`}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="totalVolume"
                                            stroke="#8b5cf6"
                                            strokeWidth={2}
                                            name="Volume Totale"
                                            dot={{ fill: '#8b5cf6', r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* RPE Medio per Settimana */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                🎯 RPE Medio per Settimana
                            </h2>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={progress.weeklyStats.filter((w) => w.avgRPE !== null)}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="weekNumber"
                                            label={{
                                                value: 'Settimana',
                                                position: 'insideBottom',
                                                offset: -5,
                                            }}
                                        />
                                        <YAxis
                                            domain={[0, 10]}
                                            label={{
                                                value: 'RPE',
                                                angle: -90,
                                                position: 'insideLeft',
                                            }}
                                        />
                                        <Tooltip
                                            formatter={(value: any) =>
                                                value ? Number(value).toFixed(1) : '0'
                                            }
                                            labelFormatter={(label) => `Settimana ${label}`}
                                        />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="avgRPE"
                                            stroke="#FFA700"
                                            strokeWidth={2}
                                            name="RPE Medio"
                                            dot={{ fill: '#FFA700', r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Completamento Workout per Settimana */}
                        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                ✅ Completamento Allenamenti per Settimana
                            </h2>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={progress.weeklyStats}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="weekNumber"
                                            label={{
                                                value: 'Settimana',
                                                position: 'insideBottom',
                                                offset: -5,
                                            }}
                                        />
                                        <YAxis
                                            label={{
                                                value: 'Allenamenti',
                                                angle: -90,
                                                position: 'insideLeft',
                                            }}
                                        />
                                        <Tooltip labelFormatter={(label) => `Settimana ${label}`} />
                                        <Legend />
                                        <Bar
                                            dataKey="completedWorkouts"
                                            fill="#10b981"
                                            name="Completati"
                                        />
                                        <Bar
                                            dataKey="totalWorkouts"
                                            fill="#e5e7eb"
                                            name="Totali"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

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
                                                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold"
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
                                        ? t('programProgress.statusActive')
                                        : progress.status === 'completed'
                                            ? t('programProgress.statusCompletedLabel')
                                            : t('programProgress.statusDraft')}
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
                                        ? formatNumber(Math.round(
                                            progress.totalVolume / progress.completedWorkouts
                                        ))
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
