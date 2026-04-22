# B3: Prisma Initial Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and commit the initial Prisma migration so that `prisma migrate deploy` on a fresh production DB succeeds at first Vercel deploy.

**Architecture:** The DB schema was applied via `prisma/init.sql` run directly in Supabase SQL Editor — not through Prisma migrations. We therefore use the **baseline approach**: generate migration SQL from the current `schema.prisma` (from empty → full schema), mark it as already applied on the existing dev DB (no reset, no data loss), then commit. Production gets a clean migration history.

**Tech Stack:** Prisma 5, PostgreSQL (Supabase), `prisma migrate diff`, `prisma migrate resolve`

---

## Context: Why baseline instead of `migrate dev`

Running `npx prisma migrate dev --name init` on a DB that already has tables would trigger Prisma's drift detection. It would prompt to reset the dev DB (destroying seed data). The baseline approach avoids that:

1. Generate migration SQL without touching the DB.
2. Tell Prisma "this migration is already applied" (`--applied`).
3. Result: migration file exists in git; dev DB is untouched; production deploy can run `prisma migrate deploy` against a fresh DB.

## File Map

| Action | Path |
|--------|------|
| Create | `prisma/migrations/20260328000000_init/migration.sql` |
| No change | `prisma/schema.prisma` |
| No change | `prisma/migrations/migration_lock.toml` |

---

## Task 1: Verify Prerequisites

**Files:**
- Read: `.env` (confirm `DIRECT_URL` is set)
- Read: `prisma/migrations/` (confirm only `migration_lock.toml` exists)

- [ ] **Step 1: Confirm DIRECT_URL is set in .env**

```bash
grep DIRECT_URL .env
```

Expected output: a line like `DIRECT_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres`

If missing: add `DIRECT_URL` to `.env` pointing to port **5432** (direct, not PgBouncer). Prisma uses `directUrl` for migrations.

- [ ] **Step 2: Confirm no migrations exist yet**

```bash
ls prisma/migrations/
```

Expected output:
```
migration_lock.toml
```

If SQL files already exist, stop — this plan does not apply.

- [ ] **Step 3: Confirm schema.prisma has directUrl configured**

```bash
grep -A3 "datasource db" prisma/schema.prisma
```

Expected output includes:
```
directUrl = env("DIRECT_URL")
```

---

## Task 2: Generate Migration SQL

**Files:**
- Create: `prisma/migrations/20260328000000_init/migration.sql`

- [ ] **Step 1: Create the migration directory**

```bash
mkdir -p prisma/migrations/20260328000000_init
```

Expected: no output, exit code 0.

- [ ] **Step 2: Generate SQL from schema (from-empty to current schema)**

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  > prisma/migrations/20260328000000_init/migration.sql
```

Expected: no output to stdout (SQL goes to file), exit code 0.

- [ ] **Step 3: Verify the generated SQL contains all expected tables**

```bash
grep "^CREATE TABLE\|^CREATE TYPE\|^CREATE UNIQUE INDEX\|^CREATE INDEX" \
  prisma/migrations/20260328000000_init/migration.sql
```

Expected output must include all 14 tables and 6 enums. Check for these tables:
```
"users"
"trainer_trainee"
"muscle_groups"
"movement_patterns"
"movement_pattern_colors"
"exercises"
"exercise_muscle_groups"
"training_programs"
"weeks"
"workouts"
"workout_exercises"
"exercise_feedbacks"
"sets_performed"
"personal_records"
```

And these enum types:
```
"Role"
"ExerciseType"
"ProgramStatus"
"WeekType"
"WeightType"
"RestTime"
```

If any table or enum is missing, do NOT proceed — check `prisma/schema.prisma` for that model.

---

## Task 3: Baseline the Migration on Dev DB

This tells Prisma "migration `20260328000000_init` is already applied — don't try to run it on this DB."

**Files:**
- No file changes (writes to `_prisma_migrations` table in the DB)

- [ ] **Step 1: Mark migration as applied on dev DB**

```bash
npx prisma migrate resolve --applied 20260328000000_init
```

Expected output:
```
Prisma Migrate has marked the migration "20260328000000_init" as applied.
```

If you see `Error: P1001` (cannot connect): check `DIRECT_URL` in `.env` is correct and the DB is reachable.

If you see `Error: P3009` (migration already recorded): the migration was somehow already applied — run `npx prisma migrate status` to inspect, then skip this step.

- [ ] **Step 2: Verify migration status is clean**

```bash
npx prisma migrate status
```

Expected output:
```
The following migration(s) are applied:

migrations/
  └─ 20260328000000_init/
       └─ migration.sql

Database schema is up to date!
```

If `migrate status` shows drift warnings (schema differs from migration), check whether `schema.prisma` has been modified after `init.sql` was applied. If so, additional migrations are needed (out of scope for B3).

---

## Task 4: Commit

- [ ] **Step 1: Stage migration files**

```bash
git add prisma/migrations/20260328000000_init/migration.sql
git add prisma/migrations/migration_lock.toml
```

- [ ] **Step 2: Verify staged files**

```bash
git diff --cached --stat
```

Expected output:
```
 prisma/migrations/20260328000000_init/migration.sql | N +++
 prisma/migrations/migration_lock.toml               | 0
 2 files changed, N insertions(+)
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: commit initial prisma migration"
```

Expected output:
```
[master <hash>] chore: commit initial prisma migration
 2 files changed, N insertions(+)
```

---

## Task 5: Verify Production Readiness

Simulate what Vercel will do at first deploy: run `prisma migrate deploy` against a DB that has never been touched.

- [ ] **Step 1: Confirm `prisma:migrate:prod` script is in package.json**

```bash
grep "migrate:prod\|migrate deploy" package.json
```

Expected output: a script line containing `prisma migrate deploy`.

If missing, add to `package.json` scripts:
```json
"prisma:migrate:prod": "prisma migrate deploy"
```

- [ ] **Step 2: Verify migration SQL is syntactically valid (optional but fast)**

```bash
npx prisma validate
```

Expected output:
```
The schema at prisma/schema.prisma is valid 🚀
```

- [ ] **Step 3: Run unit tests to confirm nothing broken**

```bash
npm run test:unit
```

Expected: all tests pass, 80% coverage maintained.

- [ ] **Step 4: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

---

## Self-Review Notes

**Spec coverage (B3 from pre-deployment-review.md):**
- ✅ `prisma/migrations/` will contain SQL migration file
- ✅ Existing dev DB untouched (baseline approach, no reset)
- ✅ Migration committed to git
- ✅ `prisma migrate deploy` will work on fresh production DB

**Placeholders:** None — all commands are exact with expected output.

**Type consistency:** N/A (no new code types introduced).

**Edge case — schema drift:** If `prisma migrate status` shows drift after Task 3 Step 2, it means `schema.prisma` was changed after `init.sql` was run. In that case, run an additional `npx prisma migrate dev --name <description_of_change>` for each schema change, then commit the extra migration files alongside `20260328000000_init`.
