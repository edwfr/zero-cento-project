'use client'

import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import '@/lib/i18n/client'
import ExerciseForm, { type CreatedExercise } from '@/components/ExerciseForm'

export interface ExerciseQuickCreateModalProps {
    onClose: () => void
    onCreated: (exercise: CreatedExercise) => void
}

const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog around `ExerciseForm` for creating a library exercise without leaving the page.
 * Mount it only while open: unmounting discards the typed values. The backdrop does not
 * close it, so a stray click cannot lose a half-filled form.
 */
export default function ExerciseQuickCreateModal({ onClose, onCreated }: ExerciseQuickCreateModalProps) {
    const { t } = useTranslation(['trainer', 'common'])
    const titleId = useId()
    const dialogRef = useRef<HTMLDivElement>(null)
    const onCloseRef = useRef(onClose)

    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null

        const firstInput = dialogRef.current?.querySelector<HTMLElement>('input:not([disabled])')
        firstInput?.focus()

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCloseRef.current()
                return
            }
            if (e.key !== 'Tab' || !dialogRef.current) return

            const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
            const first = focusable[0]
            const last = focusable[focusable.length - 1]

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last?.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first?.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            previouslyFocused?.focus()
        }
    }, [])

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            role="presentation"
            data-testid="exercise-quick-create-backdrop"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-gray-50 shadow-xl"
            >
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <h2 id={titleId} className="text-2xl font-bold text-gray-900">
                        {t('exercises.newExerciseTitle')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('common:common.close')}
                        title={t('common:common.close')}
                        className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-6 pb-6">
                    <ExerciseForm onSuccess={onCreated} onCancel={onClose} />
                </div>
            </div>
        </div>
    )
}
