'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function ForceChangePasswordPage() {
    const router = useRouter()
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validation
        if (newPassword.length < 8) {
            setError('La nuova password deve essere di almeno 8 caratteri.')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Le nuove password non coincidono.')
            return
        }
        if (currentPassword === newPassword) {
            setError('La nuova password deve essere diversa da quella temporanea.')
            return
        }

        setLoading(true)
        try {
            // Call API to change password and remove mustChangePassword flag
            const response = await fetch('/api/auth/force-change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error?.message || 'Impossibile aggiornare la password.')
            }

            // Re-authenticate with new password to get updated session with mustChangePassword=false
            const supabase = createClient()
            const { data: sessionData } = await supabase.auth.getSession()

            if (sessionData.session?.user?.email) {
                // Sign in again with new password to refresh session metadata
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: sessionData.session.user.email,
                    password: newPassword,
                })

                if (signInError) {
                    throw new Error('Errore durante il re-login con la nuova password.')
                }

                // Get user role and redirect to dashboard
                const userResponse = await fetch('/api/auth/me', {
                    credentials: 'include'
                })

                if (userResponse.ok) {
                    const userData = await userResponse.json()
                    const role = userData.data.role

                    // Use hard redirect to ensure session is fully refreshed
                    window.location.href = `/${role}/dashboard`
                } else {
                    throw new Error('Impossibile ottenere i dati utente.')
                }
            } else {
                throw new Error('Sessione non valida.')
            }
        } catch (err: any) {
            setError(err.message || 'Impossibile aggiornare la password.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {/* Header with warning */}
                    <div className="mb-6">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                            Cambio password obbligatorio
                        </h2>
                        <p className="text-gray-600 text-sm text-center">
                            Per motivi di sicurezza, devi cambiare la password temporanea ricevuta prima di poter accedere all&apos;applicazione.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Password temporanea
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                disabled={loading}
                                placeholder="Inserisci la password temporanea ricevuta"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                autoComplete="current-password"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Nuova password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                disabled={loading}
                                minLength={8}
                                placeholder="Minimo 8 caratteri"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                autoComplete="new-password"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Scegli una password sicura, diversa dalla temporanea
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Conferma nuova password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                                minLength={8}
                                placeholder="Ripeti la nuova password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                autoComplete="new-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                            className="w-full bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
                        >
                            {loading ? 'Aggiornamento...' : 'Cambia password e accedi'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-gray-500 mt-4">
                    Hai bisogno di aiuto? Contatta il tuo trainer.
                </p>
            </div>
        </div>
    )
}
