'use client'

import { useState } from 'react'

interface UserCreateModalProps {
    onClose: () => void
    onUserCreated: () => void
}

export default function UserCreateModal({ onClose, onUserCreated }: UserCreateModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [tempPassword, setTempPassword] = useState('')
    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        role: 'trainee' as 'trainer' | 'trainee',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error?.message || 'Errore durante la creazione')
            }

            // Show temporary password
            setTempPassword(data.data.tempPassword)

            // Auto-close after 5 seconds
            setTimeout(() => {
                onUserCreated()
            }, 5000)
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    if (tempPassword) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        ✅ Utente Creato
                    </h2>

                    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                        <p className="text-sm text-green-800 mb-3">
                            L'utente è stato creato con successo. Salva questa password temporanea:
                        </p>
                        <div className="bg-white p-3 rounded border border-green-300 font-mono text-sm break-all">
                            {tempPassword}
                        </div>
                        <p className="text-xs text-green-700 mt-2">
                            ⚠️ Questa password verrà mostrata solo una volta. L'utente dovrà cambiarla al primo accesso.
                        </p>
                    </div>

                    <button
                        onClick={onUserCreated}
                        className="w-full px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Crea Nuovo Utente
                </h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email *
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                            Nome *
                        </label>
                        <input
                            type="text"
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                            Cognome *
                        </label>
                        <input
                            type="text"
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                            Ruolo *
                        </label>
                        <select
                            id="role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'trainer' | 'trainee' })}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        >
                            <option value="trainee" className="text-gray-900">Atleta</option>
                            <option value="trainer" className="text-gray-900">Trainer</option>
                        </select>
                    </div>

                    <div className="flex space-x-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Creando...' : 'Crea Utente'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                        >
                            Annulla
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
