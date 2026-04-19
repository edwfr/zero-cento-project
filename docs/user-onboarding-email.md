# User Onboarding via Email

**Documento tecnico**: Sistema di onboarding utenti via email invece di password temporanea  
**Data**: 2026-04-01  
**Autore**: Sistema di sviluppo ZeroCento  

---

## Problema Attuale

Attualmente, quando un trainer/admin crea un nuovo utente:

1. ✅ Il sistema genera una **password temporanea casuale**
2. ❌ La password viene restituita al creatore (trainer/admin)
3. ❌ Il creatore deve comunicare manualmente la password al nuovo utente (WhatsApp, email, SMS)
4. ❌ L'utente deve fare login e cambiarla obbligatoriamente al primo accesso

**Problemi**:
- 🔐 La password transita per canali non sicuri (WhatsApp, SMS)
- 📱 Richiede coordinazione manuale tra trainer e trainee
- ⚠️ Rischio che la password temporanea venga intercettata o persa
- 😟 User experience non ottimale per il trainee

---

## Soluzione Proposta: Onboarding via Email

### Flusso Migliorato

1. ✅ Trainer/Admin crea nuovo utente (solo email + dati anagrafici)
2. ✅ Il sistema invia automaticamente un'email al nuovo utente con un **magic link**
3. ✅ L'utente clicca il link e imposta la sua password personale
4. ✅ L'utente accede direttamente alla piattaforma

**Vantaggi**:
- 🔐 **Sicurezza**: Nessuna password transita per canali esterni
- 🚀 **Autonomia**: Il trainee si registra autonomamente quando vuole
- 📧 **Professionalità**: Email brandizzata con logo e colori aziendali
- ✨ **UX migliore**: Processo simile a quello di altre piattaforme moderne
- 🌍 **i18n-ready**: Email personalizzate per lingua utente

---

## Implementazione Tecnica

### Opzione 1: `admin.inviteUserByEmail()` (Consigliata) ⭐

Supabase fornisce un'API specifica per invitare nuovi utenti.

#### Backend: Modifica `/api/users/route.ts`

```typescript
// POST /api/users
export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth()
        const body = await request.json()

        const validation = createUserSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors)
        }

        const { email, firstName, lastName, role } = validation.data

        // Permission checks (come prima)
        if (role === 'admin') {
            return apiError('FORBIDDEN', 'Cannot create admin users', 403)
        }
        // ... altri controlli permessi

        // Check email già esistente
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return apiError('CONFLICT', 'Email already exists', 409)
        }

        // ⭐ NUOVO: Invita utente via email (no password temporanea)
        const supabase = createAdminClient()
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
            email,
            {
                // URL dove l'utente verrà reindirizzato dopo aver cliccato il link
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/set-password`,
                data: {
                    role,
                    firstName,
                    lastName,
                    // Lingua dell'utente per email localizzata
                    locale: body.locale || 'it', // default italiano
                },
            }
        )

        if (authError) {
            logger.error({ error: authError }, 'Failed to invite user')
            return apiError('INTERNAL_ERROR', 'Failed to send invitation', 500)
        }

        // Create user in Prisma (con flag invitationPending)
        const user = await prisma.user.create({
            data: {
                id: authData.user.id,
                email,
                firstName,
                lastName,
                role,
                isActive: false, // ⭐ Attivo solo dopo che completa la registrazione
            },
        })

        // Associazione trainer-trainee (se applicabile)
        if (role === 'trainee' && session.user.role === 'trainer') {
            await prisma.trainerTrainee.create({
                data: {
                    trainerId: session.user.id,
                    traineeId: user.id,
                },
            })
        }

        logger.info({ userId: user.id, role }, 'User invited successfully')

        return apiSuccess(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    status: 'invitation_sent', // ⭐ Nuovo campo status
                },
                message: 'Invitation email sent successfully',
            },
            201
        )
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error inviting user')
        return apiError('INTERNAL_ERROR', 'Failed to invite user', 500)
    }
}
```

#### Frontend: Nuova pagina `/onboarding/set-password`

Crea `src/app/onboarding/set-password/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useTranslation } from 'react-i18next'

export default function SetPasswordPage() {
    const { t } = useTranslation(['auth', 'common'])
    const router = useRouter()
    const searchParams = useSearchParams()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [userData, setUserData] = useState<any>(null)

    useEffect(() => {
        // Verifica che il token sia valido
        const checkInvitation = async () => {
            try {
                const supabase = createClient()
                const { data: { user }, error } = await supabase.auth.getUser()

                if (error || !user) {
                    setError('Link di invito non valido o scaduto')
                    setVerifying(false)
                    return
                }

                // Se l'utente ha già una password, reindirizza al dashboard
                if (user.confirmed_at) {
                    router.push('/login')
                    return
                }

                setUserData(user)
                setVerifying(false)
            } catch (err) {
                setError('Errore durante la verifica dell\'invito')
                setVerifying(false)
            }
        }

        checkInvitation()
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError('Le password non coincidono')
            return
        }

        if (password.length < 8) {
            setError('La password deve essere lunga almeno 8 caratteri')
            return
        }

        setLoading(true)

        try {
            const supabase = createClient()
            
            // Imposta la password
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            })

            if (updateError) throw updateError

            // Attiva l'utente nel database
            await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            // Redirect al dashboard
            const role = userData.user_metadata.role
            router.push(`/${role}/dashboard`)
        } catch (err: any) {
            setError('Impossibile impostare la password. Riprova.')
        } finally {
            setLoading(false)
        }
    }

    if (verifying) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFA700] mx-auto mb-4" />
                    <p className="text-gray-600">Verifica link in corso...</p>
                </div>
            </div>
        )
    }

    if (error && !userData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <p className="text-red-800">{error}</p>
                        <a href="/login" className="text-[#FFA700] hover:underline mt-4 inline-block">
                            Torna al login
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/images/logo/logo.png"
                            alt="ZeroCento Logo"
                            className="w-24 h-24 object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Benvenuto su ZeroCento</h1>
                    <p className="text-gray-600 mt-2 text-sm">
                        Ciao {userData?.user_metadata?.firstName}! Imposta la tua password per iniziare.
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                disabled={loading}
                                placeholder="Minimo 8 caratteri"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Conferma Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                disabled={loading}
                                placeholder="Ripeti la password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFA700] focus:border-transparent disabled:bg-gray-100"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password || !confirmPassword}
                            className="w-full bg-[#FFA700] hover:bg-[#FF9500] disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
                        >
                            {loading ? 'Salvataggio...' : 'Completa Registrazione'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
```

#### API route per attivazione utente

Crea `src/app/api/auth/activate/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth-utils'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/activate
 * Attiva un utente dopo che ha completato l'onboarding
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth()

        // Attiva l'utente
        await prisma.user.update({
            where: { id: session.user.id },
            data: { isActive: true },
        })

        logger.info({ userId: session.user.id }, 'User activated after onboarding')

        return apiSuccess({ message: 'User activated successfully' })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error activating user')
        return apiError('INTERNAL_ERROR', 'Failed to activate user', 500)
    }
}
```

#### Aggiorna middleware

In `src/middleware.ts`, aggiungi la route pubblica:

```typescript
const PUBLIC_ROUTES = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/force-change-password',
    '/onboarding/set-password', // ⭐ Nuovo
]
```

---

### Opzione 2: Riuso `resetPasswordForEmail()` (Alternativa più semplice)

Se non vuoi creare una nuova pagina, puoi riusare il flusso di reset password:

```typescript
// Nel POST /api/users
const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?isNewUser=true`,
})
```

Pro:
- ✅ Meno codice, riusa infrastruttura esistente
- ✅ Funziona anche se l'utente dimentica di cliccare il link la prima volta

Contro:
- ❌ Meno chiaro per l'utente (riceve email "reset password" invece di "benvenuto")
- ❌ Meno personalizzabile

---

## Personalizzazione Email Templates

### 1. Dashboard Supabase (Soluzione MVP)

Le email di Supabase sono personalizzabili dal **Dashboard**:

1. Vai su https://supabase.com/dashboard
2. Seleziona il progetto ZeroCento
3. **Authentication** → **Email Templates**
4. Modifica i template:
   - **Invite user** (per `inviteUserByEmail()`)
   - **Password Reset** (per `resetPasswordForEmail()`)
   - **Confirmation** (opzionale)

#### Template Personalizzato Italiano (Invite User)

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Benvenuto su ZeroCento</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://zerocento.app/images/logo/logo.png" alt="ZeroCento" style="width: 100px; height: auto;">
    </div>
    
    <h1 style="color: #FFA700; text-align: center;">Benvenuto su ZeroCento!</h1>
    
    <p>Ciao <strong>{{ .Data.firstName }} {{ .Data.lastName }}</strong>,</p>
    
    <p>Il tuo trainer ha creato un account per te sulla piattaforma <strong>ZeroCento</strong>.</p>
    
    <p>Per iniziare il tuo percorso di allenamento, completa la registrazione impostando la tua password personale:</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" 
           style="background-color: #FFA700; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Completa Registrazione
        </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
        Questo link è valido per <strong>24 ore</strong>. Se non hai richiesto questa registrazione,
        ignora questa email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
        ZeroCento - La tua piattaforma di allenamento personalizzato<br>
        <a href="https://zerocento.app" style="color: #FFA700;">zerocento.app</a>
    </p>
</body>
</html>
```

**Variabili disponibili in Supabase templates**:
- `{{ .ConfirmationURL }}` - Link magico con token
- `{{ .Token }}` - Token raw (6 cifre)
- `{{ .Data.firstName }}` - Metadata custom
- `{{ .Email }}` - Email utente
- `{{ .SiteURL }}` - URL dell'app

---

### 2. Resend + React Email (Soluzione Produzione) ⭐ Scelta

Provider scelto: **Resend**. Gestisce l'invio delle email; Supabase genera solo i token di autenticazione.

#### Setup Resend

1. Installa le dipendenze:
```bash
npm install resend @react-email/components
```

2. Crea `src/lib/resend.ts`:
```typescript
import { Resend } from 'resend'
export const resend = new Resend(process.env.RESEND_API_KEY)
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
```

3. Crea template in `emails/InviteUser.tsx`:
```typescript
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface InviteUserEmailProps {
  firstName: string
  lastName: string
  inviteLink: string
  trainerName: string
}

export function InviteUserEmail({
  firstName,
  lastName,
  inviteLink,
  trainerName,
}: InviteUserEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Benvenuto su ZeroCento - Completa la tua registrazione</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://zerocento.app/images/logo/logo.png"
            width="100"
            height="100"
            alt="ZeroCento"
            style={logo}
          />
          
          <Text style={heading}>Benvenuto su ZeroCento!</Text>
          
          <Text style={paragraph}>
            Ciao <strong>{firstName} {lastName}</strong>,
          </Text>
          
          <Text style={paragraph}>
            Il tuo trainer <strong>{trainerName}</strong> ha creato un account per te
            sulla piattaforma ZeroCento.
          </Text>
          
          <Section style={buttonContainer}>
            <Button style={button} href={inviteLink}>
              Completa Registrazione
            </Button>
          </Section>
          
          <Text style={footerText}>
            Questo link è valido per 24 ore. Se non hai richiesto questa
            registrazione, ignora questa email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const logo = {
  margin: '0 auto',
  display: 'block',
}

const heading = {
  fontSize: '32px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#FFA700',
  textAlign: 'center' as const,
}

const paragraph = {
  fontSize: '18px',
  lineHeight: '1.4',
  color: '#484848',
}

const button = {
  backgroundColor: '#FFA700',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '18px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '15px 0',
}

const buttonContainer = {
  padding: '27px 0',
}

const footerText = {
  fontSize: '14px',
  color: '#9ca299',
  lineHeight: '24px',
  textAlign: 'center' as const,
}
```

4. Nel backend, invia email con Resend invece di usare Supabase:
```typescript
import { Resend } from 'resend'
import { InviteUserEmail } from '@/emails/InviteUser'

const resend = new Resend(process.env.RESEND_API_KEY)

// Dopo aver creato l'utente
await resend.emails.send({
  from: 'ZeroCento <noreply@zerocento.app>',
  to: email,
  subject: 'Benvenuto su ZeroCento',
  react: InviteUserEmail({
    firstName,
    lastName,
    inviteLink: inviteUrl,
    trainerName: session.user.firstName,
  }),
})
```

---

## Confronto Approcci

| Feature                          | Password Temporanea (Attuale) | Email Onboarding (Proposto) |
| -------------------------------- | ----------------------------- | --------------------------- |
| Sicurezza                        | ⚠️ Media                       | ✅ Alta                      |
| User Experience                  | ❌ Scarsa                      | ✅ Ottima                    |
| Autonomia utente                 | ❌ Richiede coordinazione      | ✅ Autonomo                  |
| Professionalità                  | ⚠️ Media                       | ✅ Alta                      |
| Complessità implementazione      | ✅ Bassa (già implementato)    | ⚠️ Media (+2 ore dev)        |
| Rischio intercettazione password | ❌ Alto                        | ✅ Basso                     |
| Link expiration                  | ❌ No                          | ✅ 24h                       |
| Email brandizzate                | ❌ No                          | ✅ Sì                        |

---

## Roadmap Implementazione

### Fase 1: MVP (2-3 ore)
- [x] Modifica API `/api/users` per usare `inviteUserByEmail()`
- [x] Crea pagina `/onboarding/set-password`
- [x] Personalizza template email in Supabase Dashboard (HTML basic)
- [x] Test con utente reale

### Fase 2: Produzione (2-3 ore) — Provider scelto: **Resend** ⭐

- [ ] Installa `resend` e `@react-email/components`
- [ ] Crea `src/lib/resend.ts` (client Resend)
- [ ] Crea template `emails/InviteUser.tsx` (React Email)
- [ ] Aggiorna `/api/users` per usare Resend al posto dell'email Supabase
- [ ] Configura dominio `zerocento.app` su Resend Dashboard
- [ ] Localizzazione email (IT/EN)
- [ ] Email tracking (apertura, click)
- [ ] Reinvio link scaduto

> Guida completa: `docs/resend-email.md`

### Fase 3: Advanced (opzionale)
- [ ] Email di benvenuto post-registrazione
- [ ] Email reminder se non completa registrazione dopo 3 giorni
- [ ] Dashboard trainer con status inviti (pending/accepted)
- [ ] Bulk invite CSV import

---

## Ambiente Variables Necessarie

```env
# App URL per redirect
NEXT_PUBLIC_APP_URL=https://zerocento.app

# Resend (provider email scelto)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@zerocento.app

# Supabase (già presenti)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx
```

---

## Testing

### Test Email in Locale

Usa [Mailtrap](https://mailtrap.io/) o [MailHog](https://github.com/mailhog/MailHog) per catturare email in sviluppo:

```env
# .env.local
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_mailtrap_username
SMTP_PASS=your_mailtrap_password
```

### Test E2E

```typescript
// tests/e2e/user-onboarding.spec.ts
test('trainer può invitare trainee via email', async ({ page }) => {
    await page.goto('/trainer/users/new')
    
    await page.fill('[name="email"]', 'newtrainee@test.it')
    await page.fill('[name="firstName"]', 'Mario')
    await page.fill('[name="lastName"]', 'Rossi')
    await page.click('[type="submit"]')
    
    await expect(page.locator('text=Invito inviato')).toBeVisible()
    
    // Simula click su link email (in test usa token diretto)
    const inviteToken = await getInviteTokenFromDb('newtrainee@test.it')
    await page.goto(`/onboarding/set-password?token=${inviteToken}`)
    
    await page.fill('[name="password"]', 'NewSecurePass123!')
    await page.fill('[name="confirmPassword"]', 'NewSecurePass123!')
    await page.click('[type="submit"]')
    
    // Verifica redirect a dashboard
    await expect(page).toHaveURL(/\/trainee\/dashboard/)
})
```

---

## FAQ

### Q: Cosa succede se l'utente non clicca il link?
**R**: Il link scade dopo 24h, ma il trainer può reinviare l'invito dalla dashboard utenti.

### Q: Serve ancora la funzione di reset password?
**R**: Sì, è indipendente. L'utente potrebbe dimenticare la password anche dopo l'onboarding.

### Q: Posso personalizzare l'email per lingua?
**R**: Sì, passando `locale` nei metadata: `data: { locale: 'it' }`. Poi personalizza i template in Supabase per lingua.

### Q: Funziona offline?
**R**: No, serve connessione per ricevere l'email e cliccare il link. Ma è uno step di setup una tantum.

### Q: Costa di più?
**R**: Supabase email gratis fino a 30k/mese. SendGrid/Resend hanno piani free generosi (100-3000 email/mese).

---

## Conclusioni

L'onboarding via email è **fortemente consigliato** per:
- ✅ Migliorare sicurezza (no password in chiaro su WhatsApp)
- ✅ Professionalità e brand awareness
- ✅ User experience moderna e standard

Implementazione stimata: **2-3 ore** per MVP funzionante con template base.

Per domande o implementazione assistita, referenzia questo documento.
