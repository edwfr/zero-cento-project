'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function ResetPasswordPage() {
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

        // Also check if session is already available (page reload case)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setSessionReady(true)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password.length < 8) {
            setError('La password deve essere di almeno 8 caratteri.')
            return
        }
        if (password !== confirmPassword) {
            setError('Le password non coincidono.')
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            router.push('/login?message=password-updated')
        } catch (err: any) {
            setError('Impossibile aggiornare la password. Il link potrebbe essere scaduto.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FFA700] rounded-2xl mb-4">
                        <span className="text-white font-bold text-2xl">0c</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Nuova password</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        Scegli una nuova password sicura per il tuo account
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {!sessionReady ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FFA700] mx-auto mb-4" />
                            <p className="text-gray-600 text-sm">Verifica del link in corso...</p>
                            <p className="text-gray-400 text-xs mt-2">
                                Se il problema persiste,{' '}
                                <Link href="/forgot-password" className="text-[#FFA700] hover:underline">
                                    richiedi un nuovo link
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
                                    Nuova password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    placeholder="Minimo 8 caratteri"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    Conferma password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    placeholder="Ripeti la nuova password"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !password || !confirmPassword}
                                className="w-full bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
                            >
                                {loading ? 'Aggiornamento...' : 'Imposta nuova password'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
