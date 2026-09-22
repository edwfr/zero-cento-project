'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { ActionIconButton } from '@/components/ActionIconButton'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import MeasurementFormModal, {
    type MeasurementCreatePayload,
    type MeasurementEditPayload,
} from '@/components/MeasurementFormModal'
import MeasurementTrendChart from '@/components/MeasurementTrendChart'
import { SkeletonDetail } from '@/components/Skeleton'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/date-format'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    deltaFromPrevious,
    latestByMetric,
    type MeasurementMetric,
    type MeasurementPoint,
} from '@/lib/measurements'

type TimeWindow = '3m' | '6m' | '1y' | 'all'

const TIME_WINDOWS: TimeWindow[] = ['3m', '6m', '1y', 'all']

const WINDOW_MONTHS: Record<Exclude<TimeWindow, 'all'>, number> = { '3m': 3, '6m': 6, '1y': 12 }

const CHART_METRICS = MEASUREMENT_METRICS.filter((metric) => MEASUREMENT_METRIC_META[metric].inChart)

export interface MeasurementsTabProps {
    traineeId: string
}

/**
 * Trainer-only tab: body measurements over time. The API refuses the trainee
 * role outright, so nothing here needs a role check.
 */
export default function MeasurementsTab({ traineeId }: MeasurementsTabProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()

    const [rows, setRows] = useState<MeasurementPoint[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; initial?: MeasurementPoint } | null>(null)
    const [pendingDelete, setPendingDelete] = useState<MeasurementPoint | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [timeWindow, setTimeWindow] = useState<TimeWindow>('6m')
    const [selectedMetrics, setSelectedMetrics] = useState<MeasurementMetric[]>(['weight', 'waist'])

    const fetchRows = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const res = await fetch(`/api/trainee-measurements?traineeId=${traineeId}`)
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.loadError'), t))
            }

            setRows(data.data?.items ?? [])
        } catch {
            setError(t('measurements.loadError'))
        } finally {
            setLoading(false)
        }
    }, [traineeId, t])

    useEffect(() => {
        void fetchRows()
    }, [fetchRows])

    const windowedRows = useMemo(() => {
        if (timeWindow === 'all') return rows

        const threshold = new Date()
        threshold.setMonth(threshold.getMonth() - WINDOW_MONTHS[timeWindow])
        const thresholdKey = threshold.toISOString().slice(0, 10)

        return rows.filter((row) => row.measuredAt.slice(0, 10) >= thresholdKey)
    }, [rows, timeWindow])

    const latest = useMemo(() => latestByMetric(rows), [rows])

    const toggleMetric = (metric: MeasurementMetric) => {
        setSelectedMetrics((current) =>
            current.includes(metric) ? current.filter((item) => item !== metric) : [...current, metric]
        )
    }

    const handleCreate = async (payload: MeasurementCreatePayload) => {
        setSaving(true)
        try {
            const res = await fetch('/api/trainee-measurements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ traineeId, ...payload }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.saveError'), t))
            }

            setModal(null)
            await fetchRows()
            showToast(t('common:common.success'), 'success')
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('measurements.saveError'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = async (payload: MeasurementEditPayload) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/trainee-measurements/${payload.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    value: payload.value,
                    measuredAt: payload.measuredAt,
                    notes: payload.notes,
                }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.saveError'), t))
            }

            setModal(null)
            await fetchRows()
            showToast(t('common:common.success'), 'success')
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('measurements.saveError'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (row: MeasurementPoint) => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/trainee-measurements/${row.id}`, { method: 'DELETE' })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('measurements.saveError'), t))
            }

            setPendingDelete(null)
            await fetchRows()
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('measurements.saveError'), 'error')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return <SkeletonDetail />

    if (error) {
        return (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-state-error">
                <p>{error}</p>
                <Button type="button" onClick={() => void fetchRows()}>
                    {t('measurements.retry')}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('measurements.title')}</h2>
                    <p className="mt-1 text-sm text-gray-600">{t('measurements.subtitle')}</p>
                </div>
                <Button type="button" icon={<Plus />} onClick={() => setModal({ mode: 'create' })}>
                    {t('measurements.addButton')}
                </Button>
            </div>

            {/* Summary cards */}
            <div role="list" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {MEASUREMENT_METRICS.map((metric) => {
                    const meta = MEASUREMENT_METRIC_META[metric]
                    const point = latest[metric]
                    const delta = deltaFromPrevious(rows, metric)

                    return (
                        <div
                            key={metric}
                            role="listitem"
                            aria-label={t(meta.labelKey)}
                            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                        >
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {t(meta.labelKey)}
                            </p>
                            {point ? (
                                <>
                                    <p className="mt-1 text-lg font-bold text-gray-900">
                                        {`${point.value} ${meta.unit}`}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {t('measurements.lastMeasured', { date: formatDate(point.measuredAt) })}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-gray-700">
                                        {delta === null ? t('measurements.deltaNone') : delta > 0 ? `+${delta}` : `${delta}`}
                                    </p>
                                </>
                            ) : (
                                <p className="mt-1 text-sm text-gray-400">{t('measurements.emptyMetric')}</p>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
                <h3 className="text-lg font-bold text-gray-900">{t('measurements.chartTitle')}</h3>
                <p className="mb-4 text-sm text-gray-600">{t('measurements.chartDescription')}</p>

                <div className="mb-4 flex flex-wrap items-center gap-4">
                    <select
                        value={timeWindow}
                        onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                        aria-label={t('measurements.chartTitle')}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    >
                        {TIME_WINDOWS.map((option) => (
                            <option key={option} value={option}>
                                {t(`measurements.window.${option}`)}
                            </option>
                        ))}
                    </select>

                    <div className="flex flex-wrap gap-3">
                        {CHART_METRICS.map((metric) => (
                            <label key={metric} className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={selectedMetrics.includes(metric)}
                                    onChange={() => toggleMetric(metric)}
                                    aria-label={t(MEASUREMENT_METRIC_META[metric].labelKey)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                />
                                {t(MEASUREMENT_METRIC_META[metric].labelKey)}
                            </label>
                        ))}
                    </div>
                </div>

                <MeasurementTrendChart
                    rows={windowedRows}
                    selectedMetrics={selectedMetrics}
                    emptyLabel={t('measurements.emptyChart')}
                />
            </div>

            {/* History */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-md">
                <h3 className="px-5 py-4 text-lg font-bold text-gray-900">{t('measurements.historyTitle')}</h3>

                {rows.length === 0 ? (
                    <p className="px-5 pb-5 text-sm text-gray-500">{t('measurements.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.date')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.metricColumn')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.value')}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                                        {t('measurements.notes')}
                                    </th>
                                    <th className="px-6 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {rows.map((row) => {
                                    const meta = MEASUREMENT_METRIC_META[row.metric]
                                    return (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                                                {formatDate(row.measuredAt)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                                                {t(meta.labelKey)}
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                                                {`${row.value} ${meta.unit}`}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{row.notes ?? '—'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <ActionIconButton
                                                        variant="edit"
                                                        label={t('common:common.edit')}
                                                        onClick={() => setModal({ mode: 'edit', initial: row })}
                                                    />
                                                    <ActionIconButton
                                                        variant="delete"
                                                        label={t('common:common.delete')}
                                                        onClick={() => setPendingDelete(row)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal && (
                <MeasurementFormModal
                    mode={modal.mode}
                    initial={modal.initial}
                    isSaving={saving}
                    onClose={() => setModal(null)}
                    onCreate={(payload) => void handleCreate(payload)}
                    onEdit={(payload) => void handleEdit(payload)}
                />
            )}

            {pendingDelete && (
                <ConfirmationModal
                    isOpen
                    title={t('measurements.deleteConfirmTitle')}
                    message={t('measurements.deleteConfirmMessage')}
                    variant="danger"
                    isLoading={deleting}
                    onClose={() => setPendingDelete(null)}
                    onConfirm={() => void handleDelete(pendingDelete)}
                />
            )}
        </div>
    )
}
