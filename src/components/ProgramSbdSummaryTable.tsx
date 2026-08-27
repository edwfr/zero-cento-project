'use client'

import { useTranslation } from 'react-i18next'
import type { SbdLiftAcrossWeeks } from '@/lib/program-sbd-metrics'

interface ProgramSbdSummaryTableProps {
    weeks: Array<{ id: string; weekNumber: number }>
    metricsByLiftAcrossWeeks: SbdLiftAcrossWeeks[]
}

export default function ProgramSbdSummaryTable({
    weeks,
    metricsByLiftAcrossWeeks,
}: ProgramSbdSummaryTableProps) {
    const { t } = useTranslation('trainer')

    return (
        <div className="overflow-x-auto">
            <table className="w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                        <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 text-left w-[88px]">
                            {t('reviewProgram.sbdExerciseCol')}
                        </th>
                        {weeks.map((week) => (
                            <th key={week.id} className="px-2 py-2 text-left whitespace-nowrap w-[72px]">
                                {t('reviewProgram.sbdWeekShort', { week: week.weekNumber })}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {metricsByLiftAcrossWeeks.map((liftMetric) => (
                        <tr key={liftMetric.lift}>
                            <td className="sticky left-0 z-10 bg-white px-2 py-2 align-top text-sm font-semibold text-slate-900 whitespace-nowrap">
                                {liftMetric.liftLabel}
                            </td>
                            {weeks.map((week) => {
                                const metric = liftMetric.metricsByWeekId[week.id]

                                return (
                                    <td key={week.id} className="px-2 py-2 align-top">
                                        {metric ? (
                                            <div className="space-y-0.5 text-[11px] text-slate-700">
                                                <p>
                                                    <span className="font-semibold text-slate-500">
                                                        {t('reviewProgram.sbdFrqCol')}:
                                                    </span>{' '}
                                                    <span className="font-semibold text-slate-900">
                                                        {metric.frequency}
                                                    </span>
                                                </p>
                                                <p>
                                                    <span className="font-semibold text-slate-500">
                                                        {t('reviewProgram.sbdNblCol')}:
                                                    </span>{' '}
                                                    <span className="font-semibold text-slate-900">
                                                        {metric.totalLifts}
                                                    </span>
                                                </p>
                                                <p>
                                                    <span className="font-semibold text-slate-500">
                                                        {t('reviewProgram.sbdImCol')}:
                                                    </span>{' '}
                                                    <span className="font-semibold text-slate-900">
                                                        {metric.averageIntensity !== null
                                                            ? `${metric.averageIntensity.toFixed(1)}%`
                                                            : '-'}
                                                    </span>
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">-</span>
                                        )}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
