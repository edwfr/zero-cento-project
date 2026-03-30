'use client'

import { useTranslation } from 'react-i18next'
import { useEffect, useRef } from 'react'
import LoadingSpinner from './LoadingSpinner'

interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info' | 'success'
    isLoading?: boolean
}

/**
 * ConfirmationModal Component
 * Modal for confirming destructive or important actions
 */
export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    cancelText,
    variant = 'danger',
    isLoading = false,
}: ConfirmationModalProps) {
    const { t } = useTranslation('common')
    const dialogRef = useRef<HTMLDivElement>(null)
    const confirmButtonRef = useRef<HTMLButtonElement>(null)

    // Generate unique IDs for ARIA labels
    const titleId = useRef(`confirmation-title-${Math.random().toString(36).substr(2, 9)}`).current
    const messageId = useRef(`confirmation-message-${Math.random().toString(36).substr(2, 9)}`).current

    // Focus management and keyboard handling
    useEffect(() => {
        if (!isOpen) return

        // Store currently focused element
        const previouslyFocused = document.activeElement as HTMLElement

        // Focus the confirm button when modal opens
        setTimeout(() => {
            confirmButtonRef.current?.focus()
        }, 100)

        // Handle ESC key to close
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        // Focus trap
        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !dialogRef.current) return

            const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault()
                lastElement?.focus()
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault()
                firstElement?.focus()
            }
        }

        document.addEventListener('keydown', handleEscape)
        document.addEventListener('keydown', handleTab)

        // Cleanup and restore focus
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.removeEventListener('keydown', handleTab)
            previouslyFocused?.focus()
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const finalConfirmText = confirmText || t('common.confirm')
    const finalCancelText = cancelText || t('common.cancel')

    const variantStyles = {
        danger: {
            icon: '⚠️',
            confirmBg: 'bg-red-600 hover:bg-red-700',
            titleColor: 'text-red-900',
            iconBg: 'bg-red-100',
        },
        warning: {
            icon: '⚡',
            confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
            titleColor: 'text-yellow-900',
            iconBg: 'bg-yellow-100',
        },
        info: {
            icon: 'ℹ️',
            confirmBg: 'bg-brand-primary hover:bg-brand-primary/90',
            titleColor: 'text-blue-900',
            iconBg: 'bg-blue-100',
        },
        success: {
            icon: '✓',
            confirmBg: 'bg-green-600 hover:bg-green-700',
            titleColor: 'text-green-900',
            iconBg: 'bg-green-100',
        },
    }

    const styles = variantStyles[variant]

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={messageId}
                className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}>
                    <span className="text-3xl" aria-hidden="true">
                        {styles.icon}
                    </span>
                </div>

                {/* Title */}
                <h2 id={titleId} className={`text-2xl font-bold ${styles.titleColor} mb-3`}>{title}</h2>

                {/* Message */}
                <p id={messageId} className="text-gray-700 mb-6 leading-relaxed">{message}</p>

                {/* Actions */}
                <div className="flex space-x-3">
                    <button
                        ref={confirmButtonRef}
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 ${styles.confirmBg} disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center`}
                        aria-label={`${finalConfirmText} - ${title}`}
                    >
                        {isLoading ? <LoadingSpinner size="sm" color="white" /> : finalConfirmText}
                    </button>

                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                        aria-label={finalCancelText}
                    >
                        {finalCancelText}
                    </button>
                </div>
            </div>
        </div>
    )
}
