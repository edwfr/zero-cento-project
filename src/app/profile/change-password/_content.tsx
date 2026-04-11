'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { useTranslation } from 'react-i18next'

export default function ChangePasswordContent() {
    const { t } = useTranslation(['auth', 'common', 'profile'])
    const router = useRouter()
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (newPassword.length < 8) {
            setError(t('auth:changePassword.errorMinLength'))
            return
        }
        if (newPassword !== confirmPassword) {
            setError(t('auth:changePassword.errorMismatch'))
            return
        }
        if (currentPassword === newPassword) {
            setError(t('auth:changePassword.errorMustBeDifferent'))
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
                throw new Error(t('auth:changePassword.errorSessionInvalid'))
            }

            const email = user.email
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            })
            if (signInError) {
                setError(t('auth:changePassword.errorInvalidCurrent'))
                return
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            })
            if (updateError) throw updateError

            setSuccess(true)
            setTimeout(() => router.push('/profile'), 2000)
        } catch (err: any) {
            setError(err.message || t('auth:changePassword.errorGeneric'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-md w-full mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">{t('auth:changePassword.title')}</h2>
                    <p className="text-gray-600 mt-1 text-sm">
                        {t('auth:changePassword.description')}
                    </p>
                </div>

                {success ? (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('auth:changePassword.success')}</h2>
                        <p className="text-gray-600 text-sm">
                            {t('auth:changePassword.successDescription')}
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                {t('auth:changePassword.currentPassword')}
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                disabled={loading}
                                placeholder={t('auth:changePassword.currentPasswordPlaceholder')}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                {t('auth:changePassword.newPassword')}
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                disabled={loading}
                                minLength={8}
                                placeholder={t('auth:changePassword.newPasswordPlaceholder')}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                {t('auth:changePassword.confirmPassword')}
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                                minLength={8}
                                placeholder={t('auth:changePassword.confirmPasswordPlaceholder')}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                            className="w-full bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
                        >
                            {loading ? t('auth:changePassword.submitting') : t('auth:changePassword.submit')}
                        </button>

                        <div className="text-center">
                            <Link
                                href="/profile"
                                className="text-gray-500 hover:text-gray-700 text-sm"
                            >
                                {t('auth:changePassword.backToProfile')}
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
