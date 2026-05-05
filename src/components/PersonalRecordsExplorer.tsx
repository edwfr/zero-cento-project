'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
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
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ActionIconButton, InlineActions } from '@/components/ActionIconButton'
import { formatDate } from '@/lib/date-format'
import { estimateOneRMFromRpeTable } from '@/lib/calculations'

const CHART_COLORS = ['rgb(var(--brand-primary))', '#0F766E', '#2563EB', '#DC2626', '#7C3AED', '#0891B2', '#65A30D', '#EA580C']

type TimeWindow = '30d' | '90d' | '180d' | '365d' | 'all'

interface RecordExercise {
    id: string
    name: string
    type?: string
}

export interface PersonalRecordExplorerItem {
    id: string
    weight: number
    reps: number
    recordDate: string
    notes: string | null
    exercise: RecordExercise
}

interface GroupedExerciseRecords {
    exercise: RecordExercise
    latestRecord: PersonalRecordExplorerItem
    historicalRecords: PersonalRecordExplorerItem[]
    totalRecords: number
}

interface ChartRow {
    dateKey: string
    dateLabel: string
    [exerciseId: string]: string | number
}

interface ChartLineSeries {
    dataKey: string
    label: string
    color: string
}

interface PersonalRecordsExplorerProps {
    records: PersonalRecordExplorerItem[]
    className?: string
    onEditRecord?: (record: PersonalRecordExplorerItem) => void
    onDeleteRecord?: (record: PersonalRecordExplorerItem) => void
    calculateOneRepMax?: (weight: number, reps: number) => number
}

function normalizeRecordDateKey(recordDate: string): string {
    if (recordDate.length >= 10) {
        return recordDate.slice(0, 10)
    }

    const parsedDate = new Date(recordDate)
    if (Number.isNaN(parsedDate.getTime())) {
        return recordDate
    }

    return parsedDate.toISOString().slice(0, 10)
}

function formatWeight(weight: number): string {
    if (!Number.isFinite(weight)) {
        return '0'
    }

    return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

export default function PersonalRecordsExplorer({
    records,
    className = '',
    onEditRecord,
    onDeleteRecord,
    calculateOneRepMax,
}: PersonalRecordsExplorerProps) {
    const { t } = useTranslation('common')
    const [expandedExerciseIds, setExpandedExerciseIds] = useState<Record<string, boolean>>({})
    const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([])
    const [selectedTimeWindow, setSelectedTimeWindow] = useState<TimeWindow>('180d')

    const showActions = Boolean(onEditRecord || onDeleteRecord)

    const computeOneRepMax = useMemo(() => {
        if (calculateOneRepMax) {
            return calculateOneRepMax
        }

        return (weight: number, reps: number) => {
            return Math.round(estimateOneRMFromRpeTable(weight, reps, 10) * 10) / 10
        }
    }, [calculateOneRepMax])

    const groupedRecords = useMemo<GroupedExerciseRecords[]>(() => {
        const exerciseMap = new Map<string, { exercise: RecordExercise; history: PersonalRecordExplorerItem[] }>()

        records.forEach((record) => {
            const exerciseId = record.exercise.id
            if (!exerciseMap.has(exerciseId)) {
                exerciseMap.set(exerciseId, {
                    exercise: record.exercise,
                    history: [],
                })
            }

            exerciseMap.get(exerciseId)?.history.push(record)
        })

        return Array.from(exerciseMap.values())
            .map((group) => {
                const sortedHistory = [...group.history].sort((left, right) => {
                    return new Date(right.recordDate).getTime() - new Date(left.recordDate).getTime()
                })

                return {
                    exercise: group.exercise,
                    latestRecord: sortedHistory[0],
                    historicalRecords: sortedHistory.slice(1),
                    totalRecords: sortedHistory.length,
                }
            })
            .sort((left, right) => {
                if (left.exercise.type !== right.exercise.type) {
                    return left.exercise.type === 'fundamental' ? -1 : 1
                }

                return left.exercise.name.localeCompare(right.exercise.name, 'it', { sensitivity: 'base' })
            })
    }, [records])

    useEffect(() => {
        if (selectedExerciseIds.length === 0) {
            return
        }

        const availableExerciseIds = new Set(groupedRecords.map((group) => group.exercise.id))
        const nextSelectedIds = selectedExerciseIds.filter((exerciseId) =>
            availableExerciseIds.has(exerciseId)
        )

        if (nextSelectedIds.length !== selectedExerciseIds.length) {
            setSelectedExerciseIds(nextSelectedIds)
        }
    }, [groupedRecords, selectedExerciseIds])

    const filteredRecordsForChart = useMemo(() => {
        const now = new Date()
        const daysByWindow: Record<Exclude<TimeWindow, 'all'>, number> = {
            '30d': 30,
            '90d': 90,
            '180d': 180,
            '365d': 365,
        }

        const cutoffDate =
            selectedTimeWindow === 'all'
                ? null
                : new Date(now.getTime() - daysByWindow[selectedTimeWindow] * 24 * 60 * 60 * 1000)

        return records.filter((record) => {
            const matchesExercise =
                selectedExerciseIds.length === 0 || selectedExerciseIds.includes(record.exercise.id)

            if (!matchesExercise) {
                return false
            }

            if (!cutoffDate) {
                return true
            }

            const recordDate = new Date(record.recordDate)
            return !Number.isNaN(recordDate.getTime()) && recordDate >= cutoffDate
        })
    }, [records, selectedExerciseIds, selectedTimeWindow])

    const chartLineSeries = useMemo<ChartLineSeries[]>(() => {
        const exerciseMap = new Map<string, string>()

        filteredRecordsForChart.forEach((record) => {
            if (!exerciseMap.has(record.exercise.id)) {
                exerciseMap.set(record.exercise.id, record.exercise.name)
            }
        })

        return Array.from(exerciseMap.entries())
            .sort((left, right) => left[1].localeCompare(right[1], 'it', { sensitivity: 'base' }))
            .map(([exerciseId, exerciseName], index) => ({
                dataKey: exerciseId,
                label: exerciseName,
                color: CHART_COLORS[index % CHART_COLORS.length],
            }))
    }, [filteredRecordsForChart])

    const chartData = useMemo<ChartRow[]>(() => {
        const chartRowsByDate = new Map<string, ChartRow>()

        filteredRecordsForChart.forEach((record) => {
            const dateKey = normalizeRecordDateKey(record.recordDate)
            const oneRepMax = computeOneRepMax(record.weight, record.reps)

            if (!chartRowsByDate.has(dateKey)) {
                chartRowsByDate.set(dateKey, {
                    dateKey,
                    dateLabel: formatDate(dateKey),
                })
            }

            const chartRow = chartRowsByDate.get(dateKey)
            if (!chartRow) {
                return
            }

            const currentValue = chartRow[record.exercise.id]
            if (typeof currentValue !== 'number' || oneRepMax > currentValue) {
                chartRow[record.exercise.id] = oneRepMax
            }
        })

        return Array.from(chartRowsByDate.values()).sort((left, right) => {
            return left.dateKey.localeCompare(right.dateKey)
        })
    }, [computeOneRepMax, filteredRecordsForChart])

    const timeWindowOptions: Array<{ value: TimeWindow; label: string }> = [
        { value: '30d', label: t('common.personalRecordsExplorer.window30d') },
        { value: '90d', label: t('common.personalRecordsExplorer.window90d') },
        { value: '180d', label: t('common.personalRecordsExplorer.window180d') },
        { value: '365d', label: t('common.personalRecordsExplorer.window365d') },
        { value: 'all', label: t('common.personalRecordsExplorer.windowAll') },
    ]

    const toggleExerciseRows = (exerciseId: string) => {
        setExpandedExerciseIds((currentState) => ({
            ...currentState,
            [exerciseId]: !currentState[exerciseId],
        }))
    }

    const toggleExerciseFilter = (exerciseId: string) => {
        setSelectedExerciseIds((currentIds) => {
            if (currentIds.length === 0) {
                return [exerciseId]
            }

            if (currentIds.includes(exerciseId)) {
                return currentIds.filter((id) => id !== exerciseId)
            }

            return [...currentIds, exerciseId]
        })
    }

    const showAllExercises = () => {
        setSelectedExerciseIds([])
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
                <div className="border-b border-gray-100 bg-gradient-to-r from-[#FFF7E5] to-[#F5F3FF] px-5 py-4">
                    <h2 className="text-lg font-bold text-gray-900">
                        {t('common.personalRecordsExplorer.tableTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                        {t('common.personalRecordsExplorer.tableDescription')}
                    </p>
                </div>

                {groupedRecords.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-500">
                        {t('common.personalRecordsExplorer.noData')}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                                        {t('common.personalRecordsExplorer.columnExercise')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                                        {t('common.personalRecordsExplorer.columnLatestRecord')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                                        {t('common.personalRecordsExplorer.columnEstimatedOneRm')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                                        {t('common.personalRecordsExplorer.columnDate')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                                        {t('common.personalRecordsExplorer.columnNotes')}
                                    </th>
                                    {showActions && (
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                            {t('common.personalRecordsExplorer.columnActions')}
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {groupedRecords.map((group) => {
                                    const isExpanded = Boolean(expandedExerciseIds[group.exercise.id])
                                    const latestOneRepMax = computeOneRepMax(
                                        group.latestRecord.weight,
                                        group.latestRecord.reps
                                    )

                                    return (
                                        <Fragment key={group.exercise.id}>
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                                            onClick={() => toggleExerciseRows(group.exercise.id)}
                                                            aria-label={
                                                                isExpanded
                                                                    ? t('common.personalRecordsExplorer.collapse')
                                                                    : t('common.personalRecordsExplorer.expand')
                                                            }
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">
                                                                {group.exercise.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {t('common.personalRecordsExplorer.historyCount', {
                                                                    count: group.totalRecords,
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-800">
                                                    {t('common.personalRecordsExplorer.recordFormat', {
                                                        weight: formatWeight(group.latestRecord.weight),
                                                        reps: group.latestRecord.reps,
                                                    })}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-brand-primary">
                                                    {formatWeight(latestOneRepMax)} {t('common.personalRecordsExplorer.oneRmUnit')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                    {formatDate(group.latestRecord.recordDate)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                                    {group.latestRecord.notes || t('common.personalRecordsExplorer.noNotes')}
                                                </td>
                                                {showActions && (
                                                    <td className="px-4 py-3 text-right">
                                                        <InlineActions>
                                                            {onEditRecord && (
                                                                <ActionIconButton
                                                                    variant="edit"
                                                                    label={t('common.edit')}
                                                                    onClick={() => onEditRecord(group.latestRecord)}
                                                                />
                                                            )}
                                                            {onDeleteRecord && (
                                                                <ActionIconButton
                                                                    variant="delete"
                                                                    label={t('common.delete')}
                                                                    onClick={() => onDeleteRecord(group.latestRecord)}
                                                                />
                                                            )}
                                                        </InlineActions>
                                                    </td>
                                                )}
                                            </tr>

                                            {isExpanded && (
                                                <>
                                                    {group.historicalRecords.length === 0 ? (
                                                        <tr className="bg-gray-50">
                                                            <td
                                                                className="px-4 py-3 text-sm text-gray-500"
                                                                colSpan={showActions ? 6 : 5}
                                                            >
                                                                {t('common.personalRecordsExplorer.noHistory')}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        group.historicalRecords.map((record) => {
                                                            const historicalOneRepMax = computeOneRepMax(
                                                                record.weight,
                                                                record.reps
                                                            )

                                                            return (
                                                                <tr key={record.id} className="bg-gray-50/80 hover:bg-gray-100/80">
                                                                    <td className="px-4 py-3 text-sm text-gray-700 pl-12">
                                                                        {t('common.personalRecordsExplorer.historyPrefix')}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-gray-700">
                                                                        {t('common.personalRecordsExplorer.recordFormat', {
                                                                            weight: formatWeight(record.weight),
                                                                            reps: record.reps,
                                                                        })}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                                                                        {formatWeight(historicalOneRepMax)} {t('common.personalRecordsExplorer.oneRmUnit')}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-gray-700">
                                                                        {formatDate(record.recordDate)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                                                        {record.notes || t('common.personalRecordsExplorer.noNotes')}
                                                                    </td>
                                                                    {showActions && (
                                                                        <td className="px-4 py-3 text-right">
                                                                            <InlineActions>
                                                                                {onEditRecord && (
                                                                                    <ActionIconButton
                                                                                        variant="edit"
                                                                                        label={t('common.edit')}
                                                                                        onClick={() => onEditRecord(record)}
                                                                                    />
                                                                                )}
                                                                                {onDeleteRecord && (
                                                                                    <ActionIconButton
                                                                                        variant="delete"
                                                                                        label={t('common.delete')}
                                                                                        onClick={() => onDeleteRecord(record)}
                                                                                    />
                                                                                )}
                                                                            </InlineActions>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            )
                                                        })
                                                    )}
                                                </>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
                <div className="border-b border-gray-100 bg-gradient-to-r from-[#ECFDF5] to-[#EFF6FF] px-5 py-4">
                    <h2 className="text-lg font-bold text-gray-900">
                        {t('common.personalRecordsExplorer.chartTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                        {t('common.personalRecordsExplorer.chartDescription')}
                    </p>
                </div>

                <div className="px-5 py-5">
                    <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                {t('common.personalRecordsExplorer.filterExercise')}
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={showAllExercises}
                                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${selectedExerciseIds.length === 0
                                        ? 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    {t('common.personalRecordsExplorer.allExercises')}
                                </button>
                                {groupedRecords.map((group) => {
                                    const isActive = selectedExerciseIds.includes(group.exercise.id)

                                    return (
                                        <button
                                            key={group.exercise.id}
                                            type="button"
                                            onClick={() => toggleExerciseFilter(group.exercise.id)}
                                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${isActive
                                                ? 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                                                }`}
                                        >
                                            {group.exercise.name}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                {t('common.personalRecordsExplorer.filterWindow')}
                            </label>
                            <select
                                value={selectedTimeWindow}
                                onChange={(event) => setSelectedTimeWindow(event.target.value as TimeWindow)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            >
                                {timeWindowOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {chartData.length > 0 && chartLineSeries.length > 0 ? (
                        <div className="h-[340px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="dateLabel" minTickGap={24} />
                                    <YAxis
                                        tickFormatter={(value) => `${formatWeight(Number(value))}`}
                                        width={56}
                                    />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            const numericValue = Array.isArray(value)
                                                ? Number(value[0] ?? 0)
                                                : Number(value ?? 0)
                                            const dataKey = String(name ?? '')
                                            const lineLabel =
                                                chartLineSeries.find((lineSeries) => lineSeries.dataKey === dataKey)
                                                    ?.label || dataKey

                                            return [
                                                `${formatWeight(numericValue)} ${t('common.personalRecordsExplorer.oneRmUnit')}`,
                                                lineLabel,
                                            ]
                                        }}
                                    />
                                    <Legend
                                        formatter={(value) => {
                                            return (
                                                chartLineSeries.find(
                                                    (lineSeries) => lineSeries.dataKey === String(value)
                                                )?.label || String(value)
                                            )
                                        }}
                                    />
                                    {chartLineSeries.map((lineSeries) => (
                                        <Line
                                            key={lineSeries.dataKey}
                                            type="monotone"
                                            dataKey={lineSeries.dataKey}
                                            stroke={lineSeries.color}
                                            strokeWidth={2.5}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                            {t('common.personalRecordsExplorer.noChartData')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

