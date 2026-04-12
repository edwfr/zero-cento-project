'use client'

import { useState, useEffect, useCallback } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'
import { Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

interface Trainee {
    id: string
    firstName: string
    lastName: string
}

interface EditProgramMetadataProps {
    programId: string
    initialTitle: string
    initialTraineeId: string
    initialIsSbdProgram: boolean
    initialDurationWeeks: number
    initialWorkoutsPerWeek: number
    status: 'draft' | 'active' | 'completed'
    onUpdate: () => void
}

export default function EditProgramMetadata({
    programId,
    initialTitle,
    initialTraineeId,
    initialIsSbdProgram,
    initialDurationWeeks,
    initialWorkoutsPerWeek,
    status,
    onUpdate,
}: EditProgramMetadataProps) {
    const { showToast } = useToast()
    const { t } = useTranslation(['trainer', 'common'])
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [trainees, setTrainees] = useState<Trainee[]>([])

    const [title, setTitle] = useState(initialTitle)
    const [traineeId, setTraineeId] = useState(initialTraineeId)
    const [isSbdProgram, setIsSbdProgram] = useState(initialIsSbdProgram)
    const [durationWeeks, setDurationWeeks] = useState(initialDurationWeeks)
    const [workoutsPerWeek, setWorkoutsPerWeek] = useState(initialWorkoutsPerWeek)

    const fetchTrainees = useCallback(async () => {
        try {
            const res = await fetch('/api/users?role=trainee')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('programMetadata.loadingAthletesError'), t))
            }

            const activeTrainees = data.data.items.filter((t: any) => t.isActive)
            setTrainees(activeTrainees)
        } catch (err: any) {
            showToast(err.message, 'error')
        }
    }, [showToast, t])

    useEffect(() => {
        if (isOpen) {
            void fetchTrainees()
        }
    }, [fetchTrainees, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (status !== 'draft') {
            showToast(t('programMetadata.draftOnlyError'), 'error')
            return
        }

        try {
            setSaving(true)

            const res = await fetch(`/api/programs/${programId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    traineeId,
                    isSbdProgram,
                    durationWeeks,
                    workoutsPerWeek,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('programMetadata.updateError'), t))
            }

            showToast(t('programMetadata.updateSuccess'), 'success')
            setIsOpen(false)
            onUpdate()
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleOpen = () => {
        if (status !== 'draft') {
            showToast(
                t('programMetadata.draftOnlyWarning'),
                'warning'
            )
            return
        }
        setIsOpen(true)
    }

    if (!isOpen) {
        return (
            <button
                onClick={handleOpen}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15"
            >
                <Pencil className="w-4 h-4" />
                {t('programMetadata.editProgramInfo')}
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {t('programMetadata.editProgramInfoTitle')}
                        </h2>
                        <button
                            onClick={() => setIsOpen(false)}
                            disabled={saving}
                            className="text-gray-400 hover:text-gray-600 text-2xl font-bold disabled:opacity-50"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {status !== 'draft' && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                            {t('programMetadata.draftOnlyWarningBanner')}
                        </div>
                    )}

                    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                        <label className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={isSbdProgram}
                                onChange={(e) => setIsSbdProgram(e.target.checked)}
                                disabled={saving || status !== 'draft'}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-gray-900">{t('programs.sbdProgramLabel')}</span>
                                <span className="block text-sm text-gray-600">
                                    {t('programs.sbdProgramDescription')}
                                </span>
                            </span>
                        </label>
                    </div>

                    {/* Program Title */}
                    <div>
                        <FormLabel>
                            {t('programs.programNameLabel')}
                        </FormLabel>
                        <Input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={saving || status !== 'draft'}
                            placeholder={t('programs.programNamePlaceholder')}
                            inputSize="md"
                            required
                        />
                    </div>

                    {/* Trainee Selection */}
                    {trainees.length > 0 && (
                        <div>
                            <FormLabel>
                                {t('programs.athleteLabel')}
                            </FormLabel>
                            <select
                                value={traineeId}
                                onChange={(e) => setTraineeId(e.target.value)}
                                disabled={saving || status !== 'draft'}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                required
                            >
                                {trainees.map((trainee) => (
                                    <option key={trainee.id} value={trainee.id}>
                                        {trainee.firstName} {trainee.lastName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Duration Weeks */}
                    <div>
                        <FormLabel>
                            {t('programs.durationWeeksLabel')}
                        </FormLabel>
                        <div className="space-y-2">
                            <Input
                                type="number"
                                min="1"
                                max="52"
                                value={durationWeeks}
                                onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 1)}
                                disabled={saving || status !== 'draft'}
                                inputSize="md"
                                required
                            />
                            {durationWeeks !== initialDurationWeeks && (
                                <p className="text-sm text-amber-600">
                                    {t('programMetadata.durationChangedWarning')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Workouts Per Week */}
                    <div>
                        <FormLabel>
                            {t('programs.workoutsPerWeekLabel')}
                        </FormLabel>
                        <div className="space-y-2">
                            <Input
                                type="number"
                                min="1"
                                max="7"
                                value={workoutsPerWeek}
                                onChange={(e) => setWorkoutsPerWeek(parseInt(e.target.value) || 1)}
                                disabled={saving || status !== 'draft'}
                                inputSize="md"
                                required
                            />
                            {workoutsPerWeek !== initialWorkoutsPerWeek && (
                                <p className="text-sm text-amber-600">
                                    {t('programMetadata.workoutsChangedWarning')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Updated Summary */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-blue-900 mb-2">{t('programMetadata.configurationSummaryTitle')}</p>
                        <p className="text-sm text-blue-700">
                            {t('programMetadata.configurationSummaryValue', {
                                durationWeeks,
                                workoutsPerWeek,
                                totalWorkouts: durationWeeks * workoutsPerWeek,
                            })}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-4 pt-4 border-t">
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="flex-1"
                            disabled={saving || status !== 'draft'}
                            isLoading={saving}
                            loadingText={t('common:common.saving')}
                        >
                            {t('common:common.saveChanges')}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            variant="secondary"
                            size="lg"
                            className="flex-1"
                            disabled={saving}
                        >
                            {t('common:common.cancel')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
