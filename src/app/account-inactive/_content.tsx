'use client'

import { AlertCircle, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface AccountInactiveContentProps {
    trainerName: string | null
    userRole: string
    onLogout: () => Promise<void>
}

export default function AccountInactiveContent({ trainerName, userRole, onLogout }: AccountInactiveContentProps) {
    const { t } = useTranslation(['auth', 'common'])
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleLogout = () => {
        startTransition(async () => {
            await onLogout()
            router.push('/login')
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
                <div className="flex justify-center mb-6">
                    <div className="bg-red-100 rounded-full p-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">
                    {t('auth:accountInactive.title')}
                </h1>

                <p className="text-center text-gray-600 mb-6">
                    {t('auth:accountInactive.message')}
                </p>

                {trainerName && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-gray-700 mb-2">
                            {t('auth:accountInactive.trainerContact')}
                        </p>
                        <p className="font-semibold text-gray-900">
                            {trainerName}
                        </p>
                    </div>
                )}

                {!trainerName && userRole === 'trainee' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-gray-700">
                            {t('auth:accountInactive.noTrainerAssigned')}
                        </p>
                    </div>
                )}

                {userRole !== 'trainee' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-gray-700">
                            {t('auth:accountInactive.adminContact')}
                        </p>
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    {t('auth:accountInactive.logout')}
                </button>
            </div>
        </div>
    )
}
