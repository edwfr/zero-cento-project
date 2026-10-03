import Link from 'next/link'
import { ChevronRight, CircleCheck, UserX } from 'lucide-react'
import { getInactiveTrainees } from '@/lib/trainer-dashboard/inactive-trainees'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { Avatar, WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function InactiveTraineesWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.inactive.title')
    const icon = <UserX className="h-5 w-5" />
    const result = await loadWidget('inactive-trainees', () => getInactiveTrainees(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const { items, total } = result.data
    const hidden = total - items.length

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.inactive.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<CircleCheck className="h-8 w-8 text-green-500" />} message={t('trainerDashboard.inactive.empty')} />
            ) : (
                <>
                    <ul className="-mx-2 space-y-1">
                        {items.map((item) => (
                            <li key={item.traineeId}>
                                <Link
                                    href={`/trainer/trainees/${item.traineeId}`}
                                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                                >
                                    <Avatar label={item.initials} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-gray-900">{item.traineeName}</p>
                                        <p className="text-sm text-gray-500">
                                            {item.daysSinceLastSession === null
                                                ? t('trainerDashboard.inactive.never')
                                                : t('trainerDashboard.inactive.lastSession', { count: item.daysSinceLastSession })}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {hidden > 0 && (
                        <Link href="/trainer/trainees" className="mt-3 inline-block text-sm font-semibold text-gray-700 hover:text-gray-900">
                            {t('trainerDashboard.widget.moreItems', { count: hidden })}
                        </Link>
                    )}
                </>
            )}
        </WidgetCard>
    )
}
