'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import Link from 'next/link'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ToastNotification'

export default function NewTraineePageContent() {
    const router = useRouter()
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()
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
            setError(t('athletes.fillAllFields'))
            return
        }

        if (!autoPassword && !manualPassword.trim()) {
            setError(t('athletes.manualPasswordRequired'))
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
                throw new Error(getApiErrorMessage(data, t('athletes.creationError'), t))
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
                        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {t('athletes.athleteCreatedSuccess')}
                        </h2>
                        <p className="text-gray-600">
                            {t('athletes.athleteAddedMessage', { firstName, lastName })}
                        </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <p className="text-sm font-semibold text-yellow-800 mb-2">
                            {t('athletes.tempPasswordTitle')}
                        </p>
                        <p className="text-sm text-yellow-700 mb-3">
                            {t('athletes.tempPasswordWarning')}
                        </p>
                        <div className="bg-white rounded px-4 py-3 font-mono text-lg text-center border-2 border-yellow-300">
                            {generatedPassword}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(generatedPassword)
                                showToast(t('athletes.passwordCopied'), 'success')
                            }}
                            className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            {t('athletes.copyPassword')}
                        </button>
                        <Link
                            href="/trainer/trainees"
                            className="block w-full bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            {t('athletes.goToAthleteList')}
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
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('athletes.backToAthletes')}
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">{t('athletes.newAthleteTitle')}</h1>
                    <p className="text-gray-600 mt-2">{t('athletes.newAthleteDescription')}</p>
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
                            {t('athletes.firstNameLabel')}
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={loading}
                            placeholder={t('athletes.firstNamePlaceholder')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('athletes.lastNameLabel')}
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={loading}
                            placeholder={t('athletes.lastNamePlaceholder')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('common:common.email')} *
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            placeholder={t('athletes.emailPlaceholder')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                                    disabled={loading}
                                    className="mr-2 h-5 w-5 disabled:cursor-not-allowed"
                                />
                                <span className="font-semibold text-gray-700">
                                    {t('athletes.autoPasswordLabel')}
                                </span>
                            </label>
                            <p className="text-sm text-gray-500 mt-1 ml-7">
                                {t('athletes.autoPasswordHint')}
                            </p>
                        </div>

                        {!autoPassword && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {t('athletes.manualPasswordLabel')}
                                </label>
                                <input
                                    type="password"
                                    value={manualPassword}
                                    onChange={(e) => setManualPassword(e.target.value)}
                                    disabled={loading}
                                    placeholder={t('athletes.manualPasswordPlaceholder')}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                                t('athletes.createAthlete')
                            )}
                        </button>
                        <Link
                            href="/trainer/trainees"
                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                        >
                            {t('common:common.cancel')}
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
