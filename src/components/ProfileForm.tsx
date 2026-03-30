'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
    id: string
    email: string
    firstName: string
    lastName: string
}

interface ProfileFormProps {
    user: User
}

export default function ProfileForm({ user }: ProfileFormProps) {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [formData, setFormData] = useState({
        firstName: user.firstName,
        lastName: user.lastName,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error?.message || 'Errore durante l\'aggiornamento')
            }

            setSuccess('Profilo aggiornato con successo')
            setIsEditing(false)

            // Refresh page to update session data
            setTimeout(() => {
                router.refresh()
            }, 1000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = () => {
        setFormData({
            firstName: user.firstName,
            lastName: user.lastName,
        })
        setIsEditing(false)
        setError('')
        setSuccess('')
    }

    if (!isEditing) {
        return (
            <div>
                <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
                >
                    Modifica Profilo
                </button>
            </div>
        )
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Modifica Dati Personali
            </h2>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600">{success}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome
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
                        Cognome
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

                <div className="flex space-x-3 pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Salvando...' : 'Salva Modifiche'}
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
