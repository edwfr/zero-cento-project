'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { FormLabel } from '@/components/FormLabel'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import {
    addDays,
    isIsoDay,
    isValidPeriodRange,
    localMsToDay,
    weekEndOf,
    weekStartOf,
    type IsoDay,
    type MacroPhaseTypeDto,
} from '@/lib/macro-periods'

export interface MacroPeriodFormValues {
    phaseTypeId: string
    startDate: IsoDay
    endDate: IsoDay
    note: string | null
}

export interface MacroPeriodFormModalProps {
    mode: 'create' | 'edit'
    initial: Partial<MacroPeriodFormValues>
    phaseTypes: MacroPhaseTypeDto[]
    isSaving: boolean
    error: string | null
    onClose: () => void
    onSubmit: (values: MacroPeriodFormValues) => void
    onDelete?: () => void
}

/**
 * Create or edit a macro period. Everything that can be done by dragging on the
 * timeline can also be done here — this is the keyboard and touch path.
 */
export default function MacroPeriodFormModal({
    mode,
    initial,
    phaseTypes,
    isSaving,
    error,
    onClose,
    onSubmit,
    onDelete,
}: MacroPeriodFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    // Archived phases are not assignable, except the one this period already has
    const selectablePhases = phaseTypes.filter((phase) => phase.isActive || phase.id === initial.phaseTypeId)

    const [phaseTypeId, setPhaseTypeId] = useState(() => initial.phaseTypeId ?? selectablePhases[0]?.id ?? '')
    const [startDate, setStartDate] = useState<IsoDay>(() => initial.startDate ?? weekStartOf(localMsToDay(Date.now())))
    const [endDate, setEndDate] = useState<IsoDay>(
        () => initial.endDate ?? addDays(initial.startDate ?? weekStartOf(localMsToDay(Date.now())), 27)
    )
    const [note, setNote] = useState(initial.note ?? '')

    const rangeIsValid = isValidPeriodRange(startDate, endDate)
    const canSubmit = phaseTypeId !== '' && rangeIsValid && !isSaving

    const handleSubmit = () => {
        if (!canSubmit) return
        onSubmit({ phaseTypeId, startDate, endDate, note: note.trim() === '' ? null : note.trim() })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="macro-period-modal-title"
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
                <h2 id="macro-period-modal-title" className="mb-4 text-xl font-bold text-gray-900">
                    {mode === 'edit' ? t('planning.editTitle') : t('planning.createTitle')}
                </h2>

                {error && (
                    <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="mb-4">
                    <FormLabel htmlFor="macro-period-phase" required>
                        {t('planning.phase')}
                    </FormLabel>
                    {selectablePhases.length === 0 ? (
                        <p className="text-sm text-gray-600">
                            {t('planning.noActivePhases')}{' '}
                            <Link href="/profile" className="font-semibold text-brand-primary hover:underline">
                                {t('planning.managePhases')}
                            </Link>
                        </p>
                    ) : (
                        <select
                            id="macro-period-phase"
                            value={phaseTypeId}
                            onChange={(event) => setPhaseTypeId(event.target.value)}
                            disabled={isSaving}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
                        >
                            {selectablePhases.map((phase) => (
                                <option key={phase.id} value={phase.id}>
                                    {phase.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="mb-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <FormLabel htmlFor="macro-period-start" required>
                            {t('planning.startWeek')}
                        </FormLabel>
                        <Input
                            id="macro-period-start"
                            type="date"
                            value={startDate}
                            onChange={(event) => {
                                if (isIsoDay(event.target.value)) setStartDate(weekStartOf(event.target.value))
                            }}
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <FormLabel htmlFor="macro-period-end" required>
                            {t('planning.endWeek')}
                        </FormLabel>
                        <Input
                            id="macro-period-end"
                            type="date"
                            value={endDate}
                            onChange={(event) => {
                                if (isIsoDay(event.target.value)) setEndDate(weekEndOf(event.target.value))
                            }}
                            state={rangeIsValid ? 'default' : 'error'}
                            helperText={rangeIsValid ? undefined : t('planning.invalidRange')}
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <p className="mb-4 text-xs text-gray-500">{t('planning.weekSnapHint')}</p>

                <div className="mb-6">
                    <FormLabel htmlFor="macro-period-note">{t('planning.note')}</FormLabel>
                    <Textarea
                        id="macro-period-note"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={t('planning.notePlaceholder')}
                        maxLength={500}
                        rows={3}
                        disabled={isSaving}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        {mode === 'edit' && onDelete && (
                            <Button type="button" variant="danger" onClick={onDelete} disabled={isSaving}>
                                {t('planning.deletePeriod')}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                            {t('common:common.cancel')}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            isLoading={isSaving}
                            loadingText={t('common:common.saving')}
                        >
                            {t('common:common.save')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
