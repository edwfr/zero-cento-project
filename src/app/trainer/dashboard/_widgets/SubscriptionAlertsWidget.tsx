import Link from 'next/link'
import { CalendarClock, CalendarX, ChevronRight, CircleCheck } from 'lucide-react'
import { WIDGET_PAGE_SIZE } from '@/lib/trainer-dashboard/constants'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getSubscriptionAlerts, type SubscriptionAlert } from '@/lib/trainer-dashboard/subscription-alerts'
import PaginatedList from './PaginatedList'
import { CountBadge, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

const STATUS_STYLE: Record<SubscriptionAlert['status'], { icon: typeof CalendarX; className: string }> = {
    expired: { icon: CalendarX, className: 'bg-red-50 text-red-600' },
    expiring: { icon: CalendarClock, className: 'bg-orange-50 text-orange-600' },
}

export default async function SubscriptionAlertsWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.subscriptionAlerts.title')
    const icon = <CalendarClock className="h-5 w-5" />
    const result = await loadWidget('subscription-alerts', () => getSubscriptionAlerts(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} icon={icon} action={items.length > 0 && <CountBadge count={items.length} />}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<CircleCheck className="h-8 w-8 text-green-500" />} message={t('trainerDashboard.subscriptionAlerts.empty')} />
            ) : (
                <PaginatedList
                    pageSize={WIDGET_PAGE_SIZE}
                    previousLabel={t('trainerDashboard.widget.previousPage')}
                    nextLabel={t('trainerDashboard.widget.nextPage')}
                    items={items.map((item) => {
                        const { icon: Icon, className } = STATUS_STYLE[item.status]

                        return (
                            <li key={item.traineeId}>
                                <Link href="/trainer/subscriptions" className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`}>
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900">{item.traineeName}</p>
                                        <p className="text-sm text-gray-600">
                                            {t(`trainerDashboard.subscriptionAlerts.${item.status}`, { count: item.days })}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                                </Link>
                            </li>
                        )
                    })}
                />
            )}
        </WidgetCard>
    )
}
