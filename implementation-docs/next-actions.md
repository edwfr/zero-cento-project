# Next Actions — ZeroCento Training Platform

**Updated**: April 2026
**Status**: 142/160 tasks completed (~89%), 18 remaining
**Source of truth**: [checklist.md](./checklist.md)

---

## Active Backlog

### Priority 0 — Email con Resend

- [ ] **E.1** `npm install resend @react-email/components`
- [ ] **E.2** Crea `src/lib/resend.ts` (client Resend singleton)
- [ ] **E.3** Crea template `emails/InviteUser.tsx` (React Email)
- [ ] **E.4** Aggiorna `POST /api/users` per usare Resend (genera magic link Supabase + invia email Resend)
- [ ] **E.5** Aggiungi `RESEND_API_KEY` e `RESEND_FROM_EMAIL` alle Vercel Environment Variables
- [ ] **E.6** Verifica dominio `zerocento.app` in Resend Dashboard (DNS: SPF, DKIM, DMARC)
- [ ] **E.7** Test end-to-end: crea utente → email arriva → link funziona → onboarding completato

> Riferimento: `docs/resend-email.md`

---

### Priority 1 — Sprint 6: CI/CD & Deploy

- [ ] **6.1** Add `prisma:migrate:prod` script to `package.json`
- [ ] **6.2** Add `npm run build` step in CI test job
- [ ] **6.3** Create `vercel.json` with build config and route rewrites
- [ ] **6.4** Configure GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `STAGING_URL`, `PRODUCTION_DATABASE_URL`
- [ ] **6.5** Connect GitHub repo to Vercel for auto-deploy + PR previews
- [ ] **6.6** Complete Sentry integration
- [ ] **6.7** Configure UptimeRobot on `/api/health`

### Priority 2 — Sprint 8: PWA & Final Polish

- [ ] **8.1** Verify/complete service worker integration with Serwist
- [ ] **8.2** Replace placeholder icons with real logos
- [ ] **8.3** Test PWA installation on mobile
- [ ] **8.4** Implement offline cache strategy for active workout
- [ ] **8.5** Add index on `ExerciseFeedback.traineeId`
- [ ] **8.6** Add composite index on `SetPerformed(feedbackId, setNumber)`
- [ ] **8.7** Cache admin reports with 5min TTL

### Priority 3 — Sprint 11: i18n Error Keys

- [ ] **11.51** `src/app/trainee/dashboard/_content.tsx`
- [ ] **11.52** `src/app/admin/dashboard/_content.tsx`
- [ ] **11.55** `src/app/profile/change-password/_content.tsx`
- [ ] **11.64** Update integration tests asserting hardcoded error messages

---

## Troubleshooting

### `Cannot find module '@prisma/client'`
```bash
npm run prisma:generate
```

### Database connection failed
- Verify `DATABASE_URL` uses port 6543 (pooled)
- Verify `DIRECT_URL` uses port 5432 (direct)
- Check password is correct