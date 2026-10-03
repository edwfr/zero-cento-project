import Link from 'next/link'
import { Activity, Trophy } from 'lucide-react'
import { getActivityFeed, type ActivityItem } from '@/lib/trainer-dashboard/activity-feed'
import { formatDayLabel, formatRelative } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { Avatar, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

function groupByDay(items: ActivityItem[]): [string, ActivityItem[]][] {
    const groups = new Map<string, ActivityItem[]>()
    for (const item of items) {
        groups.set(item.day, [...(groups.get(item.day) ?? []), item])
    }
    return [...groups.entries()]
}

export default async function ActivityFeedWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.feed.title')
    const icon = <Activity className="h-5 w-5" />
    const result = await loadWidget('activity-feed', () => getActivityFeed(ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<Activity className="h-8 w-8" />} message={t('trainerDashboard.feed.empty')} />
            ) : (
                <div className="space-y-5">
                    {groupByDay(items).map(([day, dayItems]) => (
                        <section key={day}>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {formatDayLabel(day, ctx.now, ctx.locale, t)}
                            </h3>
                            <ul className="-mx-2 grid grid-cols-1 gap-1 lg:grid-cols-2">
                                {dayItems.map((item) => (
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
                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                                    <Trophy className="h-3 w-3" aria-hidden="true" />
                                                    {t('trainerDashboard.feed.record')}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </WidgetCard>
    )
}
