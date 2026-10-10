'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'

export interface ProgramCreditRefundModalProps {
    programTitle: string
    isLoading: boolean
    /** Delete the program and give the program credit back to the athlete */
    onRefund: () => void
    /** Delete the program, the credit stays spent */
    onKeep: () => void
    onClose: () => void
}

/**
 * Shown instead of the plain delete confirmation when the program consumed a
 * program credit: the trainer decides, case by case, whether the athlete gets it back.
 */
export default function ProgramCreditRefundModal({ programTitle, isLoading, onRefund, onKeep, onClose }: ProgramCreditRefundModalProps) {
    const { t } = useTranslation(['trainer', 'common'])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="refund-modal-title"
                className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            >
                <h2 id="refund-modal-title" className="mb-3 text-xl font-bold text-gray-900">
                    {t('programs.refund.title')}
                </h2>
                <p className="mb-2 text-sm text-gray-700">{t('programs.refund.message', { title: programTitle })}</p>
                <p className="mb-6 text-sm text-gray-600">{t('programs.confirmDeleteProgramWarning')}</p>

                <div className="flex flex-col gap-3">
                    <Button type="button" onClick={onRefund} disabled={isLoading} isLoading={isLoading} loadingText={t('common:common.saving')}>
                        {t('programs.refund.refund')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onKeep} disabled={isLoading}>
                        {t('programs.refund.keep')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                        {t('common:common.cancel')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
