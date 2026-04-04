'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatNumber } from '@/lib/date-format'

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

interface RPEDistributionEntry {
    range: string
    count: number
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
    rpeDistribution: RPEDistributionEntry[]
}



const SBD_COLORS: Record<string, string> = {
    squat: 'bg-blue-500',
    bench: 'bg-green-500',
    deadlift: 'bg-purple-500',
}

export default function ProgramReportsContent() {
    const { t } = useTranslation('trainer')
    const params = useParams<{ id: string }>()
    const programId = params.id

    const [loading, setLoading] = useState(true)
    const [report, setReport] = useState<ReportData | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/programs/${programId}/reports`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, 'Errore caricamento report', t))
            }

            setReport(data.data)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('reports.loadingError'))
        } finally {
            setLoading(false)
        }
    }, [programId, t])

    useEffect(() => {
        void fetchReport()
    }, [fetchReport])

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
                        {error || t('reports.notAvailable')}
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
                    <div className="mb-4 flex items-center">
                        <Link
                            href={`/trainer/programs/${programId}`}
                            className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold"
                        >
                            {t('reports.backToProgram')}
                        </Link>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('reports.sbdReport')}</h1>
                    <p className="text-gray-600 mt-2">
                        {report.programName} — {report.trainee.firstName} {report.trainee.lastName}
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">{t('reports.totalVolume')}</div>
                        <div className="text-3xl font-bold text-gray-900">
                            {formatNumber(totalSBDVolume)} kg
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">{t('reports.totalSets')}</div>
                        <div className="text-3xl font-bold text-blue-600">{totalSBDSets}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">{t('reports.exercisesRegistered')}</div>
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
                                        {t(`reports.${lift}`)}
                                    </h2>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">{t('reports.volume')}:</span>
                                            <span className="font-semibold text-gray-900">
                                                {formatNumber(data.volume)} {t('reports.kgUnit')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">{t('reports.setsPerformed')}:</span>
                                            <span className="font-semibold text-gray-900">
                                                {data.trainingSets}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">{t('reports.avgIntensity')}:</span>
                                            <span className="font-semibold text-gray-900">
                                                {data.avgIntensity !== null
                                                    ? `${data.avgIntensity.toFixed(1)}% 1RM`
                                                    : t('reports.noOrm')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">{t('reports.avgRpe')}:</span>
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
                                            {t('reports.noData')}
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
                            {t('reports.muscleGroups')}
                        </h2>
                        {report.muscleGroups.length === 0 ? (
                            <p className="text-gray-500 text-sm">{t('reports.noDataAvailable')}</p>
                        ) : (
                            <div className="space-y-4">
                                {report.muscleGroups.map((mg) => (
                                    <div key={mg.muscleGroupId}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-gray-700">
                                                {mg.muscleGroupName}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {mg.trainingSets} {t('reports.seriesLabel')} ({mg.percentage}%)
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
                            {t('reports.movementPatterns')}
                        </h2>
                        {report.movementPatterns.length === 0 ? (
                            <p className="text-gray-500 text-sm">{t('reports.noDataAvailable')}</p>
                        ) : (
                            <div className="space-y-4">
                                {report.movementPatterns.map((mp) => (
                                    <div key={mp.movementPatternId}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-gray-700">
                                                {mp.movementPatternName}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {formatNumber(mp.volume)} {t('reports.kgUnit')} ({mp.percentage}%)
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

                {/* RPE Distribution */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">
                        {t('reports.rpeDistribution')}
                    </h2>
                    {report.rpeDistribution.every((item) => item.count === 0) ? (
                        <p className="text-gray-500 text-sm">{t('reports.noRpeData')}</p>
                    ) : (
                        <div className="space-y-4">
                            {report.rpeDistribution.map((item) => {
                                // Color coding based on RPE range
                                const getColor = (range: string) => {
                                    if (range === '6.0-6.5') return 'bg-green-500'
                                    if (range === '7.0-7.5') return 'bg-yellow-500'
                                    if (range === '8.0-8.5') return 'bg-orange-500'
                                    if (range === '9.0-10.0') return 'bg-red-500'
                                    return 'bg-gray-500'
                                }

                                const getLabel = (range: string) => {
                                    if (range === '6.0-6.5') return t('reports.rpeEasy')
                                    if (range === '7.0-7.5') return t('reports.rpeModerate')
                                    if (range === '8.0-8.5') return t('reports.rpeHard')
                                    if (range === '9.0-10.0') return t('reports.rpeMax')
                                    return range
                                }

                                return (
                                    <div key={item.range}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-semibold text-gray-700">
                                                {getLabel(item.range)}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                {item.count} {t('reports.seriesLabel')} ({item.percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                                            <div
                                                className={`${getColor(item.range)} h-4 rounded-full transition-all duration-500`}
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
