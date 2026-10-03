'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangle, CalendarCheck, CalendarX } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { remainingLabel, type SubscriptionStatus, type SubscriptionSummary } from '@/lib/subscriptions'

export interface SubscriptionStatusIconProps {
    summary: SubscriptionSummary | null
    /** While the status is unknown (loading or failed) nothing is shown: "no subscription" would be a false claim */
    loading: boolean
    onOpen: () => void
}

const STYLES: Record<SubscriptionStatus, { Icon: typeof AlertTriangle; className: string }> = {
    active: { Icon: CalendarCheck, className: 'bg-green-100 text-green-700 hover:bg-green-200' },
    expiring: { Icon: AlertTriangle, className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
    expired: { Icon: CalendarX, className: 'bg-red-100 text-red-700 hover:bg-red-200' },
    none: { Icon: CalendarX, className: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },
}

/**
 * Subscription status at a glance, next to the Active/Inactive badge in the
 * trainee header. The details live in the tooltip; clicking opens the tab,
 * since touch screens have no hover.
 */
export default function SubscriptionStatusIcon({ summary, loading, onOpen }: SubscriptionStatusIconProps) {
    const { t } = useTranslation('trainer')

    if (loading) return null

    const status: SubscriptionStatus = summary?.status ?? 'none'
    const { Icon, className } = STYLES[status]

    let description = t('subscriptions.badge.none')
    if (summary) {
        const remaining = remainingLabel(summary.daysLeft)
        const badge = t(`subscriptions.badge.${summary.status}`, {
            date: formatDate(summary.endDate),
            days: summary.daysLeft,
        })
        description = `${badge} · ${t(remaining.key, { count: remaining.count })}`
    }

    return (
        <button
            type="button"
            data-status={status}
            title={description}
            aria-label={description}
            onClick={onOpen}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${className}`}
        >
            <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
    )
}
