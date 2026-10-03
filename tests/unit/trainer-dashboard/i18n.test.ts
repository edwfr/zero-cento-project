import { describe, it, expect } from 'vitest'
import {
    createTranslator,
    formatDayLabel,
    formatLongDate,
    formatRelative,
    formatShortDay,
    greetingKey,
    resolveDashboardLocale,
} from '@/lib/trainer-dashboard/i18n'
import { NOW, at, day } from './fixtures'

const t = createTranslator('it')

describe('resolveDashboardLocale', () => {
    it('defaults to Italian and recognises English variants', () => {
        expect(resolveDashboardLocale(undefined)).toBe('it')
        expect(resolveDashboardLocale('it-IT')).toBe('it')
        expect(resolveDashboardLocale('EN-us')).toBe('en')
    })
})

describe('createTranslator', () => {
    it('interpolates parameters', () => {
        expect(t('trainerDashboard.header.greetingMorning', { firstName: 'Edo' })).toBe('Buongiorno, Edo')
    })

    it('picks _one and _zero variants from count when they exist', () => {
        expect(t('trainerDashboard.todo.subscriptionExpiring', { count: 5 })).toBe('Abbonamento in scadenza tra 5 giorni')
        expect(t('trainerDashboard.todo.subscriptionExpiring', { count: 1 })).toBe('Abbonamento in scadenza domani')
        expect(t('trainerDashboard.todo.subscriptionExpiring', { count: 0 })).toBe('Abbonamento in scadenza oggi')
        // no _zero variant: falls back to the base key
        expect(t('trainerDashboard.inactive.lastSession', { count: 0 })).toBe('Ultimo allenamento 0 giorni fa')
    })

    it('returns the key itself when it does not exist', () => {
        expect(t('trainerDashboard.nope')).toBe('trainerDashboard.nope')
    })

    it('translates English', () => {
        expect(createTranslator('en')('trainerDashboard.todo.title')).toBe('To do today')
    })
})

describe('formatRelative', () => {
    it('covers minutes, hours and days', () => {
        expect(formatRelative(at('2026-10-03T09:59:30'), NOW, t)).toBe('poco fa')
        expect(formatRelative(at('2026-10-03T09:35:00'), NOW, t)).toBe('25 min fa')
        expect(formatRelative(at('2026-10-03T09:00:00'), NOW, t)).toBe('1 ora fa')
        expect(formatRelative(at('2026-10-03T03:00:00'), NOW, t)).toBe('7 ore fa')
        expect(formatRelative(at('2026-10-02T03:00:00'), NOW, t)).toBe('ieri')
        expect(formatRelative(at('2026-09-29T08:00:00'), NOW, t)).toBe('4 giorni fa')
    })

    it('treats future instants (clock skew) as just now', () => {
        expect(formatRelative(at('2026-10-03T10:05:00'), NOW, t)).toBe('poco fa')
    })
})

describe('day formatting', () => {
    it('labels today and yesterday, otherwise weekday + dd/MM', () => {
        expect(formatDayLabel('2026-10-03', NOW, 'it', t)).toBe('Oggi')
        expect(formatDayLabel('2026-10-02', NOW, 'it', t)).toBe('Ieri')
        expect(formatDayLabel('2026-09-29', NOW, 'it', t)).toMatch(/mar.*29\/09/i)
    })

    it('formatShortDay prints dd/MM in UTC', () => {
        expect(formatShortDay(day('2026-09-28'), 'it')).toBe('28/09')
    })

    it('formatLongDate uses the Rome calendar day', () => {
        expect(formatLongDate(NOW, 'it')).toMatch(/3 ottobre 2026/i)
        expect(formatLongDate(at('2026-10-03T22:30:00'), 'it')).toMatch(/4 ottobre 2026/i)
    })
})

describe('greetingKey', () => {
    it('follows the hour in Rome (UTC+2 in October)', () => {
        expect(greetingKey(at('2026-10-03T06:00:00'))).toBe('trainerDashboard.header.greetingMorning')
        expect(greetingKey(at('2026-10-03T10:00:00'))).toBe('trainerDashboard.header.greetingAfternoon')
        expect(greetingKey(at('2026-10-03T17:00:00'))).toBe('trainerDashboard.header.greetingEvening')
    })
})
