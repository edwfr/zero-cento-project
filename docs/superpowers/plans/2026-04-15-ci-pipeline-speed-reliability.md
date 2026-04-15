# CI Pipeline Speed & Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parallelize the GitHub Actions CI pipeline, add E2E sharding + browser caching, gate PRs with a fast smoke test subset, and fix a broken deploy dependency.

**Architecture:** Split the monolithic `test` job into two parallel jobs (`lint-typecheck` + `unit-test`). Add a `e2e-smoke` job that runs only `@smoke`-tagged Playwright tests on every PR. Shard the full E2E suite into 4 parallel workers on staging. Fix `deploy-production` to depend on the jobs that actually run on `main`.

**Tech Stack:** GitHub Actions, Playwright 1.46, Vitest 2.0, Next.js 14, Node 20

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.github/workflows/ci.yml` | Modify | Restructure jobs: parallel lint+unit, sharded E2E, smoke gate, fix deploy dep |
| `playwright.config.ts` | Modify | `workers: 4` in CI (was `1`) to enable real parallelism |
| `tests/e2e/login-redirect-by-role.spec.ts` | Modify | Tag 3 login tests with `@smoke` |
| `tests/e2e/trainee-complete-workout.spec.ts` | Modify | Tag happy-path test with `@smoke` |
| `tests/e2e/trainer-create-program.spec.ts` | Modify | Tag `navigates to create program page` with `@smoke` |

---

## Task 1: Tag smoke tests — login redirects

**Files:**
- Modify: `tests/e2e/login-redirect-by-role.spec.ts`

- [ ] **Step 1: Add `@smoke` tag to three login tests**

Open `tests/e2e/login-redirect-by-role.spec.ts`. Change these three `test(...)` calls to include `{ tag: '@smoke' }`:

```typescript
// BEFORE
test('admin logs in and redirects to /admin/dashboard', async ({ page }) => {

// AFTER
test('admin logs in and redirects to /admin/dashboard', { tag: '@smoke' }, async ({ page }) => {
```

```typescript
// BEFORE
test('trainer logs in and redirects to /trainer/dashboard', async ({ page }) => {

// AFTER
test('trainer logs in and redirects to /trainer/dashboard', { tag: '@smoke' }, async ({ page }) => {
```

```typescript
// BEFORE
test('trainee logs in and redirects to /trainee/dashboard', async ({ page }) => {

// AFTER
test('trainee logs in and redirects to /trainee/dashboard', { tag: '@smoke' }, async ({ page }) => {
```

Leave all other tests in the file unchanged.

- [ ] **Step 2: Verify tags parse correctly (dry-run)**

```bash
cd C:/dev-projects/ZeroCentoProject
npx playwright test --grep "@smoke" --list 2>&1 | head -30
```

Expected output: lists the 3 tagged tests, e.g.:
```
  [desktop-trainer] › login-redirect-by-role.spec.ts:27:5 › Login: Role-based redirects › admin logs in ...
  [desktop-trainer] › login-redirect-by-role.spec.ts:42:5 › Login: Role-based redirects › trainer logs in ...
  [desktop-trainer] › login-redirect-by-role.spec.ts:60:5 › Login: Role-based redirects › trainee logs in ...
  ...
```
(Both `desktop-trainer` and `mobile-trainee` projects will each list them — so 6 lines for 3 tests × 2 projects.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/login-redirect-by-role.spec.ts
git commit -m "test(e2e): tag login redirect tests as @smoke"
```

---

## Task 2: Tag smoke tests — trainee workout + trainer program

**Files:**
- Modify: `tests/e2e/trainee-complete-workout.spec.ts`
- Modify: `tests/e2e/trainer-create-program.spec.ts`

- [ ] **Step 1: Tag trainee happy-path test**

In `tests/e2e/trainee-complete-workout.spec.ts`, find line:

```typescript
test('trainee completes a workout end-to-end and receives success feedback', async ({ page }) => {
```

Change to:

```typescript
test('trainee completes a workout end-to-end and receives success feedback', { tag: '@smoke' }, async ({ page }) => {
```

- [ ] **Step 2: Tag trainer navigation test**

In `tests/e2e/trainer-create-program.spec.ts`, find line:

```typescript
test('navigates to create program page', async ({ page }) => {
```

Change to:

```typescript
test('navigates to create program page', { tag: '@smoke' }, async ({ page }) => {
```

- [ ] **Step 3: Verify total smoke test count**

```bash
cd C:/dev-projects/ZeroCentoProject
npx playwright test --grep "@smoke" --list 2>&1 | grep "desktop-trainer" | wc -l
```

Expected: `5` (3 login + 1 trainee + 1 trainer = 5 smoke tests for the desktop project).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/trainee-complete-workout.spec.ts tests/e2e/trainer-create-program.spec.ts
git commit -m "test(e2e): tag core trainee and trainer flows as @smoke"
```

---

## Task 3: Update Playwright config to allow parallel workers in CI

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Change workers from `1` to `4` for CI**

In `playwright.config.ts`, find line:

```typescript
workers: process.env.CI ? 1 : undefined,
```

Change to:

```typescript
workers: process.env.CI ? 4 : undefined,
```

This allows both the smoke job and the sharded E2E job to run tests across 4 parallel browser workers. Without this change, sharding dispatches work to 4 machines but each machine is still single-threaded.

- [ ] **Step 2: Verify config parses without errors**

```bash
cd C:/dev-projects/ZeroCentoProject
npx playwright test --list 2>&1 | tail -5
```

Expected: no syntax errors; test list prints normally.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "test(e2e): set CI workers to 4 to enable parallel execution"
```

---

## Task 4: Restructure GitHub Actions — parallel jobs + caching + smoke gate + sharding + fix deploy

**Files:**
- Modify: `.github/workflows/ci.yml`

This is the largest change. Replace the entire file content.

- [ ] **Step 1: Write the new ci.yml**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI/CD Pipeline

on:
  pull_request:
    branches: [staging, main]
  push:
    branches: [staging, main]

env:
  NODE_VERSION: '20'

# ── Shared setup steps are duplicated per job intentionally.
# GitHub Actions has no native "shared steps" — composite actions would add
# maintenance overhead not worth it at this scale.

jobs:
  # ─────────────────────────────────────────────────────────
  # Job 1: Lint & Type Check  (runs in parallel with unit-test)
  # ─────────────────────────────────────────────────────────
  lint-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npm run prisma:generate

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

  # ─────────────────────────────────────────────────────────
  # Job 2: Unit Tests + Coverage  (runs in parallel with lint-typecheck)
  # ─────────────────────────────────────────────────────────
  unit-test:
    name: Unit Tests & Coverage
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npm run prisma:generate

      - name: Unit tests with coverage
        run: npm run test:unit -- --coverage

      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  # ─────────────────────────────────────────────────────────
  # Job 3: E2E Smoke Tests  (runs on every PR, fast ~90s gate)
  # ─────────────────────────────────────────────────────────
  e2e-smoke:
    name: E2E Smoke Tests
    needs: [lint-typecheck, unit-test]
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps

      - name: Install Playwright system deps (cache hit path)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps

      - name: Run smoke E2E tests
        run: npx playwright test --grep "@smoke"
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}

      - name: Upload smoke test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: smoke-report
          path: playwright-report/
          retention-days: 7

  # ─────────────────────────────────────────────────────────
  # Job 4: Full E2E Tests — sharded  (runs on staging push only)
  # ─────────────────────────────────────────────────────────
  e2e-staging:
    name: E2E Tests (Staging) — Shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
    needs: [lint-typecheck, unit-test]
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps

      - name: Install Playwright system deps (cache hit path)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps

      - name: Run E2E tests (shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }})
        run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}

      - name: Upload shard report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-shard-${{ matrix.shardIndex }}
          path: playwright-report/
          retention-days: 30

  # ─────────────────────────────────────────────────────────
  # Job 5: Deploy to Production  (main branch only)
  # Fixed: was incorrectly depending on e2e-staging which never
  # runs on main. Now depends on the jobs that do run on main.
  # ─────────────────────────────────────────────────────────
  deploy-production:
    name: Deploy to Production
    needs: [lint-typecheck, unit-test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Run database migrations
        run: npm run prisma:migrate:prod
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

- [ ] **Step 2: Validate YAML syntax**

```bash
cd C:/dev-projects/ZeroCentoProject
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

If Python not available, use Node:

```bash
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log('YAML valid')"
```

- [ ] **Step 3: Verify job graph logic (manual check)**

Read the file and confirm:
- `lint-typecheck` and `unit-test` have no `needs` → run in parallel on every trigger ✓
- `e2e-smoke` has `needs: [lint-typecheck, unit-test]` + `if: pull_request` → only on PRs ✓
- `e2e-staging` has `needs: [lint-typecheck, unit-test]` + `if: refs/heads/staging` → only staging push ✓
- `deploy-production` has `needs: [lint-typecheck, unit-test]` + `if: refs/heads/main` → only main push ✓
- No job depends on `e2e-staging` except itself ✓

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: parallelize jobs, add E2E sharding, smoke gate on PRs, fix deploy dependency"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Parallelize CI (lint + unit in parallel) | Task 4 — two independent jobs |
| E2E sharding 4× on staging | Task 4 — `strategy.matrix.shardIndex: [1,2,3,4]` |
| Cache Playwright browsers | Task 4 — `actions/cache@v4` on `~/.cache/ms-playwright` |
| Fix broken deploy dependency | Task 4 — `deploy-production` now depends on `lint-typecheck` + `unit-test` |
| Tag smoke tests | Tasks 1 + 2 |
| Smoke E2E job on PRs | Task 4 — `e2e-smoke` job with `--grep "@smoke"` |

All 6 requirements covered. ✓

### Placeholder scan

No TBD, TODO, or vague instructions found. All code blocks are complete. ✓

### Type consistency

No shared types across tasks — changes are YAML + TypeScript annotations only. Test tag syntax `{ tag: '@smoke' }` used consistently in Tasks 1 and 2. Playwright CLI flag `--grep "@smoke"` in Task 4 matches the tag strings. ✓
