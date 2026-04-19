# Design Review — ZeroCento Training Platform

**Reviews**: v1 (28 March 2026) + v2 (28 March 2026, post-fix)
**Documents analyzed**: 11 design files (`design/00–10`)
**Result**: All 42 original decisions (OD-01–OD-42) and 32 review decisions (ODR-01–ODR-32) **closed**

---

## Architecture Assessment

| Aspect        | Rating    | Notes                                                   |
| ------------- | --------- | ------------------------------------------------------- |
| Documentation | Excellent | 11 well-structured files with cross-references          |
| Stack choice  | Excellent | Pragmatic for scale (54 users), no over-engineering     |
| Budget        | Excellent | €45-48/month with detailed breakdown                    |
| Security      | Strong    | RBAC, rate limiting, JWT sessions, GDPR framework       |
| Data model    | Strong    | 14 entities, normalized feedback, correct relationships |
| PWA approach  | Excellent | Ideal for gym use (offline-first, long sessions)        |

---

## Key Decisions (ODR — All Resolved)

### Architecture

| ID     | Decision                               | Resolution                                               |
| ------ | -------------------------------------- | -------------------------------------------------------- |
| ODR-01 | NextAuth vs Supabase Auth conflict     | Supabase Auth confirmed as sole provider                 |
| ODR-02 | ExerciseFeedback.setsPerformed as JSON | Normalized to `SetPerformed` table (1:N)                 |
| ODR-03 | In-memory rate limiting on serverless  | Upstash Redis for auth (€0), in-memory for rest          |
| ODR-04 | initialPassword stored in DB           | Removed — `mustChangePassword` flag only                 |
| ODR-09 | Missing database indexes               | Composite indexes implemented                            |
| ODR-10 | API pagination                         | Cursor-based on exercises (50/page, max 100)             |
| ODR-11 | Concurrency control                    | Risk accepted for MVP (3 trainers, last-write-wins)      |
| ODR-12 | POST feedback idempotency              | UNIQUE constraint `(workoutExerciseId, traineeId, date)` |
| ODR-18 | Tailwind + MUI conflict                | MUI limited to complex components, Tailwind for rest     |
| ODR-19 | Service Worker with App Router         | @serwist/next (fork of next-pwa)                         |
| ODR-20 | Supabase vendor lock-in                | Prisma abstracts DB; auth adapter layer documented       |

### Functional

| ID     | Decision                             | Resolution                                                |
| ------ | ------------------------------------ | --------------------------------------------------------- |
| ODR-05 | Multi-trainer per trainee            | 1:1 relationship — UNIQUE on traineeId                    |
| ODR-06 | active→completed transition          | Automatic (cron at endDate) + manual (trainer PATCH)      |
| ODR-07 | Program versioning                   | Not implemented — published programs are immutable        |
| ODR-08 | Admin capabilities                   | Full CRUD override on all programs + trainee reassignment |
| ODR-26 | Multiple active programs per trainee | Allowed (e.g., strength + mobility)                       |
| ODR-27 | Soft-delete vs hard-delete           | Soft-delete with `deletedAt` + GDPR anonymization         |
| ODR-28 | Trainee self-reassignment            | Admin only — prevents abuse                               |

### Infrastructure

| ID     | Decision              | Resolution                                         |
| ------ | --------------------- | -------------------------------------------------- |
| ODR-13 | Backup & DR           | Supabase daily backup, 7-day retention, RPO 24h    |
| ODR-14 | Monitoring            | Health endpoint + UptimeRobot + Sentry (all free)  |
| ODR-15 | Client error boundary | react-error-boundary + Sentry logging              |
| ODR-16 | Accessibility         | WCAG 2.1 Level AA + axe-core/playwright            |
| ODR-17 | Seed data             | Environment-specific seeds (e2e/staging/prod)      |
| ODR-25 | Timezone              | UTC storage, locale conversion in frontend         |
| ODR-29 | Storage projection    | Free tier 500MB adequate for 5+ years              |
| ODR-30 | Deploy region         | EU Frankfurt (Vercel fra1 + Supabase eu-central-1) |

---

## Criticalities From v2 (All Fixed)

1. **Duplicate Zod schemas in backend-api doc** — Removed legacy block
2. **calculateEffectiveWeight percentage_previous** — Fixed `orderBy: 'desc'` for correct chain resolution
3. **Program completion** — Added dual mode: automatic (cron) + manual (trainer PATCH)
4. **Feedback visibility** — Clarified: trainer sees feedback immediately (submit is for formal timestamp)

---

## Maturity Rating

**5/5** — Exceptional design maturity for an MVP. All criticalities resolved. Stack coherent, economical, adequate for scale. Solid architecture, robust security.
