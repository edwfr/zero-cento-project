'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangle, CalendarCheck, CalendarX } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { remainingLabel, type SubscriptionStatus, type SubscriptionSummary } from '@/lib/subscriptions'

export interface SubscriptionStatusIconProps {
    summary: SubscriptionSummary | null
    /** While the status is unknown (loading or failed) nothing is shown: "no subscription" would be a false claim */
    loading?: boolean
    size?: 'sm' | 'md'
}

const STYLES: Record<SubscriptionStatus, { Icon: typeof AlertTriangle; className: string }> = {
    active: { Icon: CalendarCheck, className: 'bg-green-100 text-green-700 hover:bg-green-200' },
    expiring: { Icon: AlertTriangle, className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
    expired: { Icon: CalendarX, className: 'bg-red-100 text-red-700 hover:bg-red-200' },
    none: { Icon: CalendarX, className: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },
}

const SIZES = {
    sm: { circle: 'h-7 w-7', icon: 'h-4 w-4' },
    md: { circle: 'h-9 w-9', icon: 'h-5 w-5' },
}

/**
 * Subscription status at a glance, next to the Active/Inactive badge.
 * Informative only, like that badge: the details live in the tooltip.
 */
export default function SubscriptionStatusIcon({ summary, loading = false, size = 'md' }: SubscriptionStatusIconProps) {
    const { t } = useTranslation('trainer')

    if (loading) return null

    const status: SubscriptionStatus = summary?.status ?? 'none'
    const { Icon, className } = STYLES[status]
    const { circle, icon } = SIZES[size]

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
        <span
            role="img"
            data-status={status}
            title={description}
            aria-label={description}
            className={`inline-flex shrink-0 cursor-default items-center justify-center rounded-full transition-colors ${circle} ${className}`}
        >
            <Icon className={icon} aria-hidden="true" />
        </span>
    )
}
