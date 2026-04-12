'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { Button } from '@/components/Button'

export default function SetPasswordPage() {
    const { t } = useTranslation(['auth', 'common'])
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [userData, setUserData] = useState<any>(null)

    useEffect(() => {
        const supabase = createClient()

        const setupAuth = async () => {
            try {
                // Check if we have tokens in the URL hash
                const hashParams = new URLSearchParams(window.location.hash.substring(1))
                const accessToken = hashParams.get('access_token')
                const refreshToken = hashParams.get('refresh_token')

                console.log('Hash params:', {
                    hasAccessToken: !!accessToken,
                    hasRefreshToken: !!refreshToken,
                    hash: window.location.hash.substring(0, 50) + '...'
                })

                if (accessToken && refreshToken) {
                    // Manually set the session with tokens from URL
                    console.log('Setting session manually...')
                    const { data, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    })

                    if (sessionError) {
                        console.error('Session error:', sessionError)
                        setError(t('auth:setPassword.invalidInvite'))
                        setVerifying(false)
                        return
                    }

                    console.log('Session set successfully, user:', data.user?.email)
                    console.log('User metadata:', data.user?.user_metadata)
                    console.log('Email confirmed:', data.user?.email_confirmed_at)
                    console.log('Confirmed at:', data.user?.confirmed_at)

                    // Clean up the URL hash
                    window.history.replaceState(null, '', window.location.pathname)

                    // For invited users, email_confirmed_at is set by the invite link
                    // But they still need to set a password. Only redirect if they've
                    // already completed onboarding (check isActive in metadata or if they have a real password)
                    const isOnboardingComplete = data.user?.user_metadata?.isActive === true

                    if (isOnboardingComplete) {
                        console.log('User already completed onboarding, redirecting to login')
                        router.push('/login')
                        return
                    }

                    console.log('Showing password setup form')
                    // Show the password form
                    setUserData(data.user)
                    setVerifying(false)
                } else {
                    // No tokens in URL, check if we have an existing session
                    const { data: { user }, error } = await supabase.auth.getUser()

                    if (error || !user) {
                        console.log('No session found')
                        setError(t('auth:setPassword.invalidInvite'))
                        setVerifying(false)
                        return
                    }

                    // Check if already completed onboarding
                    const isOnboardingComplete = user.user_metadata?.isActive === true

                    if (isOnboardingComplete) {
                        router.push('/login')
                        return
                    }

                    setUserData(user)
                    setVerifying(false)
                }
            } catch (err) {
                console.error('Setup error:', err)
                setError(t('auth:setPassword.verifyError'))
                setVerifying(false)
            }
        }

        setupAuth()
    }, [router, t])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError(t('auth:setPassword.errorMismatch'))
            return
        }

        if (password.length < 8) {
            setError(t('auth:setPassword.errorMinLength'))
            return
        }

        setLoading(true)

        try {
            const supabase = createClient()

            // Set the password
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            })

            if (updateError) throw updateError

            // Activate the user in the database
            const activateResponse = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!activateResponse.ok) {
                throw new Error(t('auth:setPassword.errorActivateUser'))
            }

            // Redirect to role-based dashboard
            const role = userData.user_metadata.role
            router.push(`/${role}/dashboard`)
        } catch (err: any) {
            setError(err.message || t('auth:setPassword.errorGeneric'))
            console.error('Error setting password:', err)
        } finally {
            setLoading(false)
        }
    }

    if (verifying) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFA700] mx-auto mb-4" />
                    <p className="text-gray-600">{t('common:common.loading')}</p>
                </div>
            </div>
        )
    }

    if (error && !userData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <p className="text-red-800 mb-4">{error}</p>
                        <Link href="/login" className="text-[#FFA700] hover:underline">
                            {t('auth:setPassword.backToLogin')}
                        </Link>
                    </div>
                </div>
            </div>
        )
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
                                // Fallback to placeholder if image doesn't load
                                e.currentTarget.style.display = 'none'
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement
                                fallback?.classList.remove('hidden')
                            }}
                        />
                        <div className="hidden w-24 h-24 rounded-full bg-gradient-to-br from-[#FFA700] to-[#FF8C00] flex items-center justify-center shadow-lg">
                            <span className="text-white text-4xl font-bold">0→100</span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('auth:setPassword.title')}</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        {userData?.user_metadata?.firstName && (
                            <>
                                {t('auth:setPassword.greeting', {
                                    firstName: userData.user_metadata.firstName,
                                })}{' '}
                            </>
                        )}
                        {t('auth:setPassword.description')}
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                {t('common:common.password')}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                disabled={loading}
                                placeholder={t('auth:setPassword.passwordPlaceholder')}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                {t('auth:setPassword.confirmPassword')}
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                disabled={loading}
                                placeholder={t('auth:setPassword.confirmPasswordPlaceholder')}
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
                            loadingText={t('common:common.loadingProgress')}
                        >
                            {t('auth:setPassword.submit')}
                        </Button>
                    </form>
                </div>

                <div className="text-center mt-6">
                    <p className="text-sm text-gray-600">
                        {t('auth:setPassword.alreadyHaveAccount')}{' '}
                        <Link href="/login" className="text-[#FFA700] hover:text-[#FF9500] font-semibold">
                            {t('auth:login.title')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
