import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, UserPlus } from 'lucide-react'
import { formatLongDate, greetingKey } from '@/lib/trainer-dashboard/i18n'
import HeaderKpis from './HeaderKpis'
import type { WidgetContext } from './types'

function KpiSkeleton() {
    return (
        <div className="mt-6 grid grid-cols-3 gap-4" aria-hidden="true">
            {[0, 1, 2].map((index) => (
                <div key={index} className="h-24 animate-pulse rounded-lg bg-white/10" />
            ))}
        </div>
    )
}

export default function DashboardHeader({ ctx, firstName }: { ctx: WidgetContext; firstName: string }) {
    const { t } = ctx

    return (
        <header className="rounded-xl bg-gray-900 p-6 text-white shadow-md">
            <div className="flex items-start justify-between gap-6">
                <div>
                    <p className="text-sm text-gray-400 first-letter:uppercase">{formatLongDate(ctx.now, ctx.locale)}</p>
                    <h1 className="mt-1 text-3xl font-bold">{t(greetingKey(ctx.now), { firstName })}</h1>
                </div>
                <div className="flex shrink-0 gap-3">
                    <Link
                        href="/trainer/programs/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-semibold text-gray-900 transition-colors hover:bg-brand-primary-hover"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.newProgram')}
                    </Link>
                    <Link
                        href="/trainer/trainees/new"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/10"
                    >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        {t('trainerDashboard.header.newTrainee')}
                    </Link>
                </div>
            </div>
            <Suspense fallback={<KpiSkeleton />}>
                <HeaderKpis ctx={ctx} />
            </Suspense>
        </header>
    )
}
