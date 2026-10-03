import { Sparkles, Trophy } from 'lucide-react'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import { getNewRecords } from '@/lib/trainer-dashboard/new-records'
import { WidgetCard, WidgetEmpty, WidgetError } from './WidgetCard'
import type { WidgetContext } from './types'

export default async function NewRecordsWidget({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const title = t('trainerDashboard.records.title')
    const icon = <Trophy className="h-5 w-5" />
    const result = await loadWidget('new-records', () => getNewRecords(ctx.trainees, ctx.now))

    if (!result.ok) return <WidgetError title={title} icon={icon} t={t} />

    const items = result.data

    return (
        <WidgetCard title={title} subtitle={t('trainerDashboard.records.subtitle')} icon={icon}>
            {items.length === 0 ? (
                <WidgetEmpty icon={<Sparkles className="h-8 w-8" />} message={t('trainerDashboard.records.empty')} />
            ) : (
                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                <Trophy className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-gray-900">{item.traineeName}</p>
                                <p className="truncate text-sm text-gray-500">{item.exerciseName}</p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="font-semibold text-gray-900">
                                    {t('trainerDashboard.records.value', { weight: item.weight, reps: item.reps })}
                                </p>
                                {item.deltaKg === null ? (
                                    <p className="text-xs text-gray-500">{t('trainerDashboard.records.first')}</p>
                                ) : item.deltaKg > 0 ? (
                                    <p className="text-xs font-semibold text-green-600">
                                        {t('trainerDashboard.records.delta', { delta: item.deltaKg })}
                                    </p>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </WidgetCard>
    )
}
