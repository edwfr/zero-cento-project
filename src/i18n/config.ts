export const i18nConfig = {
  locales: ['it', 'en'],
  defaultLocale: 'it',
  localeDetection: true,
} as const

export type Locale = (typeof i18nConfig.locales)[number]
