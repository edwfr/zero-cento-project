'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useTranslation } from 'react-i18next'

export default function LoginPage() {
    const router = useRouter()
    const { t } = useTranslation(['auth', 'common'])
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(true)

    // Check if user is already logged in
    useEffect(() => {
        const checkSession = async () => {
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()

                if (session) {
                    // User is already logged in, get their role and redirect
                    const response = await fetch('/api/auth/me', {
                        credentials: 'include'
                    })

                    if (response.ok) {
                        const userData = await response.json()
                        const role = userData.data.role
                        router.push(`/${role}/dashboard`)
                        return
                    }
                }
            } catch (err) {
                // Ignore errors, just show login form
                console.error('Session check error:', err)
            } finally {
                setChecking(false)
            }
        }

        checkSession()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const supabase = createClient()
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) throw signInError

            if (data.session) {
                // Check if user must change password
                const mustChangePassword = data.user.user_metadata?.mustChangePassword

                if (mustChangePassword) {
                    // Redirect to force change password page
                    router.push('/force-change-password')
                    return
                }

                // Get user role from database via API
                const response = await fetch('/api/auth/me', {
                    credentials: 'include'
                })

                if (!response.ok) {
                    throw new Error('Failed to fetch user data')
                }

                const userData = await response.json()
                const role = userData.data.role

                // Redirect to role-based dashboard
                router.push(`/${role}/dashboard`)
                router.refresh()
            }
        } catch (err: any) {
            setError(err.message || t('auth:login.error'))
        } finally {
            setLoading(false)
        }
    }

    // Show loading while checking existing session
    if (checking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">{t('common:common.loading')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900">{t('common:app.name')}</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {t('auth:login.title')}
                    </p>

                    {/* Logo - Se manca il file, verrà mostrato un placeholder */}
                    <div className="mt-6 mb-4 flex justify-center">
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
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                {t('common:common.email')}
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                disabled={loading}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="email@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                {t('common:common.password')}
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                disabled={loading}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-[#E69500] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? t('common:common.loadingProgress') : t('auth:login.submit')}
                        </button>
                    </div>

                    <div className="text-center">
                        <a
                            href="/forgot-password"
                            className="text-sm text-brand-primary hover:text-[#E69500]"
                        >
                            {t('auth:login.forgotPassword')}
                        </a>
                    </div>
                </form>
            </div>
        </div>
    )
}
