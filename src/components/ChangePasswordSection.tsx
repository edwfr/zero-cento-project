'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/Button'

export default function ChangePasswordSection() {
    const { t } = useTranslation(['auth', 'common'])
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        // Validation
        if (newPassword.length < 8) {
            setError(t('changePassword.errorMinLength'))
            return
        }
        if (newPassword !== confirmPassword) {
            setError(t('changePassword.errorMismatch'))
            return
        }
        if (currentPassword === newPassword) {
            setError(t('changePassword.errorMustBeDifferent'))
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()

            // Re-authenticate to verify current password before changing
            const {
                data: { user },
                error: getUserError,
            } = await supabase.auth.getUser()

            if (getUserError || !user?.email) {
                throw new Error(t('changePassword.errorSessionInvalid'))
            }

            const email = user.email
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            })
            if (signInError) {
                setError(t('changePassword.errorInvalidCurrent'))
                return
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            })
            if (updateError) throw updateError

            setSuccess(true)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')

            // Reset form after 3 seconds
            setTimeout(() => {
                setSuccess(false)
                setIsEditing(false)
            }, 3000)
        } catch (err: any) {
            setError(err.message || t('changePassword.errorGeneric'))
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setError(null)
        setSuccess(false)
        setIsEditing(false)
    }

    if (!isEditing) {
        return (
            <div>
                <Button
                    onClick={() => setIsEditing(true)}
                    variant="primary"
                    size="md"
                >
                    {t('changePassword.editButton')}
                </Button>
            </div>
        )
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('changePassword.title')}
            </h2>

            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-sm text-green-600 font-medium">{t('changePassword.success')}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('changePassword.currentPassword')}
                    </label>
                    <input
                        type="password"
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        disabled={loading}
                        placeholder={t('changePassword.currentPasswordPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        autoComplete="current-password"
                    />
                </div>

                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('changePassword.newPassword')}
                    </label>
                    <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={8}
                        placeholder={t('changePassword.newPasswordPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        autoComplete="new-password"
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('changePassword.confirmPassword')}
                    </label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={8}
                        placeholder={t('changePassword.confirmPasswordPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        autoComplete="new-password"
                    />
                </div>

                <div className="flex space-x-3 pt-4">
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                        isLoading={loading}
                        loadingText={t('changePassword.submitting')}
                    >
                        {t('changePassword.submit')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleCancel}
                        variant="secondary"
                        size="md"
                        disabled={loading}
                    >
                        {t('common:common.cancel')}
                    </Button>
                </div>
            </form>
        </div>
    )
}
