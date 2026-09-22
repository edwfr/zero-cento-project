'use client'

import { useMemo } from 'react'
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
import {
    buildChartSeries,
    MEASUREMENT_METRIC_META,
    type MeasurementMetric,
    type MeasurementPoint,
} from '@/lib/measurements'
import { formatDate } from '@/lib/date-format'

export interface MeasurementTrendChartProps {
    rows: MeasurementPoint[]
    selectedMetrics: MeasurementMetric[]
    emptyLabel: string
}

/**
 * Weight (kg) and circumferences (cm) share one chart but not one axis:
 * a single axis would flatten the cm lines against the kg scale.
 */
export default function MeasurementTrendChart({
    rows,
    selectedMetrics,
    emptyLabel,
}: MeasurementTrendChartProps) {
    const { t } = useTranslation('trainer')

    const series = useMemo(
        () => buildChartSeries(rows, selectedMetrics),
        [rows, selectedMetrics]
    )

    if (series.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                {emptyLabel}
            </div>
        )
    }

    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="measuredAt" tickFormatter={(value: string) => formatDate(value)} />
                    <YAxis yAxisId="cm" orientation="left" unit=" cm" width={64} />
                    <YAxis yAxisId="kg" orientation="right" unit=" kg" width={64} />
                    <Tooltip labelFormatter={(value) => formatDate(String(value))} />
                    <Legend />
                    {selectedMetrics.map((metric) => {
                        const meta = MEASUREMENT_METRIC_META[metric]
                        return (
                            <Line
                                key={metric}
                                type="monotone"
                                dataKey={metric}
                                name={t(meta.labelKey)}
                                stroke={meta.chartColor}
                                strokeWidth={2}
                                yAxisId={meta.unit === 'kg' ? 'kg' : 'cm'}
                                connectNulls
                                dot={{ r: 3 }}
                            />
                        )
                    })}
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
