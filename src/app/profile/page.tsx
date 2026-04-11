import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import DashboardLayout from '@/components/DashboardLayout'
import ChangePasswordSection from '@/components/ChangePasswordSection'
import MovementPatternColorsSection from '@/components/MovementPatternColorsSection'
import profileIt from '../../../public/locales/it/profile.json'
import profileEn from '../../../public/locales/en/profile.json'
import commonIt from '../../../public/locales/it/common.json'
import commonEn from '../../../public/locales/en/common.json'

type SupportedLocale = 'it' | 'en'

const PROFILE_DICTIONARIES = {
    it: profileIt,
    en: profileEn,
} as const

const COMMON_DICTIONARIES = {
    it: commonIt,
    en: commonEn,
} as const

const resolveLocale = (cookieLocale?: string): SupportedLocale => {
    if (!cookieLocale) return 'it'
    return cookieLocale.toLowerCase().startsWith('en') ? 'en' : 'it'
}

const resolveTranslation = (dictionary: Record<string, unknown>, key: string): string | null => {
    const value = key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && part in current) {
            return (current as Record<string, unknown>)[part]
        }
        return null
    }, dictionary)

    return typeof value === 'string' ? value : null
}

const translate = (dictionary: Record<string, unknown>, key: string): string => {
    return resolveTranslation(dictionary, key) ?? key
}

export default async function ProfilePage() {
    const session = await getSession()
    const locale = resolveLocale(cookies().get('i18next')?.value)
    const profileDictionary = PROFILE_DICTIONARIES[locale] as Record<string, unknown>
    const commonDictionary = COMMON_DICTIONARIES[locale] as Record<string, unknown>

    const tp = (key: string) => translate(profileDictionary, key)
    const tc = (key: string) => translate(commonDictionary, key)

    if (!session) {
        redirect('/login')
    }

    return (
        <DashboardLayout user={session.user}>
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        {tp('profile.title')}
                    </h1>

                    <div className="space-y-6">
                        {/* User Info Display */}
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                {tp('profile.accountInfo')}
                            </h2>

                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{tc('common.email')}</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{session.user.email}</dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{tp('profile.roleLabel')}</dt>
                                    <dd className="mt-1 text-sm text-gray-900 capitalize">
                                        {session.user.role === 'admin' && tc('roles.admin')}
                                        {session.user.role === 'trainer' && tc('roles.trainer')}
                                        {session.user.role === 'trainee' && tc('roles.trainee')}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{tc('common.firstName')}</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{session.user.firstName}</dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{tc('common.lastName')}</dt>
                                    <dd className="mt-1 text-sm text-gray-900">{session.user.lastName}</dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{tp('profile.userId')}</dt>
                                    <dd className="mt-1 text-sm text-gray-900 font-mono">{session.user.id}</dd>
                                </div>
                            </dl>
                        </div>

                        {/* Security Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                {tp('profile.security')}
                            </h2>
                            <ChangePasswordSection />
                        </div>

                        {/* Movement Pattern Colors - Only for Trainers */}
                        {session.user.role === 'trainer' && (
                            <div className="border-t border-gray-200 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                    {tp('profile.movementPatternColors')}
                                </h2>
                                <MovementPatternColorsSection />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
