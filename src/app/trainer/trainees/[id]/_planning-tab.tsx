'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import MacroPeriodFormModal, { type MacroPeriodFormValues } from '@/components/MacroPeriodFormModal'
import type { MacroPeriodTimelineProps } from '@/components/MacroPeriodTimeline'
import { useNavigationLoader } from '@/components/NavigationLoadingProvider'
import { SkeletonDetail } from '@/components/Skeleton'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import {
    VIEW_SPAN_MS,
    WEEK_MS,
    dayToLocalMs,
    findOverlap,
    localMsToDay,
    weekStartOf,
    type DayRange,
    type MacroPeriodDto,
    type MacroPhaseTypeDto,
    type PlanProgramDto,
    type TimelineView,
} from '@/lib/macro-periods'

// Client-only and split out: the timeline library touches the DOM at import time and is heavy
const MacroPeriodTimeline = dynamic<MacroPeriodTimelineProps>(() => import('@/components/MacroPeriodTimeline'), {
    ssr: false,
    loading: () => <SkeletonDetail />,
})

const VIEW_STORAGE_KEY = 'zc.planning.view'

/** How far one press of previous/next moves the window. */
const NAV_STEP_MS: Record<TimelineView, number> = { weeks: 4 * WEEK_MS, month: 13 * WEEK_MS }

/** Weeks shown before the current one, so "now" is not glued to the left edge. */
const LEAD_IN_MS: Record<TimelineView, number> = { weeks: 2 * WEEK_MS, month: 8 * WEEK_MS }

function readStoredView(): TimelineView {
    try {
        return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'month' ? 'month' : 'weeks'
    } catch {
        return 'weeks'
    }
}

function storeView(view: TimelineView) {
    try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, view)
    } catch {
        // storage unavailable (private mode): the choice simply is not remembered
    }
}

function rangeAroundToday(view: TimelineView) {
    const start = dayToLocalMs(weekStartOf(localMsToDay(Date.now()))) - LEAD_IN_MS[view]
    return { start, end: start + VIEW_SPAN_MS[view] }
}

const byStartDate = (a: MacroPeriodDto, b: MacroPeriodDto) => a.startDate.localeCompare(b.startDate)

type DialogState =
    | { mode: 'create'; initial: Partial<MacroPeriodFormValues> }
    | { mode: 'edit'; periodId: string; initial: MacroPeriodFormValues }

export interface PlanningTabProps {
    traineeId: string
}

/**
 * Trainer-only tab, default view of a trainee: the long-term plan as macro
 * periods on an editable timeline, with the trainee's programs underneath.
 */
export default function PlanningTab({ traineeId }: PlanningTabProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()
    const router = useRouter()
    const navigation = useNavigationLoader()

    const [periods, setPeriods] = useState<MacroPeriodDto[]>([])
    const [programs, setPrograms] = useState<PlanProgramDto[]>([])
    const [phaseTypes, setPhaseTypes] = useState<MacroPhaseTypeDto[]>([])
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)

    // 'weeks' on the first render (server and client agree), stored choice applied after mount
    const [view, setView] = useState<TimelineView>('weeks')
    const [visibleRange, setVisibleRange] = useState(() => rangeAroundToday('weeks'))

    const [draft, setDraft] = useState<DayRange | null>(null)
    const [dialog, setDialog] = useState<DialogState | null>(null)
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)

    const load = useCallback(async () => {
        try {
            setLoading(true)
            const [planRes, phasesRes] = await Promise.all([
                fetch(`/api/trainer/trainees/${traineeId}/macro-periods`),
                fetch('/api/macro-phase-types'),
            ])
            const [plan, phases] = await Promise.all([planRes.json(), phasesRes.json()])
            if (!planRes.ok || !phasesRes.ok) throw new Error('load failed')

            setPeriods(plan.data.periods)
            setPrograms(plan.data.programs)
            setPhaseTypes(phases.data.items)
            setLoadFailed(false)
        } catch {
            setLoadFailed(true)
        } finally {
            setLoading(false)
        }
    }, [traineeId])

    useEffect(() => {
        void load()
    }, [load])

    useEffect(() => {
        const stored = readStoredView()
        if (stored === 'weeks') return
        setView(stored)
        setVisibleRange((current) => ({ start: current.start, end: current.start + VIEW_SPAN_MS[stored] }))
    }, [])

    /** Sends a write; resolves to `data`, throws an Error carrying the translated message. */
    const send = async (url: string, method: string, body: unknown, fallbackKey: string) => {
        const res = await fetch(url, {
            method,
            ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(getApiErrorMessage(json, t(fallbackKey), t))
        return json.data
    }

    const closeDialog = () => {
        setDialog(null)
        setDialogError(null)
        setDraft(null)
    }

    const handleViewChange = (next: TimelineView) => {
        setView(next)
        storeView(next)
        setVisibleRange((current) => ({ start: current.start, end: current.start + VIEW_SPAN_MS[next] }))
    }

    const shiftWindow = (direction: -1 | 1) =>
        setVisibleRange((current) => ({
            start: current.start + direction * NAV_STEP_MS[view],
            end: current.end + direction * NAV_STEP_MS[view],
        }))

    const handleDraftCommit = (range: DayRange) => {
        setDraft(range)
        setDialogError(null)
        setDialog({ mode: 'create', initial: range })
    }

    const handlePeriodClick = (id: string) => {
        const period = periods.find((item) => item.id === id)
        if (!period) return
        setDialogError(null)
        setDialog({
            mode: 'edit',
            periodId: id,
            initial: {
                phaseTypeId: period.phaseType.id,
                startDate: period.startDate,
                endDate: period.endDate,
                note: period.note,
            },
        })
    }

    /** A drag: show it at once, save it, put the bar back if the server refuses. */
    const handlePeriodChange = async (id: string, range: DayRange) => {
        const previous = periods
        setPeriods((current) => current.map((item) => (item.id === id ? { ...item, ...range } : item)).sort(byStartDate))
        try {
            await send(`/api/macro-periods/${id}`, 'PATCH', range, 'planning.saveError')
        } catch (err) {
            setPeriods(previous)
            showToast(err instanceof Error ? err.message : t('planning.saveError'), 'error')
        }
    }

    const handleSubmit = async (values: MacroPeriodFormValues) => {
        if (!dialog) return
        const editedId = dialog.mode === 'edit' ? dialog.periodId : undefined

        // Same rule as the server: do not send a request that is going to be refused
        if (findOverlap(values, periods, editedId)) {
            setDialogError(t('errors:macroPeriod.overlap'))
            return
        }

        setSaving(true)
        setDialogError(null)
        try {
            if (editedId) {
                const data = await send(`/api/macro-periods/${editedId}`, 'PATCH', values, 'planning.saveError')
                setPeriods((current) => current.map((item) => (item.id === editedId ? data.period : item)).sort(byStartDate))
            } else {
                const data = await send(`/api/trainer/trainees/${traineeId}/macro-periods`, 'POST', values, 'planning.saveError')
                setPeriods((current) => [...current, data.period].sort(byStartDate))
            }
            closeDialog()
        } catch (err) {
            // The dialog stays open: the trainer can pick another phase or range
            setDialogError(err instanceof Error ? err.message : t('planning.saveError'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (dialog?.mode !== 'edit') return
        const { periodId } = dialog
        setSaving(true)
        try {
            await send(`/api/macro-periods/${periodId}`, 'DELETE', undefined, 'planning.deleteError')
            setPeriods((current) => current.filter((item) => item.id !== periodId))
            setConfirmingDelete(false)
            closeDialog()
        } catch (err) {
            setConfirmingDelete(false)
            setDialogError(err instanceof Error ? err.message : t('planning.deleteError'))
        } finally {
            setSaving(false)
        }
    }

    const handleProgramClick = (id: string) => {
        navigation.start()
        router.push(`/trainer/programs/${id}`)
    }

    // Legend: what the trainer can assign, plus archived phases this plan still shows
    const legendPhases = useMemo(() => {
        const usedIds = new Set(periods.map((period) => period.phaseType.id))
        return phaseTypes.filter((phase) => phase.isActive || usedIds.has(phase.id))
    }, [phaseTypes, periods])

    const labels = useMemo(
        () => ({ phases: t('planning.rowPhases'), programs: t('planning.rowPrograms'), draft: t('planning.draft') }),
        [t]
    )

    const viewButtonClass = (active: boolean) =>
        active ? 'bg-brand-primary text-white hover:bg-brand-primary-hover' : ''

    if (loading) return <SkeletonDetail />

    if (loadFailed) {
        return (
            <div className="space-y-3">
                <p className="text-state-error">{t('planning.loadError')}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                    {t('common:common.retry')}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">{t('planning.title')}</h2>
                    <p className="text-sm text-gray-600">{t('planning.subtitle')}</p>
                </div>
                <Button type="button" icon={<Plus size={16} />} onClick={() => setDialog({ mode: 'create', initial: {} })}>
                    {t('planning.newPeriod')}
                </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-pressed={view === 'weeks'}
                        className={viewButtonClass(view === 'weeks')}
                        onClick={() => handleViewChange('weeks')}
                    >
                        {t('planning.viewWeeks')}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-pressed={view === 'month'}
                        className={viewButtonClass(view === 'month')}
                        onClick={() => handleViewChange('month')}
                    >
                        {t('planning.viewMonth')}
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" aria-label={t('planning.previous')} onClick={() => shiftWindow(-1)}>
                        <ChevronLeft size={16} />
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setVisibleRange(rangeAroundToday(view))}>
                        {t('planning.today')}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" aria-label={t('planning.next')} onClick={() => shiftWindow(1)}>
                        <ChevronRight size={16} />
                    </Button>
                </div>
            </div>

            <MacroPeriodTimeline
                periods={periods}
                programs={programs}
                view={view}
                visibleStart={visibleRange.start}
                visibleEnd={visibleRange.end}
                draft={draft}
                labels={labels}
                onVisibleRangeChange={(start, end) => setVisibleRange({ start, end })}
                onDraftChange={setDraft}
                onDraftCommit={handleDraftCommit}
                onPeriodChange={(id, range) => void handlePeriodChange(id, range)}
                onPeriodConflict={() => showToast(t('planning.overlapToast'), 'warning')}
                onPeriodClick={handlePeriodClick}
                onProgramClick={handleProgramClick}
            />

            <p className="text-xs text-gray-500">{periods.length === 0 ? t('planning.empty') : t('planning.dragHint')}</p>

            <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">{t('planning.legend')}</h3>
                    <Link href="/profile" className="text-sm font-semibold text-brand-primary hover:underline">
                        {t('planning.managePhases')}
                    </Link>
                </div>
                <ul aria-label={t('planning.legend')} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {legendPhases.map((phase) => (
                        <li key={phase.id} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2">
                            <span
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-gray-300"
                                style={{ backgroundColor: phase.color }}
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                    {phase.name}
                                    {!phase.isActive && (
                                        <span className="ml-2 text-xs font-normal text-gray-500">{t('planning.archivedPhase')}</span>
                                    )}
                                </p>
                                {phase.description && <p className="text-xs text-gray-500">{phase.description}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {dialog && (
                <MacroPeriodFormModal
                    // a fresh form for each opening: its fields are initialised once, from `initial`
                    key={dialog.mode === 'edit' ? dialog.periodId : `new:${dialog.initial.startDate ?? ''}`}
                    mode={dialog.mode}
                    initial={dialog.initial}
                    phaseTypes={phaseTypes}
                    isSaving={saving}
                    error={dialogError}
                    onClose={closeDialog}
                    onSubmit={(values) => void handleSubmit(values)}
                    onDelete={dialog.mode === 'edit' ? () => setConfirmingDelete(true) : undefined}
                />
            )}

            <ConfirmationModal
                isOpen={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                onConfirm={() => void handleDelete()}
                title={t('planning.deleteConfirmTitle')}
                message={t('planning.deleteConfirmMessage')}
                confirmText={t('planning.deleteConfirm')}
                variant="danger"
                isLoading={saving}
            />
        </div>
    )
}
