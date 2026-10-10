'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import { FormLabel } from '@/components/FormLabel'
import { Input } from '@/components/Input'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { PHASE_COLOR_PALETTE, nextUnusedColor, type MacroPhaseTypeDto } from '@/lib/macro-periods'

interface PhaseDraft {
    name: string
    description: string
    color: string
}

interface PhaseFormProps {
    idPrefix: string
    draft: PhaseDraft
    submitLabel: string
    isSaving: boolean
    onChange: (draft: PhaseDraft) => void
    onSubmit: () => void
    onCancel: () => void
}

function PhaseForm({ idPrefix, draft, submitLabel, isSaving, onChange, onSubmit, onCancel }: PhaseFormProps) {
    const { t } = useTranslation(['trainer', 'common'])

    return (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <FormLabel htmlFor={`${idPrefix}-name`} required>
                        {t('macroPhases.name')}
                    </FormLabel>
                    <Input
                        id={`${idPrefix}-name`}
                        value={draft.name}
                        maxLength={40}
                        onChange={(event) => onChange({ ...draft, name: event.target.value })}
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <FormLabel htmlFor={`${idPrefix}-description`}>{t('macroPhases.descriptionLabel')}</FormLabel>
                    <Input
                        id={`${idPrefix}-description`}
                        value={draft.description}
                        maxLength={200}
                        placeholder={t('macroPhases.descriptionPlaceholder')}
                        onChange={(event) => onChange({ ...draft, description: event.target.value })}
                        disabled={isSaving}
                    />
                </div>
            </div>

            <div>
                <p className="mb-1 text-sm font-medium text-gray-700">{t('macroPhases.color')}</p>
                <div className="flex flex-wrap items-center gap-2">
                    {PHASE_COLOR_PALETTE.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-label={color}
                            aria-pressed={draft.color.toLowerCase() === color}
                            onClick={() => onChange({ ...draft, color })}
                            className={`h-7 w-7 rounded border-2 transition-colors ${
                                draft.color.toLowerCase() === color ? 'border-gray-900' : 'border-gray-300 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    <input
                        type="color"
                        aria-label={t('macroPhases.customColor')}
                        value={draft.color}
                        onChange={(event) => onChange({ ...draft, color: event.target.value })}
                        disabled={isSaving}
                        className="h-8 w-10 cursor-pointer rounded border-2 border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            </div>

            <div className="flex gap-3">
                <Button
                    type="button"
                    size="sm"
                    onClick={onSubmit}
                    disabled={draft.name.trim() === ''}
                    isLoading={isSaving}
                    loadingText={t('common:common.saving')}
                >
                    {submitLabel}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
                    {t('common:common.cancel')}
                </Button>
            </div>
        </div>
    )
}

const toBody = (draft: PhaseDraft) => ({
    name: draft.name.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    color: draft.color,
})

/**
 * Trainer profile: the phases used to plan macro periods. Names, meanings and
 * colours are the trainer's own — nothing here is hardcoded.
 */
export default function MacroPhaseTypesSection() {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()

    const [phases, setPhases] = useState<MacroPhaseTypeDto[]>([])
    const [loading, setLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [newDraft, setNewDraft] = useState<PhaseDraft | null>(null)
    const [editing, setEditing] = useState<{ id: string; draft: PhaseDraft } | null>(null)
    const [pendingDelete, setPendingDelete] = useState<MacroPhaseTypeDto | null>(null)

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/macro-phase-types')
            const json = await res.json()
            if (!res.ok) throw new Error('load failed')
            setPhases(json.data.items)
            setLoadFailed(false)
        } catch {
            setLoadFailed(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const send = async (url: string, method: string, body?: unknown) => {
        const res = await fetch(url, {
            method,
            ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(getApiErrorMessage(json, t('macroPhases.saveError'), t))
    }

    /** Runs a write, reloads the list on success, toasts the translated error otherwise. */
    const run = async (key: string, action: () => Promise<void>) => {
        setBusy(key)
        try {
            await action()
            await load()
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('macroPhases.saveError'), 'error')
        } finally {
            setBusy(null)
        }
    }

    const handleCreate = () => {
        if (!newDraft) return
        void run('create', async () => {
            await send('/api/macro-phase-types', 'POST', toBody(newDraft))
            setNewDraft(null)
        })
    }

    const handleSaveEdit = () => {
        if (!editing) return
        void run(`save:${editing.id}`, async () => {
            await send(`/api/macro-phase-types/${editing.id}`, 'PATCH', toBody(editing.draft))
            setEditing(null)
        })
    }

    const handleToggleActive = (phase: MacroPhaseTypeDto) =>
        void run(`toggle:${phase.id}`, () =>
            send(`/api/macro-phase-types/${phase.id}`, 'PATCH', { isActive: !phase.isActive })
        )

    const handleMove = (index: number, direction: -1 | 1) => {
        const moved = phases[index]
        const neighbour = phases[index + direction]
        if (!neighbour) return
        void run(`move:${moved.id}`, async () => {
            await send(`/api/macro-phase-types/${moved.id}`, 'PATCH', { sortOrder: neighbour.sortOrder })
            await send(`/api/macro-phase-types/${neighbour.id}`, 'PATCH', { sortOrder: moved.sortOrder })
        })
    }

    const handleDelete = () => {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        void run(`delete:${target.id}`, () => send(`/api/macro-phase-types/${target.id}`, 'DELETE'))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-primary"></div>
            </div>
        )
    }

    if (loadFailed) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-state-error">{t('macroPhases.loadError')}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                    {t('common:common.retry')}
                </Button>
            </div>
        )
    }

    return (
        <div>
            <p className="mb-4 text-sm text-gray-600">{t('macroPhases.description')}</p>

            {phases.length === 0 && <p className="mb-4 text-sm text-gray-500">{t('macroPhases.empty')}</p>}

            <ul className="mb-4 space-y-3">
                {phases.map((phase, index) => (
                    <li key={phase.id} aria-label={phase.name} className="rounded-lg bg-gray-50 p-3">
                        {editing?.id === phase.id ? (
                            <PhaseForm
                                idPrefix={`phase-${phase.id}`}
                                draft={editing.draft}
                                submitLabel={t('common:common.save')}
                                isSaving={busy === `save:${phase.id}`}
                                onChange={(draft) => setEditing({ id: phase.id, draft })}
                                onSubmit={handleSaveEdit}
                                onCancel={() => setEditing(null)}
                            />
                        ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="h-8 w-8 flex-shrink-0 rounded-md border-2 border-gray-300"
                                        style={{ backgroundColor: phase.color }}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900">
                                            {phase.name}
                                            {!phase.isActive && (
                                                <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs font-normal text-gray-600">
                                                    {t('macroPhases.archived')}
                                                </span>
                                            )}
                                        </p>
                                        {phase.description && <p className="text-xs text-gray-500">{phase.description}</p>}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        aria-label={t('macroPhases.moveUp')}
                                        disabled={index === 0 || busy !== null}
                                        onClick={() => handleMove(index, -1)}
                                    >
                                        <ChevronUp size={16} />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        aria-label={t('macroPhases.moveDown')}
                                        disabled={index === phases.length - 1 || busy !== null}
                                        onClick={() => handleMove(index, 1)}
                                    >
                                        <ChevronDown size={16} />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        disabled={busy !== null}
                                        onClick={() =>
                                            setEditing({
                                                id: phase.id,
                                                draft: { name: phase.name, description: phase.description ?? '', color: phase.color },
                                            })
                                        }
                                    >
                                        {t('macroPhases.edit')}
                                    </Button>
                                    {(phase.usageCount > 0 || !phase.isActive) && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            isLoading={busy === `toggle:${phase.id}`}
                                            loadingText={t('common:common.saving')}
                                            disabled={busy !== null}
                                            onClick={() => handleToggleActive(phase)}
                                        >
                                            {phase.isActive ? t('macroPhases.archive') : t('macroPhases.reactivate')}
                                        </Button>
                                    )}
                                    {phase.usageCount === 0 && (
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            isLoading={busy === `delete:${phase.id}`}
                                            loadingText={t('common:common.saving')}
                                            disabled={busy !== null}
                                            onClick={() => setPendingDelete(phase)}
                                        >
                                            {t('macroPhases.delete')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            {newDraft ? (
                <PhaseForm
                    idPrefix="phase-new"
                    draft={newDraft}
                    submitLabel={t('macroPhases.create')}
                    isSaving={busy === 'create'}
                    onChange={setNewDraft}
                    onSubmit={handleCreate}
                    onCancel={() => setNewDraft(null)}
                />
            ) : (
                <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={busy !== null}
                    onClick={() =>
                        setNewDraft({ name: '', description: '', color: nextUnusedColor(phases.map((phase) => phase.color)) })
                    }
                >
                    {t('macroPhases.add')}
                </Button>
            )}

            <ConfirmationModal
                isOpen={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                title={t('macroPhases.deleteConfirmTitle')}
                message={t('macroPhases.deleteConfirmMessage')}
                confirmText={t('macroPhases.deleteConfirm')}
                variant="danger"
            />
        </div>
    )
}
