'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import commonIt from '../../../public/locales/it/common.json'
import commonEn from '../../../public/locales/en/common.json'
import authIt from '../../../public/locales/it/auth.json'
import authEn from '../../../public/locales/en/auth.json'
import errorsIt from '../../../public/locales/it/errors.json'
import errorsEn from '../../../public/locales/en/errors.json'
import navigationIt from '../../../public/locales/it/navigation.json'
import navigationEn from '../../../public/locales/en/navigation.json'
import trainerIt from '../../../public/locales/it/trainer.json'
import trainerEn from '../../../public/locales/en/trainer.json'
import traineeIt from '../../../public/locales/it/trainee.json'
import traineeEn from '../../../public/locales/en/trainee.json'
import adminIt from '../../../public/locales/it/admin.json'
import adminEn from '../../../public/locales/en/admin.json'
import profileIt from '../../../public/locales/it/profile.json'
import profileEn from '../../../public/locales/en/profile.json'
import componentsIt from '../../../public/locales/it/components.json'
import componentsEn from '../../../public/locales/en/components.json'
import validationIt from '../../../public/locales/it/validation.json'
import validationEn from '../../../public/locales/en/validation.json'

export const defaultLocale = 'it'
export const locales = ['it', 'en'] as const
export type Locale = typeof locales[number]

export const localeNames: Record<Locale, string> = {
    it: 'Italiano',
    en: 'English',
}

const resources = {
    it: {
        common: commonIt,
        auth: authIt,
        errors: errorsIt,
        navigation: navigationIt,
        trainer: trainerIt,
        trainee: traineeIt,
        admin: adminIt,
        profile: profileIt,
        components: componentsIt,
        validation: validationIt,
    },
    en: {
        common: commonEn,
        auth: authEn,
        errors: errorsEn,
        navigation: navigationEn,
        trainer: trainerEn,
        trainee: traineeEn,
        admin: adminEn,
        profile: profileEn,
        components: componentsEn,
        validation: validationEn,
    },
}

// Initialize i18next
if (!i18n.isInitialized) {
    i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
            resources,
            lng: defaultLocale,
            fallbackLng: defaultLocale,
            supportedLngs: locales,
            interpolation: {
                escapeValue: false,
            },
            defaultNS: 'common',
            ns: ['common', 'auth', 'errors', 'navigation', 'trainer', 'trainee', 'admin', 'profile', 'components', 'validation'],
            detection: {
                order: ['localStorage', 'cookie', 'navigator'],
                caches: ['localStorage', 'cookie'],
            },
        })
}

export default i18n
