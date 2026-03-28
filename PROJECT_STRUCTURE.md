# ZeroCento Training Platform - Struttura Progetto

## 📋 Panoramica

Piattaforma web per la gestione di servizi di training sportivo/fitness.

**Scala Utenti**: 1 Admin + 3 Trainer + ~50 Trainee (crescita 20% annuo)

👉 Per dettagli completi vedi [design/00_problem_statement.md](design/00_problem_statement.md)

---

## 🗂️ Indice Documentazione

| File                                                              | Contenuto                             |
| ----------------------------------------------------------------- | ------------------------------------- |
| [00_problem_statement.md](design/00_problem_statement.md)         | Obiettivo, utenti, scope IN/OUT       |
| [01_architecture_overview.md](design/01_architecture_overview.md) | Stack tecnologico, componenti, rischi |
| [02_frontend_design.md](design/02_frontend_design.md)             | Route, UI/UX per ruolo                |
| [03_backend_api.md](design/03_backend_api.md)                     | API endpoints, payload                |
| [04_data_model.md](design/04_data_model.md)                       | Entità, relazioni, vincoli            |
| [05_security_auth.md](design/05_security_auth.md)                 | Autenticazione, autorizzazione        |
| [06_deploy_and_scaling.md](design/06_deploy_and_scaling.md)       | Deployment, monitoring, scaling       |
| [07_testing_strategy.md](design/07_testing_strategy.md)           | Test plan, framework, coverage        |
| [08_open_decisions.md](design/08_open_decisions.md)               | Decisioni in sospeso                  |
| [09_change_log.md](design/09_change_log.md)                       | Storia modifiche design               |
| [10_user_stories.md](design/10_user_stories.md)                   | User stories e requirements           |
| [prisma/schema.prisma](prisma/schema.prisma)                      | Database schema completo              |

---

## 📁 Struttura Directory

```
ZeroCentoProject/
├── design/                          # 📄 Design docs (vedi indice sopra)
├── design-review/                   # 🔍 Review architetturali
├── docs/                            # 📚 Documentazione tecnica specifica
│   ├── api-pagination.md
│   ├── database-indexes.md
│   ├── i18n-strategy.md
│   └── supabase-auth-api-surface.md
│
├── prisma/                          # 🗄️ Database
│   ├── schema.prisma                # Schema completo
│   └── migrations/                  # (da creare)
│
├── src/ (da creare)                 # 💻 Codice sorgente
│   ├── app/                         # Next.js App Router
│   │   ├── (auth)/                  # Login, signup
│   │   ├── (admin)/                 # Dashboard admin
│   │   ├── (trainer)/               # Dashboard trainer (desktop-optimized)
│   │   ├── (trainee)/               # Dashboard trainee (mobile-optimized)
│   │   └── api/                     # API routes
│   │
│   ├── components/                  # React components
│   │   ├── admin/
│   │   ├── trainer/
│   │   ├── trainee/
│   │   ├── shared/
│   │   └── ui/                      # Base UI (shadcn/ui)
│   │
│   ├── lib/                         # Utilities
│   │   ├── prisma.ts
│   │   ├── supabase.ts
│   │   └── auth.ts
│   │
│   ├── hooks/                       # Custom React hooks
│   ├── types/                       # TypeScript types
│   └── middleware.ts                # Auth middleware
│
├── tests/ (da creare)               # 🧪 Test suite
│   ├── unit/                        # Vitest
│   ├── integration/                 # API tests
│   └── e2e/                         # Playwright
│
├── .env.local                       # Environment vars (gitignored)
├── .env.example                     # Template
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── PROJECT_STRUCTURE.md             # Questo file
```

👉 **Route dettagliate per ruolo**: [design/02_frontend_design.md](design/02_frontend_design.md)  
👉 **API endpoints**: [design/03_backend_api.md](design/03_backend_api.md)

---

## 🛠️ Setup Ambiente Sviluppo

### Prerequisiti
```bash
Node.js >= 18
pnpm >= 8 (o npm/yarn)
Git
Account Supabase (free tier)
Account Vercel (free tier per dev)
```

### Setup Locale
```bash
# 1. Clone repository
git clone <repo-url>
cd ZeroCentoProject

# 2. Installa dipendenze
pnpm install

# 3. Setup environment variables
cp .env.example .env.local
# Editare .env.local con credenziali Supabase

# 4. Setup database
npx prisma generate
npx prisma db push

# 5. Seed database (opzionale)
npx prisma db seed

# 6. Start dev server
pnpm dev
# App su http://localhost:3000
```

### Variabili Ambiente Richieste
```env
# Supabase
DATABASE_URL="postgresql://..."          # Pooled connection
DIRECT_URL="postgresql://..."            # Direct (per migrations)
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Next.js
NEXTAUTH_SECRET="..."                    # openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# Opzionale
NODE_ENV="development"
```

---

## 📝 Convenzioni Codice

### Naming
- **File/Folder**: kebab-case (`user-profile.tsx`)
- **Component**: PascalCase (`UserProfile`)
- **Function**: camelCase (`getUserById`)
- **Constant**: UPPER_SNAKE_CASE (`MAX_PAGE_SIZE`)

### Struttura Component
```typescript
// 1. Imports
import { ...} from 'react'

// 2. Types/Interfaces
interface UserProfileProps {
  userId: string
}

// 3. Component
export function UserProfile({ userId }: UserProfileProps) {
  // Hooks
  // Handlers
  // Render
  return (...)
}
```

### API Routes
```typescript
// src/app/api/users/route.ts
export async function GET(request: Request) {
  // 1. Auth check
  // 2. Input validation
  // 3. Business logic (Prisma queries)
  // 4. Response formatting
  return Response.json({ ... })
}
```

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)
- Utilities e helper functions
- Business logic pura
- React hooks custom

### Integration Tests (Jest + Supertest)
- API endpoints (autenticazione mock)
- Prisma queries (in-memory SQLite)

### E2E Tests (Playwright)
- User flows critici:
  - Login/logout
  - Trainer: Crea scheda → Assegna trainee
  - Trainee: Visualizza scheda → Invia feedback

### Coverage Target
- **Unit**: 80%+
- **Integration**: Route critiche coperte
- **E2E**: Happy paths tutti i ruoli

---

## 📚 Risorse Utili

### Documentazione
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [TailwindCSS](https://tailwindcss.com/docs)

### Best Practices
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [React Hook Form](https://react-hook-form.com/) (per form validation)

### Tools Suggeriti
- **shadcn/ui**: UI component library (TailwindCSS based)
- **Zod**: Schema validation (runtime + TypeScript)
- **date-fns**: Date manipulation (lightweight)
- **Recharts**: Grafici analytics trainer

---

## 🐛 Troubleshooting Comuni

### "Too many connections" Error
**Causa**: Prisma non usa connection pooler
**Soluzione**: Verificare DATABASE_URL punta a endpoint pooled (`:6543` Supabase)

### Cold Start Lenti
**Causa**: Vercel free tier hiberna funzioni inattive
**Soluzione**: Upgrade Vercel Pro o usare Edge Runtime per route critiche

### Session Timeout in Palestra
**Causa**: Token JWT scaduto durante allenamento lungo
**So� Quick Start

### Prerequisiti
- Node.js >= 18
- pnpm (o npm/yarn)
- Account Supabase (free tier)
- Account Vercel (opzionale per dev)

### Setup Locale
```bash
# 1. Clone e installa
git clone <repo-url>
cd ZeroCentoProject
pnpm install

# 2. Environment variables
cp .env.example .env.local
# Editare .env.local con credenziali Supabase

# 3. Database setup
npx prisma generate
npx prisma db push

# 4. Start
pnpm dev
# → http://localhost:3000
```

### Variabili Ambiente Richieste
```env
DATABASE_URL="postgresql://..."          # Pooled (PgBouncer)
DIRECT_URL="postgresql://..."            # Direct (migrations)
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
NEXTAUTH_SECRET="..."                    # openssl rand -base64 32
```

👉 **Dettagli deployment**: [design/06_deploy_and_scaling.md](design/06_deploy_and_scaling.md)

---

## 📝 Convenzioni Codice

### Naming
- File/Folder: `kebab-case.tsx`
- Component: `PascalCase`
- Function: `camelCase`
- Constant: `UPPER_SNAKE_CASE`

### Struttura Base
```typescript
// Component
export function UserProfile({ userId }: Props) { ... }

// API Route
export async function GET(request: Request) {
  // 1. Auth check
  // 2. Validation
  // 3. Business logic
  // 4. Response
}
```

---

## 🧪 Testing

👉 **Strategia completa**: [design/07_testing_strategy.md](design/07_testing_strategy.md)

**Framework**:
- **Unit**: Vitest + @testing-library/react
- **Integration**: API tests con Vitest
- **E2E**: Playwright

**Coverage target**: 80%+ unit tests

---

## 📚 Risorse

### Stack Principale
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [TailwindCSS](https://tailwindcss.com/docs)

### Tools Consigliati
- **shadcn/ui**: Component library
- **Zod**: Schema validation
- **react-hook-form**: Form handling

---

## 📅 Versione
**v1.0** - 28 Marzo 2026