# Quick Start Guide - ZeroCento Training Platform

## 📦 Setup Iniziale (5 minuti)

### 1. Verifica Prerequisiti
```bash
node --version  # Deve essere >= 20.0.0
npm --version
```

### 2. Configura Supabase

1. Vai su [https://supabase.com](https://supabase.com)
2. Crea nuovo progetto:
   - **Region**: Europe Central (Frankfurt) `eu-central-1`
   - **Database Password**: Salva in luogo sicuro
3. Vai su **Settings** → **API**
4. Copia:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret!)

### 3. Configura Environment Variables

Modifica `.env.local`:

```env
# Supabase (dalle tue credenziali)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Database - Modifica con i tuoi dettagli
DATABASE_URL=postgresql://postgres:TUA_PASSWORD@db.xxx.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:TUA_PASSWORD@db.xxx.supabase.co:5432/postgres

# Il resto va bene come default per development
```

**IMPORTANTE**: Sostituisci `xxx` e `TUA_PASSWORD` con i tuoi valori reali!

### 4. Installa Dipendenze (se non fatto)
```bash
npm install
```

### 5. Setup Database

```bash
# Genera Prisma Client
npm run prisma:generate

# Crea tabelle nel database
npm run prisma:migrate

# Popola con dati di test (admin + 2 trainer + 10 trainee + esercizi)
npm run prisma:seed
```

### 6. Avvia Dev Server
```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

## 🔑 Credenziali di Test

**IMPORTANTE**: Dopo il seed, devi creare manualmente le password in Supabase!

### Admin
- Email: `admin@zerocento.app`
- Password: Devi crearla in Supabase Auth Dashboard

### Trainer 1
- Email: `trainer1@zerocento.app`
- Password: Devi crearla in Supabase Auth Dashboard

### Trainee 1
- Email: `trainee1@zerocento.app`
- Password: Devi crearla in Supabase Auth Dashboard

### Come Creare le Password in Supabase:

1. Vai su **Authentication** → **Users** nel Supabase Dashboard
2. Per ogni utente:
   - Clicca sui 3 puntini → **Reset Password**
   - Imposta password: `Test1234!` (o quella che preferisci)
   - Salva

## 🛠️ Comandi Utili

```bash
# Development
npm run dev              # Avvia dev server (http://localhost:3000)
npm run build            # Build production
npm run start            # Avvia server production

# Database
npm run prisma:studio    # GUI per esplorare DB (http://localhost:5555)
npm run prisma:generate  # Rigenera Prisma Client dopo modifica schema
npm run prisma:migrate   # Crea nuova migration
npm run prisma:seed      # Re-seed database

# Testing
npm run test:unit        # Unit tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run lint             # ESLint check
npm run type-check       # TypeScript check

# Utilities
npm list --depth=0       # Vedi dipendenze installate
```

## 🎯 Sviluppo: Prossimi Step

### Step 1: Verifica Health Check
```bash
curl http://localhost:3000/api/health
```

Dovresti vedere:
```json
{
  "data": {
    "status": "healthy",
    "timestamp": "...",
    "services": {
      "database": "up",
      "auth": "up"
    }
  },
  "meta": {
    "timestamp": "..."
  }
}
```

### Step 2: Testa Login
1. Vai su [http://localhost:3000/login](http://localhost:3000/login)
2. Usa credenziali admin/trainer/trainee
3. Dovresti essere reindirizzato a `/ruolo/dashboard`

### Step 3: Testa API Users
```bash
# Ottieni token da Supabase dopo login, poi:
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 4: Continua Implementazione
Segui l'ordine in `README.md` → **TODO** section:
1. Completa pagine auth restanti
2. API exercises (priorità alta)
3. API programs (priorità alta)
4. Frontend Trainer dashboard
5. Frontend Trainee mobile

## 🐛 Troubleshooting

### Errore: "Cannot find module '@prisma/client'"
```bash
npm run prisma:generate
```

### Errore: "PrismaClient is unable to run in this browser environment"
Stai importando Prisma in un Client Component. Usa solo in Server Components o API Routes.

### Errore: "Database connection failed"
1. Verifica `.env.local` con credenziali corrette
2. Verifica che Supabase project sia attivo
3. Prova connection string diretta in Prisma Studio

### Errore: "User not found" dopo login
1. Verifica che il seed sia stato eseguito
2. Controlla in Supabase Dashboard → Database → Table Editor → users
3. Verifica che user.id corrisponda a auth.users.id

### Rate Limit in Development
Se vedi errore `RATE_LIMIT_EXCEEDED`, commenta il rate limiting nel middleware per dev:
```typescript
// In src/middleware.ts, commenta checkRateLimit() durante development
```

## 📚 Risorse

- **Documentazione Design**: `design/` folder
- **Prompt Implementazione**: `prompts/implementation_prompt.md`
- **Schema Database**: `prisma/schema.prisma`
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Supabase Docs**: https://supabase.com/docs
- **Tailwind Docs**: https://tailwindcss.com/docs

## 💡 Tips

1. **Usa Prisma Studio** durante sviluppo per esplorare i dati
2. **Hot Reload** è attivo - le modifiche si riflettono immediatamente
3. **TypeScript strict** è attivo - risolvi tutti gli errori type
4. **ESLint** è configurato - segui le convenzioni
5. **Middleware** gestisce auth automaticamente - non serve controllare in ogni route

## 🎉 Hai Finito!

Ora hai un progetto funzionante con:
- ✅ Auth completa (Supabase)
- ✅ Database con schema completo (Prisma)
- ✅ API users funzionanti
- ✅ Health check endpoint
- ✅ Pagina login
- ✅ Seed data per testing

Continua lo sviluppo seguendo il piano in `README.md`!
