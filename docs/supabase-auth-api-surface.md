# Supabase Auth API Surface

**Documento di riferimento per migrazione futura**  
**Versione**: 1.0  
**Data**: 2026-03-28  
**Scopo**: Documentare tutte le chiamate Supabase Auth usate nella piattaforma per facilitare eventuale migrazione a provider alternativo (NextAuth.js, Clerk, Auth0)

---

## API Supabase Auth Utilizzate

### 1. Client-Side Auth API (Browser/Next.js Client Components)

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

// ============================================================================
// SIGN IN (Login)
// ============================================================================
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string,
})

// Response:
// data.session: { access_token, refresh_token, user }
// data.user: { id, email, role, ... }
// error: AuthError | null

// ============================================================================
// SIGN UP (Registrazione)
// ============================================================================
const { data, error } = await supabase.auth.signUp({
  email: string,
  password: string,
  options: {
    data: {
      firstName: string,
      lastName: string,
      role: 'trainer' | 'trainee' | 'admin',
    },
  },
})

// Response:
// data.user: User object
// error: AuthError | null

// ============================================================================
// SIGN OUT (Logout)
// ============================================================================
const { error } = await supabase.auth.signOut()

// ============================================================================
// GET SESSION (Retrieve Current Session)
// ============================================================================
const { data: { session }, error } = await supabase.auth.getSession()

// Response:
// session: { access_token, refresh_token, user, expires_at } | null

// ============================================================================
// REFRESH SESSION
// ============================================================================
const { data: { session }, error } = await supabase.auth.refreshSession()

// Automaticamente invia refresh_token e ottiene nuova coppia access/refresh token

// ============================================================================
// ON AUTH STATE CHANGE (Listener eventi auth)
// ============================================================================
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    // event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY'
    // session: Session | null
  }
)

// Cleanup: subscription.unsubscribe()

// ============================================================================
// UPDATE USER (Modifica profilo/password)
// ============================================================================
const { data, error } = await supabase.auth.updateUser({
  password: newPassword,  // Cambio password
  data: {                 // Custom metadata
    firstName: string,
    lastName: string,
  },
})

// ============================================================================
// RESET PASSWORD FOR EMAIL (Forgot password)
// ============================================================================
const { data, error } = await supabase.auth.resetPasswordForEmail(
  email,
  {
    redirectTo: 'https://zerocento.app/reset-password',
  }
)

// Invia email con link magic per reset password
```

---

### 2. Server-Side Auth API (Next.js API Routes, Server Components, Server Actions)

```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const supabase = createServerComponentClient({ cookies })

// ============================================================================
// GET SESSION (Server-side)
// ============================================================================
const { data: { session } } = await supabase.auth.getSession()

// Response:
// session: { access_token, refresh_token, user, expires_at } | null

// ============================================================================
// GET USER (Server-side)
// ============================================================================
const { data: { user } } = await supabase.auth.getUser()

// Response:
// user: User object | null

// Preferibile rispetto a getSession() per verifiche autorizzazione
// perché valida access_token contro Supabase (no trust client cookie blindly)
```

---

### 3. Middleware Auth (Per route protection)

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // ============================================================================
  // GET SESSION (Middleware)
  // ============================================================================
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}
```

---

## JWT Token Structure (Supabase Auth)

**Access Token** (JWT):
```json
{
  "aud": "authenticated",
  "exp": 1234567890,       // Expiration timestamp
  "iat": 1234567890,       // Issued at timestamp
  "sub": "user-uuid",      // User ID
  "email": "user@example.com",
  "role": "authenticated", // Supabase role (non applicativo)
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  },
  "user_metadata": {
    "firstName": "Mario",
    "lastName": "Rossi",
    "role": "trainer"      // Ruolo applicativo custom
  }
}
```

**Verifica JWT custom**:
- Supabase usa algoritmo **HS256** (HMAC SHA-256) per firmare JWT
- Secret: `SUPABASE_JWT_SECRET` (da Dashboard Supabase → Settings → API)
- Library: `@supabase/jwt` o `jsonwebtoken`

```typescript
import jwt from 'jsonwebtoken'

const decoded = jwt.verify(accessToken, process.env.SUPABASE_JWT_SECRET!)
// decoded.user_metadata.role = 'trainer' | 'trainee' | 'admin'
```

---

## Cookie Management

Supabase Auth Helpers gestiscono automaticamente i cookie per sessioni persistenti.

**Cookie names**:
- `sb-<project-ref>-auth-token` (access token + refresh token encrypted)

**Cookie attributes**:
```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 30, // 30 giorni (refresh token lifetime)
  path: '/',
}
```

---

## Mapping per Migrazione Provider Alternativo

### NextAuth.js

| Supabase Auth              | NextAuth.js Equivalent                            |
| -------------------------- | ------------------------------------------------- |
| `signInWithPassword()`     | `signIn('credentials', { email, password })`      |
| `signUp()`                 | Custom API route + Prisma User create             |
| `signOut()`                | `signOut()`                                       |
| `getSession()`             | `getServerSession(authOptions)`                   |
| `refreshSession()`         | Automatico con JWT strategy + refresh token       |
| `onAuthStateChange()`      | `useSession()` hook (auto-refresh)                |
| `updateUser({ password })` | `update()` session + custom password update route |
| `resetPasswordForEmail()`  | Custom forgot-password flow + email service       |
| JWT `user_metadata`        | JWT `user` claim (custom callback)                |
| Cookie `sb-*-auth-token`   | Cookie `next-auth.session-token`                  |

### Clerk

| Supabase Auth             | Clerk Equivalent                            |
| ------------------------- | ------------------------------------------- |
| `signInWithPassword()`    | `signIn.create({ identifier, password })`   |
| `signUp()`                | `signUp.create({ emailAddress, password })` |
| `signOut()`               | `signOut()`                                 |
| `getSession()`            | `auth()` in Server Components/API Routes    |
| `onAuthStateChange()`     | `useUser()` + `useAuth()` hooks             |
| JWT verification          | `verifyToken()` o `withClerkMiddleware()`   |
| Role-based access control | Custom claims in JWT (`publicMetadata`)     |

---

## Rate Limiting & Anti-Brute-Force

**Supabase Auth built-in**:
- Limite 5 tentativi falliti login → account temporaneamente bloccato per 1 ora
- Non configurabile via dashboard (hard limit backend)

**Per MVP**: Rate limiting aggiuntivo gestito con **Upstash Redis** (vedi `05_security_auth.md`)

**Migrazione provider**:
- NextAuth.js: Nessun rate limiting nativo, implementare con Redis/Cache
- Clerk: Rate limiting integrato, configurabile da dashboard

---

## Email Templates

**Email inviate da Supabase Auth**:
1. **Conferma registrazione** (se email verification enabled)
2. **Reset password** (magic link)
3. **Email change confirmation**

**Template location in progetto**:
- Path: `/emails` (React Email components)
- Provider: Attualmente Supabase Email (SMTP interno)
- Migrazione: Switchare a SendGrid/Resend con env var `EMAIL_PROVIDER`

**Custom SMTP per Supabase**:
```env
SUPABASE_SMTP_HOST=smtp.sendgrid.net
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=apikey
SUPABASE_SMTP_PASS=<sendgrid-api-key>
SUPABASE_SMTP_FROM=noreply@zerocento.app
```

---

## Environment Variables Necessarie

```env
# Supabase Auth (attuale)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>

# Per migrazione a NextAuth.js
NEXTAUTH_URL=https://zerocento.app
NEXTAUTH_SECRET=<random-secret-32-chars>
DATABASE_URL=<postgres-connection-string>

# Per migrazione a Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk-pub-key>
CLERK_SECRET_KEY=<clerk-secret-key>
```

---

## Effort Stimato per Migrazione

| Provider        | Effort | Note                                                                                  |
| --------------- | ------ | ------------------------------------------------------------------------------------- |
| **NextAuth.js** | Alto   | Reimplementazione completa auth flow, gestione password hashing, email service custom |
| **Clerk**       | Medio  | SDK pre-built, ma richiede refactor frontend (hooks diversi) e custom role mapping    |
| **Auth0**       | Medio  | Similar a Clerk, SDK maturo, pricing più alto                                         |
| **Supabase**    | N/A    | Configurazione attuale, nessuna migrazione necessaria                                 |

**Raccomandazione**: Mantenere Supabase Auth per MVP. Valutare migrazione solo se:
- Costo Supabase Auth supera $100/mese (> 1000 utenti attivi)
- Requisiti enterprise (SSO, MFA avanzato, audit log)
- Supabase depreca funzionalità critiche

---

## Checklist Pre-Migrazione

- [ ] Esportare tutti gli utenti da Supabase Auth (`auth.users` table)
- [ ] Hashare password con algoritmo compatibile (bcrypt per NextAuth, Clerk gestisce internamente)
- [ ] Aggiornare frontend per usare nuovi hook/API
- [ ] Aggiornare middleware per nuova logica session check
- [ ] Testare flussi: login, logout, forgot password, sign up, session persistence
- [ ] Aggiornare email templates con nuovo provider SMTP
- [ ] Verificare JWT claims mapping (ruoli custom)
- [ ] Test E2E completo auth flow su staging prima di switch produzione

---

## Riferimenti

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Auth Helpers Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Clerk Docs](https://clerk.com/docs)
- [JWT.io Debugger](https://jwt.io/)
