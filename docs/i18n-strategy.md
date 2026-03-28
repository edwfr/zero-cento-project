# Internazionalizzazione (i18n) - Strategy

**Documento**: Strategia internazionalizzazione  
**Versione**: 1.0  
**Data**: 2026-03-28  
**Lingue supportate MVP**: Italiano (default), Inglese  

---

## Panoramica

La piattaforma supporta internazionalizzazione completa (UI, email, notifiche) con framework **i18next** e adapter **next-i18next** per Next.js App Router.

**Scelte architetturali**:
1. **File-based translations** — JSON locale files per ogni lingua
2. **Server-side + Client-side** — Traduzioni disponibili sia su Server Components che Client Components
3. **URL-based routing** — Prefisso lingua in URL (es. `/it/dashboard`, `/en/dashboard`)
4. **Persistence** — Preferenza lingua salvata in cookie + localStorage
5. **Fallback** — Se traduzione mancante, usa italiano (lingua default)

---

## Stack Tecnologico

| Package                            | Versione | Scopo                                                             |
| ---------------------------------- | -------- | ----------------------------------------------------------------- |
| `i18next`                          | ^23.7.0  | Core i18n engine (detection, interpolazione, plurali, namespaces) |
| `react-i18next`                    | ^14.0.0  | React bindings (hook `useTranslation`, component `Trans`)         |
| `next-i18next`                     | ^15.2.0  | Next.js App Router integration (middleware, server-side)          |
| `i18next-browser-languagedetector` | ^7.2.0   | Auto-detection lingua browser (fallback se cookie assente)        |

---

## Struttura File

```
/public
  /locales
    /it
      common.json          # Traduzioni comuni (header, footer, bottoni)
      auth.json            # Pagine login, signup, forgot password
      dashboard.json       # Dashboard trainer/trainee/admin
      programs.json        # Schede allenamento, settimane, workout
      exercises.json       # Libreria esercizi, gruppi muscolari, pattern
      feedback.json        # Form feedback trainee, RPE, note
      errors.json          # Messaggi errore, validazioni
      emails.json          # Template email (subject, body)
    /en
      common.json
      auth.json
      dashboard.json
      programs.json
      exercises.json
      feedback.json
      errors.json
      emails.json
```

**Esempio `/public/locales/it/common.json`**:
```json
{
  "navigation": {
    "dashboard": "Dashboard",
    "programs": "Schede",
    "exercises": "Esercizi",
    "trainees": "Allievi",
    "settings": "Impostazioni",
    "logout": "Esci"
  },
  "actions": {
    "save": "Salva",
    "cancel": "Annulla",
    "delete": "Elimina",
    "edit": "Modifica",
    "create": "Crea",
    "back": "Indietro",
    "next": "Avanti"
  },
  "status": {
    "draft": "Bozza",
    "active": "Attiva",
    "completed": "Completata"
  }
}
```

**Esempio `/public/locales/en/common.json`**:
```json
{
  "navigation": {
    "dashboard": "Dashboard",
    "programs": "Programs",
    "exercises": "Exercises",
    "trainees": "Trainees",
    "settings": "Settings",
    "logout": "Logout"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "back": "Back",
    "next": "Next"
  },
  "status": {
    "draft": "Draft",
    "active": "Active",
    "completed": "Completed"
  }
}
```

---

## Configurazione i18next

**File**: `/lib/i18n/config.ts`

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

export const defaultLocale = 'it'
export const locales = ['it', 'en'] as const
export type Locale = typeof locales[number]

export const localeNames: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
}

i18n
  .use(LanguageDetector) // Auto-detect lingua browser
  .use(initReactI18next) // React bindings
  .init({
    fallbackLng: defaultLocale,
    supportedLngs: locales,
    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'programs', 'exercises', 'feedback', 'errors', 'emails'],
    
    detection: {
      order: ['cookie', 'localStorage', 'navigator'],
      caches: ['cookie', 'localStorage'],
      cookieName: 'NEXT_LOCALE',
    },
    
    interpolation: {
      escapeValue: false, // React già escapa automaticamente
    },
    
    react: {
      useSuspense: false, // Evita problemi SSR
    },
  })

export default i18n
```

---

## Middleware Next.js (URL-based routing)

**File**: `/middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/lib/i18n/config'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Escludi API routes, static assets, _next
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    /\.(.*)$/.test(pathname) // file con estensione
  ) {
    return NextResponse.next()
  }

  // Check se URL ha già prefisso lingua
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    return NextResponse.next()
  }

  // Auto-detect lingua da cookie o header Accept-Language
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value as Locale | undefined
  const acceptLanguage = req.headers.get('accept-language') || ''
  const browserLocale = acceptLanguage.split(',')[0].split('-')[0] // es. "en-US" -> "en"

  const locale = 
    (cookieLocale && locales.includes(cookieLocale)) ? cookieLocale :
    (locales.includes(browserLocale as Locale)) ? browserLocale :
    defaultLocale

  // Redirect con prefisso lingua
  req.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(req.nextUrl)
}

export const config = {
  matcher: ['/((?!api|_next|static|.*\\..*).*)'],
}
```

---

## Uso in Client Components

```tsx
'use client'

import { useTranslation } from 'react-i18next'

export default function DashboardHeader() {
  const { t, i18n } = useTranslation(['common', 'dashboard'])

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    // Cookie aggiornato automaticamente da i18next-browser-languagedetector
  }

  return (
    <header>
      <h1>{t('dashboard:welcome', { name: 'Mario' })}</h1>
      {/* Interpola variabile: "Benvenuto, Mario!" */}
      
      <nav>
        <a href="/dashboard">{t('common:navigation.dashboard')}</a>
        <a href="/programs">{t('common:navigation.programs')}</a>
        <a href="/exercises">{t('common:navigation.exercises')}</a>
      </nav>

      <div>
        <button onClick={() => changeLanguage('it')}>🇮🇹 IT</button>
        <button onClick={() => changeLanguage('en')}>🇬🇧 EN</button>
      </div>
    </header>
  )
}
```

---

## Uso in Server Components

**Next.js App Router + i18next server-side**:

```tsx
import { createTranslation } from '@/lib/i18n/server'

export default async function DashboardPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  const { t } = await createTranslation(locale, 'dashboard')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  )
}
```

**File**: `/lib/i18n/server.ts`

```typescript
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next/initReactI18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { defaultLocale, locales } from './config'

export async function createTranslation(locale: string, ns: string | string[]) {
  const i18nInstance = createInstance()

  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          import(`@/public/locales/${language}/${namespace}.json`)
      )
    )
    .init({
      lng: locale,
      fallbackLng: defaultLocale,
      supportedLngs: locales,
      defaultNS: Array.isArray(ns) ? ns[0] : ns,
      ns,
    })

  return {
    t: i18nInstance.getFixedT(locale, Array.isArray(ns) ? ns[0] : ns),
    i18n: i18nInstance,
  }
}
```

---

## Traduzioni Database Content

**Problema**: I dati dinamici nel database (es. nomi esercizi, note allenamento) sono in italiano. Come gestiamo traduzioni?

### Approccio 1: Colonne multiple (per contenuti statici)

**Caso d'uso**: MuscleGroup.name, MovementPattern.name (set limitato, gestito da admin)

```prisma
model MuscleGroup {
  id          String   @id @default(uuid())
  name_it     String   // "Pettorali"
  name_en     String   // "Pectorals"
  description_it String?
  description_en String?
  // ...
}
```

**Pro**: Query semplici, nessun JOIN aggiuntivo  
**Contro**: Colonne duplicate, non scala per > 5 lingue

---

### Approccio 2: Tabella traduzioni separata (per contenuti dinamici)

**Caso d'uso**: Exercise.name, Exercise.description (libreria condivisa, centinaia di esercizi)

```prisma
model Exercise {
  id                String   @id @default(uuid())
  // ... altri campi
  translations      ExerciseTranslation[]
}

model ExerciseTranslation {
  id         String   @id @default(uuid())
  exerciseId String
  locale     String   // 'it' | 'en'
  name       String
  description String?
  
  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  
  @@unique([exerciseId, locale])
  @@index([exerciseId])
}
```

**Query con traduzione**:
```typescript
const exercise = await prisma.exercise.findUnique({
  where: { id: exerciseId },
  include: {
    translations: {
      where: { locale: currentLocale },
    },
  },
})

const translatedName = exercise.translations[0]?.name || exercise.translations.find(t => t.locale === 'it')?.name || 'N/A'
```

**Pro**: Scalabile per N lingue, nessuna colonna duplicata  
**Contro**: JOIN aggiuntivo su ogni query, complessità ORM

---

### Approccio 3: JSON field (compromesso per MVP)

```prisma
model Exercise {
  id          String   @id @default(uuid())
  name        Json     // { "it": "Squat", "en": "Squat" }
  description Json?    // { "it": "Accosciata", "en": "Squat movement" }
  // ...
}
```

**Helper TypeScript**:
```typescript
type TranslatedField = Record<Locale, string>

function translate(field: TranslatedField, locale: Locale): string {
  return field[locale] || field['it'] || Object.values(field)[0]
}

// Uso
const exerciseName = translate(exercise.name, currentLocale)
```

**Pro**: Flessibile, nessuna tabella aggiuntiva, supporta N lingue  
**Contro**: Nessuna type-safety Prisma, non indicizzabile per ricerca full-text

---

### **Decisione MVP**: Approccio misto

| Entità              | Strategia                               | Rationale                                                    |
| ------------------- | --------------------------------------- | ------------------------------------------------------------ |
| **MuscleGroup**     | Colonne multiple (`name_it`, `name_en`) | Set limitato (~20 gruppi muscolari), gestito da admin        |
| **MovementPattern** | Colonne multiple (`name_it`, `name_en`) | Set limitato (~10 pattern), gestito da admin                 |
| **Exercise**        | JSON field (`name`, `description`)      | Libreria condivisa crescente, creata da trainer              |
| **User-generated**  | Solo italiano per MVP                   | Note allenamento, feedback trainee — user input non tradotto |

**Nota**: Email template e UI statiche tradotte con i18next (file JSON). User-generated content (UGC) rimane monolingua per MVP.

---

## Email Templates (Multilingua)

**Stack**: React Email + i18next

**File**: `/emails/WelcomeEmail.tsx`

```tsx
import { Body, Container, Head, Html, Text, Button } from '@react-email/components'

interface WelcomeEmailProps {
  firstName: string
  email: string
  temporaryPassword: string
  locale: 'it' | 'en'
}

const translations = {
  it: {
    subject: 'Benvenuto su ZeroCento',
    greeting: (name: string) => `Ciao ${name},`,
    body: 'Il tuo account è stato creato con successo.',
    credentials: 'Credenziali di accesso temporanee:',
    email: 'Email',
    password: 'Password temporanea',
    action: 'Accedi ora',
    footer: 'Cambia la password al primo accesso.',
  },
  en: {
    subject: 'Welcome to ZeroCento',
    greeting: (name: string) => `Hi ${name},`,
    body: 'Your account has been successfully created.',
    credentials: 'Temporary login credentials:',
    email: 'Email',
    password: 'Temporary password',
    action: 'Login now',
    footer: 'Change your password on first login.',
  },
}

export default function WelcomeEmail({
  firstName,
  email,
  temporaryPassword,
  locale = 'it',
}: WelcomeEmailProps) {
  const t = translations[locale]

  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>{t.greeting(firstName)}</Text>
          <Text>{t.body}</Text>
          <Text><strong>{t.credentials}</strong></Text>
          <Text>{t.email}: {email}</Text>
          <Text>{t.password}: {temporaryPassword}</Text>
          <Button href="https://zerocento.app/login">{t.action}</Button>
          <Text>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

**Invio email con lingua utente**:
```typescript
import { render } from '@react-email/render'
import WelcomeEmail from '@/emails/WelcomeEmail'

const locale = user.preferredLanguage || 'it' // User.preferredLanguage salvato nel DB

const emailHtml = render(
  <WelcomeEmail 
    firstName={user.firstName}
    email={user.email}
    temporaryPassword={tempPassword}
    locale={locale}
  />
)

await sendEmail({
  to: user.email,
  subject: locale === 'it' ? 'Benvenuto su ZeroCento' : 'Welcome to ZeroCento',
  html: emailHtml,
})
```

---

## Persistenza Preferenza Lingua

### Cookie (Cross-session)

Middleware i18next salva automaticamente preferenza in cookie `NEXT_LOCALE`.

**Cookie attributes**:
```typescript
{
  name: 'NEXT_LOCALE',
  maxAge: 60 * 60 * 24 * 365, // 1 anno
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}
```

---

### Database (Opzionale - per user preference persistenza server-side)

Aggiungere campo `preferredLanguage` al model User:

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  firstName         String
  lastName          String
  role              Role
  isActive          Boolean  @default(true)
  preferredLanguage String   @default("it") // 'it' | 'en'
  createdAt         DateTime @default(now())
  // ...
}
```

**Workflow**:
1. Utente cambia lingua via dropdown → aggiorna cookie + DB
2. Al login successivo → middleware legge `User.preferredLanguage` e setta cookie
3. Cookie ha precedenza su DB (user può override temporaneamente senza salvataggio permanente)

---

## Pluralizzazione

i18next supporta plurali automatici.

**File**: `/public/locales/it/dashboard.json`

```json
{
  "traineeCount": "{{count}} allievo",
  "traineeCount_plural": "{{count}} allievi"
}
```

**File**: `/public/locales/en/dashboard.json`

```json
{
  "traineeCount": "{{count}} trainee",
  "traineeCount_plural": "{{count}} trainees"
}
```

**Uso**:
```tsx
const { t } = useTranslation('dashboard')

<p>{t('traineeCount', { count: traineeList.length })}</p>
// count=1 → "1 allievo" (IT) | "1 trainee" (EN)
// count=5 → "5 allievi" (IT) | "5 trainees" (EN)
```

---

## Formattazione Date & Numeri

**Date**: `date-fns` con locale support

```typescript
import { format } from 'date-fns'
import { it, enUS } from 'date-fns/locale'

const locales = { it, en: enUS }

const formattedDate = format(
  new Date(),
  'PPP', // "1 gennaio 2026" (IT) | "January 1st, 2026" (EN)
  { locale: locales[currentLocale] }
)
```

**Numeri / Pesi**: `Intl.NumberFormat`

```typescript
const weight = 82.5 // kg

const formattedWeight = new Intl.NumberFormat(currentLocale, {
  style: 'unit',
  unit: 'kilogram',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
}).format(weight)

// IT: "82,5 kg"
// EN: "82.5 kg"
```

---

## Testing i18n

### Unit Tests (Vitest)

```typescript
import { renderHook } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n/config'

describe('Translation', () => {
  it('should translate common.actions.save to Italian', () => {
    i18n.changeLanguage('it')
    const { result } = renderHook(() => useTranslation('common'))
    expect(result.current.t('actions.save')).toBe('Salva')
  })

  it('should translate common.actions.save to English', () => {
    i18n.changeLanguage('en')
    const { result } = renderHook(() => useTranslation('common'))
    expect(result.current.t('actions.save')).toBe('Save')
  })
})
```

---

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test'

test.describe('i18n', () => {
  test('should display Italian UI by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Esci')).toBeVisible() // Logout in italiano
  })

  test('should switch to English', async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("🇬🇧 EN")')
    await expect(page).toHaveURL('/en/dashboard')
    await expect(page.locator('text=Logout')).toBeVisible() // Logout in inglese
  })

  test('should persist language preference in cookie', async ({ page, context }) => {
    await page.goto('/')
    await page.click('button:has-text("🇬🇧 EN")')
    
    // Verifica cookie
    const cookies = await context.cookies()
    const localeCookie = cookies.find(c => c.name === 'NEXT_LOCALE')
    expect(localeCookie?.value).toBe('en')

    // Ricarica pagina, dovrebbe rimanere inglese
    await page.reload()
    await expect(page.locator('text=Logout')).toBeVisible()
  })
})
```

---

## Estensione Lingue Future

Per aggiungere una nuova lingua (es. spagnolo):

1. **Creare cartella traduzioni**:
   ```
   /public/locales/es/
     common.json
     auth.json
     dashboard.json
     ...
   ```

2. **Aggiornare config**:
   ```typescript
   // /lib/i18n/config.ts
   export const locales = ['it', 'en', 'es'] as const
   export const localeNames = {
     it: 'Italiano',
     en: 'English',
     es: 'Español',
   }
   ```

3. **Aggiornare schema Prisma** (se si usa colonne multiple):
   ```prisma
   model MuscleGroup {
     name_it String
     name_en String
     name_es String // Aggiunta
   }
   ```

4. **Tradurre file JSON** con servizio professionale (es. Lokalise, Crowdin)

5. **Testing**: Eseguire suite E2E con locale `es`

---

## Checklist Pre-Deploy i18n

- [x] Tutte le stringhe UI wrappate in `t()` (no hardcoded text)
- [x] Email templates supportano `locale` prop
- [x] Middleware redirect corretto per URL senza prefisso lingua
- [x] Cookie `NEXT_LOCALE` persistito con maxAge 1 anno
- [x] Fallback a italiano per traduzioni mancanti
- [x] Date formattate con `date-fns` locale-aware
- [x] Numeri/pesi formattati con `Intl.NumberFormat`
- [x] E2E test copertura switch lingua IT ↔ EN
- [ ] Traduzioni revisionate da native speaker inglese

---

## Riferimenti

- [i18next Documentation](https://www.i18next.com/)
- [next-i18next Guide](https://github.com/i18next/next-i18next)
- [React Email i18n Example](https://react.email/docs/integrations/with-i18n)
- [date-fns Locales](https://date-fns.org/docs/Locale)
- [Intl.NumberFormat MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
