'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-client'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

export default function ForgotPasswordPage() {
    const { t } = useTranslation(['auth', 'common'])
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
            setError(t('auth:forgotPassword.errorSend'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <Image
                            src="/images/logo/logo.png"
                            alt="ZeroCento Logo"
                            width={96}
                            height={96}
                            className="w-24 h-24 object-contain"
                            onError={(e) => {
                                // Fallback al placeholder se l'immagine non esiste
                                e.currentTarget.style.display = 'none'
                                e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                        />
                        <div className="hidden w-24 h-24 rounded-full bg-gradient-to-br from-brand-primary to-[#FF8C00] flex items-center justify-center shadow-lg">
                            <span className="text-white text-4xl font-bold">0&rarr;100</span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('auth:forgotPassword.title')}</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        {t('auth:forgotPassword.description')}
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
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('auth:forgotPassword.success')}</h2>
                            <p className="text-gray-600 text-sm mb-6">
                                {t('auth:forgotPassword.successDescription')}
                            </p>
                            <Link
                                href="/login"
                                className="text-brand-primary hover:text-brand-primary-hover font-semibold text-sm"
                            >
                                {t('auth:forgotPassword.backToLogin')}
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
                                <FormLabel>
                                    {t('common:common.email')}
                                </FormLabel>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    placeholder={t('auth:forgotPassword.emailPlaceholder')}
                                    inputSize="lg"
                                />
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                disabled={loading || !email}
                                isLoading={loading}
                                loadingText={t('common:common.loadingProgress')}
                            >
                                {t('auth:forgotPassword.submit')}
                            </Button>

                            <div className="text-center text-sm text-gray-600">
                                {t('auth:forgotPassword.rememberPassword')}{' '}
                                <Link href="/login" className="text-brand-primary hover:text-brand-primary-hover font-semibold">
                                    {t('auth:login.title')}
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

