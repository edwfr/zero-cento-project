'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) throw error
            setSent(true)
        } catch (err: any) {
            setError('Impossibile inviare l\'email di ripristino. Verifica l\'indirizzo inserito.')
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
                    <h1 className="text-2xl font-bold text-gray-900">Password dimenticata</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        Inserisci la tua email per ricevere le istruzioni di ripristino
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {sent ? (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">Email inviata!</h2>
                            <p className="text-gray-600 text-sm mb-6">
                                Controlla la tua casella di posta. Se l&apos;indirizzo è registrato, riceverai a breve un link per reimpostare la password.
                            </p>
                            <Link
                                href="/login"
                                className="text-[#FFA700] hover:text-[#FF9500] font-semibold text-sm"
                            >
                                ← Torna al login
                            </Link>
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
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    placeholder="la-tua@email.com"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
                            >
                                {loading ? 'Invio in corso...' : 'Invia istruzioni'}
                            </button>

                            <div className="text-center text-sm text-gray-600">
                                Ricordi la password?{' '}
                                <Link href="/login" className="text-[#FFA700] hover:text-[#FF9500] font-semibold">
                                    Accedi
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
