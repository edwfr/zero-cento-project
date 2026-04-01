'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function ChangePasswordSection() {
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
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')

            // Reset form after 3 seconds
            setTimeout(() => {
                setSuccess(false)
                setIsEditing(false)
            }, 3000)
        } catch (err: any) {
            setError(err.message || 'Impossibile aggiornare la password.')
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
                <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
                >
                    Modifica Password
                </button>
            </div>
        )
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Modifica Password
            </h2>

            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-sm text-green-600 font-medium">Password aggiornata con successo!</p>
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
                        Password attuale
                    </label>
                    <input
                        type="password"
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Inserisci la password attuale"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        autoComplete="current-password"
                    />
                </div>

                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Nuova password
                    </label>
                    <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={8}
                        placeholder="Minimo 8 caratteri"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        autoComplete="new-password"
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Conferma nuova password
                    </label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={8}
                        placeholder="Ripeti la nuova password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        autoComplete="new-password"
                    />
                </div>

                <div className="flex space-x-3 pt-4">
                    <button
                        type="submit"
                        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                        className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Aggiornamento...' : 'Salva Nuova Password'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                    >
                        Annulla
                    </button>
                </div>
            </form>
        </div>
    )
}
