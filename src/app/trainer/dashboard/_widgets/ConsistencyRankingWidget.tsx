import { Medal, Users } from 'lucide-react'
import ProgressBar from '@/components/ProgressBar'
import { getConsistencyRanking } from '@/lib/trainer-dashboard/consistency-ranking'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-700']

export default async function ConsistencyRankingWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.consistency.title')
    const icon = <Medal className="h-5 w-5" />
    const result = await loadWidget('consistency-ranking', () => getConsistencyRanking(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.consistency.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<Users className="h-8 w-8" />} message={t('trainerDashboard.consistency.empty')} />
            ) : (
                <ol className="space-y-4">
                    {items.map((item, index) => (
                        <li key={item.traineeId} className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold text-gray-500">
                                {index < MEDAL_COLORS.length ? (
                                    <Medal className={`h-6 w-6 ${MEDAL_COLORS[index]}`} aria-hidden="true" data-testid={`medal-${index + 1}`} />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <ProgressBar
                                current={Math.min(item.sessions, item.expected)}
                                total={item.expected}
                                label={`${item.traineeName} · ${t('trainerDashboard.consistency.sessions', { done: item.sessions, expected: item.expected })}`}
                                labelClassName="text-sm text-gray-700"
                                size="sm"
                                color={item.adherence >= 0.8 ? 'success' : item.adherence >= 0.5 ? 'warning' : 'danger'}
                                className="min-w-0 flex-1"
                            />
                        </li>
                    ))}
                </ol>
            )}
        </WidgetCard>
    )
}
