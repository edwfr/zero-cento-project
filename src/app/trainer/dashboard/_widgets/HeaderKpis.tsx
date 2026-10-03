import type { ReactNode } from 'react'
import { Activity, ClipboardList, Minus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import type { WidgetContext } from './types'

function Kpi({ icon, label, value, footer }: { icon: ReactNode; label: string; value: ReactNode; footer?: ReactNode }) {
    return (
        <div className="rounded-lg bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
            <p className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-brand-primary" aria-hidden="true">{icon}</span>
                {label}
            </p>
            <p className="mt-1 text-3xl font-bold text-white">{value}</p>
            {footer}
        </div>
    )
}

export default async function HeaderKpis({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const result = await loadWidget('header-kpis', () => getHeaderKpis(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) {
        return (
            <p role="alert" className="mt-6 text-sm text-gray-300">
                {t('trainerDashboard.header.kpiUnavailable')}
            </p>
        )
    }

    const kpis = result.data
    const delta = kpis.sessionsThisWeek - kpis.sessionsLastWeek
    const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
    const deltaColor = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'

    return (
        <div className="mt-6 grid grid-cols-3 gap-4">
            <Kpi
                icon={<Users className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiActiveTrainees')}
                value={`${kpis.activeTrainees} / ${kpis.totalTrainees}`}
            />
            <Kpi
                icon={<ClipboardList className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiActivePrograms')}
                value={kpis.activePrograms}
            />
            <Kpi
                icon={<Activity className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiSessionsWeek')}
                value={kpis.sessionsThisWeek}
                footer={
                    <p className={`mt-1 flex items-center gap-1 text-sm ${deltaColor}`}>
                        <DeltaIcon className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.kpiSessionsDelta', { delta: delta > 0 ? `+${delta}` : String(delta) })}
                    </p>
                }
            />
        </div>
    )
}
