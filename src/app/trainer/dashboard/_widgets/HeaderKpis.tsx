import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, ClipboardList, Dumbbell, ListChecks, Minus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { KPI_MONTH_DAYS } from '@/lib/trainer-dashboard/constants'
import type { Translate } from '@/lib/trainer-dashboard/i18n'
import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { loadWidget } from '@/lib/trainer-dashboard/load-widget'
import type { WidgetContext } from './types'

function Kpi({
    icon,
    label,
    value,
    delta,
    href,
}: {
    icon: ReactNode
    label: string
    value: ReactNode
    delta?: ReactNode
    href?: string
}) {
    const content = (
        <>
            <p className="flex min-w-0 items-center justify-center gap-2 text-sm text-gray-600" title={label}>
                <span className="shrink-0 text-brand-primary" aria-hidden="true">{icon}</span>
                <span className="truncate">{label}</span>
            </p>
            <p className="mt-2 text-center text-3xl font-bold text-gray-900">{value}</p>
            <div className="mt-1 flex justify-center">{delta}</div>
        </>
    )
    const className = 'block rounded-lg bg-gray-50 px-4 py-3 ring-1 ring-inset ring-gray-200'

    return href ? (
        <Link href={href} className={`${className} transition-colors hover:bg-gray-100 hover:ring-gray-300`}>
            {content}
        </Link>
    ) : (
        <div className={className}>{content}</div>
    )
}

function Delta({ current, previous, days, t }: { current: number; previous: number; days: number; t: Translate }) {
    const delta = current - previous
    const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
    const deltaColor = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'

    return (
        <p className={`flex items-center gap-1 whitespace-nowrap text-sm ${deltaColor}`}>
            <DeltaIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('trainerDashboard.header.kpiDelta', { delta: delta > 0 ? `+${delta}` : String(delta), count: days })}
        </p>
    )
}

export default async function HeaderKpis({ ctx }: { ctx: WidgetContext }) {
    const { t } = ctx
    const result = await loadWidget('header-kpis', () => getHeaderKpis(ctx.trainerId, ctx.trainees, ctx.now))

    if (!result.ok) {
        return (
            <p role="alert" className="mt-6 text-sm text-gray-600">
                {t('trainerDashboard.header.kpiUnavailable')}
            </p>
        )
    }

    const kpis = result.data

    return (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi
                icon={<Users className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiActiveTrainees')}
                href="/trainer/trainees"
                value={`${kpis.activeTrainees} / ${kpis.totalTrainees}`}
                delta={<Delta current={kpis.activeTrainees} previous={kpis.activeTraineesMonthAgo} days={KPI_MONTH_DAYS} t={t} />}
            />
            <Kpi
                icon={<ClipboardList className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiActivePrograms')}
                href="/trainer/programs"
                value={kpis.activePrograms}
                delta={<Delta current={kpis.activePrograms} previous={kpis.activeProgramsMonthAgo} days={KPI_MONTH_DAYS} t={t} />}
            />
            <Kpi
                icon={<Activity className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiSessionsWeek')}
                value={kpis.sessionsThisWeek}
                delta={<Delta current={kpis.sessionsThisWeek} previous={kpis.sessionsLastWeek} days={7} t={t} />}
            />
            <Kpi
                icon={<ListChecks className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiConfirmedSetsWeek')}
                value={kpis.confirmedSetsThisWeek}
                delta={<Delta current={kpis.confirmedSetsThisWeek} previous={kpis.confirmedSetsLastWeek} days={7} t={t} />}
            />
            <Kpi
                icon={<Dumbbell className="h-4 w-4" />}
                label={t('trainerDashboard.header.kpiLibraryExercises')}
                href="/trainer/exercises"
                value={kpis.libraryExercises}
                delta={<Delta current={kpis.libraryExercises} previous={kpis.libraryExercisesMonthAgo} days={KPI_MONTH_DAYS} t={t} />}
            />
        </div>
    )
}
