'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void
    hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
        const id = Math.random().toString(36).substring(2, 9)
        const newToast: Toast = { id, message, type, duration }

        setToasts((prev) => [...prev, newToast])

        if (duration > 0) {
            setTimeout(() => {
                hideToast(id)
            }, duration)
        }
    }, [])

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            <ToastContainer toasts={toasts} onClose={hideToast} />
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

interface ToastContainerProps {
    toasts: Toast[]
    onClose: (id: string) => void
}

function ToastContainer({ toasts, onClose }: ToastContainerProps) {
    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="region" aria-label="Notifiche">
            {toasts.map((toast) => (
                <ToastNotification key={toast.id} toast={toast} onClose={onClose} />
            ))}
        </div>
    )
}

interface ToastNotificationProps {
    toast: Toast
    onClose: (id: string) => void
}

function ToastNotification({ toast, onClose }: ToastNotificationProps) {
    const configs = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-500',
            text: 'text-green-800',
            icon: '✓',
            iconBg: 'bg-green-500',
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-500',
            text: 'text-red-800',
            icon: '✕',
            iconBg: 'bg-red-500',
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-500',
            text: 'text-yellow-800',
            icon: '⚠',
            iconBg: 'bg-yellow-500',
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-500',
            text: 'text-blue-800',
            icon: 'ℹ',
            iconBg: 'bg-blue-500',
        },
    }

    const config = configs[toast.type]

    return (
        <div
            className={`
                flex min-w-80 max-w-md items-start gap-3 rounded-lg border-l-4 p-4 shadow-lg
                animate-in slide-in-from-right-full duration-300
                ${config.bg} ${config.border}
            `}
            role="alert"
        >
            {/* Icon */}
            <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${config.iconBg} text-white font-bold text-sm`}>
                {config.icon}
            </div>

            {/* Message */}
            <p className={`flex-1 text-sm font-medium ${config.text}`}>{toast.message}</p>

            {/* Close Button */}
            <button
                onClick={() => onClose(toast.id)}
                className={`flex-shrink-0 rounded p-1 transition-colors ${config.text} hover:bg-black/10`}
                aria-label="Chiudi notifica"
            >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    )
}

export default ToastNotification
