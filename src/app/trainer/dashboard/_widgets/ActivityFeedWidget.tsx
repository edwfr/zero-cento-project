import Link from 'next/link'
import { Activity, Trophy } from 'lucide-react'
import { getActivityFeed } from '@/lib/trainer-dashboard/activity-feed'
import { WIDGET_PAGE_SIZE } from '@/lib/trainer-dashboard/constants'
import { formatRelative } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import PaginatedList from './PaginatedList'
import { Avatar, CountBadge, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function ActivityFeedWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.feed.title')
    const icon = <Activity className="h-5 w-5" />
    const result = await loadWidget('activity-feed', () => getActivityFeed(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} icon={icon} action={items.length > 0 && <CountBadge count={items.length} />}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<Activity className="h-8 w-8" />} message={t('trainerDashboard.feed.empty')} />
            ) : (
                <PaginatedList
                    pageSize={WIDGET_PAGE_SIZE}
                    previousLabel={t('trainerDashboard.widget.previousPage')}
                    nextLabel={t('trainerDashboard.widget.nextPage')}
                    items={items.map((item) => (
                        <li key={item.key}>
                            <Link
                                href={`/trainer/programs/${item.programId}`}
                                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                            >
                                <Avatar label={item.initials} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-gray-700">
                                        <span className="font-semibold text-gray-900">{item.traineeName}</span>{' '}
                                        {t('trainerDashboard.feed.entry', { day: item.dayIndex, week: item.weekNumber })}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {t('trainerDashboard.feed.exercises', { count: item.exerciseCount })} ·{' '}
                                        {formatRelative(item.lastLoggedAt, ctx.now, t)}
                                    </p>
                                </div>
                                {item.hasRecord && (
                                    <span
                                        className="inline-flex shrink-0 items-center rounded-full bg-amber-50 p-1.5 text-amber-700"
                                        title={t('trainerDashboard.feed.record')}
                                    >
                                        <Trophy className="h-3.5 w-3.5" aria-label={t('trainerDashboard.feed.record')} />
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                />
            )}
        </WidgetCard>
    )
}
