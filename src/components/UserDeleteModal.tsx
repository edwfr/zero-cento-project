'use client'

import { useState } from 'react'

interface User {
    id: string
    email: string
    firstName: string
    lastName: string
}

interface UserDeleteModalProps {
    user: User
    onClose: () => void
    onUserDeleted: () => void
}

export default function UserDeleteModal({ user, onClose, onUserDeleted }: UserDeleteModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleDelete = async () => {
        setError('')
        setLoading(true)

        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'DELETE',
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error?.message || 'Errore durante l\'eliminazione')
            }

            onUserDeleted()
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                        <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="ml-3 text-xl font-bold text-gray-900">
                        Elimina Utente
                    </h2>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                        Sei sicuro di voler eliminare questo utente? Questa azione è permanente e cancellerà tutti i dati associati.
                    </p>

                    <div className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <div className="flex space-x-3">
                    <button
                        onClick={handleDelete}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Eliminando...' : 'Elimina'}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                    >
                        Annulla
                    </button>
                </div>
            </div>
        </div>
    )
}
