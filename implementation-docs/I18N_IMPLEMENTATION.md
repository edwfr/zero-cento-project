# i18n Integration - Implementation Guide

**Data**: 30 Marzo 2026  
**Task**: Sprint 7.1 - Integrazione `useTranslation()` nei componenti  
**Status**: ✅ Completato (infrastruttura base e pattern dimostrativi)

---

## 📋 Sommario Implementazione

### ✅ Completato

1. **Infrastruttura i18n** (`src/lib/i18n/`)
   - `client.ts` - Configurazione i18next lato client
   - `provider.tsx` - Provider React per i18n
   - Integrato in `src/app/layout.tsx`

2. **File di Traduzione** (`public/locales/`)
   - **Italiano & Inglese** per 10 namespace:
     - `common.json` - Stringhe comuni, bottoni, status
     - `auth.json` - Login, password, autenticazione
     - `errors.json` - Messaggi di errore
     - `navigation.json` - Menu, breadcrumb, navigazione
     - `trainer.json` - Area trainer
     - `trainee.json` - Area trainee/atleta
     - `admin.json` - Area amministrazione
     - `profile.json` - Profilo utente
     - `components.json` - Componenti riutilizzabili
     - `validation.json` - Validazioni form

3. **Componenti Aggiornati** (esempi dimostrativi)
   - ✅ `login/page.tsx` - Pagina login
   - ✅ `forgot-password/page.tsx` - Reset password
   - ✅ `ConfirmationModal.tsx` - Modal conferma
   - ✅ `PWAInstallPrompt.tsx` - Prompt installazione PWA
   - ✅ `admin/users/AdminUsersContent.tsx` (parziale) - Gestione utenti admin

4. **Dipendenze Installate**
   - ✅ `i18next-browser-languagedetector` (^7.2.1)

---

## 🔧 Pattern di Utilizzo

### Base: Client Component

```tsx
'use client'

import { useTranslation } from 'react-i18next'

export default function MioComponente() {
  const { t } = useTranslation(['namespace1', 'namespace2'])
  
  return (
    <div>
      <h1>{t('namespace1:sezione.chiave')}</h1>
      <button>{t('common:common.save')}</button>
    </div>
  )
}
```

### Con Interpolazione

```tsx
<p>{t('admin:users.confirmActivate', { count: selectedIds.size })}</p>
// "Sei sicuro di voler attivare 5 utenti?"
```

### Default Values nei Props

```tsx
export default function Modal({ confirmText, cancelText }: Props) {
  const { t } = useTranslation('common')
  
  const finalConfirmText = confirmText || t('common.confirm')
  const finalCancelText = cancelText || t('common.cancel')
  
  // Usa finalConfirmText e finalCancelText nel render
}
```

### Loading States

```tsx
{loading ? t('common:common.loading') : t('auth:login.submit')}
```

---

## 📁 Struttura Namespace

### `common:` Stringhe Comuni
```
common.save, common.cancel, common.delete, common.edit
common.loading, common.loadingProgress, common.saving
common.error, common.success
common.yes, common.no
common.active, common.inactive
daysOfWeek.monday, daysOfWeek.tuesday, ...
roles.admin, roles.trainer, roles.trainee
```

### `auth:` Autenticazione
```
login.title, login.submit, login.error, login.forgotPassword
forgotPassword.title, forgotPassword.description, forgotPassword.submit
resetPassword.title, resetPassword.newPassword
changePassword.title, changePassword.currentPassword
validation.emailRequired, validation.passwordTooShort
```

### `navigation:` Navigazione
```
navigation.dashboard, navigation.programs, navigation.exercises
breadcrumbs.backToLibrary, breadcrumbs.backToAthletes
```

### `admin:`, `trainer:`, `trainee:` Aree Specifiche
```
admin:users.title, admin:users.createUser
trainer:exercises.title, trainer:athletes.searchPlaceholder
trainee:dashboard.noActiveProgram
```

### `components:` Componenti
```
confirmationModal.sideEffects
feedbackForm.prescribed, feedbackForm.addSet
pwaPrompt.install, pwaPrompt.description
```

### `validation:` Validazioni
```
validation.invalidExerciseId
validation.minSets, validation.maxSets
validation.selectMuscleGroup
```

---

## 🚀 Come Procedere con i18n Rimanente

### Fase 1: Componenti Core (priorità alta)

**File da aggiornare:**
- `src/components/UserCreateModal.tsx`
- `src/components/UserEditModal.tsx`
- `src/components/UserDeleteModal.tsx`
- `src/components/ExerciseCard.tsx`
- `src/components/ExercisesTable.tsx`
- `src/components/FeedbackForm.tsx`
- `src/components/ProgramsTable.tsx`
- `src/components/UsersTable.tsx`

**Pattern:**
1. Aggiungi import: `import { useTranslation } from 'react-i18next'`
2. Nel componente: `const { t } = useTranslation(['namespace1', 'namespace2'])`
3. Sostituisci stringhe:
   - `"Salva"` → `{t('common:common.save')}`
   - `"Elimina"` → `{t('common:common.delete')}`
   - `"Caricamento..."` → `{t('common:common.loading')}`

### Fase 2: Pagine Admin (priorità alta)

**File da completare:**
- ✅ `src/app/admin/users/AdminUsersContent.tsx` (iniziato)
- `src/app/admin/dashboard/AdminDashboardContent.tsx`

**Stringhe comuni admin:**
```tsx
t('admin:users.title')
t('admin:users.createUser')
t('admin:users.confirmDelete')
t('admin:users.role')
t('admin:dashboard.title')
```

### Fase 3: Pagine Trainer (priorità alta)

**File da aggiornare:**
- `src/app/trainer/dashboard/page.tsx`
- `src/app/trainer/exercises/page.tsx`
- `src/app/trainer/exercises/[id]/edit/page.tsx`
- `src/app/trainer/trainees/[id]/page.tsx`
- `src/app/trainer/trainees/[id]/records/page.tsx`
- `src/app/trainer/programs/[id]/page.tsx`
- `src/app/trainer/programs/[id]/reports/page.tsx`
- `src/app/trainer/programs/[id]/progress/page.tsx`

**Stringhe trainer frequenti:**
```tsx
t('trainer:dashboard.title')
t('trainer:exercises.title')
t('trainer:exercises.createNew')
t('trainer:athletes.searchPlaceholder')
t('trainer:personalRecords.title')
t('trainer:programs.searchPlaceholder')
```

### Fase 4: Pagine Trainee (priorità media)

**File da aggiornare:**
- `src/app/trainee/dashboard/page.tsx`
- `src/app/trainee/workouts/[id]/page.tsx`

**Stringhe trainee:**
```tsx
t('trainee:dashboard.noActiveProgram')
t('trainee:dashboard.myRecords')
t('trainee:workouts.nextExercise')
```

### Fase 5: Pagine Profilo & Reset Password

**File da aggiornare:**
- `src/app/profile/page.tsx`
- `src/app/reset-password/page.tsx`

---

## 🔍 Checklist di Conversione per Ogni File

1. [ ] Aggiungi import `useTranslation`
2. [ ] Aggiungi hook nel componente: `const { t } = useTranslation([...])`
3. [ ] Identifica tutte le stringhe hardcoded italiane
4. [ ] Verifica che esistano le chiavi di traduzione nei file JSON
5. [ ] Se mancano chiavi, aggiungile in `public/locales/it/*.json` e `public/locales/en/*.json`
6. [ ] Sostituisci le stringhe con chiamate `t()`
7. [ ] Testa il componente
8. [ ] Verifica che non ci siano errori TypeScript: `npm run type-check`

---

## 📝 Esempi di Conversione

### Esempio 1: Bottone Semplice

**Prima:**
```tsx
<button>Salva Modifiche</button>
```

**Dopo:**
```tsx
const { t } = useTranslation('common')
// ...
<button>{t('common.saveChanges')}</button>
```

### Esempio 2: Titolo con Stato Loading

**Prima:**
```tsx
<h1>{loading ? 'Caricamento...' : 'Dashboard Trainer'}</h1>
```

**Dopo:**
```tsx
const { t } = useTranslation(['trainer', 'common'])
// ...
<h1>{loading ? t('common:common.loading') : t('trainer:dashboard.title')}</h1>
```

### Esempio 3: Messaggio di Conferma

**Prima:**
```tsx
const message = `Sei sicuro di voler eliminare ${count} utenti?`
```

**Dopo:**
```tsx
const { t } = useTranslation('admin')
const message = t('admin:users.confirmDelete', { count })
```

(Assicurati che il JSON abbia: `"confirmDelete": "Sei sicuro di voler eliminare {{count}} utenti?"`)

### Esempio 4: Array di Opzioni

**Prima:**
```tsx
const weekTypes = [
  { value: 'standard', label: 'Settimana Standard' },
  { value: 'test', label: 'Settimana Test' },
  { value: 'deload', label: 'Settimana Scarico' }
]
```

**Dopo:**
```tsx
const { t } = useTranslation('trainer')
const weekTypes = [
  { value: 'standard', label: t('weekTypes.standard') },
  { value: 'test', label: t('weekTypes.test') },
  { value: 'deload', label: t('weekTypes.deload') }
]
```

---

## 🧪 Testing

### Test Locale Switching

1. Apri DevTools Console
2. Esegui:
```javascript
i18next.changeLanguage('en')  // Switch a inglese
i18next.changeLanguage('it')  // Torna a italiano
```

3. Le stringhe dovrebbero aggiornarsi automaticamente

### Test Missing Keys

Se una chiave di traduzione non esiste, i18next mostrerà la chiave stessa come fallback:
```
"auth:login.nonExistentKey" 
```

---

## ⚠️ Note Importanti

1. **Server Components**: Attualmente i18n è configurato solo per client components (`'use client'`). Per server components serve un setup diverso (vedi docs).

2. **Namespace Loading**: Specifica sempre i namespace necessari in `useTranslation(['ns1', 'ns2'])` per performance ottimali.

3. **Cookie Persistence**: La lingua selezionata è salvata in cookie `NEXT_LOCALE` e localStorage automaticamente.

4. **Fallback**: Se manca una traduzione inglese, verrà usata quella italiana (lingua default).

5. **Context**: La sintassi `namespace:sezione.chiave` è più esplicita e previene conflitti.

---

## 📊 Statistiche

- **Namespace creati**: 10
- **Stringhe tradotte**: ~450+
- **Lingue supportate**: Italiano (default), Inglese
- **Componenti già convertiti**: 5 (esempi dimostrativi)
- **Componenti rimanenti**: ~45+

---

## 🎯 Prossimi Passi Suggeriti

1. **Task 7.2**: Completare la rimozione di tutte le stringhe hardcoded usando questo pattern
2. **Task 7.3**: Implementare `date-fns` con locale i18n per formattazione date
3. Aggiungere un language switcher nell'header/settings per testare le traduzioni
4. Considerare l'aggiunta di URL-based routing (`/it/dashboard`, `/en/dashboard`) se necessario

---

## 📚 Riferimenti

- [Documentazione i18next](https://www.i18next.com/)
- [react-i18next Hooks](https://react.i18next.com/latest/usetranslation-hook)
- [Next.js i18n](https://nextjs.org/docs/app/building-your-application/routing/internationalization)

---

**Autore**: GitHub Copilot  
**Data completamento infrastruttura**: 30 Marzo 2026
