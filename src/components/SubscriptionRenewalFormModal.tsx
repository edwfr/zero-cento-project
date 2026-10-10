'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import DatePicker from '@/components/DatePicker'
import {
    DURATION_SHORTCUTS,
    MAX_DURATION_MONTHS,
    MAX_PROGRAM_COUNT,
    MIN_DURATION_MONTHS,
    MIN_PROGRAM_COUNT,
    PROGRAM_COUNT_SHORTCUTS,
    addMonthsClamped,
    isValidDurationMonths,
    isValidProgramCount,
    type RenewalKind,
    type RenewalRow,
} from '@/lib/subscriptions'
import { formatDate, formatDateForInput } from '@/lib/date-format'

export type RenewalFormPayload =
    | { kind: 'period'; /** YYYY-MM-DD */ startDate: string; durationMonths: number }
    | { kind: 'programs'; /** YYYY-MM-DD, purchase date */ startDate: string; programCount: number }

export interface SubscriptionRenewalFormModalProps {
    mode: 'create' | 'edit'
    initial?: RenewalRow
    /** Create mode, months: pre-fill (see nextRenewalStart); the trainer can change it */
    defaultStartDate: string
    /** Create mode: the trainee's current mode */
    defaultKind: RenewalKind
    /** Programs currently available (negative = owed), used by the balance preview */
    programBalance: number
    /** Create mode, programs: a package is bought today */
    todayForInput: string
    isSaving: boolean
    onClose: () => void
    onSubmit: (payload: RenewalFormPayload) => void
}

const KINDS: RenewalKind[] = ['period', 'programs']

/**
 * Create / edit a renewal, by months or by package of programs. The end date
 * and the balance shown are only previews: the server computes the stored values.
 */
export default function SubscriptionRenewalFormModal({
    mode,
    initial,
    defaultStartDate,
    defaultKind,
    programBalance,
    todayForInput,
    isSaving,
    onClose,
    onSubmit,
}: SubscriptionRenewalFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    const [kind, setKind] = useState<RenewalKind>(() => initial?.kind ?? defaultKind)
    const [periodStart, setPeriodStart] = useState(() =>
        initial?.kind === 'period' ? formatDateForInput(initial.startDate) : defaultStartDate
    )
    const [purchaseDate, setPurchaseDate] = useState(() =>
        initial?.kind === 'programs' ? formatDateForInput(initial.startDate) : todayForInput
    )
    const [duration, setDuration] = useState(() => (initial?.durationMonths != null ? String(initial.durationMonths) : ''))
    const [programCount, setProgramCount] = useState(() => (initial?.programCount != null ? String(initial.programCount) : ''))
    const [error, setError] = useState<string | null>(null)

    const isPrograms = kind === 'programs'
    const date = isPrograms ? purchaseDate : periodStart
    const amount = isPrograms ? programCount : duration
    const dateIsValid = date !== '' && !isNaN(new Date(date).getTime())
    const canSubmit = dateIsValid && amount.trim() !== '' && !isSaving

    const months = Number(duration)
    const count = Number(programCount)
    const previewEnd = !isPrograms && dateIsValid && isValidDurationMonths(months) ? addMonthsClamped(new Date(date), months) : null
    // Editing: the current balance already includes this package, take it out before adding the new count
    const previewBalance =
        isPrograms && isValidProgramCount(count) ? programBalance - (initial?.programCount ?? 0) + count : null

    const changeKind = (next: RenewalKind) => {
        setKind(next)
        setError(null)
    }

    const handleSubmit = () => {
        if (isPrograms) {
            if (!isValidProgramCount(count)) {
                setError('validation.programCountRange')
                return
            }
            setError(null)
            onSubmit({ kind: 'programs', startDate: purchaseDate, programCount: count })
            return
        }
        if (!isValidDurationMonths(months)) {
            setError('validation.durationMonthsRange')
            return
        }
        setError(null)
        onSubmit({ kind: 'period', startDate: periodStart, durationMonths: months })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="renewal-modal-title"
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
                <h2 id="renewal-modal-title" className="mb-4 text-xl font-bold text-gray-900">
                    {mode === 'edit' ? t('subscriptions.editTitle') : t('subscriptions.createTitle')}
                </h2>

                {/* The kind of a recorded renewal cannot change: switching means recording a new one */}
                <div role="group" aria-label={t('subscriptions.kind.label')} className="mb-4 flex gap-2">
                    {KINDS.map((option) => (
                        <Button
                            key={option}
                            type="button"
                            variant={kind === option ? 'primary' : 'secondary'}
                            size="sm"
                            aria-pressed={kind === option}
                            onClick={() => changeKind(option)}
                            disabled={isSaving || (mode === 'edit' && kind !== option)}
                        >
                            {t(`subscriptions.kind.${option}`)}
                        </Button>
                    ))}
                </div>

                {/* Shared DatePicker: dd/MM/yyyy whatever the browser locale (a native date input follows it) */}
                <div className="mb-4">
                    <DatePicker
                        id="renewal-start-date"
                        label={isPrograms ? t('subscriptions.purchaseDate') : t('subscriptions.startDate')}
                        value={date}
                        onChange={isPrograms ? setPurchaseDate : setPeriodStart}
                        required
                        disabled={isSaving}
                    />
                </div>

                {isPrograms ? (
                    <div className="mb-4">
                        <FormLabel htmlFor="renewal-program-count" required>
                            {t('subscriptions.programCount')}
                        </FormLabel>
                        <Input
                            id="renewal-program-count"
                            type="number"
                            inputMode="numeric"
                            step={1}
                            min={MIN_PROGRAM_COUNT}
                            max={MAX_PROGRAM_COUNT}
                            value={programCount}
                            onChange={(event) => setProgramCount(event.target.value)}
                            state={error ? 'error' : 'default'}
                            helperText={error ? t(error) : undefined}
                            disabled={isSaving}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                            {PROGRAM_COUNT_SHORTCUTS.map((shortcut) => (
                                <Button
                                    key={shortcut}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    aria-pressed={count === shortcut}
                                    onClick={() => setProgramCount(String(shortcut))}
                                    disabled={isSaving}
                                >
                                    {t('subscriptions.programCountShortcut', { count: shortcut })}
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mb-4">
                        <FormLabel htmlFor="renewal-duration" required>
                            {t('subscriptions.duration')}
                        </FormLabel>
                        <Input
                            id="renewal-duration"
                            type="number"
                            inputMode="numeric"
                            step={1}
                            min={MIN_DURATION_MONTHS}
                            max={MAX_DURATION_MONTHS}
                            value={duration}
                            onChange={(event) => setDuration(event.target.value)}
                            state={error ? 'error' : 'default'}
                            helperText={error ? t(error) : undefined}
                            disabled={isSaving}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                            {DURATION_SHORTCUTS.map((shortcut) => (
                                <Button
                                    key={shortcut}
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    aria-pressed={months === shortcut}
                                    onClick={() => setDuration(String(shortcut))}
                                    disabled={isSaving}
                                >
                                    {t('subscriptions.durationShortcut', { count: shortcut })}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {previewEnd && (
                    <p className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {t('subscriptions.previewLabel')}{' '}
                        <strong data-testid="renewal-end-preview">{formatDate(previewEnd)}</strong>
                    </p>
                )}

                {previewBalance !== null && (
                    <p className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {t('subscriptions.balancePreviewLabel')}{' '}
                        <strong data-testid="renewal-balance-preview">{previewBalance}</strong>
                    </p>
                )}

                <div className="flex justify-end gap-3">
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
    )
}
