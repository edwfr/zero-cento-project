'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangle, CalendarCheck, CalendarX } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { summaryLabel, type SubscriptionStatus, type SubscriptionSummary } from '@/lib/subscriptions'

export interface SubscriptionStatusBadgeProps {
    summary: SubscriptionSummary | null
    /** List mode: show only statuses that need action (expiring / expired). */
    compact?: boolean
}

const STYLES: Record<SubscriptionStatus, string> = {
    expiring: 'bg-amber-100 text-amber-800',
    expired: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    none: 'bg-gray-100 text-gray-600',
}

const ICONS: Record<SubscriptionStatus, typeof AlertTriangle> = {
    expiring: AlertTriangle,
    expired: CalendarX,
    active: CalendarCheck,
    none: CalendarX,
}

export default function SubscriptionStatusBadge({ summary, compact = false }: SubscriptionStatusBadgeProps) {
    const { t } = useTranslation('trainer')
    const status: SubscriptionStatus = summary?.status ?? 'none'

    if (compact && (status === 'active' || status === 'none')) return null

    const Icon = ICONS[status]
    let label = t('subscriptions.badge.none')
    if (summary) {
        const { key, count, date } = summaryLabel(summary)
        label = t(key, { count, days: count, date: date ? formatDate(date) : undefined })
    }

    return (
        <span
            data-status={status}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${STYLES[status]}`}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{label}</span>
        </span>
    )
}
