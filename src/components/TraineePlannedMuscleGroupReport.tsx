'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/date-format'
import type { ApiSuccessResponse } from '@/lib/api-response'

const MUSCLE_GROUP_CHART_COLORS = [
    '#FFA700',
    '#0F766E',
    '#2563EB',
    '#DC2626',
    '#7C3AED',
    '#0891B2',
    '#65A30D',
    '#EA580C',
]

type TimeWindow = '4' | '8' | '12' | '24' | 'all'

interface MuscleGroupOption {
    id: string
    name: string
}

interface ReportPoint {
    date: string
    totalTrainingSets: number
    muscleGroups: Array<{
        muscleGroupId: string
        muscleGroupName: string
        trainingSets: number
    }>
}

interface PlannedTrainingSetsReportData {
    traineeId: string
    muscleGroups: MuscleGroupOption[]
    points: ReportPoint[]
}

interface TraineePlannedMuscleGroupReportProps {
    traineeId: string
}

export default function TraineePlannedMuscleGroupReport({
    traineeId,
}: TraineePlannedMuscleGroupReportProps) {
    const { t } = useTranslation('trainer')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [report, setReport] = useState<PlannedTrainingSetsReportData | null>(null)
    const [timeWindow, setTimeWindow] = useState<TimeWindow>('12')
    const [visibleMuscleGroupIds, setVisibleMuscleGroupIds] = useState<string[]>([])

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await fetch(`/api/users/${traineeId}/reports/planned-training-sets`)
                const payload: ApiSuccessResponse<PlannedTrainingSetsReportData> | Record<string, unknown> = await response.json()

                if (!response.ok) {
                    throw new Error(getApiErrorMessage(payload, t('athletes.reportsLoadError'), t))
                }

                const data = (payload as ApiSuccessResponse<PlannedTrainingSetsReportData>).data
                setReport(data)
                setVisibleMuscleGroupIds(data.muscleGroups.map((muscleGroup) => muscleGroup.id))
            } catch (fetchError: unknown) {
                setError(
                    fetchError instanceof Error
                        ? fetchError.message
                        : t('athletes.reportsLoadError')
                )
            } finally {
                setLoading(false)
            }
        }

        fetchReport()
    }, [traineeId, t])

    const muscleGroupSeries = useMemo(() => {
        if (!report) {
            return []
        }

        return report.muscleGroups.map((muscleGroup, index) => ({
            ...muscleGroup,
            color: MUSCLE_GROUP_CHART_COLORS[index % MUSCLE_GROUP_CHART_COLORS.length],
        }))
    }, [report])

    const filteredPoints = useMemo(() => {
        if (!report) {
            return []
        }

        if (timeWindow === 'all') {
            return report.points
        }

        return report.points.slice(-Number(timeWindow))
    }, [report, timeWindow])

    const visibleMuscleGroups = useMemo(
        () => muscleGroupSeries.filter((muscleGroup) => visibleMuscleGroupIds.includes(muscleGroup.id)),
        [muscleGroupSeries, visibleMuscleGroupIds]
    )

    const chartData = useMemo(() => {
        return filteredPoints.map((point) => {
            const row: Record<string, number | string> = {
                date: point.date,
                dateLabel: formatDate(point.date, 'medium'),
            }

            point.muscleGroups.forEach((muscleGroup) => {
                row[muscleGroup.muscleGroupId] = muscleGroup.trainingSets
            })

            return row
        })
    }, [filteredPoints])

    const hasData = chartData.some((row) =>
        visibleMuscleGroups.some((muscleGroup) => Number(row[muscleGroup.id] || 0) > 0)
    )

    const toggleMuscleGroupVisibility = (muscleGroupId: string) => {
        setVisibleMuscleGroupIds((currentIds) => {
            if (currentIds.includes(muscleGroupId)) {
                if (currentIds.length === 1) {
                    return currentIds
                }

                return currentIds.filter((id) => id !== muscleGroupId)
            }

            return [...currentIds, muscleGroupId]
        })
    }

    const showAllMuscleGroups = () => {
        setVisibleMuscleGroupIds(muscleGroupSeries.map((muscleGroup) => muscleGroup.id))
    }

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-7 w-64 rounded bg-gray-200" />
                    <div className="h-4 w-full rounded bg-gray-100" />
                    <div className="h-96 rounded bg-gray-100" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                {error}
            </div>
        )
    }

    if (!report || report.points.length === 0 || report.muscleGroups.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900">
                    {t('athletes.reportingSectionTitle')}
                </h2>
                <p className="mt-3 text-sm text-gray-600">
                    {t('athletes.reportingSectionEmpty')}
                </p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        {t('athletes.reportingSectionTitle')}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {t('athletes.reportingSectionDescription')}
                    </p>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-sm font-medium text-gray-700">
                                {t('athletes.reportingMuscleGroupsFilterLabel')}
                            </p>
                            <button
                                type="button"
                                onClick={showAllMuscleGroups}
                                className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59]"
                            >
                                {t('athletes.reportingResetFilters')}
                            </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {muscleGroupSeries.map((muscleGroup) => {
                                const isActive = visibleMuscleGroupIds.includes(muscleGroup.id)

                                return (
                                    <button
                                        key={muscleGroup.id}
                                        type="button"
                                        onClick={() => toggleMuscleGroupVisibility(muscleGroup.id)}
                                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${isActive
                                            ? 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: muscleGroup.color }}
                                        />
                                        {muscleGroup.name}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="w-full lg:max-w-xs">
                        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="time-window">
                            {t('athletes.reportingTimeWindowLabel')}
                        </label>
                        <select
                            id="time-window"
                            value={timeWindow}
                            onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#FFA700] focus:outline-none focus:ring-2 focus:ring-[#FFA700]/20"
                        >
                            <option value="4">{t('athletes.reportingWindow4Weeks')}</option>
                            <option value="8">{t('athletes.reportingWindow8Weeks')}</option>
                            <option value="12">{t('athletes.reportingWindow12Weeks')}</option>
                            <option value="24">{t('athletes.reportingWindow24Weeks')}</option>
                            <option value="all">{t('athletes.reportingWindowAll')}</option>
                        </select>
                    </div>
                </div>

                {hasData ? (
                    <div className="h-[28rem]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="dateLabel" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number, name: string) => [
                                        `${Number.isInteger(Number(value)) ? Number(value) : Number(value).toFixed(1)} ${t('athletes.reportingSetsUnit')}`,
                                        visibleMuscleGroups.find((muscleGroup) => muscleGroup.id === name)?.name || name,
                                    ]}
                                    labelFormatter={(_, payload) => {
                                        const point = payload?.[0]?.payload as { date?: string } | undefined
                                        return point?.date ? formatDate(point.date, 'medium') : ''
                                    }}
                                />
                                <Legend
                                    formatter={(value) =>
                                        visibleMuscleGroups.find((muscleGroup) => muscleGroup.id === value)?.name || value
                                    }
                                />
                                {visibleMuscleGroups.map((muscleGroup) => (
                                    <Line
                                        key={muscleGroup.id}
                                        type="monotone"
                                        dataKey={muscleGroup.id}
                                        stroke={muscleGroup.color}
                                        strokeWidth={2.5}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 5 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">
                        {t('athletes.reportingNoVisibleData')}
                    </div>
                )}
            </div>
        </div>
    )
}