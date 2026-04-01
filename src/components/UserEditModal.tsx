'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'

interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
}

interface UserEditModalProps {
    user: User
    onClose: () => void
    onUserUpdated: () => void
}

export default function UserEditModal({ user, onClose, onUserUpdated }: UserEditModalProps) {
    const { t } = useTranslation(['admin', 'common'])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [formData, setFormData] = useState({
        firstName: user.firstName,
        lastName: user.lastName,
    })

    const dialogRef = useRef<HTMLDivElement>(null)
    const firstInputRef = useRef<HTMLInputElement>(null)

    // Generate unique IDs for ARIA labels
    const titleId = useRef(`user-edit-title-${Math.random().toString(36).substr(2, 9)}`).current

    // Focus management and keyboard handling
    useEffect(() => {
        // Store currently focused element
        const previouslyFocused = document.activeElement as HTMLElement

        // Focus first input when modal opens (only in form state)
        if (!success) {
            setTimeout(() => {
                firstInputRef.current?.focus()
            }, 100)
        }

        // Handle ESC key to close
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
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
    }, [loading, onClose, success])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, t('common:errors.updateError'), t))
            }

            setSuccess(true)
            setTimeout(() => {
                onUserUpdated()
            }, 1000)
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="presentation">
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
                >
                    <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 id={titleId} className="text-lg font-medium text-gray-900">
                            {t('admin:users.userUpdated')}
                        </h3>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="presentation">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            >
                <h2 id={titleId} className="text-2xl font-bold text-gray-900 mb-4">
                    {t('admin:users.editUser')}
                </h2>

                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('common:common.email')}:</span> {user.email}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{t('admin:users.role')}:</span> {user.role}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common:common.firstName')} *
                        </label>
                        <input
                            ref={firstInputRef}
                            type="text"
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common:common.lastName')} *
                        </label>
                        <input
                            type="text"
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    <div className="flex space-x-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? t('common:common.saving') : t('common:common.saveChanges')}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('common:common.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
