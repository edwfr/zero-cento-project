'use client'

import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/Button'
import { formatDate } from '@/lib/date-format'
import { needsAttention, programsLabel, remainingLabel, type SubscriptionSummary } from '@/lib/subscriptions'

export interface SubscriptionAlertBannerProps {
    summary: SubscriptionSummary | null
    onManage: () => void
}

/** Shown under the trainee header on every tab, only when action is needed. */
export default function SubscriptionAlertBanner({ summary, onManage }: SubscriptionAlertBannerProps) {
    const { t } = useTranslation('trainer')

    if (!summary || !needsAttention(summary)) return null

    const expired = summary.status === 'expired'
    let message: string
    if (summary.kind === 'programs') {
        const label = programsLabel(summary.remaining)
        message = t(label.key, { count: label.count })
    } else {
        const date = formatDate(summary.endDate)
        const remaining = remainingLabel(summary.daysLeft)
        message = expired
            ? t('subscriptions.banner.expired', { date })
            : t('subscriptions.banner.expiring', { date, remaining: t(remaining.key, { count: remaining.count }) })
    }

    return (
        <div
            role="alert"
            className={`mb-6 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                expired ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
        >
            <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {message}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={onManage}>
                {t('subscriptions.banner.manage')}
            </Button>
        </div>
    )
}
