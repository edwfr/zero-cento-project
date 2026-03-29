'use client'

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
    confirmText = 'Conferma',
    cancelText = 'Annulla',
    variant = 'danger',
    isLoading = false,
}: ConfirmationModalProps) {
    if (!isOpen) return null

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
            confirmBg: 'bg-blue-600 hover:bg-blue-700',
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
        >
            <div
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
                <h2 className={`text-2xl font-bold ${styles.titleColor} mb-3`}>{title}</h2>

                {/* Message */}
                <p className="text-gray-700 mb-6 leading-relaxed">{message}</p>

                {/* Actions */}
                <div className="flex space-x-3">
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 ${styles.confirmBg} disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center`}
                    >
                        {isLoading ? <LoadingSpinner size="sm" color="white" /> : confirmText}
                    </button>

                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    )
}
