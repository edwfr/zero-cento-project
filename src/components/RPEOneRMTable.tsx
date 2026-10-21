'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
    MIKE_TUCHSCHERER_REP_RANGE,
    MIKE_TUCHSCHERER_RPE_CHART,
    MIKE_TUCHSCHERER_RPE_LEVELS,
} from '@/lib/calculations'

interface RPEOneRMTableProps {
    title?: string
    description?: string
    className?: string
    defaultOpen?: boolean
    openText?: string
    closeText?: string
    chart?: Record<number, Record<string, number>>
    rpeLevels?: readonly number[]
    repRange?: readonly number[]
    formatPercentage?: (pct: number) => string
    notes?: string[]
    i18nPrefix?: string
    showFormula?: boolean
}

function toRpeChartKey(rpe: number): string {
    return Number.isInteger(rpe) ? String(rpe) : rpe.toFixed(1)
}

function getCellToneClass(percentage: number): string {
    if (percentage >= 90) return 'bg-rose-50 text-rose-700'
    if (percentage >= 80) return 'bg-orange-50 text-orange-700'
    if (percentage >= 70) return 'bg-amber-50 text-amber-700'
    return 'bg-emerald-50 text-emerald-700'
}

export default function RPEOneRMTable({
    title,
    description,
    className = '',
    defaultOpen = false,
    openText,
    closeText,
    chart = MIKE_TUCHSCHERER_RPE_CHART,
    rpeLevels = MIKE_TUCHSCHERER_RPE_LEVELS,
    repRange = MIKE_TUCHSCHERER_REP_RANGE,
    formatPercentage = (pct) => `${pct.toFixed(1)}%`,
    notes,
    i18nPrefix = 'common.rpeOneRmTable',
    showFormula = true,
}: RPEOneRMTableProps) {
    const { t } = useTranslation('common')
    const [isOpen, setIsOpen] = useState(defaultOpen)

    const resolvedTitle = title ?? t(`${i18nPrefix}.title`)
    const resolvedDescription = description ?? t(`${i18nPrefix}.description`)
    const resolvedOpenText = openText ?? t(`${i18nPrefix}.open`)
    const resolvedCloseText = closeText ?? t(`${i18nPrefix}.close`)

    return (
        <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full px-4 py-3 sm:px-5 sm:py-4 text-left"
                aria-expanded={isOpen}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 sm:text-lg">{resolvedTitle}</h3>
                        <p className="mt-1 text-sm text-gray-600">{resolvedDescription}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-2.5 py-1 text-xs font-semibold text-brand-primary whitespace-nowrap">
                        {isOpen ? resolvedCloseText : resolvedOpenText}
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                </div>
            </button>

            {isOpen && (
                <div className="border-t border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full border-collapse">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th
                                        rowSpan={2}
                                        scope="col"
                                        className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left align-bottom text-xs font-semibold text-gray-600"
                                    >
                                        {t(`${i18nPrefix}.rpeHeader`)}
                                    </th>
                                    <th
                                        colSpan={repRange.length}
                                        scope="colgroup"
                                        className="border-b border-gray-200 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
                                    >
                                        {t(`${i18nPrefix}.repsHeader`)}
                                    </th>
                                </tr>
                                <tr>
                                    {repRange.map((rep) => (
                                        <th
                                            key={rep}
                                            className="border-b border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-600"
                                        >
                                            {rep}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rpeLevels.map((rpe) => {
                                    const rpeKey = toRpeChartKey(rpe)
                                    return (
                                        <tr key={rpeKey} className="border-b border-gray-100 last:border-b-0">
                                            <th
                                                scope="row"
                                                className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-700"
                                            >
                                                {rpeKey}
                                            </th>
                                            {repRange.map((rep) => {
                                                const percentage = chart[rep]?.[rpeKey]
                                                return (
                                                    <td
                                                        key={`${rpeKey}-${rep}`}
                                                        className={`px-3 py-2 text-center text-xs font-semibold ${typeof percentage === 'number'
                                                                ? getCellToneClass(percentage)
                                                                : 'bg-gray-50 text-gray-400'
                                                            }`}
                                                    >
                                                        {typeof percentage === 'number' ? formatPercentage(percentage) : '-'}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {showFormula && (
                        <p className="mt-3 text-xs text-gray-500">
                            {t(`${i18nPrefix}.formula`)}
                        </p>
                    )}
                    {notes?.map((note) => (
                        <p key={note} className="mt-3 text-xs text-gray-500">
                            {note}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}
