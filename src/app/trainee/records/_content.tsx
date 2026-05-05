'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { getApiErrorMessage } from '@/lib/api-error'
import { estimateOneRMFromRpeTable } from '@/lib/calculations'
import { Button, Card, FormLabel, Input, NavigationLoadingOverlay } from '@/components'
import { BarChart2, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { formatDate } from '@/lib/date-format'

interface PersonalRecord {
    id: string
    weight: number
    reps: number
    recordDate: string
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

interface ProgressChartPoint {
    dateKey: string
    dateLabel: string
    oneRepMax: number
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

export default function PersonalRecordsContent() {
    const { t } = useTranslation('trainee')
    const [loading, setLoading] = useState(true)
    const [records, setRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'fundamental' | 'accessory'>('all')
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true)

            const res = await fetch('/api/personal-records')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('records.errorLoading'), t))
            }

            setRecords(data.data.items)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t('records.errorLoading')
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        void fetchRecords()
    }, [fetchRecords])

    const calculateOneRepMax = useCallback((weight: number, reps: number): number => {
        return Math.round(estimateOneRMFromRpeTable(weight, reps, 10) * 10) / 10
    }, [])

    const buildProgressChartData = useCallback((exerciseRecords: PersonalRecord[]): ProgressChartPoint[] => {
        const chartRowsByDate = new Map<string, ProgressChartPoint>()

        exerciseRecords.forEach((record) => {
            const dateKey = normalizeRecordDateKey(record.recordDate)
            const oneRepMax = calculateOneRepMax(record.weight, record.reps)

            if (!chartRowsByDate.has(dateKey)) {
                chartRowsByDate.set(dateKey, {
                    dateKey,
                    dateLabel: formatDate(dateKey),
                    oneRepMax,
                })
                return
            }

            const existing = chartRowsByDate.get(dateKey)
            if (!existing) {
                return
            }

            if (oneRepMax > existing.oneRepMax) {
                existing.oneRepMax = oneRepMax
            }
        })

        return Array.from(chartRowsByDate.values()).sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    }, [calculateOneRepMax])

    const toggleCardExpansion = (exerciseId: string) => {
        setExpandedCards((currentCards) => {
            const newExpanded = new Set(currentCards)
            if (newExpanded.has(exerciseId)) {
                newExpanded.delete(exerciseId)
            } else {
                newExpanded.add(exerciseId)
            }

            return newExpanded
        })
    }

    const filteredRecords = useMemo(() => records.filter((pr) => {
        const matchesSearch = pr.exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = typeFilter === 'all' || pr.exercise.type === typeFilter
        return matchesSearch && matchesType
    }), [records, searchQuery, typeFilter])

    const groupedRecords = useMemo(() => {
        const grouped: Record<string, PersonalRecord[]> = {}

        filteredRecords.forEach((pr) => {
            if (!grouped[pr.exercise.id]) {
                grouped[pr.exercise.id] = []
            }
            grouped[pr.exercise.id].push(pr)
        })

        return grouped
    }, [filteredRecords])

    const bestRecords = useMemo(() => Object.values(groupedRecords).map((prs) => {
        return prs.reduce((best, current) => {
            const bestOrm = calculateOneRepMax(best.weight, best.reps)
            const currentOrm = calculateOneRepMax(current.weight, current.reps)
            return currentOrm > bestOrm ? current : best
        })
    }), [calculateOneRepMax, groupedRecords])

    const hasActiveFilters = searchQuery.trim().length > 0 || typeFilter !== 'all'

    const resetFilters = () => {
        setSearchQuery('')
        setTypeFilter('all')
    }

    if (loading) {
        return <NavigationLoadingOverlay />
    }

    if (error) {
        return (
            <div className="flex items-center justify-center py-16">
                <Card className="text-state-error" variant="base">
                    {error}
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t('records.title')}</h1>
                <p className="text-gray-600 mt-2">
                    {t('records.description')}
                </p>
            </div>

            {records.length === 0 ? (
                <Card className="p-12 text-center" variant="base">
                    <div className="mb-4"><BarChart2 className="w-16 h-16 mx-auto text-gray-300" /></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        {t('records.noRecords')}
                    </h2>
                    <p className="text-gray-600">
                        {t('records.noRecordsDesc')}
                    </p>
                </Card>
            ) : (
                <>
                    {/* Filters */}
                    <Card className="mb-6" variant="base" padding="sm">
                        <div className="space-y-3">
                            {/* Search */}
                            <div>
                                <FormLabel className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                                    {t('records.searchLabel')}
                                </FormLabel>
                                <div className="mt-1 flex items-center gap-1.5">
                                    <Input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t('records.searchPlaceholder')}
                                        inputSize="md"
                                        icon={<Search className="h-4 w-4" />}
                                        className="text-sm"
                                    />
                                    {searchQuery.trim().length > 0 && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setSearchQuery('')}
                                            icon={<X className="h-4 w-4" />}
                                            aria-label={t('records.searchClear')}
                                        >
                                            {t('records.searchClear')}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Type Filter */}
                            <div>
                                <FormLabel className="mb-1 block text-xs uppercase tracking-wide text-gray-500">
                                    {t('records.typeLabel')}
                                </FormLabel>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { value: 'all', label: t('records.typeAll') },
                                        { value: 'fundamental', label: t('records.typeFundamental') },
                                        { value: 'accessory', label: t('records.typeAccessory') },
                                    ].map((option) => (
                                        <Button
                                            key={option.value}
                                            onClick={() =>
                                                setTypeFilter(option.value as typeof typeFilter)
                                            }
                                            variant={typeFilter === option.value ? 'primary' : 'secondary'}
                                            size="sm"
                                            className="min-w-[94px]"
                                        >
                                            {option.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                                <p className="text-xs font-medium text-gray-600">
                                    {t('records.searchResultsCount', { count: bestRecords.length })}
                                </p>

                                {hasActiveFilters && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={resetFilters}
                                    >
                                        {t('records.searchReset')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Records Grid */}
                    {bestRecords.length === 0 ? (
                        <Card className="p-8 text-center" variant="base">
                            <p className="text-gray-600">{t('records.noRecordsFound')}</p>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {bestRecords
                                .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name))
                                .map((pr) => {
                                    const oneRepMax = calculateOneRepMax(pr.weight, pr.reps)
                                    const allPRs = groupedRecords[pr.exercise.id] || []
                                    const sortedProgressionRecords = [...allPRs].sort(
                                        (a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime()
                                    )
                                    const chartData = buildProgressChartData(allPRs)

                                    return (
                                        <Card
                                            key={pr.id}
                                            className="h-full"
                                            variant="base"
                                        >
                                            <div className="space-y-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="truncate text-lg font-bold text-gray-900">
                                                                {pr.exercise.name}
                                                            </h3>
                                                            <span
                                                                className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${pr.exercise.type === 'fundamental'
                                                                    ? 'bg-red-100 text-red-800'
                                                                    : 'bg-blue-100 text-blue-800'
                                                                    }`}
                                                                title={
                                                                    pr.exercise.type === 'fundamental'
                                                                        ? t('workouts.tagFundamental')
                                                                        : t('workouts.tagAccessory')
                                                                }
                                                                aria-label={
                                                                    pr.exercise.type === 'fundamental'
                                                                        ? t('records.tagFundamental')
                                                                        : t('records.tagAccessory')
                                                                }
                                                            >
                                                                {pr.exercise.type === 'fundamental'
                                                                    ? t('workouts.tagFundamentalShort')
                                                                    : t('workouts.tagAccessoryShort')}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-xs text-gray-600">
                                                            {t('records.achievedOn')} {formatDate(pr.recordDate)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 shadow-sm">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                            {t('records.bestRecord')}
                                                        </p>
                                                        <p className="mt-1 text-3xl font-black leading-none tracking-tight text-gray-900 sm:text-2xl">
                                                            {formatWeight(pr.weight)}
                                                            <span className="ml-1 text-lg font-bold text-gray-700">kg</span>
                                                        </p>
                                                        <p className="mt-1 text-sm text-gray-600">x {pr.reps}</p>
                                                    </div>

                                                    <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-3 shadow-sm ring-1 ring-brand-primary/20">
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                                                            {t('records.normalizedOrmLabel')}
                                                        </p>
                                                        <p className="mt-1 text-3xl font-black leading-none tracking-tight text-brand-primary sm:text-2xl">
                                                            {formatWeight(oneRepMax)}
                                                            <span className="ml-1 text-lg font-bold text-brand-primary">kg</span>
                                                        </p>
                                                        <p className="mt-1 text-sm text-gray-700">1RM</p>
                                                    </div>
                                                </div>

                                                <div className="flex justify-center">
                                                    <Button
                                                        onClick={() => toggleCardExpansion(pr.exercise.id)}
                                                        variant="secondary"
                                                        size="sm"
                                                        className="border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            <BarChart2 className="h-4 w-4" />
                                                            {t('records.progressAction')}
                                                            {expandedCards.has(pr.exercise.id) ? (
                                                                <ChevronUp className="h-4 w-4 shrink-0" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4 shrink-0" />
                                                            )}
                                                        </span>
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Progress Section */}
                                            {expandedCards.has(pr.exercise.id) && (
                                                <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                                                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                                        {t('records.progressHistory')}
                                                    </h4>

                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                                            {t('records.progressChartTitle')}
                                                        </p>
                                                        {chartData.length > 0 ? (
                                                            <div className="h-64 w-full rounded-lg border border-gray-200 bg-gray-50 p-2">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <LineChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 4 }}>
                                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                                        <XAxis dataKey="dateLabel" minTickGap={20} />
                                                                        <YAxis
                                                                            width={56}
                                                                            tickFormatter={(value) => formatWeight(Number(value))}
                                                                        />
                                                                        <Tooltip
                                                                            formatter={(value) => [
                                                                                `${formatWeight(Number(value))} kg`,
                                                                                t('records.normalizedOrmLabel'),
                                                                            ]}
                                                                        />
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="oneRepMax"
                                                                            name={t('records.normalizedOrmLabel')}
                                                                            stroke="rgb(var(--brand-primary))"
                                                                            strokeWidth={2.5}
                                                                            dot={{ r: 3 }}
                                                                            activeDot={{ r: 5 }}
                                                                        />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-sm text-gray-600">
                                                                {t('records.noRecordsFound')}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                        <table className="min-w-full divide-y divide-gray-200">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                                                                        {t('records.progressTableDate')}
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                                                                        {t('records.progressTableRecord')}
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                                                                        {t('records.progressTableOrm')}
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                                {sortedProgressionRecords.map((record) => {
                                                                    const orm = calculateOneRepMax(record.weight, record.reps)
                                                                    return (
                                                                        <tr key={record.id} className="text-sm text-gray-700">
                                                                            <td className="px-3 py-2">{formatDate(record.recordDate)}</td>
                                                                            <td className="px-3 py-2">
                                                                                {formatWeight(record.weight)} kg x {record.reps}
                                                                            </td>
                                                                            <td className="px-3 py-2 font-semibold text-brand-primary">
                                                                                {formatWeight(orm)} kg
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </Card>
                                    )
                                })}
                        </div>
                    )}
                </>
            )}

        </div>
    )
}

