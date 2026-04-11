# ZeroCento Training Platform

Training management platform (trainer-led) for fitness coaching. Trainers build and assign multi-week workout programs; trainees follow them and provide feedback.

## Overview

| Role        | Focus                                                   | Device       |
| ----------- | ------------------------------------------------------- | ------------ |
| **Admin**   | User management, trainer reassignment, global oversight | Desktop      |
| **Trainer** | Create exercises, build programs, monitor progress      | Desktop      |
| **Trainee** | View workouts, log feedback, track personal records     | Mobile (gym) |

**Scale**: 1 admin, 3 trainers, ~50 trainees (20% annual growth)

## Tech Stack

- **Framework**: Next.js 14 (App Router) — full-stack (frontend + API Routes)
- **Database**: Supabase PostgreSQL + Prisma ORM
- **Auth**: Supabase Auth (email/password, JWT sessions)
- **Styling**: Tailwind CSS + MUI (targeted usage)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **i18n**: i18next (Italian + English)
- **Hosting**: Vercel (serverless) + Supabase

## Quick Start

### Prerequisites

- Node.js >= 20
- npm/pnpm
- [Supabase](https://supabase.com) account (free tier)

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd ZeroCentoProject
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Setup database
npm run prisma:generate
npm run prisma:migrate

# 4. Seed test data (1 admin + 2 trainers + 10 trainees + exercises)
npm run prisma:seed

# 5. Start dev server
npm run dev
# → http://localhost:3000
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Database
DATABASE_URL=postgresql://...:6543/postgres?pgbouncer=true   # Pooled
DIRECT_URL=postgresql://...:5432/postgres                     # Direct (migrations)

# Auth
NEXTAUTH_SECRET=...   # openssl rand -base64 32
```

### Common Commands

```bash
# Development
npm run dev              # Dev server (http://localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run type-check       # TypeScript check

# Database
npm run prisma:studio    # DB explorer (http://localhost:5555)
npm run prisma:generate  # Regenerate Prisma Client
npm run prisma:migrate   # Create new migration
npm run prisma:seed      # Re-seed database

# Testing
npm run test:unit        # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
```

## Project Status

**142/160 tasks completed (~89%)**

| Sprint               | Status            |
| -------------------- | ----------------- |
| 1–5, 7, 9, 10        | Completed         |
| 6 (CI/CD & Deploy)   | 7 tasks remaining |
| 8 (PWA & Polish)     | 7 tasks remaining |
| 11 (i18n Error Keys) | 4 tasks remaining |

Source of truth: [implementation-docs/checklist.md](implementation-docs/checklist.md)

## Project Structure

```
ZeroCentoProject/
├── design/                    # Design documents (11 files)
├── design-review/             # Architectural reviews
├── docs/                      # Technical reference docs
├── implementation-docs/       # Development tracking
│   ├── checklist.md           # Task status (source of truth)
│   ├── changelog.md           # Development log
│   ├── next-actions.md        # Active backlog
│   └── system-review.md       # System analysis
├── prisma/                    # Database schema + migrations
├── src/
│   ├── app/                   # Next.js App Router (pages + API)
│   ├── components/            # React components (30+)
│   ├── i18n/                  # i18n configuration
│   ├── lib/                   # Utilities (auth, prisma, calculations)
│   └── schemas/               # Zod validation schemas (9)
├── tests/
│   ├── unit/                  # Vitest
│   ├── integration/           # API tests
│   └── e2e/                   # Playwright
└── public/
    ├── locales/               # i18n translations (IT + EN)
    └── manifest.json          # PWA manifest
```

## Documentation Map

| Document                                                         | Content                              |
| ---------------------------------------------------------------- | ------------------------------------ |
| [design/00-problem-statement.md](design/00-problem-statement.md) | Goals, users, scope                  |
| [design/01-architecture.md](design/01-architecture.md)           | Stack, components, risks             |
| [design/02-frontend.md](design/02-frontend.md)                   | Routes, UI/UX per role               |
| [design/03-backend-api.md](design/03-backend-api.md)             | API endpoints, validation            |
| [design/04-data-model.md](design/04-data-model.md)               | Entities, relations, ER diagram      |
| [design/05-security-auth.md](design/05-security-auth.md)         | Auth, RBAC, sessions                 |
| [design/06-deployment.md](design/06-deployment.md)               | Deploy, CI/CD, scaling               |
| [design/07-testing.md](design/07-testing.md)                     | Test strategy, coverage              |
| [design/08-decisions.md](design/08-decisions.md)                 | Architectural decisions (all closed) |
| [design/09-changelog.md](design/09-changelog.md)                 | Design change history                |
| [design/10-user-stories.md](design/10-user-stories.md)           | 56 user stories                      |
| [prisma/schema.prisma](prisma/schema.prisma)                     | Database schema                      |

## Code Conventions

| Category      | Convention         |
| ------------- | ------------------ |
| Files/Folders | `kebab-case.tsx`   |
| Components    | `PascalCase`       |
| Functions     | `camelCase`        |
| Constants     | `UPPER_SNAKE_CASE` |

### API Route Pattern

```typescript
export async function GET(request: Request) {
  // 1. Auth check
  // 2. Input validation (Zod)
  // 3. Business logic (Prisma)
  // 4. Response formatting (apiSuccess/apiError)
}
```

## Testing

- **Unit**: Vitest + @testing-library/react — business logic, schemas, calculations
- **Integration**: API endpoint tests with mocked Prisma
- **E2E**: Playwright — critical user flows
- **Coverage target**: 80%+

See [design/07-testing.md](design/07-testing.md) for full strategy.

## Troubleshooting

| Error                                 | Fix                                                           |
| ------------------------------------- | ------------------------------------------------------------- |
| `Cannot find module '@prisma/client'` | `npm run prisma:generate`                                     |
| `Database connection failed`          | Check `DATABASE_URL` uses port 6543 (pooled)                  |
| `PrismaClient in browser`             | Only use Prisma in Server Components or API Routes            |
| `User not found after login`          | Run `npm run prisma:seed`, verify user IDs match `auth.users` |
| `RATE_LIMIT_EXCEEDED` in dev          | Comment out `checkRateLimit()` in `src/middleware.ts`         |
