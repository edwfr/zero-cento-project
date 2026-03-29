'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function NewTraineePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)

    // Form state
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [autoPassword, setAutoPassword] = useState(true)
    const [manualPassword, setManualPassword] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validation
        if (!firstName.trim() || !lastName.trim() || !email.trim()) {
            setError('Compila tutti i campi obbligatori')
            return
        }

        if (!autoPassword && !manualPassword.trim()) {
            setError('Inserisci una password manuale o abilita la generazione automatica')
            return
        }

        try {
            setLoading(true)

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    role: 'trainee',
                    password: autoPassword ? undefined : manualPassword,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error?.message || 'Errore nella creazione atleta')
            }

            // Show generated password if auto-generated
            if (data.data.tempPassword) {
                setGeneratedPassword(data.data.tempPassword)
            } else {
                // Redirect immediately if manual password
                router.push('/trainer/trainees')
            }
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    // If password was generated, show it
    if (generatedPassword) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">✅</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Atleta Creato con Successo!
                        </h2>
                        <p className="text-gray-600">
                            L'atleta {firstName} {lastName} è stato aggiunto
                        </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <p className="text-sm font-semibold text-yellow-800 mb-2">
                            ⚠️ Password Temporanea Generata
                        </p>
                        <p className="text-sm text-yellow-700 mb-3">
                            Salva questa password e comunicala all'atleta. Non sarà più visibile.
                        </p>
                        <div className="bg-white rounded px-4 py-3 font-mono text-lg text-center border-2 border-yellow-300">
                            {generatedPassword}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(generatedPassword)
                                alert('Password copiata negli appunti!')
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            📋 Copia Password
                        </button>
                        <Link
                            href="/trainer/trainees"
                            className="block w-full bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            Vai alla Lista Atleti
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainer/trainees"
                        className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna agli atleti
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Nuovo Atleta</h1>
                    <p className="text-gray-600 mt-2">Aggiungi un nuovo atleta al tuo roster</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                    {/* First Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Nome *
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="es. Mario"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Cognome *
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="es. Rossi"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="mario.rossi@email.com"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Password Options */}
                    <div className="border-t pt-6">
                        <div className="mb-4">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={autoPassword}
                                    onChange={(e) => setAutoPassword(e.target.checked)}
                                    className="mr-2 h-5 w-5"
                                />
                                <span className="font-semibold text-gray-700">
                                    Genera password automatica (consigliato)
                                </span>
                            </label>
                            <p className="text-sm text-gray-500 mt-1 ml-7">
                                Verrà generata una password sicura che dovrai comunicare all'atleta
                            </p>
                        </div>

                        {!autoPassword && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Password Manuale *
                                </label>
                                <input
                                    type="password"
                                    value={manualPassword}
                                    onChange={(e) => setManualPassword(e.target.value)}
                                    placeholder="Inserisci password (min 8 caratteri)"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent"
                                    minLength={8}
                                />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-4 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                        >
                            {loading ? (
                                <LoadingSpinner size="sm" color="white" />
                            ) : (
                                'Crea Atleta'
                            )}
                        </button>
                        <Link
                            href="/trainer/trainees"
                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            Annulla
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
