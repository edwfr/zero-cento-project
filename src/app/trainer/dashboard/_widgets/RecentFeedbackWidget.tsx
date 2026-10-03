import Link from 'next/link'
import { MessageSquareText } from 'lucide-react'
import { formatRelative } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getRecentFeedback } from '@/lib/trainer-dashboard/recent-feedback'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function RecentFeedbackWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.feedback.title')
    const icon = <MessageSquareText className="h-5 w-5" />
    const result = await loadWidget('recent-feedback', () => getRecentFeedback(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.feedback.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<MessageSquareText className="h-8 w-8" />} message={t('trainerDashboard.feedback.empty')} />
            ) : (
                <ul className="-mx-2 divide-y divide-gray-100">
                    {items.map((item) => (
                        <li key={item.id}>
                            <Link href={`/trainer/programs/${item.programId}`} className="block rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="min-w-0 truncate text-sm">
                                        <span className="font-semibold text-gray-900">{item.traineeName}</span>
                                        <span className="text-gray-500"> · {item.exerciseName}</span>
                                    </p>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {item.rpe !== null && (
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    item.isHighRpe ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                                }`}
                                            >
                                                {t('trainerDashboard.feedback.rpe', { value: item.rpe })}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">{formatRelative(item.loggedAt, ctx.now, t)}</span>
                                    </div>
                                </div>
                                {item.note && <p className="mt-1 line-clamp-2 text-sm text-gray-700">{item.note}</p>}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </WidgetCard>
    )
}
