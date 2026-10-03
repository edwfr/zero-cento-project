'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import SubscriptionStatusBadge from '@/components/SubscriptionStatusBadge'
import { formatDate } from '@/lib/date-format'
import {
    needsAttention,
    remainingLabel,
    type SubscriptionOverview,
    type SubscriptionOverviewItem,
    type SubscriptionStatus,
} from '@/lib/subscriptions'

export interface TrainerSubscriptionsContentProps {
    overview: SubscriptionOverview
}

const COUNTERS: { key: SubscriptionStatus; className: string }[] = [
    { key: 'expired', className: 'border-red-200 bg-red-50 text-red-800' },
    { key: 'expiring', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    { key: 'active', className: 'border-green-200 bg-green-50 text-green-800' },
    { key: 'none', className: 'border-gray-200 bg-gray-50 text-gray-700' },
]

function SubscriptionRow({ item }: { item: SubscriptionOverviewItem }) {
    const { t } = useTranslation('trainer')
    const { subscription } = item
    const remaining = subscription ? remainingLabel(subscription.daysLeft) : null

    return (
        <li>
            <Link
                href={`/trainer/trainees/${item.traineeId}?tab=subscription`}
                className={`flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-gray-50 md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:items-center md:gap-4 md:px-6 ${
                    needsAttention(subscription) ? 'bg-amber-50/40' : ''
                }`}
            >
                <span className="font-semibold text-gray-900">
                    {item.firstName} {item.lastName}
                </span>
                <span>
                    <SubscriptionStatusBadge summary={subscription} />
                </span>
                <span className="text-sm text-gray-700">{subscription ? formatDate(subscription.endDate) : '—'}</span>
                <span className="text-sm text-gray-600">
                    {remaining ? t(remaining.key, { count: remaining.count }) : '—'}
                </span>
                <ChevronRight className="hidden h-4 w-4 text-gray-400 md:block" aria-hidden="true" />
            </Link>
        </li>
    )
}

function ColumnHeader() {
    const { t } = useTranslation('trainer')
    return (
        <div className="hidden bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:gap-4">
            <span>{t('subscriptions.page.athleteColumn')}</span>
            <span>{t('subscriptions.page.statusColumn')}</span>
            <span>{t('subscriptions.page.endColumn')}</span>
            <span>{t('subscriptions.page.remainingColumn')}</span>
            <span className="w-4" />
        </div>
    )
}

export default function TrainerSubscriptionsContent({ overview }: TrainerSubscriptionsContentProps) {
    const { t } = useTranslation('trainer')
    const { withSubscription, withoutSubscription, counts } = overview
    const hasTrainees = withSubscription.length + withoutSubscription.length > 0

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{t('subscriptions.page.title')}</h1>
                    <p className="mt-2 text-gray-600">{t('subscriptions.page.description')}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {COUNTERS.map(({ key, className }) => (
                        <div key={key} data-testid={`subscription-counter-${key}`} className={`rounded-lg border p-4 ${className}`}>
                            <p className="text-sm font-semibold">{t(`subscriptions.page.counters.${key}`)}</p>
                            <p className="mt-1 text-3xl font-bold">{counts[key]}</p>
                        </div>
                    ))}
                </div>

                {!hasTrainees ? (
                    <div className="rounded-lg bg-white p-12 text-center text-gray-500 shadow-md">
                        {t('subscriptions.page.empty')}
                    </div>
                ) : (
                    <>
                        <section className="overflow-hidden rounded-lg bg-white shadow-md">
                            <h2 id="subscriptions-list-title" className="px-6 pt-6 pb-4 text-lg font-semibold text-gray-900">
                                {t('subscriptions.page.listTitle')}
                            </h2>
                            {withSubscription.length === 0 ? (
                                <p className="px-6 pb-6 text-gray-500">{t('subscriptions.page.listEmpty')}</p>
                            ) : (
                                <>
                                    <ColumnHeader />
                                    <ul aria-labelledby="subscriptions-list-title" className="divide-y divide-gray-200">
                                        {withSubscription.map((item) => (
                                            <SubscriptionRow key={item.traineeId} item={item} />
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>

                        <section className="overflow-hidden rounded-lg bg-white shadow-md">
                            <h2 id="subscriptions-none-title" className="px-6 pt-6 pb-4 text-lg font-semibold text-gray-900">
                                {t('subscriptions.page.noneTitle')}
                            </h2>
                            {withoutSubscription.length === 0 ? (
                                <p className="px-6 pb-6 text-gray-500">{t('subscriptions.page.noneEmpty')}</p>
                            ) : (
                                <ul aria-labelledby="subscriptions-none-title" className="divide-y divide-gray-200">
                                    {withoutSubscription.map((item) => (
                                        <SubscriptionRow key={item.traineeId} item={item} />
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    )
}
