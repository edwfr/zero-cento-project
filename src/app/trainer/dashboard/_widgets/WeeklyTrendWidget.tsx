import { ChartColumn, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { formatShortDay } from '@/lib/trainer-dashboard/i18n'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getWeeklyTrend } from '@/lib/trainer-dashboard/weekly-trend'
import WeeklyTrendChart from './WeeklyTrendChart'
import { WidgetCard, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function WeeklyTrendWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.trend.title')
    const icon = <ChartColumn className="h-5 w-5" />
    const result = await loadWidget('weekly-trend', () => getWeeklyTrend(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const weeks = result.data
    const current = weeks[weeks.length - 1]
    const previous = weeks[weeks.length - 2]
    const delta = current.sessions - previous.sessions
    const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
    const deltaColor = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'

    return (
        <WidgetCard title={title} icon={icon}>
            <div className="mb-3 flex items-baseline gap-3">
                <p className="text-sm font-semibold text-gray-900">
                    {t('trainerDashboard.trend.summary', { count: current.sessions })}
                </p>
                <p className={`flex items-center gap-1 text-sm ${deltaColor}`}>
                    <DeltaIcon className="h-4 w-4" aria-hidden="true" />
                    {t('trainerDashboard.trend.delta', { delta: delta > 0 ? `+${delta}` : String(delta) })}
                </p>
            </div>
            <WeeklyTrendChart
                data={weeks.map((week) => ({
                    label: formatShortDay(new Date(`${week.weekStart}T00:00:00.000Z`), ctx.locale),
                    sessions: week.sessions,
                    volumeKg: week.volumeKg,
                }))}
                sessionsLabel={t('trainerDashboard.trend.sessions')}
                volumeLabel={t('trainerDashboard.trend.volume')}
            />
        </WidgetCard>
    )
}
