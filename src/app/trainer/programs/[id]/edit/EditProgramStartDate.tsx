'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { getTodayForInput } from '@/lib/date-format'
import { Button } from '@/components/Button'
import DatePicker from '@/components/DatePicker'

interface EditProgramStartDateProps {
    programId: string
    status: 'draft' | 'active' | 'completed'
    startDate: string | null
    onUpdate: () => void
}

/**
 * Lets the trainer move the start date of a published program before it starts.
 * The trainee sees the program only from its start date, so once it has started
 * the date is locked (the API enforces the same rule).
 */
export default function EditProgramStartDate({ programId, status, startDate, onUpdate }: EditProgramStartDateProps) {
    const { showToast } = useToast()
    const { t } = useTranslation(['trainer', 'common'])
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const currentDate = startDate ? startDate.slice(0, 10) : ''
    const [newDate, setNewDate] = useState(currentDate)

    // Both are YYYY-MM-DD, so string order is date order
    const notStartedYet = status === 'active' && currentDate > getTodayForInput()
    if (!notStartedYet) return null

    const handleOpen = () => {
        setNewDate(currentDate)
        setIsOpen(true)
    }

    const handleSave = async () => {
        if (!newDate) {
            showToast(t('publish.noStartDate'), 'error')
            return
        }
        if (newDate < getTodayForInput()) {
            showToast(t('publish.pastDateError'), 'error')
            return
        }

        try {
            setSaving(true)
            const res = await fetch(`/api/programs/${programId}/start-date`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate: newDate }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('programMetadata.startDateUpdateError'), t))
            }

            showToast(t('programMetadata.startDateUpdateSuccess'), 'success')
            setIsOpen(false)
            onUpdate()
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('programMetadata.startDateUpdateError'), 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handleOpen}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15"
            >
                <CalendarDays className="w-4 h-4" />
                {t('programMetadata.editStartDate')}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => !saving && setIsOpen(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="edit-start-date-title"
                        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="edit-start-date-title" className="text-xl font-bold text-gray-900 mb-2">
                            {t('programMetadata.editStartDateTitle')}
                        </h2>
                        <p className="text-sm text-gray-600 mb-4">{t('programMetadata.editStartDateDescription')}</p>

                        <DatePicker
                            id="edit-program-start-date"
                            label={t('programMetadata.newStartDateLabel')}
                            value={newDate}
                            onChange={setNewDate}
                            min={getTodayForInput()}
                            disabled={saving}
                            required
                        />

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="secondary" onClick={() => setIsOpen(false)} disabled={saving}>
                                {t('common:common.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => void handleSave()}
                                isLoading={saving}
                                loadingText={t('common:common.saving')}
                            >
                                {t('common:common.save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
