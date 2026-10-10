'use client'

import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/date-format'
import type { SubscriptionEventRow, SubscriptionEventType } from '@/lib/subscriptions'

export interface SubscriptionEventListProps {
    events: SubscriptionEventRow[]
}

const KNOWN_TYPES: ReadonlySet<string> = new Set<SubscriptionEventType>([
    'period_renewal_created',
    'package_created',
    'renewal_updated',
    'renewal_deleted',
    'credit_consumed',
    'credit_refunded',
    'credit_forfeited',
])

/** details is free-form JSON written at the time of the event: read it defensively. */
function text(details: Record<string, unknown>, field: string): string {
    const value = details[field]
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function formatDelta(delta: number): string {
    // U+2212 minus: same width as the plus sign
    return delta > 0 ? `+${delta}` : `−${-delta}`
}

/** Read-only history of renewals and program-credit movements, newest first. */
export default function SubscriptionEventList({ events }: SubscriptionEventListProps) {
    const { t } = useTranslation('trainer')

    if (events.length === 0) {
        return <p className="px-6 py-8 text-center text-gray-500">{t('subscriptions.events.empty')}</p>
    }

    return (
        <ul className="divide-y divide-gray-200">
            {events.map((event) => {
                const key = KNOWN_TYPES.has(event.type) ? event.type : 'unknown'
                const details = event.details ?? {}
                const delta = event.creditDelta

                return (
                    <li key={event.id} className="flex items-start justify-between gap-4 px-6 py-4">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                                {t(`subscriptions.events.types.${key}`, {
                                    title: text(details, 'programTitle'),
                                    count: Number(text(details, 'programCount')) || 0,
                                    months: text(details, 'durationMonths'),
                                })}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {formatDateTime(event.createdAt)} · {event.actorName}
                            </p>
                        </div>
                        {delta !== null && delta !== 0 && (
                            <span
                                data-testid="event-delta"
                                className={`shrink-0 text-sm font-semibold ${delta > 0 ? 'text-green-700' : 'text-red-700'}`}
                            >
                                {formatDelta(delta)}
                            </span>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
