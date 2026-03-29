'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

interface SBDEntry {
    volume: number
    trainingSets: number
    avgIntensity: number | null
    avgRPE: number | null
}

interface MuscleGroupEntry {
    muscleGroupId: string
    muscleGroupName: string
    trainingSets: number
    percentage: number
}

interface MovementPatternEntry {
    movementPatternId: string
    movementPatternName: string
    volume: number
    percentage: number
}

interface ReportData {
    programId: string
    programName: string
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    sbd: {
        squat: SBDEntry
        bench: SBDEntry
        deadlift: SBDEntry
    }
    muscleGroups: MuscleGroupEntry[]
    movementPatterns: MovementPatternEntry[]
}

const SBD_LABELS: Record<string, string> = {
    squat: '🏋️ Squat',
    bench: '🏋️ Panca',
    deadlift: '🏋️ Stacco',
}

const SBD_COLORS: Record<string, string> = {
    squat: 'bg-blue-500',
    bench: 'bg-green-500',
    deadlift: 'bg-purple-500',
}

export default function ProgramReportsPage() {
    const params = useParams<{ id: string }>()
    const programId = params.id

    const [loading, setLoading] = useState(true)
    const [report, setReport] = useState<ReportData | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchReport()
    }, [programId])

    const fetchReport = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}/reports`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore caricamento report')
            }

            setReport(data.data)
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

    if (error || !report) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                        {error || 'Report non disponibile'}
                    </div>
                </div>
            </div>
        )
    }

    const totalSBDVolume =
        report.sbd.squat.volume + report.sbd.bench.volume + report.sbd.deadlift.volume
    const totalSBDSets =
        report.sbd.squat.trainingSets + report.sbd.bench.trainingSets + report.sbd.deadlift.trainingSets

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center space-x-4 mb-4">
                        <Link
                            href={`/trainer/programs/${programId}/progress`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                        >
                            ← Avanzamento
                        </Link>
                        <span className="text-gray-300">|</span>
                        <Link
                            href={`/trainer/programs/${programId}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                        >
                            Programma
                        </Link>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">📈 Report SBD</h1>
                    <p className="text-gray-600 mt-2">
                        {report.programName} — {report.trainee.firstName} {report.trainee.lastName}
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Volume Totale SBD</div>
                        <div className="text-3xl font-bold text-gray-900">
                            {totalSBDVolume.toLocaleString()} kg
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Serie Totali SBD</div>
                        <div className="text-3xl font-bold text-blue-600">{totalSBDSets}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Esercizi SBD Registrati</div>
                        <div className="text-3xl font-bold text-[#FFA700]">
                            {
                                [
                                    report.sbd.squat.trainingSets > 0,
                                    report.sbd.bench.trainingSets > 0,
                                    report.sbd.deadlift.trainingSets > 0,
                                ].filter(Boolean).length
                            }
                            / 3
                        </div>
                    </div>
                </div>

                {/* SBD Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {(['squat', 'bench', 'deadlift'] as const).map((lift) => {
                        const data = report.sbd[lift]
                        return (
                            <div key={lift} className="bg-white rounded-lg shadow-md overflow-hidden">
                                <div className={`h-2 ${SBD_COLORS[lift]}`} />
                                <div className="p-6">
                                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                                        {SBD_LABELS[lift]}
                                    </h2>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Volume:</span>
                                            <span className="font-semibold text-gray-900">
                                                {data.volume.toLocaleString()} kg
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Serie Eseguite:</span>
                                            <span className="font-semibold text-gray-900">
                                                {data.trainingSets}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Intensità Media:</span>
                                            <span className="font-semibold text-gray-900">
                                                {data.avgIntensity !== null
                                                    ? `${data.avgIntensity.toFixed(1)}% 1RM`
                                                    : '— (no 1RM)'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">RPE Medio:</span>
                                            <span
                                                className={`font-semibold ${data.avgRPE !== null && data.avgRPE >= 8.5
                                                        ? 'text-red-600'
                                                        : data.avgRPE !== null && data.avgRPE >= 7.5
                                                            ? 'text-orange-500'
                                                            : 'text-green-600'
                                                    }`}
                                            >
                                                {data.avgRPE !== null
                                                    ? data.avgRPE.toFixed(1)
                                                    : '—'}
                                            </span>
                                        </div>
                                    </div>
                                    {data.trainingSets === 0 && (
                                        <p className="text-gray-400 text-xs mt-4 italic">
                                            Nessun dato registrato
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Muscle Groups */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">
                            💪 Serie per Gruppo Muscolare
                        </h2>
                        {report.muscleGroups.length === 0 ? (
                            <p className="text-gray-500 text-sm">Nessun dato disponibile</p>
                        ) : (
                            <div className="space-y-4">
                                {report.muscleGroups.map((mg) => (
                                    <div key={mg.muscleGroupId}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-gray-700">
                                                {mg.muscleGroupName}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {mg.trainingSets} serie ({mg.percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="bg-[#FFA700] h-3 rounded-full transition-all duration-500"
                                                style={{ width: `${mg.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Movement Patterns */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">
                            🔄 Volume per Schema Motorio
                        </h2>
                        {report.movementPatterns.length === 0 ? (
                            <p className="text-gray-500 text-sm">Nessun dato disponibile</p>
                        ) : (
                            <div className="space-y-4">
                                {report.movementPatterns.map((mp) => (
                                    <div key={mp.movementPatternId}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-gray-700">
                                                {mp.movementPatternName}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {mp.volume.toLocaleString()} kg ({mp.percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="bg-purple-500 h-3 rounded-full transition-all duration-500"
                                                style={{ width: `${mp.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
