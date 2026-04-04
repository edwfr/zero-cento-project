'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface UserCreateModalProps {
    onClose: () => void
    onUserCreated: () => void
}

export default function UserCreateModal({ onClose, onUserCreated }: UserCreateModalProps) {
    const { t } = useTranslation(['admin', 'common'])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [invitationSent, setInvitationSent] = useState(false)
    const [createdUserEmail, setCreatedUserEmail] = useState('')
    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        role: 'trainee' as 'trainer' | 'trainee',
    })

    const dialogRef = useRef<HTMLDivElement>(null)
    const firstInputRef = useRef<HTMLInputElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    // Generate unique IDs for ARIA labels
    const titleId = useRef(`user-create-title-${Math.random().toString(36).substr(2, 9)}`).current

    // Focus management and keyboard handling
    useEffect(() => {
        // Store currently focused element
        const previouslyFocused = document.activeElement as HTMLElement

        // Focus appropriate element based on state
        setTimeout(() => {
            if (invitationSent) {
                closeButtonRef.current?.focus()
            } else {
                firstInputRef.current?.focus()
            }
        }, 100)

        // Handle ESC key to close
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                if (invitationSent) {
                    onUserCreated()
                } else {
                    onClose()
                }
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
    }, [loading, onClose, onUserCreated, invitationSent])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, t('common:errors.creationError'), t))
            }

            // Show invitation sent confirmation
            setCreatedUserEmail(formData.email)
            setInvitationSent(true)
            setLoading(false)

            // Auto-close after 5 seconds
            setTimeout(() => {
                onUserCreated()
            }, 5000)
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    if (invitationSent) {
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
                        <CheckCircle2 className="inline w-6 h-6 text-green-500 mr-2" />
                        {t('admin:users.userCreated')}
                    </h2>

                    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                        <p className="text-sm text-green-800 mb-3">
                            L&apos;utente è stato creato con successo! Un&apos;email di invito è stata inviata a:
                        </p>
                        <div className="bg-white p-3 rounded border border-green-300 font-mono text-sm break-all">
                            {createdUserEmail}
                        </div>
                        <p className="text-xs text-green-700 mt-3">
                            <AlertTriangle className="inline w-3 h-3 mr-1" />
                            L&apos;utente riceverà un link per impostare la propria password e completare la registrazione.
                        </p>
                    </div>

                    <button
                        ref={closeButtonRef}
                        onClick={onUserCreated}
                        className="w-full px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
                        aria-label={t('common:common.close')}
                    >
                        {t('common:common.close')}
                    </button>
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
                    {t('admin:users.createNewUser')}
                </h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common:common.email')} *
                        </label>
                        <input
                            ref={firstInputRef}
                            type="email"
                            id="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('common:common.firstName')} *
                        </label>
                        <input
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

                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('admin:users.role')} *
                        </label>
                        <select
                            id="role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'trainer' | 'trainee' })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        >
                            <option value="trainee" className="text-gray-900">{t('common:roles.trainee')}</option>
                            <option value="trainer" className="text-gray-900">{t('common:roles.trainer')}</option>
                        </select>
                    </div>

                    <div className="flex space-x-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? t('common:common.creating') : t('admin:users.createUser')}
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
