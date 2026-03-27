# Open Decisions

> Formato: `[ ]` = aperta · `[~]` = in discussione · `[x]` = chiusa (vedi 09_change_log.md)

---

## 00 — Problem Statement

- [ ] **OD-01** Chi è l'utente primario? (ruolo, contesto d'uso, livello tecnico)
- [ ] **OD-02** Esistono utenti secondari o amministratori?
- [ ] **OD-03** Qual è il valore concreto prodotto dall'app? (outcome misurabile)
- [ ] **OD-04** Quali funzionalità sono esplicitamente fuori scope (MVP)?
- [ ] **OD-05** Vincoli tecnologici esistenti? (es. stack aziendale obbligato, cloud provider, licenze)
- [ ] **OD-06** Vincoli temporali / milestone principali?
- [ ] **OD-07** Vincoli organizzativi? (team size, approvazioni, compliance)

---

## 01 — Architecture Overview

- [ ] **OD-08** Quale stack tecnologico viene adottato? (Frontend framework, Backend runtime, DB)
- [ ] **OD-09** Hosting / Cloud provider? (Vercel, AWS, Azure, on-premise…)
- [ ] **OD-10** Architettura: monolite, microservizi, serverless, edge?
- [ ] **OD-11** Esiste un BFF (Backend for Frontend) o il frontend chiama direttamente le API?
- [ ] **OD-12** Quali sono i rischi architetturali da monitorare?

---

## 02 — Frontend Design

- [ ] **OD-13** Quali sono le pagine/schermate principali dell'applicazione?
- [ ] **OD-14** Quale libreria UI viene utilizzata? (es. shadcn/ui, MUI, Tailwind puro…)
- [ ] **OD-15** Quale soluzione di state management globale? (Zustand, Redux, Context API, nessuna)
- [ ] **OD-16** Come vengono gestiti i form? (React Hook Form, Formik, nativo)
- [ ] **OD-17** L'app richiede SSR / SSG o è interamente SPA?

---

## 03 — Backend & API

- [ ] **OD-18** REST, GraphQL, tRPC o altro?
- [ ] **OD-19** Dove avviene la validazione degli input? (zod, yup, joi, lato DB)
- [ ] **OD-20** Qual è il formato standard degli errori API?
- [ ] **OD-21** Si utilizzano rate limiting / throttling? Con quale provider?
- [ ] **OD-22** Logging strutturato: soluzione e livelli di log previsti?

---

## 04 — Data Model

- [ ] **OD-23** Quali sono le entità principali del dominio?
- [ ] **OD-24** Database relazionale o document-based? (PostgreSQL, MySQL, MongoDB, SQLite…)
- [ ] **OD-25** Si usa un ORM? (Prisma, Drizzle, TypeORM, nessuno)
- [ ] **OD-26** Strategia di migrazione dello schema? (migration files, push automatico)
- [ ] **OD-27** Crescita attesa dei dati: ordini di grandezza per le entità principali?

---

## 05 — Security & Auth

- [ ] **OD-28** Quale metodo di autenticazione? (email+password, OAuth, magic link, SSO aziendale)
- [ ] **OD-29** Provider di autenticazione? (NextAuth, Auth0, Clerk, Firebase Auth, custom)
- [ ] **OD-30** Quali ruoli esistono nel sistema? (admin, user, guest…)
- [ ] **OD-31** Come vengono gestiti i segreti? (env vars, secret manager, vault)
- [ ] **OD-32** Requisiti di compliance? (GDPR, SOC2, ISO 27001)

---

## 06 — Deploy & Scaling

- [ ] **OD-33** Ambienti previsti: dev / staging / prod? URL e accessi?
- [ ] **OD-34** CI/CD pipeline: GitHub Actions, GitLab CI, altro?
- [ ] **OD-35** Strategia di deploy: rolling, blue/green, immutabile?
- [ ] **OD-36** Bottleneck di scalabilità previsti? (DB connections, compute, storage)
- [ ] **OD-37** Budget infrastrutturale mensile stimato?

---

## 07 — Testing Strategy

- [ ] **OD-38** Framework di unit test? (Vitest, Jest, pytest…)
- [ ] **OD-39** Framework E2E? (Playwright, Cypress, nessuno per MVP)
- [ ] **OD-40** Soglia minima di code coverage accettata?
- [ ] **OD-41** I test E2E girano in CI o solo in locale?
- [ ] **OD-42** Quali sono i flussi utente critici da coprire obbligatoriamente?