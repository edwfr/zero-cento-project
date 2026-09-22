'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'
import { Textarea } from '@/components/Textarea'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    isValueInRange,
    type MeasurementMetric,
    type MeasurementPoint,
} from '@/lib/measurements'
import { formatDateForInput, getTodayForInput } from '@/lib/date-format'

export interface MeasurementCreatePayload {
    measuredAt: string
    notes?: string
    values: Partial<Record<MeasurementMetric, number>>
}

export interface MeasurementEditPayload {
    id: string
    value: number
    measuredAt: string
    notes: string | null
}

export interface MeasurementFormModalProps {
    mode: 'create' | 'edit'
    initial?: MeasurementPoint
    isSaving: boolean
    onClose: () => void
    onCreate: (payload: MeasurementCreatePayload) => void
    onEdit: (payload: MeasurementEditPayload) => void
}

type FieldValues = Partial<Record<MeasurementMetric, string>>

/**
 * One modal, two shapes: "create" shows every metric (all optional, the trainer
 * fills only what was measured), "edit" shows the single metric of the row.
 */
export default function MeasurementFormModal({
    mode,
    initial,
    isSaving,
    onClose,
    onCreate,
    onEdit,
}: MeasurementFormModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    const visibleMetrics: readonly MeasurementMetric[] =
        mode === 'edit' && initial ? [initial.metric] : MEASUREMENT_METRICS

    const [values, setValues] = useState<FieldValues>(() =>
        mode === 'edit' && initial ? { [initial.metric]: String(initial.value) } : {}
    )
    const [measuredAt, setMeasuredAt] = useState(() =>
        initial ? formatDateForInput(initial.measuredAt) : getTodayForInput()
    )
    const [notes, setNotes] = useState(initial?.notes ?? '')
    const [errors, setErrors] = useState<Partial<Record<MeasurementMetric, string>>>({})

    const filledMetrics = visibleMetrics.filter((metric) => (values[metric] ?? '').trim() !== '')
    const canSubmit = filledMetrics.length > 0 && !isSaving

    const handleSubmit = () => {
        const parsed: Partial<Record<MeasurementMetric, number>> = {}
        const nextErrors: Partial<Record<MeasurementMetric, string>> = {}

        for (const metric of filledMetrics) {
            const value = Number((values[metric] ?? '').replace(',', '.'))
            if (!Number.isFinite(value) || !isValueInRange(metric, value)) {
                nextErrors[metric] = 'validation.measurementOutOfRange'
                continue
            }
            parsed[metric] = value
        }

        setErrors(nextErrors)
        if (Object.keys(nextErrors).length > 0) return

        if (mode === 'edit' && initial) {
            onEdit({
                id: initial.id,
                value: parsed[initial.metric] as number,
                measuredAt,
                notes: notes.trim() === '' ? null : notes,
            })
            return
        }

        onCreate({
            measuredAt,
            ...(notes.trim() === '' ? {} : { notes }),
            values: parsed,
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="measurement-modal-title"
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            >
                <h2 id="measurement-modal-title" className="mb-4 text-xl font-bold text-gray-900">
                    {mode === 'edit' ? t('measurements.editTitle') : t('measurements.createTitle')}
                </h2>

                <div className="mb-4">
                    <FormLabel htmlFor="measurement-date" required>
                        {t('measurements.date')}
                    </FormLabel>
                    <Input
                        id="measurement-date"
                        type="date"
                        value={measuredAt}
                        max={getTodayForInput()}
                        onChange={(event) => setMeasuredAt(event.target.value)}
                        disabled={isSaving}
                    />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {visibleMetrics.map((metric) => {
                        const meta = MEASUREMENT_METRIC_META[metric]
                        const fieldId = `measurement-${metric}`
                        return (
                            <div key={metric}>
                                <FormLabel htmlFor={fieldId}>{t(meta.labelKey)}</FormLabel>
                                <Input
                                    id={fieldId}
                                    type="number"
                                    inputMode="decimal"
                                    step={meta.step}
                                    min={meta.min}
                                    max={meta.max}
                                    value={values[metric] ?? ''}
                                    onChange={(event) =>
                                        setValues((current) => ({ ...current, [metric]: event.target.value }))
                                    }
                                    state={errors[metric] ? 'error' : 'default'}
                                    helperText={errors[metric] ? t(errors[metric] as string) : meta.unit}
                                    disabled={isSaving}
                                />
                            </div>
                        )
                    })}
                </div>

                <div className="mb-6">
                    <FormLabel htmlFor="measurement-notes">{t('measurements.notes')}</FormLabel>
                    <Textarea
                        id="measurement-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t('measurements.notesPlaceholder')}
                        maxLength={500}
                        rows={3}
                        disabled={isSaving}
                    />
                </div>

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
