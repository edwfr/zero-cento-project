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
}: RPEOneRMTableProps) {
    const { t } = useTranslation('common')
    const [isOpen, setIsOpen] = useState(defaultOpen)

    const resolvedTitle = title ?? t('common.rpeOneRmTable.title')
    const resolvedDescription = description ?? t('common.rpeOneRmTable.description')
    const resolvedOpenText = openText ?? t('common.rpeOneRmTable.open')
    const resolvedCloseText = closeText ?? t('common.rpeOneRmTable.close')

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
                                    <th className="sticky left-0 z-10 bg-gray-50 border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600">
                                        {t('common.rpeOneRmTable.rpeHeader')}
                                    </th>
                                    {MIKE_TUCHSCHERER_REP_RANGE.map((rep) => (
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
                                {MIKE_TUCHSCHERER_RPE_LEVELS.map((rpe) => {
                                    const rpeKey = toRpeChartKey(rpe)
                                    return (
                                        <tr key={rpeKey} className="border-b border-gray-100 last:border-b-0">
                                            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                                {rpeKey}
                                            </th>
                                            {MIKE_TUCHSCHERER_REP_RANGE.map((rep) => {
                                                const percentage = MIKE_TUCHSCHERER_RPE_CHART[rep]?.[rpeKey]
                                                return (
                                                    <td
                                                        key={`${rpeKey}-${rep}`}
                                                        className={`px-3 py-2 text-center text-xs font-semibold ${typeof percentage === 'number'
                                                                ? getCellToneClass(percentage)
                                                                : 'bg-gray-50 text-gray-400'
                                                            }`}
                                                    >
                                                        {typeof percentage === 'number' ? `${percentage.toFixed(1)}%` : '-'}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-3 text-xs text-gray-500">
                        {t('common.rpeOneRmTable.formula')}
                    </p>
                </div>
            )}
        </div>
    )
}
