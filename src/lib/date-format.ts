/**
 * Date and Number Formatting Utilities with i18n Support
 * 
 * Provides consistent date and number formatting across the application
 * that respects the user's locale preference.
 */

import i18n from 'i18next'

/**
 * Get the current locale from i18n or fallback to default
 */
function getCurrentLocale(): string {
    return i18n.language || 'it-IT'
}

/**
 * Map short locale codes to full locale codes
 */
function getFullLocale(locale: string): string {
    const localeMap: Record<string, string> = {
        'it': 'it-IT',
        'en': 'en-US',
    }
    return localeMap[locale] || locale
}

/**
 * Format a date for display with locale support
 * 
 * @param date - Date string, Date object, or timestamp to format
 * @param format - Format type: 'short' (dd/mm/yyyy), 'medium' (dd Mon yyyy), 'long' (full date)
 * @returns Formatted date string
 * 
 * @example
 * formatDate('2024-03-30') // "30/03/2024" (in it locale)
 * formatDate('2024-03-30', 'medium') // "30 mar 2024"
 * formatDate('2024-03-30', 'long') // "30 marzo 2024"
 */
export function formatDate(
    date: string | Date | number | null | undefined,
    format: 'short' | 'medium' | 'long' = 'short'
): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' || typeof date === 'number'
            ? new Date(date)
            : date

        if (isNaN(dateObj.getTime())) return '-'

        const locale = getFullLocale(getCurrentLocale())

        let options: Intl.DateTimeFormatOptions

        if (format === 'short') {
            options = { year: 'numeric', month: '2-digit', day: '2-digit' }
        } else if (format === 'medium') {
            options = { year: 'numeric', month: 'short', day: '2-digit' }
        } else {
            options = { year: 'numeric', month: 'long', day: '2-digit', weekday: 'long' }
        }

        return dateObj.toLocaleDateString(locale, options)
    } catch (error) {
        console.error('Error formatting date:', error)
        return '-'
    }
}

/**
 * Format a date and time for display with locale support
 * 
 * @param date - Date string, Date object, or timestamp to format
 * @param format - Format type: 'short' or 'medium'
 * @returns Formatted date and time string
 * 
 * @example
 * formatDateTime('2024-03-30T14:30:00') // "30/03/2024, 14:30"
 * formatDateTime('2024-03-30T14:30:00', 'medium') // "30 mar 2024, 14:30"
 */
export function formatDateTime(
    date: string | Date | number | null | undefined,
    format: 'short' | 'medium' = 'short'
): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' || typeof date === 'number'
            ? new Date(date)
            : date

        if (isNaN(dateObj.getTime())) return '-'

        const locale = getFullLocale(getCurrentLocale())

        let options: Intl.DateTimeFormatOptions

        if (format === 'short') {
            options = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }
        } else {
            options = {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }
        }

        return dateObj.toLocaleString(locale, options)
    } catch (error) {
        console.error('Error formatting datetime:', error)
        return '-'
    }
}

/**
 * Format a number for display with locale support
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 * 
 * @example
 * formatNumber(1234567) // "1.234.567" (in it locale) or "1,234,567" (in en locale)
 * formatNumber(1234.567, 2) // "1.234,57" (in it locale)
 */
export function formatNumber(
    value: number | null | undefined,
    decimals: number = 0
): string {
    if (value === null || value === undefined) return '0'

    try {
        const locale = getFullLocale(getCurrentLocale())
        return value.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })
    } catch (error) {
        console.error('Error formatting number:', error)
        return String(value)
    }
}

/**
 * Format date for HTML input[type="date"] (YYYY-MM-DD format)
 * 
 * @param date - Date string, Date object, or timestamp to format
 * @returns Date string in YYYY-MM-DD format
 * 
 * @example
 * formatDateForInput(new Date()) // "2024-03-30"
 */
export function formatDateForInput(date: string | Date | number | null | undefined): string {
    if (!date) return ''

    try {
        const dateObj = typeof date === 'string' || typeof date === 'number'
            ? new Date(date)
            : date

        if (isNaN(dateObj.getTime())) return ''

        return dateObj.toISOString().split('T')[0]
    } catch (error) {
        console.error('Error formatting date for input:', error)
        return ''
    }
}

/**
 * Get today's date in YYYY-MM-DD format for input max/min values
 * 
 * @returns Today's date in YYYY-MM-DD format
 */
export function getTodayForInput(): string {
    return new Date().toISOString().split('T')[0]
}

/**
 * Format a relative time (e.g., "2 days ago", "in 3 hours")
 * 
 * @param date - Date string, Date object, or timestamp to format
 * @returns Relative time string
 * 
 * @example
 * formatRelativeTime('2024-03-28') // "2 days ago"
 */
export function formatRelativeTime(date: string | Date | number | null | undefined): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' || typeof date === 'number'
            ? new Date(date)
            : date

        if (isNaN(dateObj.getTime())) return '-'

        const now = new Date()
        const diffMs = now.getTime() - dateObj.getTime()
        const diffSec = Math.floor(diffMs / 1000)
        const diffMin = Math.floor(diffSec / 60)
        const diffHour = Math.floor(diffMin / 60)
        const diffDay = Math.floor(diffHour / 24)
        const diffWeek = Math.floor(diffDay / 7)
        const diffMonth = Math.floor(diffDay / 30)
        const diffYear = Math.floor(diffDay / 365)

        const locale = getCurrentLocale()

        // Simple relative time formatting (could be enhanced with i18n keys)
        if (Math.abs(diffSec) < 60) {
            return locale === 'it' ? 'poco fa' : 'just now'
        } else if (Math.abs(diffMin) < 60) {
            return locale === 'it'
                ? `${Math.abs(diffMin)} ${Math.abs(diffMin) === 1 ? 'minuto' : 'minuti'} fa`
                : `${Math.abs(diffMin)} ${Math.abs(diffMin) === 1 ? 'minute' : 'minutes'} ago`
        } else if (Math.abs(diffHour) < 24) {
            return locale === 'it'
                ? `${Math.abs(diffHour)} ${Math.abs(diffHour) === 1 ? 'ora' : 'ore'} fa`
                : `${Math.abs(diffHour)} ${Math.abs(diffHour) === 1 ? 'hour' : 'hours'} ago`
        } else if (Math.abs(diffDay) < 7) {
            return locale === 'it'
                ? `${Math.abs(diffDay)} ${Math.abs(diffDay) === 1 ? 'giorno' : 'giorni'} fa`
                : `${Math.abs(diffDay)} ${Math.abs(diffDay) === 1 ? 'day' : 'days'} ago`
        } else if (Math.abs(diffWeek) < 4) {
            return locale === 'it'
                ? `${Math.abs(diffWeek)} ${Math.abs(diffWeek) === 1 ? 'settimana' : 'settimane'} fa`
                : `${Math.abs(diffWeek)} ${Math.abs(diffWeek) === 1 ? 'week' : 'weeks'} ago`
        } else if (Math.abs(diffMonth) < 12) {
            return locale === 'it'
                ? `${Math.abs(diffMonth)} ${Math.abs(diffMonth) === 1 ? 'mese' : 'mesi'} fa`
                : `${Math.abs(diffMonth)} ${Math.abs(diffMonth) === 1 ? 'month' : 'months'} ago`
        } else {
            return locale === 'it'
                ? `${Math.abs(diffYear)} ${Math.abs(diffYear) === 1 ? 'anno' : 'anni'} fa`
                : `${Math.abs(diffYear)} ${Math.abs(diffYear) === 1 ? 'year' : 'years'} ago`
        }
    } catch (error) {
        console.error('Error formatting relative time:', error)
        return '-'
    }
}
