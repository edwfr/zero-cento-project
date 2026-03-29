# ⚡ NEXT ACTIONS - ZeroCento Training Platform

## 🎯 Step Immediati (Da Fare ORA - 10 minuti)

### 1. Verifica Installazione NPM ✅
```bash
npm list --depth=0
# Se vedi errori, ri-esegui: npm install
```

### 2. Genera Prisma Client ✅ (In corso)
```bash
npm run prisma:generate
```

### 3. Configura Supabase (5 minuti) ⏳
**OBBLIGATORIO prima di avviare il server!**

1. Vai su https://supabase.com
2. Clicca **New Project**
3. **Configurazione**:
   - Organization: Crea nuova o seleziona esistente
   - Name: `zerocento-training`
   - **Database Password**: Genera strong password e **SALVA** in luogo sicuro!
   - **Region**: `Europe Central (Frankfurt)` - eu-central-1
   - Pricing Plan: Free

4. Attendi provisioning (2-3 minuti)

5. Una volta ready, vai su **Settings** → **API**:
   - Copia **Project URL**: `https://xxx.supabase.co`
   - Copia **anon public**: `eyJ...`
   - Copia **service_role**: `eyJ...` (secret!)

6. Nella sidebar, clicca su **Database** → **Settings** (sotto "CONFIGURATION"):
   - Vedrai "Connection string" o "Connection pooling"
   - Copia **Connection pooling** (porta 6543) - usa questo per DATABASE_URL
   - Copia **Direct connection** (porta 5432) - usa questo per DIRECT_URL
   - Se hai problemi a trovarlo, cerca la tab "Connection info" o "Database settings"

7. **Modifica `.env.local`**:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co  # <-- INCOLLA QUI
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...              # <-- INCOLLA QUI
SUPABASE_SERVICE_ROLE_KEY=eyJ...                  # <-- INCOLLA QUI

# Database - MODIFICA con i tuoi valori
DATABASE_URL=postgresql://postgres:TUA_PASSWORD@db.xxx.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:TUA_PASSWORD@db.xxx.supabase.co:5432/postgres
```

**IMPORTANTE**: Sostituisci:
- `xxx` con il tuo project ID Supabase
- `TUA_PASSWORD` con la password database che hai salvato

### 4. Prima Migration Database (2 minuti) ⏳
```bash
# Crea le tabelle nel database
npm run prisma:migrate -- --name init

# Se chiede conferma, digita: yes
```

### 5. Seed Database (1 minuto) ⏳
```bash
npm run prisma:seed
```

Questo crea:
- ✅ 1 admin: `admin@zerocento.app`
- ✅ 2 trainer: `trainer1@zerocento.app`, `trainer2@zerocento.app`
- ✅ 10 trainee: `trainee1@zerocento.app` ... `trainee10@zerocento.app`
- ✅ 5 gruppi muscolari
- ✅ 5 schemi motori
- ✅ 5 esercizi fondamentali
- ✅ 2 programmi (1 draft + 1 active)
- ✅ Massimali sample

### 6. Crea Password Utenti in Supabase (3 minuti) ⏳
**IMPORTANTE**: Il seed crea gli utenti ma NON le password!

1. Vai su Supabase Dashboard → **Authentication** → **Users**
2. Dovresti vedere 13 utenti (1 admin + 2 trainer + 10 trainee)
3. Per `admin@zerocento.app`:
   - Clicca sui 3 puntini (⋮) → **Reset Password**
   - Imposta: `Admin1234!`
   - Salva
4. Per `trainer1@zerocento.app`:
   - Reset Password → `Trainer1234!`
5. Per `trainee1@zerocento.app`:
   - Reset Password → `Trainee1234!`

*Opzionale: ripeti per altri utenti se vuoi testarli*

### 7. Avvia Dev Server (1 minuto) ⏳
```bash
npm run dev
```

Dovresti vedere:
```
  ▲ Next.js 14.2.5
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000

 ✓ Ready in 2.5s
```

### 8. Test Funzionamento (2 minuti) ✅
1. **Health Check**:
   ```bash
   curl http://localhost:3000/api/health
   ```
   
   Risposta attesa:
   ```json
   {
     "data": {
       "status": "healthy",
       "services": { "database": "up", "auth": "up" }
     }
   }
   ```

2. **Login Test**:
   - Apri browser: http://localhost:3000
   - Dovresti essere reindirizzato a `/login`
   - Login con:
     - Email: `admin@zerocento.app`
     - Password: `Admin1234!`
   - Dovresti essere reindirizzato a `/admin/dashboard`

3. **API Users Test**:
   - Dopo login, apri DevTools → Network
   - Copia il token JWT dall'header Authorization
   - Test con curl:
     ```bash
     curl http://localhost:3000/api/users \
       -H "Authorization: Bearer TUO_TOKEN_QUI"
     ```

---

## 🔥 Troubleshooting

### ❌ Errore: "Cannot find module '@prisma/client'"
```bash
npm run prisma:generate
```

### ❌ Errore: "P1001: Can't reach database server"
1. Verifica `.env.local` con credenziali corrette
2. Verifica progetto Supabase sia attivo (non paused)
3. Prova connection diretta:
   ```bash
   npx prisma studio
   ```

### ❌ Errore: "User not found" dopo login
Gli utenti esistono in `public.users` ma manca in `auth.users`.

**Soluzione**:
1. Vai su Supabase Dashboard → Database → SQL Editor
2. Esegui:
   ```sql
   -- Verifica utenti in public.users
   SELECT id, email, role FROM public.users;
   
   -- Verifica utenti in auth.users
   SELECT id, email FROM auth.users;
   ```
3. Se auth.users è vuoto, devi creare manualmente via Dashboard

### ❌ Errore: "Rate limit exceeded" durante sviluppo
Nel `src/middleware.ts`, commenta temporaneamente il rate limiting:
```typescript
// Commenta queste righe durante development
// const allowed = await checkRateLimit(...)
// if (!allowed) { ... }
```

### ❌ Login reindirizza sempre a /login
Verifica middleware: `src/middleware.ts` deve permettere accesso a `/login` nei PUBLIC_ROUTES.

---

## 📋 Checklist Setup Completo

- [x] npm install completato
- [x] Prisma client generato
- [x] Supabase project creato (Frankfurt)
- [x] `.env` e `.env.local` configurati con credenziali reali
- [x] **Schema database creato** (via SQL Editor - 28 marzo 2026) ✅
- [ ] **PROSSIMO STEP**: Database popolato (`npm run prisma:seed`)
- [ ] Password create per admin/trainer1/trainee1 in Supabase
- [ ] Dev server avviato (`npm run dev`)
- [ ] Health check passa (200 OK)
- [ ] Login funziona con admin
- [ ] API /api/users risponde correttamente

---

### 📝 Nota 28 Marzo 2026
**Completato fino a:** Creazione schema database
**Metodo:** Script SQL eseguito manualmente su Supabase (prisma/init.sql)
**Motivo:** Porta 5432 non raggiungibile via Prisma CLI
**Prossimo step domani:** Eseguire `npm run prisma:seed` per popolare i dati iniziali

---

## 🎯 Dopo il Setup - Prossimi Sviluppi

Una volta che tutto funziona, segui questo ordine:

### Priority HIGH:
1. **API Exercises** (2h)
   - Cursor-based pagination
   - CRUD completo con muscle groups

2. **API Programs** (3h)
   - Creazione con auto-gen Week/Workout
   - Pubblicazione con date calculations

3. **API Feedback** (2h)
   - POST con SetPerformed nested
   - Idempotency handling

### Priority MEDIUM:
4. **Frontend Trainer Dashboard** (8h)
5. **Frontend Trainee Mobile** (6h)

### Priority LOW:
6. **Frontend Admin** (4h)
7. **Testing** (6h)
8. **PWA Service Worker** (2h)

Consulta `README.md` per dettagli completi.

---

## 🆘 Help

Se incontri problemi:
1. Controlla `README.md` → Troubleshooting
2. Verifica logs in terminal
3. Consulta `QUICK_START.md` per guida step-by-step
4. Usa `npm run prisma:studio` per esplorare database

---

**🚀 Sei pronto! Segui gli step sopra e in 10 minuti avrai tutto funzionante!**
