'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import {
    DURATION_SHORTCUTS,
    MAX_DURATION_MONTHS,
    MIN_DURATION_MONTHS,
    addMonthsClamped,
    isValidDurationMonths,
    type RenewalRow,
} from '@/lib/subscriptions'
import { formatDate, formatDateForInput } from '@/lib/date-format'

export interface RenewalFormPayload {
    /** YYYY-MM-DD */
    startDate: string
    durationMonths: number
}

export interface SubscriptionRenewalFormModalProps {
    mode: 'create' | 'edit'
    initial?: RenewalRow
    /** Create mode pre-fill (see nextRenewalStart); the trainer can change it */
    defaultStartDate: string
    isSaving: boolean
    onClose: () => void
    onSubmit: (payload: RenewalFormPayload) => void
}

/**
 * Create / edit a renewal. The end date shown is only a preview: the server
 * computes the stored one with the same addMonthsClamped().
 */
export default function SubscriptionRenewalFormModal({
    mode,
    initial,
    defaultStartDate,
    isSaving,
    onClose,
    onSubmit,
}: SubscriptionRenewalFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    const [startDate, setStartDate] = useState(() => (initial ? formatDateForInput(initial.startDate) : defaultStartDate))
    const [duration, setDuration] = useState(() => (initial ? String(initial.durationMonths) : ''))
    const [error, setError] = useState<string | null>(null)

    const months = Number(duration)
    const startIsValid = startDate !== '' && !isNaN(new Date(startDate).getTime())
    const previewEnd = startIsValid && isValidDurationMonths(months) ? addMonthsClamped(new Date(startDate), months) : null
    const canSubmit = startIsValid && duration.trim() !== '' && !isSaving

    const handleSubmit = () => {
        if (!isValidDurationMonths(months)) {
            setError('validation.durationMonthsRange')
            return
        }
        setError(null)
        onSubmit({ startDate, durationMonths: months })
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

                <div className="mb-4">
                    <FormLabel htmlFor="renewal-start-date" required>
                        {t('subscriptions.startDate')}
                    </FormLabel>
                    <Input
                        id="renewal-start-date"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        disabled={isSaving}
                    />
                </div>

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

                {previewEnd && (
                    <p className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {t('subscriptions.previewLabel')}{' '}
                        <strong data-testid="renewal-end-preview">{formatDate(previewEnd)}</strong>
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
