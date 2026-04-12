'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/Button'

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
    const { t } = useTranslation(['common', 'profile'])
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
                throw new Error(getApiErrorMessage(data, t('errors.updateError'), t))
            }

            setSuccess(t('profile:profile.updated'))

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
        setError('')
        setSuccess('')
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('profile:profile.editPersonalData')}
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
                        {t('common:common.firstName')}
                    </label>
                    <input
                        type="text"
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('common:common.lastName')}
                    </label>
                    <input
                        type="text"
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                        required
                    />
                </div>

                <div className="flex space-x-3 pt-4">
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={loading}
                        isLoading={loading}
                        loadingText={t('common:common.saving')}
                    >
                        {t('common:common.saveChanges')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleCancel}
                        variant="secondary"
                        size="md"
                        disabled={loading}
                    >
                        {t('common:common.cancel')}
                    </Button>
                </div>
            </form>
        </div>
    )
}

