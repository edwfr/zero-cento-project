'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { ActionIconButton, InlineActions } from '@/components/ActionIconButton'
import { Button } from '@/components/Button'
import ConfirmationModal from '@/components/ConfirmationModal'
import SubscriptionRenewalFormModal, { type RenewalFormPayload } from '@/components/SubscriptionRenewalFormModal'
import { SkeletonDetail } from '@/components/Skeleton'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatDate, getTodayForInput } from '@/lib/date-format'
import { nextRenewalStart, type RenewalRow } from '@/lib/subscriptions'
import type { TraineeSubscriptionState } from './_use-trainee-subscription'

export interface SubscriptionTabProps {
    traineeId: string
    state: TraineeSubscriptionState
}

/**
 * Trainer-only tab: subscription renewals. The API refuses the trainee role
 * outright, so nothing here needs a role check.
 */
export default function SubscriptionTab({ traineeId, state }: SubscriptionTabProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()
    const { renewals, current, loading, error, reload } = state

    const [modal, setModal] = useState<{ mode: 'create' | 'edit'; initial?: RenewalRow } | null>(null)
    const [saving, setSaving] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<RenewalRow | null>(null)
    const [deleting, setDeleting] = useState(false)

    const request = async (url: string, init: RequestInit) => {
        const res = await fetch(url, init)
        if (!res.ok) {
            const data = await res.json()
            throw new Error(getApiErrorMessage(data, t('subscriptions.saveError'), t))
        }
    }

    const handleSubmit = async (payload: RenewalFormPayload) => {
        setSaving(true)
        try {
            if (modal?.mode === 'edit' && modal.initial) {
                await request(`/api/subscription-renewals/${modal.initial.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            } else {
                await request('/api/subscription-renewals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ traineeId, ...payload }),
                })
            }
            setModal(null)
            await reload()
            showToast(t('common:common.success'), 'success')
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('subscriptions.saveError'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (row: RenewalRow) => {
        setDeleting(true)
        try {
            await request(`/api/subscription-renewals/${row.id}`, { method: 'DELETE' })
            setPendingDelete(null)
            await reload()
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('subscriptions.saveError'), 'error')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return <SkeletonDetail />

    if (error) {
        return (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-state-error">
                <p>{t('subscriptions.loadError')}</p>
                <Button type="button" onClick={() => void reload()}>
                    {t('subscriptions.retry')}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('subscriptions.title')}</h2>
                    <p className="mt-1 text-sm text-gray-600">{t('subscriptions.subtitle')}</p>
                </div>
                <Button type="button" icon={<Plus />} onClick={() => setModal({ mode: 'create' })}>
                    {t('subscriptions.addButton')}
                </Button>
            </div>

            <section className="overflow-hidden rounded-lg bg-white shadow-md">
                <h3 id="renewal-history-title" className="px-6 pt-6 text-lg font-semibold text-gray-900">
                    {t('subscriptions.historyTitle')}
                </h3>
                {renewals.length === 0 ? (
                    <p className="px-6 py-8 text-center text-gray-500">{t('subscriptions.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table aria-labelledby="renewal-history-title" className="mt-4 min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['startColumn', 'durationColumn', 'endColumn', 'createdColumn'].map((column) => (
                                        <th
                                            key={column}
                                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                                        >
                                            {t(`subscriptions.${column}`)}
                                        </th>
                                    ))}
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                        {t('subscriptions.actionsColumn')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {renewals.map((row) => (
                                    <tr key={row.id}>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{formatDate(row.startDate)}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                                            {t('subscriptions.durationValue', { count: row.durationMonths })}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
                                            {formatDate(row.endDate)}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{formatDate(row.createdAt)}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
                                            <InlineActions>
                                                <ActionIconButton
                                                    variant="edit"
                                                    label={t('subscriptions.editAction')}
                                                    onClick={() => setModal({ mode: 'edit', initial: row })}
                                                />
                                                <ActionIconButton
                                                    variant="delete"
                                                    label={t('subscriptions.deleteAction')}
                                                    onClick={() => setPendingDelete(row)}
                                                />
                                            </InlineActions>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && (
                <SubscriptionRenewalFormModal
                    mode={modal.mode}
                    initial={modal.initial}
                    defaultStartDate={nextRenewalStart(current?.kind === 'period' ? current.endDate : null, getTodayForInput())}
                    isSaving={saving}
                    onClose={() => setModal(null)}
                    onSubmit={(payload) => void handleSubmit(payload)}
                />
            )}

            {pendingDelete && (
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setPendingDelete(null)}
                    onConfirm={() => void handleDelete(pendingDelete)}
                    title={t('subscriptions.deleteTitle')}
                    message={t('subscriptions.deleteMessage', {
                        start: formatDate(pendingDelete.startDate),
                        end: formatDate(pendingDelete.endDate),
                    })}
                    confirmText={t('common:common.delete')}
                    variant="danger"
                    isLoading={deleting}
                />
            )}
        </div>
    )
}
