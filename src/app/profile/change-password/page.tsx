'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function ChangePasswordPage() {
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
            setError('La nuova password deve essere di almeno 8 caratteri.')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Le nuove password non coincidono.')
            return
        }
        if (currentPassword === newPassword) {
            setError('La nuova password deve essere diversa da quella attuale.')
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()

            // Re-authenticate to verify current password before changing
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData.session?.user?.email) {
                throw new Error('Sessione non valida. Effettua nuovamente il login.')
            }

            const email = sessionData.session.user.email
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            })
            if (signInError) {
                setError('Password attuale non corretta.')
                return
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            })
            if (updateError) throw updateError

            setSuccess(true)
            setTimeout(() => router.push('/profile'), 2000)
        } catch (err: any) {
            setError(err.message || 'Impossibile aggiornare la password.')
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
                    <h1 className="text-2xl font-bold text-gray-900">Modifica password</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        Aggiorna la tua password di accesso
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {success ? (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">Password aggiornata!</h2>
                            <p className="text-gray-600 text-sm">
                                La tua password è stata modificata con successo. Sarai reindirizzato al profilo...
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
                                    Password attuale
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    placeholder="Inserisci la password attuale"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
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
                                    minLength={8}
                                    placeholder="Minimo 8 caratteri"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
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
                                    minLength={8}
                                    placeholder="Ripeti la nuova password"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                                className="w-full bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
                            >
                                {loading ? 'Aggiornamento...' : 'Modifica password'}
                            </button>

                            <div className="text-center">
                                <Link
                                    href="/profile"
                                    className="text-gray-500 hover:text-gray-700 text-sm"
                                >
                                    ← Torna al profilo
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
