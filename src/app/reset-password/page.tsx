'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'

export default function ResetPasswordPage() {
    const { t } = useTranslation(['auth', 'common'])
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [sessionReady, setSessionReady] = useState(false)

    // Supabase sends the session via the URL hash when the user clicks the email link.
    // We need to wait for the auth state to update before allowing password change.
    useEffect(() => {
        const supabase = createClient()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true)
            }
        })

        // Also check if the authenticated user is already available (page reload case)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setSessionReady(true)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password.length < 8) {
            setError(t('auth:resetPassword.errorMinLength'))
            return
        }
        if (password !== confirmPassword) {
            setError(t('auth:resetPassword.errorMismatch'))
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            router.push('/login?message=password-updated')
        } catch (err: any) {
            setError(t('auth:resetPassword.errorUpdateFailed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/images/logo/logo.png"
                            alt="ZeroCento Logo"
                            className="w-24 h-24 object-contain"
                            onError={(e) => {
                                // Fallback al placeholder se l'immagine non esiste
                                e.currentTarget.style.display = 'none'
                                e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                        />
                        <div className="hidden w-24 h-24 rounded-full bg-gradient-to-br from-[#FFA700] to-[#FF8C00] flex items-center justify-center shadow-lg">
                            <span className="text-white text-4xl font-bold">0→100</span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('auth:resetPassword.title')}</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        {t('auth:resetPassword.description')}
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {!sessionReady ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFA700] mx-auto mb-4" />
                            <p className="text-gray-600 text-sm">{t('auth:resetPassword.verifyingLink')}</p>
                            <p className="text-gray-400 text-xs mt-2">
                                {t('auth:resetPassword.verifyingHelp')}{' '}
                                <Link href="/forgot-password" className="text-[#FFA700] hover:underline">
                                    {t('auth:resetPassword.requestNewLink')}
                                </Link>
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
                                    {t('auth:resetPassword.newPassword')}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    minLength={8}
                                    placeholder={t('auth:resetPassword.newPasswordPlaceholder')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    {t('auth:resetPassword.confirmPassword')}
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    minLength={8}
                                    placeholder={t('auth:resetPassword.confirmPasswordPlaceholder')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                disabled={loading || !password || !confirmPassword}
                                isLoading={loading}
                                loadingText={t('auth:resetPassword.submitting')}
                            >
                                {t('auth:resetPassword.submit')}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
