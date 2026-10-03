import trainerIt from '../../../public/locales/it/trainer.json'
import trainerEn from '../../../public/locales/en/trainer.json'
import { startOfUtcDay, wholeDaysBetween } from './dates'

/**
 * Server-side translation for the trainer home. The page is a server component,
 * so it cannot use react-i18next; it reads the same trainer.json files directly.
 */
export type DashboardLocale = 'it' | 'en'
export type TranslationParams = Record<string, string | number>
export type Translate = (key: string, params?: TranslationParams) => string

const DICTIONARIES: Record<DashboardLocale, Record<string, unknown>> = {
    it: trainerIt as Record<string, unknown>,
    en: trainerEn as Record<string, unknown>,
}

const INTL_LOCALES: Record<DashboardLocale, string> = { it: 'it-IT', en: 'en-GB' }

/** Calendar the trainers live in: used for the greeting and today's date. */
const TRAINER_TIME_ZONE = 'Europe/Rome'

export function resolveDashboardLocale(cookieLocale?: string): DashboardLocale {
    if (!cookieLocale) return 'it'
    return cookieLocale.toLowerCase().startsWith('en') ? 'en' : 'it'
}

function lookup(dictionary: Record<string, unknown>, key: string): string | null {
    const value = key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && part in current) {
            return (current as Record<string, unknown>)[part]
        }
        return null
    }, dictionary)
    return typeof value === 'string' ? value : null
}

export function createTranslator(locale: DashboardLocale): Translate {
    const dictionary = DICTIONARIES[locale]

    return (key, params) => {
        const count = params?.count
        const pluralKey = count === 0 ? `${key}_zero` : count === 1 ? `${key}_one` : null
        const template = (pluralKey && lookup(dictionary, pluralKey)) || lookup(dictionary, key)

        if (!template) return key
        if (!params) return template

        return Object.entries(params).reduce(
            (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
            template,
        )
    }
}

export function formatRelative(date: Date, now: Date, t: Translate): string {
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
    if (minutes < 1) return t('trainerDashboard.time.justNow')
    if (minutes < 60) return t('trainerDashboard.time.minutesAgo', { count: minutes })

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('trainerDashboard.time.hoursAgo', { count: hours })

    return t('trainerDashboard.time.daysAgo', { count: Math.floor(hours / 24) })
}

export function formatShortDay(date: Date, locale: DashboardLocale): string {
    return new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date)
}

export function formatDayLabel(dayKey: string, now: Date, locale: DashboardLocale, t: Translate): string {
    const date = new Date(`${dayKey}T00:00:00.000Z`)
    const daysAgo = wholeDaysBetween(date, startOfUtcDay(now))
    if (daysAgo === 0) return t('trainerDashboard.time.today')
    if (daysAgo === 1) return t('trainerDashboard.time.yesterday')

    const weekday = new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: 'short', timeZone: 'UTC' }).format(date)
    return `${weekday} ${formatShortDay(date, locale)}`
}

export function formatLongDate(now: Date, locale: DashboardLocale): string {
    return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: TRAINER_TIME_ZONE,
    }).format(now)
}

export function greetingKey(now: Date): string {
    const hour = Number(
        new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TRAINER_TIME_ZONE }).format(now),
    )
    if (hour < 12) return 'trainerDashboard.header.greetingMorning'
    if (hour < 18) return 'trainerDashboard.header.greetingAfternoon'
    return 'trainerDashboard.header.greetingEvening'
}
