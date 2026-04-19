# Integrazione Email con Resend

**Decisione**: Resend è il provider scelto per l'invio di email transazionali in ZeroCento.  
**Caso d'uso principale**: Invio email di onboarding (magic link) quando trainer/admin crea un nuovo utente.

---

## Architettura

```
Admin/Trainer crea utente
       │
       ▼
POST /api/users
       │
       ├─► Supabase Auth: inviteUserByEmail() ──► genera magic link token
       │
       └─► Resend API: invia email brandizzata con il magic link
```

Supabase gestisce l'autenticazione e i token; Resend gestisce l'invio e il rendering delle email.

---

## Setup

### 1. Installazione dipendenze

```bash
npm install resend @react-email/components
```

### 2. Variabili d'ambiente

Aggiungi a `.env.local` (sviluppo) e alle Vercel Environment Variables (produzione):

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@zerocento.app
```

> Per ottenere la chiave API: [resend.com](https://resend.com) → Dashboard → API Keys → Create API Key

### 3. Configurazione dominio Resend

1. Nel dashboard Resend → **Domains** → **Add Domain**
2. Aggiungi `zerocento.app` e configura i record DNS richiesti (SPF, DKIM, DMARC)
3. Verifica il dominio prima di andare in produzione

In sviluppo usa l'email `onboarding@resend.dev` (fornita da Resend gratuitamente, senza setup dominio).

---

## Implementazione

### Client Resend (`src/lib/resend.ts`)

```typescript
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
```

### Template email (`emails/InviteUser.tsx`)

```typescript
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
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
  role: 'trainer' | 'trainee'
}

export function InviteUserEmail({
  firstName,
  lastName,
  inviteLink,
  trainerName,
  role,
}: InviteUserEmailProps) {
  const roleLabel = role === 'trainer' ? 'trainer' : 'atleta'

  return (
    <Html lang="it">
      <Head />
      <Preview>Benvenuto su ZeroCento — Completa la tua registrazione</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Img
            src="https://zerocento.app/images/logo/logo.png"
            width="80"
            height="80"
            alt="ZeroCento"
            style={styles.logo}
          />

          <Heading style={styles.heading}>Benvenuto su ZeroCento!</Heading>

          <Text style={styles.paragraph}>
            Ciao <strong>{firstName}</strong>,
          </Text>

          <Text style={styles.paragraph}>
            {role === 'trainee'
              ? `Il tuo trainer ${trainerName} ha creato un account per te sulla piattaforma ZeroCento.`
              : `Sei stato invitato come ${roleLabel} sulla piattaforma ZeroCento.`}
          </Text>

          <Text style={styles.paragraph}>
            Clicca sul pulsante qui sotto per impostare la tua password e iniziare:
          </Text>

          <Section style={styles.buttonContainer}>
            <Button style={styles.button} href={inviteLink}>
              Completa Registrazione
            </Button>
          </Section>

          <Text style={styles.warning}>
            ⏱️ Questo link è valido per <strong>24 ore</strong>. Se non completi
            la registrazione entro questo periodo, contatta il tuo trainer per
            ricevere un nuovo invito.
          </Text>

          <Text style={styles.footer}>
            Se non hai richiesto questa registrazione, ignora questa email.
            {'\n'}© 2026 ZeroCento — La tua piattaforma di allenamento personalizzato
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  main: {
    backgroundColor: '#f9fafb',
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '40px auto',
    padding: '40px',
    borderRadius: '16px',
    maxWidth: '600px',
  },
  logo: {
    display: 'block',
    margin: '0 auto 24px',
  },
  heading: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center' as const,
    margin: '0 0 24px',
  },
  paragraph: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#374151',
    margin: '0 0 16px',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '32px 0',
  },
  button: {
    backgroundColor: '#FFA700',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    padding: '16px 40px',
    display: 'inline-block',
  },
  warning: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    borderLeft: '4px solid #FFA700',
    borderRadius: '6px',
    padding: '16px',
    margin: '0 0 24px',
  },
  footer: {
    fontSize: '12px',
    lineHeight: '1.5',
    color: '#9CA3AF',
    textAlign: 'center' as const,
    borderTop: '1px solid #E5E7EB',
    paddingTop: '24px',
    whiteSpace: 'pre-line' as const,
  },
}
```

### Integrazione in `/api/users` (`src/app/api/users/route.ts`)

```typescript
import { resend, FROM_EMAIL } from '@/lib/resend'
import { InviteUserEmail } from '@/emails/InviteUser'

// All'interno del POST handler, dopo aver creato l'utente Supabase:

// 1. Genera il magic link via Supabase Admin
const supabase = createAdminClient()
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: 'invite',
  email,
  options: {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/set-password`,
    data: { role, firstName, lastName },
  },
})

if (linkError || !linkData) {
  logger.error({ error: linkError }, 'Failed to generate invite link')
  return apiError('INTERNAL_ERROR', 'Failed to generate invite link', 500)
}

// 2. Invia email brandizzata con Resend
const { error: emailError } = await resend.emails.send({
  from: `ZeroCento <${FROM_EMAIL}>`,
  to: email,
  subject: 'Benvenuto su ZeroCento — Completa la tua registrazione',
  react: InviteUserEmail({
    firstName,
    lastName,
    inviteLink: linkData.properties.action_link,
    trainerName: `${session.user.firstName} ${session.user.lastName}`,
    role,
  }),
})

if (emailError) {
  logger.error({ error: emailError }, 'Failed to send invite email via Resend')
  // Non bloccare la creazione utente: loggare il fallback
}
```

---

## Testing in sviluppo

### Opzione A — Resend Dev Mode

Resend fornisce `onboarding@resend.dev` come mittente senza setup dominio.  
Le email arrivano solo all'indirizzo verificato nel tuo account Resend (utile per sviluppo).

```env
# .env.local
RESEND_API_KEY=re_xxxx  # chiave reale, funziona in dev
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### Opzione B — React Email Dev Server

Anteprima locale dei template senza inviare email reali:

```bash
npx react-email dev --dir emails
# Apre http://localhost:3000 con preview di tutti i template
```

---

## Limiti piano gratuito Resend

| Piano  | Email/mese | Richieste API/mese | Domini    |
| ------ | ---------- | ------------------ | --------- |
| Free   | 3.000      | 100                | 1         |
| Pro    | 50.000     | illimitato         | illimitato|

Per ZeroCento MVP (54 utenti, onboarding una-tantum + reset password): **piano free sufficiente**.

---

## Checklist configurazione

- [ ] `npm install resend @react-email/components`
- [ ] `RESEND_API_KEY` configurato in `.env.local`
- [ ] `RESEND_FROM_EMAIL` configurato in `.env.local`
- [ ] Dominio `zerocento.app` verificato in Resend Dashboard
- [ ] `src/lib/resend.ts` creato
- [ ] Template `emails/InviteUser.tsx` creato
- [ ] `/api/users` aggiornato per usare Resend
- [ ] Test invio email con utente reale
- [ ] Variabili d'ambiente aggiunte su Vercel (produzione)
