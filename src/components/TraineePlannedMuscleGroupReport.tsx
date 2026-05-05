'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Bar,
    BarChart,
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
import { FormLabel } from '@/components/FormLabel'

const MUSCLE_GROUP_CHART_COLORS = [
    'rgb(var(--brand-primary))',
    '#0F766E',
    '#2563EB',
    '#DC2626',
    '#7C3AED',
    '#0891B2',
    '#65A30D',
    '#EA580C',
]

type TimeWindow = '4' | '8' | '12' | '24' | 'all'
type FundamentalLift = 'squat' | 'bench' | 'deadlift'

const FUNDAMENTAL_COLORS: Record<FundamentalLift, string> = {
    squat: '#16A34A',
    bench: '#2563EB',
    deadlift: '#DC2626',
}

const FUNDAMENTAL_LIFTS: FundamentalLift[] = ['squat', 'bench', 'deadlift']

function getSeriesBadgeStyle(color: string, isActive: boolean) {
    if (!isActive) {
        return {
            borderColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
            color: '#4B5563',
        }
    }

    if (color.includes('var(--brand-primary)')) {
        return {
            borderColor: 'rgba(var(--brand-primary), 0.45)',
            backgroundColor: 'rgba(var(--brand-primary), 0.12)',
            color: 'rgb(var(--brand-primary))',
        }
    }

    const hex = color.replace('#', '')
    const normalizedHex =
        hex.length === 3
            ? hex
                .split('')
                .map((char) => `${char}${char}`)
                .join('')
            : hex

    const red = Number.parseInt(normalizedHex.slice(0, 2), 16)
    const green = Number.parseInt(normalizedHex.slice(2, 4), 16)
    const blue = Number.parseInt(normalizedHex.slice(4, 6), 16)

    return {
        borderColor: `rgba(${red}, ${green}, ${blue}, 0.45)`,
        backgroundColor: `rgba(${red}, ${green}, ${blue}, 0.12)`,
        color: `rgb(${Math.round(red * 0.6)}, ${Math.round(green * 0.6)}, ${Math.round(blue * 0.6)})`,
    }
}

interface MuscleGroupOption {
    id: string
    name: string
}

interface ReportPoint {
    date: string
    totalTrainingSets: number
    fundamentalSets: {
        squat: number
        bench: number
        deadlift: number
    }
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
    hideHeader?: boolean
    embedded?: boolean
    panelMode?: 'both' | 'fundamental' | 'muscle-groups'
}

export default function TraineePlannedMuscleGroupReport({
    traineeId,
    hideHeader = false,
    embedded = false,
    panelMode = 'both',
}: TraineePlannedMuscleGroupReportProps) {
    const { t } = useTranslation('trainer')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [report, setReport] = useState<PlannedTrainingSetsReportData | null>(null)
    const [timeWindow, setTimeWindow] = useState<TimeWindow>('12')
    const [visibleMuscleGroupIds, setVisibleMuscleGroupIds] = useState<string[]>([])
    const [visibleFundamentalLifts, setVisibleFundamentalLifts] = useState<FundamentalLift[]>([
        'squat',
        'bench',
        'deadlift',
    ])

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

        void fetchReport()
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

    const fundamentalChartData = useMemo(() => {
        return filteredPoints.map((point) => ({
            date: point.date,
            dateLabel: formatDate(point.date, 'medium'),
            squat: Number(point.fundamentalSets.squat || 0),
            bench: Number(point.fundamentalSets.bench || 0),
            deadlift: Number(point.fundamentalSets.deadlift || 0),
        }))
    }, [filteredPoints])

    const hasFundamentalData = fundamentalChartData.some((row) =>
        visibleFundamentalLifts.some((lift) => Number(row[lift] || 0) > 0)
    )

    const hasData = chartData.some((row) =>
        visibleMuscleGroups.some((muscleGroup) => Number(row[muscleGroup.id] || 0) > 0)
    )

    const selectAllMuscleGroups = () => {
        setVisibleMuscleGroupIds(muscleGroupSeries.map((muscleGroup) => muscleGroup.id))
    }

    const deselectAllMuscleGroups = () => {
        setVisibleMuscleGroupIds([])
    }

    const toggleMuscleGroupVisibility = (muscleGroupId: string) => {
        setVisibleMuscleGroupIds((currentIds) => {
            if (currentIds.includes(muscleGroupId)) {
                return currentIds.filter((id) => id !== muscleGroupId)
            }

            return [...currentIds, muscleGroupId]
        })
    }

    const selectAllFundamentalLifts = () => {
        setVisibleFundamentalLifts(['squat', 'bench', 'deadlift'])
    }

    const deselectAllFundamentalLifts = () => {
        setVisibleFundamentalLifts([])
    }

    const toggleFundamentalLiftVisibility = (lift: FundamentalLift) => {
        setVisibleFundamentalLifts((current) => {
            if (current.includes(lift)) {
                return current.filter((entry) => entry !== lift)
            }

            return [...current, lift]
        })
    }

    if (loading) {
        const loadingContent = (
            <div className="animate-pulse space-y-4">
                {!hideHeader && !embedded && <div className="h-7 w-64 rounded bg-gray-200" />}
                <div className="h-4 w-full rounded bg-gray-100" />
                <div className="h-96 rounded bg-gray-100" />
            </div>
        )

        if (embedded) {
            return loadingContent
        }

        return <div className="bg-white rounded-lg shadow-md p-6">{loadingContent}</div>
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                {error}
            </div>
        )
    }

    if (!report || report.points.length === 0 || report.muscleGroups.length === 0) {
        const emptyContent = (
            <>
                {!hideHeader && (
                    <h2 className="text-xl font-bold text-gray-900">
                        {t('athletes.reportingSectionTitle')}
                    </h2>
                )}
                <p className={`${hideHeader ? '' : 'mt-3 '}text-sm text-gray-600`}>
                    {t('athletes.reportingSectionEmpty')}
                </p>
            </>
        )

        if (embedded) {
            return (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8">
                    {emptyContent}
                </div>
            )
        }

        return <div className="bg-white rounded-lg shadow-md p-6">{emptyContent}</div>
    }

    const content = (
        <div className="flex flex-col gap-6">
            {!hideHeader && (
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('athletes.reportingSectionTitle')}</h2>
                    <p className="mt-2 text-sm text-gray-600">{t('athletes.reportingSectionDescription')}</p>
                </div>
            )}

            {(panelMode === 'both' || panelMode === 'fundamental') && (
                <div className={embedded ? '' : 'rounded-lg border border-gray-200 bg-white p-4'}>
                {!hideHeader && (
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{t('athletes.reportingFundamentalTitle')}</h3>
                        <p className="mt-1 text-sm text-gray-600">{t('athletes.reportingFundamentalDescription')}</p>
                    </div>
                )}

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <FormLabel className="mb-2" htmlFor="time-window-fundamental">
                            {t('athletes.reportingTimeWindowLabel')}
                        </FormLabel>
                        <select
                            id="time-window-fundamental"
                            value={timeWindow}
                            onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        >
                            <option value="4">{t('athletes.reportingWindow4Weeks')}</option>
                            <option value="8">{t('athletes.reportingWindow8Weeks')}</option>
                            <option value="12">{t('athletes.reportingWindow12Weeks')}</option>
                            <option value="24">{t('athletes.reportingWindow24Weeks')}</option>
                            <option value="all">{t('athletes.reportingWindowAll')}</option>
                        </select>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
                            <FormLabel className="mb-0 text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor="fundamental-filter">
                                {t('athletes.reportingFundamentalFilterLabel')}
                            </FormLabel>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={selectAllFundamentalLifts}
                                    className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59]"
                                >
                                    {t('athletes.reportingSelectAllFilters')}
                                </button>
                                <button
                                    type="button"
                                    onClick={deselectAllFundamentalLifts}
                                    className="text-sm font-semibold text-slate-600 hover:text-slate-800"
                                >
                                    {t('athletes.reportingDeselectAllFilters')}
                                </button>
                            </div>
                        </div>
                        <div id="fundamental-filter" className="mt-1 flex flex-wrap gap-2">
                            {FUNDAMENTAL_LIFTS.map((lift) => {
                                const isActive = visibleFundamentalLifts.includes(lift)
                                const label =
                                    lift === 'squat'
                                        ? t('reports.squat')
                                        : lift === 'bench'
                                            ? t('reports.bench')
                                            : t('reports.deadlift')

                                return (
                                    <button
                                        key={lift}
                                        type="button"
                                        onClick={() => toggleFundamentalLiftVisibility(lift)}
                                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
                                        style={getSeriesBadgeStyle(FUNDAMENTAL_COLORS[lift], isActive)}
                                    >
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: FUNDAMENTAL_COLORS[lift] }}
                                        />
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-5">
                    {hasFundamentalData ? (
                        <div className="h-[22rem]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={fundamentalChartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="dateLabel" minTickGap={24} />
                                    <YAxis />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            const liftName =
                                                name === 'squat'
                                                    ? t('reports.squat')
                                                    : name === 'bench'
                                                        ? t('reports.bench')
                                                        : t('reports.deadlift')

                                            return [
                                                `${Number.isInteger(Number(value ?? 0)) ? Number(value ?? 0) : Number(value ?? 0).toFixed(1)} ${t('athletes.reportingSetsUnit')}`,
                                                liftName,
                                            ]
                                        }}
                                    />
                                    <Legend
                                        formatter={(value) =>
                                            value === 'squat'
                                                ? t('reports.squat')
                                                : value === 'bench'
                                                    ? t('reports.bench')
                                                    : t('reports.deadlift')
                                        }
                                    />
                                    {visibleFundamentalLifts.map((lift) => (
                                        <Bar
                                            key={lift}
                                            dataKey={lift}
                                            fill={FUNDAMENTAL_COLORS[lift]}
                                            radius={[6, 6, 0, 0]}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-600">
                            {t('athletes.reportingFundamentalEmpty')}
                        </div>
                    )}
                </div>
                </div>
            )}

            {(panelMode === 'both' || panelMode === 'muscle-groups') && (
                <div className={embedded ? '' : 'rounded-lg border border-gray-200 bg-white p-4'}>
                {!hideHeader && (
                    <div>
                        <h3 className="text-base font-bold text-gray-900">{t('athletes.reportingSectionTitle')}</h3>
                        <p className="mt-1 text-sm text-gray-600">{t('athletes.reportingSectionDescription')}</p>
                    </div>
                )}

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <FormLabel className="mb-2" htmlFor="time-window-muscle-groups">
                            {t('athletes.reportingTimeWindowLabel')}
                        </FormLabel>
                        <select
                            id="time-window-muscle-groups"
                            value={timeWindow}
                            onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        >
                            <option value="4">{t('athletes.reportingWindow4Weeks')}</option>
                            <option value="8">{t('athletes.reportingWindow8Weeks')}</option>
                            <option value="12">{t('athletes.reportingWindow12Weeks')}</option>
                            <option value="24">{t('athletes.reportingWindow24Weeks')}</option>
                            <option value="all">{t('athletes.reportingWindowAll')}</option>
                        </select>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
                            <FormLabel className="mb-0 text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor="muscle-groups-filter">
                                {t('athletes.reportingMuscleGroupsFilterLabel')}
                            </FormLabel>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={selectAllMuscleGroups}
                                    className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59]"
                                >
                                    {t('athletes.reportingSelectAllFilters')}
                                </button>
                                <button
                                    type="button"
                                    onClick={deselectAllMuscleGroups}
                                    className="text-sm font-semibold text-slate-600 hover:text-slate-800"
                                >
                                    {t('athletes.reportingDeselectAllFilters')}
                                </button>
                            </div>
                        </div>
                        <div id="muscle-groups-filter" className="mt-1 flex flex-wrap gap-2">
                            {muscleGroupSeries.map((muscleGroup) => {
                                const isActive = visibleMuscleGroupIds.includes(muscleGroup.id)

                                return (
                                    <button
                                        key={muscleGroup.id}
                                        type="button"
                                        onClick={() => toggleMuscleGroupVisibility(muscleGroup.id)}
                                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
                                        style={getSeriesBadgeStyle(muscleGroup.color, isActive)}
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
                </div>

                <div className="mt-5">
                    {hasData ? (
                        <div className="h-[28rem]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="dateLabel" />
                                    <YAxis />
                                    <Tooltip
                                        formatter={(value, name) => [
                                            `${Number.isInteger(Number(value ?? 0)) ? Number(value ?? 0) : Number(value ?? 0).toFixed(1)} ${t('athletes.reportingSetsUnit')}`,
                                            visibleMuscleGroups.find((muscleGroup) => muscleGroup.id === String(name))?.name || String(name),
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
            )}
        </div>
    )

    if (embedded) {
        return content
    }

    return <div className="bg-white rounded-lg shadow-md p-6">{content}</div>
}
