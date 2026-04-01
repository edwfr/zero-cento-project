'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'

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
        // Verify that the invitation token is valid
        const checkInvitation = async () => {
            try {
                const supabase = createClient()
                const { data: { user }, error } = await supabase.auth.getUser()

                if (error || !user) {
                    setError('Link di invito non valido o scaduto')
                    setVerifying(false)
                    return
                }

                // If user already has a password set, redirect to login
                if (user.confirmed_at) {
                    router.push('/login')
                    return
                }

                setUserData(user)
                setVerifying(false)
            } catch (err) {
                setError('Errore durante la verifica dell\'invito')
                setVerifying(false)
            }
        }

        checkInvitation()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError('Le password non coincidono')
            return
        }

        if (password.length < 8) {
            setError('La password deve essere lunga almeno 8 caratteri')
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
                throw new Error('Failed to activate user')
            }

            // Redirect to role-based dashboard
            const role = userData.user_metadata.role
            router.push(`/${role}/dashboard`)
        } catch (err: any) {
            setError('Impossibile impostare la password. Riprova.')
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
                            Torna al login
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
                    <h1 className="text-2xl font-bold text-gray-900">Benvenuto su ZeroCento</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        {userData?.user_metadata?.firstName && (
                            <>Ciao <strong>{userData.user_metadata.firstName}</strong>! </>
                        )}
                        Imposta la tua password per iniziare.
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
                                placeholder="Minimo 8 caratteri"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Conferma Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                disabled={loading}
                                placeholder="Ripeti la password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password || !confirmPassword}
                            className="w-full bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
                        >
                            {loading ? t('common:common.loadingProgress') : 'Completa Registrazione'}
                        </button>
                    </form>
                </div>

                <div className="text-center mt-6">
                    <p className="text-sm text-gray-600">
                        Hai già un account?{' '}
                        <Link href="/login" className="text-[#FFA700] hover:text-[#FF9500] font-semibold">
                            Accedi
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
