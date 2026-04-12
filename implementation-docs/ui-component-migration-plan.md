# Piano di Migrazione — Adozione Componenti UI Condivisi

> **Data:** 12 aprile 2026  
> **Riferimento:** `design/11-ui-ux-consistency-review.md` §11  
> **Componenti:** `<Button>`, `<Input>`, `<FormLabel>`  
> **File sorgente componenti:** `src/components/Button.tsx`, `src/components/Input.tsx`, `src/components/FormLabel.tsx`

---

## Indice

1. [Pre-requisiti](#1-pre-requisiti)
2. [Fase 0 — Token Tailwind (P0)](#2-fase-0--token-tailwind-p0)
3. [Fase 1 — Focus Ring blu → brand (P0)](#3-fase-1--focus-ring-blu--brand-p0)
4. [Fase 2 — Migrazione `<Button>` (P0/P1)](#4-fase-2--migrazione-button-p0p1)
5. [Fase 3 — Migrazione `<Input>` (P1)](#5-fase-3--migrazione-input-p1)
6. [Fase 4 — Migrazione `<FormLabel>` (P1)](#6-fase-4--migrazione-formlabel-p1)
7. [Fase 5 — Hardcoded hex colors residui (P1)](#7-fase-5--hardcoded-hex-colors-residui-p1)
8. [Fase 6 — Validazione e QA](#8-fase-6--validazione-e-qa)
9. [Appendice — API Componenti](#9-appendice--api-componenti)

---

## 1. Pre-requisiti

- [ ] Verificare che i test esistenti (unit/integration/e2e) passino prima di iniziare
- [ ] Ogni fase produce un commit atomico con messaggio `refactor(ui): <descrizione fase>`
- [ ] Ogni fase viene verificata visivamente sulle pagine coinvolte prima di procedere

---

## 2. Fase 0 — Token Tailwind (P0)

**Obiettivo:** Assicurarsi che i token colore nel design system siano completi.

**Stato attuale** di `tailwind.config.ts`:

```ts
brand: {
    primary: '#FFA700',
    'primary-hover': '#E69500',
    secondary: '#000000',
    accent: '#FFFFFF',
}
```

### Step

- [x] **0.1** — Verificare che `brand-primary-hover` sia già utilizzato nel componente `<Button>` → ✅ già presente (`hover:bg-brand-primary-hover`)
- [x] **0.2** — Nessuna modifica necessaria a `tailwind.config.ts` — i token sono già allineati alla sezione §11.A del review

**Commit:** `refactor(ui): verify tailwind brand tokens`

---

## 3. Fase 1 — Focus Ring blu → brand (P0) 🔴 CRITICO

**Obiettivo:** Eliminare tutti i `focus:ring-blue-500` (18 istanze) nei componenti condivisi. Questi input mostreranno un anello di focus blu invece dell'arancione brand.

### Step

Per ogni file, sostituire:
- `focus:ring-blue-500` → `focus:ring-brand-primary`

| #   | File                                     | Righe                             | Istanze |
| --- | ---------------------------------------- | --------------------------------- | ------- |
| 1.1 | `src/components/ExerciseCreateModal.tsx` | 208, 223, 239, 255, 272, 307, 326 | **7**   |
| 1.2 | `src/components/ExercisesTable.tsx`      | 139, 153                          | **2**   |
| 1.3 | `src/components/ProfileForm.tsx`         | 102, 117                          | **2**   |
| 1.4 | `src/components/UserCreateModal.tsx`     | 195, 210, 225, 239                | **4**   |
| 1.5 | `src/components/UserEditModal.tsx`       | 194, 209                          | **2**   |
| 1.6 | `src/components/UsersTable.tsx`          | 145                               | **1**   |

**Totale: 18 istanze in 6 file**

### Operazione per ogni file

```diff
- focus:ring-2 focus:ring-blue-500
+ focus:ring-2 focus:ring-brand-primary
```

### Verifica

- [ ] Aprire ogni modal/form coinvolto, cliccare tab su un input e verificare anello arancione
- [x] Grep di conferma: `grep -r "focus:ring-blue" src/` deve dare **0 risultati**

**Commit:** `refactor(ui): replace blue focus ring with brand-primary (18 instances)`

---

## 4. Fase 2 — Migrazione `<Button>` (P0/P1)

**Obiettivo:** Sostituire tutti i bottoni inline con il componente `<Button>`.

### API disponibile

```tsx
import { Button } from '@/components/Button'

<Button variant="primary" size="md">Salva</Button>
<Button variant="primary" size="lg" fullWidth>Invia</Button>
<Button variant="secondary" size="md">Annulla</Button>
<Button variant="danger" size="md">Elimina</Button>
<Button variant="primary" isLoading loadingText="Salvataggio...">Salva</Button>
<Button variant="primary" icon={<PlusIcon />}>Aggiungi</Button>
```

### Mapping pattern inline → props componente

| Pattern inline                                                          | Componente equivalente                           |
| ----------------------------------------------------------------------- | ------------------------------------------------ |
| `bg-[#FFA700] hover:bg-[#FF9500] text-white rounded-lg px-4 py-2`       | `<Button variant="primary" size="md">`           |
| `bg-[#FFA700] hover:bg-[#FF9500] text-white rounded-lg px-6 py-3`       | `<Button variant="primary" size="lg">`           |
| `bg-[#FFA700] ... w-full py-3`                                          | `<Button variant="primary" size="lg" fullWidth>` |
| `bg-brand-primary hover:bg-brand-primary/90 ... px-4 py-2`              | `<Button variant="primary" size="md">`           |
| `bg-brand-primary hover:bg-[#E69500] ... px-4 py-2`                     | `<Button variant="primary" size="md">`           |
| `bg-gray-200 text-gray-700 hover:bg-gray-300 ... px-4 py-2`             | `<Button variant="secondary" size="md">`         |
| `bg-gray-300 text-gray-800 hover:bg-gray-400 ...`                       | `<Button variant="secondary" size="md">`         |
| `bg-gray-100 text-gray-700 hover:bg-gray-200 ...`                       | `<Button variant="secondary" size="md">`         |
| `bg-red-600 hover:bg-red-700 text-white ...`                            | `<Button variant="danger" size="md">`            |
| `disabled:bg-gray-300` / `disabled:bg-gray-400` / `disabled:opacity-50` | gestito internamente (`disabled:opacity-50`)     |

### Step — Bottoni Primari con hex hardcoded (P0)

Ogni step riguarda un file. Per ciascuno:
1. Aggiungere `import { Button } from '@/components/Button'` (se non presente)
2. Sostituire il `<button className="...bg-[#FFA700]...">` con `<Button>` + props corrette
3. Rimuovere classi inline; preservare `onClick`, `disabled`, `type`, `data-testid`
4. Se il bottone ha `w-full`, usare `fullWidth`
5. Se il bottone ha un'icona SVG inline, passarla come prop `icon={...}`

| #    | File                                                         | Righe ~       | Bottoni                             | Note                  |
| ---- | ------------------------------------------------------------ | ------------- | ----------------------------------- | --------------------- |
| 2.1  | `src/app/forgot-password/page.tsx`                           | 106           | 1 primary (fullWidth, lg)           | + disabled state      |
| 2.2  | `src/app/reset-password/page.tsx`                            | 144           | 1 primary (fullWidth, lg)           | + disabled state      |
| 2.3  | `src/app/force-change-password/page.tsx`                     | 183           | 1 primary (fullWidth, lg)           | + disabled state      |
| 2.4  | `src/app/onboarding/set-password/page.tsx`                   | 255           | 1 primary (fullWidth, lg)           | + disabled state      |
| 2.5  | `src/app/login/page.tsx`                                     | 185           | 1 primary (fullWidth, lg)           | hover:#E69500 variant |
| 2.6  | `src/app/error.tsx`                                          | 25            | 1 primary                           | hover:#E69500 variant |
| 2.7  | `src/app/not-found.tsx`                                      | 14            | 1 primary                           | hover:#E69500 variant |
| 2.8  | `src/app/offline/page.tsx`                                   | 34            | 1 primary (lg)                      | rounded-xl outlier    |
| 2.9  | `src/app/admin/users/_content.tsx`                           | 239           | 1 primary                           | + icon                |
| 2.10 | `src/app/trainer/trainees/_content.tsx`                      | 144           | 1 primary                           | + icon                |
| 2.11 | `src/app/trainer/trainees/[id]/_content.tsx`                 | 632, 684, 778 | 3 primari                           | sezione dettaglio     |
| 2.12 | `src/app/trainer/trainees/[id]/records/_content.tsx`         | 277, 305, 430 | 3 (2 primary, 1 con disabled)       | form PR               |
| 2.13 | `src/app/trainer/trainees/new/_content.tsx`                  | 92, 194       | 2 (1 secondary, 1 primary+disabled) | creazione trainee     |
| 2.14 | `src/app/trainer/exercises/_content.tsx`                     | 214           | 1 primary                           | lista esercizi        |
| 2.15 | `src/app/trainer/exercises/new/_content.tsx`                 | 367           | 1 primary+disabled                  | creazione esercizio   |
| 2.16 | `src/app/trainer/exercises/[id]/edit/_content.tsx`           | 418           | 1 primary+disabled                  | edit esercizio        |
| 2.17 | `src/app/trainer/programs/_content.tsx`                      | 225, 431      | 2 primari                           | lista programmi       |
| 2.18 | `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx` | 279           | 1 primary+disabled                  | metadata              |
| 2.19 | `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`  | 715           | 1 primary                           | workout detail        |
| 2.20 | `src/app/trainer/programs/[id]/tests/_content.tsx`           | 286, 540      | 2 primary+disabled                  | test config           |
| 2.21 | `src/app/trainer/programs/[id]/publish/_content.tsx`         | 417           | 1 primary                           | pubblicazione         |
| 2.22 | `src/app/trainer/dashboard/page.tsx`                         | 346           | 1 primary                           | dashboard             |
| 2.23 | `src/app/trainee/dashboard/_content.tsx`                     | 132           | 1 primary                           | dashboard trainee     |
| 2.24 | `src/app/trainee/history/_content.tsx`                       | 197           | 1 primary                           | storico               |
| 2.25 | `src/app/profile/change-password/_content.tsx`               | 154           | 1 primary+disabled                  | cambio password       |
| 2.26 | `src/components/ErrorBoundary.tsx`                           | 53            | 1 primary                           | errore generico       |
| 2.27 | `src/components/RoleGuard.tsx`                               | 66            | 1 primary                           | guard                 |
| 2.28 | `src/components/PWAInstallPrompt.tsx`                        | 107           | 1 primary + 1 secondary             | PWA prompt            |

### Step — Bottoni Secondari inline (P1)

Per ogni file che ha bottoni cancel/secondary inline:

| #    | File                                              | Pattern attuale                                          | Note                                            |
| ---- | ------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| 2.29 | `src/components/ChangePasswordSection.tsx`        | `bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md` | → `<Button variant="secondary">`                |
| 2.30 | `src/components/ProfileForm.tsx`                  | `bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md` | → `<Button variant="secondary">`                |
| 2.31 | `src/components/ExerciseCreateModal.tsx`          | `bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md` | → `<Button variant="secondary">`                |
| 2.32 | `src/components/UserCreateModal.tsx`              | `bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md` | → `<Button variant="secondary">`                |
| 2.33 | `src/components/UserDeleteModal.tsx`              | `bg-gray-200 text-gray-700 hover:bg-gray-300`            | → `<Button variant="secondary">`                |
| 2.34 | `src/components/MovementPatternColorsSection.tsx` | `bg-gray-200 text-gray-700 hover:bg-gray-300`            | → `<Button variant="secondary">`                |
| 2.35 | `src/components/ConfirmationModal.tsx`            | `bg-gray-300 text-gray-800 hover:bg-gray-400`            | → `<Button variant="secondary">` (tono diverso) |
| 2.36 | `src/components/PWAInstallPrompt.tsx`             | `bg-gray-100 text-gray-700 hover:bg-gray-200`            | → `<Button variant="secondary">`                |

### Step — Bottoni Primari con `bg-brand-primary hover:bg-brand-primary/90` (P1)

Questi file usano già il token ma con hover `/90` (opacity). Vanno migrati al componente.

| #    | File                                              | Note                         |
| ---- | ------------------------------------------------- | ---------------------------- |
| 2.37 | `src/components/ChangePasswordSection.tsx`        | bottone primario inline      |
| 2.38 | `src/components/ExerciseCreateModal.tsx`          | bottone primario inline      |
| 2.39 | `src/components/ExercisesTable.tsx`               | bottoni inline nella tabella |
| 2.40 | `src/components/FeedbackForm.tsx`                 | bottone submit               |
| 2.41 | `src/components/ProfileForm.tsx`                  | bottone save                 |
| 2.42 | `src/components/MovementPatternColorsSection.tsx` | bottone save                 |
| 2.43 | `src/components/UserCreateModal.tsx`              | bottone create               |

### Esempio di trasformazione

**Prima:**
```tsx
<button
  type="submit"
  disabled={isSubmitting}
  className="w-full py-3 bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
>
  {isSubmitting ? 'Invio in corso...' : 'Invia'}
</button>
```

**Dopo:**
```tsx
<Button
  type="submit"
  variant="primary"
  size="lg"
  fullWidth
  disabled={isSubmitting}
  isLoading={isSubmitting}
  loadingText="Invio in corso..."
>
  Invia
</Button>
```

### Verifica

- [x] Grep di conferma: `grep -r "bg-\[#FFA700\]" src/` deve dare **0 risultati**
- [x] Grep di conferma: `grep -r "hover:bg-\[#FF9500\]" src/` deve dare **0 risultati**
- [x] Grep di conferma: `grep -r "hover:bg-\[#E69500\]" src/` deve dare **0 risultati**
- [x] Grep di conferma: `grep -r "hover:bg-brand-primary/90" src/` deve dare **0 risultati** (nei bottoni)
- [x] Grep di conferma: `grep -r "disabled:bg-gray-300\|disabled:bg-gray-400" src/` deve dare **0 risultati** nei bottoni
- [ ] Test e2e passano
- [ ] Verifica visiva su almeno: login, forgot-password, admin/users, trainer/programs, trainee/dashboard

**Commit:** uno per sotto-gruppo (P0 hex / P1 secondary / P1 brand-primary/90)

---

## 5. Fase 3 — Migrazione `<Input>` (P1)

**Obiettivo:** Sostituire tutti gli `<input>` inline con il componente `<Input>`.

### API disponibile

```tsx
import { Input } from '@/components/Input'

<Input placeholder="Email..." />
<Input inputSize="lg" />
<Input state="error" helperText="Campo obbligatorio" />
<Input state="success" helperText="Valido" />
<Input icon={<SearchIcon />} iconPosition="left" />
```

### Mapping pattern inline → props componente

| Pattern inline                                      | Componente equivalente                   |
| --------------------------------------------------- | ---------------------------------------- |
| `rounded-md px-3 py-2 ... focus:ring-blue-500`      | `<Input inputSize="md">` (con fix focus) |
| `rounded-lg px-4 py-2 ... focus:ring-[#FFA700]`     | `<Input inputSize="md">`                 |
| `rounded-lg px-4 py-3 ... focus:ring-[#FFA700]`     | `<Input inputSize="lg">`                 |
| `rounded-lg px-3 py-2 ... focus:ring-brand-primary` | `<Input inputSize="md">`                 |
| Attributi: `border-red-500` su errore               | `state="error"`                          |
| Messaggio errore sotto l'input                      | `helperText="..."` con `state="error"`   |

### Step — Input con focus:ring-blue-500 (P0, se non già risolti in Fase 1)

Se nella Fase 1 è stato fatto solo il find&replace del colore ring, in questa fase si migra l'intero elemento al componente `<Input>`.

| #   | File                                     | Righe ~                           | Input | Note                         |
| --- | ---------------------------------------- | --------------------------------- | ----- | ---------------------------- |
| 3.1 | `src/components/ExerciseCreateModal.tsx` | 208, 223, 239, 255, 272, 307, 326 | **7** | tutti `rounded-md px-3 py-2` |
| 3.2 | `src/components/ExercisesTable.tsx`      | 139, 153                          | **2** | filtri tabella               |
| 3.3 | `src/components/ProfileForm.tsx`         | 102, 117                          | **2** | campi profilo                |
| 3.4 | `src/components/UserCreateModal.tsx`     | 195, 210, 225, 239                | **4** | creazione utente             |
| 3.5 | `src/components/UserEditModal.tsx`       | 194, 209                          | **2** | modifica utente              |
| 3.6 | `src/components/UsersTable.tsx`          | 145                               | **1** | filtro ricerca               |

### Step — Input con focus:ring-[#FFA700] hardcoded

| #    | File                                                 | Righe ~       | Input  | Note                                      |
| ---- | ---------------------------------------------------- | ------------- | ------ | ----------------------------------------- |
| 3.7  | `src/app/force-change-password/page.tsx`             | 138, 155, 175 | **3**  | `rounded-lg px-4 py-3` → `inputSize="lg"` |
| 3.8  | `src/app/forgot-password/page.tsx`                   | ~95           | **1**  | `rounded-lg px-4 py-3` → `inputSize="lg"` |
| 3.9  | `src/app/reset-password/page.tsx`                    | ~115, ~131    | **2**  | `rounded-lg px-4 py-3` → `inputSize="lg"` |
| 3.10 | `src/app/onboarding/set-password/page.tsx`           | ~227, ~243    | **2**  | `rounded-lg px-4 py-3` → `inputSize="lg"` |
| 3.11 | `src/app/login/page.tsx`                             | ~150, ~168    | **2**  | `rounded-lg px-3 py-2` → `inputSize="md"` |
| 3.12 | `src/app/admin/users/_content.tsx`                   | vari          | **2+** | filtri con `focus:ring-[#FFA700]`         |
| 3.13 | `src/app/admin/programs/_content.tsx`                | vari          | **1+** | filtro ricerca                            |
| 3.14 | `src/app/trainer/trainees/_content.tsx`              | vari          | **1+** | filtro ricerca                            |
| 3.15 | `src/components/DatePicker.tsx`                      | 91            | **1**  | input data                                |
| 3.16 | `src/app/trainer/trainees/new/_content.tsx`          | 149, 165      | **2**  | form creazione                            |
| 3.17 | `src/app/trainer/trainees/[id]/records/_content.tsx` | vari          | **3+** | form PR                                   |
| 3.18 | `src/app/trainee/records/_content.tsx`               | vari          | **2+** | form PR trainee                           |
| 3.19 | `src/app/profile/change-password/_content.tsx`       | vari          | **3**  | cambio password                           |

### Step — Input con focus:ring-brand-primary (già token corretto, migrare a componente)

| #    | File                                       | Input | Note                                     |
| ---- | ------------------------------------------ | ----- | ---------------------------------------- |
| 3.20 | `src/components/ChangePasswordSection.tsx` | 3     | già `focus:ring-brand-primary` ma inline |

### Esempio di trasformazione

**Prima:**
```tsx
<input
  type="email"
  id="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFA700]"
  placeholder="name@example.com"
  required
/>
```

**Dopo:**
```tsx
<Input
  type="email"
  id="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  inputSize="lg"
  placeholder="name@example.com"
  required
/>
```

### Note speciali

- **Input con validazione visiva** (bordo rosso su errore): usare `state="error"` + `helperText`
- **Input password con toggle visibilità**: conservare il wrapper con icona, usare `icon` + `iconPosition="right"` se applicabile, oppure mantenere il wrapper custom con `<Input>` dentro
- **Select, textarea**: NON rientrano in `<Input>`, gestire separatamente (esiste `<Textarea>`)
- **Input di tipo search con icona**: usare prop `icon={<SearchIcon />}` + `iconPosition="left"`

### Verifica

- [x] Grep di conferma: `grep -r "focus:ring-\[#FFA700\]" src/` deve dare **0 risultati**
- [x] Grep di conferma: `grep -r "focus:ring-blue-500" src/` deve dare **0 risultati**
- [ ] Tutti gli input hanno anello arancione al focus
- [ ] Input con errore mostrano bordo rosso e anello rosso
- [ ] Verifica visiva pagine auth (login, forgot, reset, force-change, onboarding)

**Commit:** `refactor(ui): migrate inline inputs to Input component`

---

## 6. Fase 4 — Migrazione `<FormLabel>` (P1)

**Obiettivo:** Sostituire tutte le `<label>` inline con `<FormLabel>`.

### API disponibile

```tsx
import { FormLabel } from '@/components/FormLabel'

<FormLabel htmlFor="email">Email</FormLabel>
<FormLabel htmlFor="name" required>Nome completo</FormLabel>
```

**Standard:** `text-sm font-medium text-gray-700 mb-1`

### Mapping pattern inline → componente

| Pattern inline                             | Azione                                                 |
| ------------------------------------------ | ------------------------------------------------------ |
| `text-sm font-semibold text-gray-700 mb-1` | → `<FormLabel>` (corregge semibold→medium)             |
| `text-sm font-medium text-gray-700 mb-1`   | → `<FormLabel>` (già corretto, standardizzare)         |
| `text-sm font-semibold text-gray-700 mb-2` | → `<FormLabel>` (corregge semibold→medium E mb-2→mb-1) |

### Step — Label con `font-semibold mb-1`

| #   | File                                           | Righe ~       | Label | Note     |
| --- | ---------------------------------------------- | ------------- | ----- | -------- |
| 4.1 | `src/components/AutocompleteSearch.tsx`        | 150           | 1     | semibold |
| 4.2 | `src/components/DatePicker.tsx`                | 100           | 1     | semibold |
| 4.3 | `src/app/force-change-password/page.tsx`       | 128, 144, 164 | 3     | semibold |
| 4.4 | `src/app/forgot-password/page.tsx`             | 89            | 1     | semibold |
| 4.5 | `src/app/reset-password/page.tsx`              | 110, 126      | 2     | semibold |
| 4.6 | `src/app/onboarding/set-password/page.tsx`     | 221, 237      | 2     | semibold |
| 4.7 | `src/app/profile/change-password/_content.tsx` | 105, 120, 136 | 3     | semibold |

### Step — Label con `font-semibold mb-2`

| #    | File                                                         | Righe ~                 | Label | Note            |
| ---- | ------------------------------------------------------------ | ----------------------- | ----- | --------------- |
| 4.8  | `src/app/trainer/trainees/[id]/records/_content.tsx`         | 329, 354, 370, 387, 401 | 5     | semibold + mb-2 |
| 4.9  | `src/app/trainer/trainees/new/_content.tsx`                  | 140, 156, 172           | 3     | semibold + mb-2 |
| 4.10 | `src/app/trainee/records/_content.tsx`                       | 154, 168                | 2     | semibold + mb-2 |
| 4.11 | `src/app/trainer/programs/[id]/tests/_content.tsx`           | 443, 462, 478, 495, 509 | 5     | semibold + mb-2 |
| 4.12 | `src/app/trainer/programs/[id]/publish/_content.tsx`         | 377                     | 1     | semibold + mb-2 |
| 4.13 | `src/app/trainer/programs/[id]/edit/EditProgramMetadata.tsx` | 178, 195, 216, 240      | 4     | semibold + mb-2 |
| 4.14 | `src/app/trainer/programs/new/NewProgramContent.tsx`         | 176, 191, 231, 265      | 4     | semibold + mb-2 |
| 4.15 | `src/app/trainer/exercises/new/_content.tsx`                 | 174, 232, 247, 276      | 4     | semibold + mb-2 |
| 4.16 | `src/app/trainer/exercises/[id]/edit/_content.tsx`           | 225, 283, 298, 327      | 4     | semibold + mb-2 |

### Step — Label con `font-medium mb-1` (già corretto, standardizzare a componente)

| #    | File                                       | Label | Note                 |
| ---- | ------------------------------------------ | ----- | -------------------- |
| 4.17 | `src/app/login/page.tsx`                   | 2     | già font-medium mb-1 |
| 4.18 | `src/components/ChangePasswordSection.tsx` | 3     | già font-medium mb-1 |
| 4.19 | `src/components/ExerciseCreateModal.tsx`   | 6     | già font-medium mb-1 |
| 4.20 | `src/components/ProfileForm.tsx`           | 2     | già font-medium mb-1 |
| 4.21 | `src/components/UserCreateModal.tsx`       | 4     | già font-medium mb-1 |
| 4.22 | `src/components/ExercisesTable.tsx`        | 1     | già font-medium      |
| 4.23 | `src/components/FeedbackForm.tsx`          | varie | già font-medium      |

### Esempio di trasformazione

**Prima:**
```tsx
<label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
  Password
</label>
```

**Dopo:**
```tsx
<FormLabel htmlFor="password">Password</FormLabel>
```

**Con asterisco required — Prima:**
```tsx
<label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
  Email <span className="text-red-500">*</span>
</label>
```

**Dopo:**
```tsx
<FormLabel htmlFor="email" required>Email</FormLabel>
```

### Verifica

- [x] Grep: `grep -rn "font-semibold text-gray-700 mb-" src/` su tag `<label` deve dare **0 risultati**
- [x] Le label appaiono con `font-medium` (500) uniformemente
- [ ] Lo spacing sotto la label è uniforme (mb-1 = 0.25rem)
- [ ] Verifica visiva su form con molte label: trainer/exercises/new, trainer/programs/new, records

**Commit:** `refactor(ui): migrate inline labels to FormLabel component`

---

## 7. Fase 5 — Hardcoded hex colors residui (P1)

**Obiettivo:** Dopo le fasi precedenti, eliminare tutti i riferimenti hex `#FFA700`, `#FF9500`, `#E69500` residui (in testi, bordi, decorazioni) che non erano parte di bottoni/input.

### Pattern da migrare

| Pattern                                           | Sostituzione                     | Conteggio ~ |
| ------------------------------------------------- | -------------------------------- | ----------- |
| `text-[#FFA700]`                                  | `text-brand-primary`             | ~30         |
| `border-[#FFA700]`                                | `border-brand-primary`           | ~15         |
| `hover:text-[#FF9500]`                            | `hover:text-brand-primary-hover` | ~10         |
| `hover:text-[#FFA700]`                            | `hover:text-brand-primary`       | ~5          |
| `ring-[#FFA700]` (non input)                      | `ring-brand-primary`             | residui     |
| `bg-[#FFA700]` (non bottoni, es. badge/indicator) | `bg-brand-primary`               | residui     |

### File principali coinvolti

| #   | File                                                               | Pattern                                         |
| --- | ------------------------------------------------------------------ | ----------------------------------------------- |
| 5.1 | `src/components/PersonalRecordsExplorer.tsx`                       | `text-[#FFA700]`                                |
| 5.2 | `src/components/ProgramsTable.tsx`                                 | `border-[#FFA700]`, `text-[#FFA700]`            |
| 5.3 | `src/app/trainee/dashboard/_content.tsx`                           | `text-[#FFA700]`, `border-[#FFA700]` (multipli) |
| 5.4 | `src/app/trainee/records/_content.tsx`                             | `text-[#FFA700]`                                |
| 5.5 | `src/app/trainer/trainees/[id]/_content.tsx`                       | `border-[#FFA700]`, `text-[#FFA700]`            |
| 5.6 | `src/app/trainer/trainees/_content.tsx`                            | hover text hardcoded                            |
| 5.7 | `src/app/admin/users/_content.tsx`                                 | hover text hardcoded                            |
| 5.8 | Tutti i file residui da `grep -r "#FFA700\|#FF9500\|#E69500" src/` |

### Verifica

- [x] `grep -r "#FFA700\|#FF9500\|#E69500" src/` deve dare **0 risultati**
- [x] Unica fonte di verità per il brand color: `tailwind.config.ts`

**Commit:** `refactor(ui): migrate all hardcoded hex brand colors to tokens`

---

## 8. Fase 6 — Validazione e QA

### Checklist finale

- [ ] **8.1** — Eseguire `npm run build` — zero errori
- [ ] **8.2** — Eseguire `npm run test` (unit) — tutti pass
- [ ] **8.3** — Eseguire `npm run test:e2e` — tutti pass
- [ ] **8.4** — Grep finale su tutti i pattern deprecati:

```bash
# Deve dare 0 risultati per ciascuno:
grep -r "bg-\[#FFA700\]" src/
grep -r "hover:bg-\[#FF9500\]" src/
grep -r "hover:bg-\[#E69500\]" src/
grep -r "hover:bg-brand-primary/90" src/    # (nei bottoni)
grep -r "focus:ring-blue-500" src/
grep -r "focus:ring-\[#FFA700\]" src/
grep -r "text-\[#FFA700\]" src/
grep -r "border-\[#FFA700\]" src/
grep -r "disabled:bg-gray-300" src/         # (nei bottoni)
grep -r "disabled:bg-gray-400" src/         # (nei bottoni)
```

- [ ] **8.5** — Walkthrough visivo manuale su tutte le rotte principali:

| Pagina                           | Controlli                                 |
| -------------------------------- | ----------------------------------------- |
| `/login`                         | Bottone primario, input focus ring, label |
| `/forgot-password`               | Bottone, input, label                     |
| `/reset-password`                | Bottone, input, label                     |
| `/force-change-password`         | Bottone, input, label                     |
| `/onboarding/set-password`       | Bottone, input, label                     |
| `/admin/users`                   | Bottone CTA, filtri, tabella              |
| `/admin/programs`                | Filtri                                    |
| `/trainer/trainees`              | Bottone CTA, filtri                       |
| `/trainer/trainees/[id]`         | Bottoni azione, dettagli                  |
| `/trainer/trainees/[id]/records` | Form PR, bottoni                          |
| `/trainer/trainees/new`          | Form completo                             |
| `/trainer/exercises`             | Bottone CTA, tabella, modal               |
| `/trainer/exercises/new`         | Form completo                             |
| `/trainer/programs`              | Bottoni, lista                            |
| `/trainer/programs/[id]/edit`    | Bottoni salvataggio                       |
| `/trainer/programs/[id]/tests`   | Form test                                 |
| `/trainer/programs/[id]/publish` | Bottone pubblicazione                     |
| `/trainee/dashboard`             | Bottoni, colori brand                     |
| `/trainee/history`               | Bottone navigazione                       |
| `/trainee/records`               | Form PR                                   |
| `/profile/change-password`       | Form cambio password                      |

- [ ] **8.6** — Verificare stati disabled su bottoni (opacity 50% uniforme)
- [ ] **8.7** — Verificare hover state su bottoni (colore unico brand-primary-hover)
- [ ] **8.8** — Verificare focus ring su tutti gli input (arancione brand-primary)
- [ ] **8.9** — Merge del branch `feat/ui-design-system-migration`

---

## 9. Appendice — API Componenti

### `<Button>`

| Prop           | Tipo                                   | Default     | Descrizione                      |
| -------------- | -------------------------------------- | ----------- | -------------------------------- |
| `variant`      | `'primary' \| 'secondary' \| 'danger'` | `'primary'` | Variante colore                  |
| `size`         | `'sm' \| 'md' \| 'lg'`                 | `'md'`      | Dimensione (padding + font)      |
| `isLoading`    | `boolean`                              | `false`     | Mostra spinner e disabilita      |
| `loadingText`  | `string`                               | —           | Testo durante loading            |
| `icon`         | `ReactNode`                            | —           | Icona da mostrare                |
| `iconPosition` | `'left' \| 'right'`                    | `'left'`    | Posizione icona                  |
| `fullWidth`    | `boolean`                              | `false`     | `w-full`                         |
| `disabled`     | `boolean`                              | —           | Stato disabilitato (opacity 50%) |
| `className`    | `string`                               | `''`        | Classi aggiuntive                |
| `...props`     | `ButtonHTMLAttributes`                 | —           | Tutti gli attributi HTML nativi  |

### `<Input>`

| Prop           | Tipo                                | Default     | Descrizione                     |
| -------------- | ----------------------------------- | ----------- | ------------------------------- |
| `inputSize`    | `'md' \| 'lg'`                      | `'md'`      | Dimensione (py-2 vs py-3)       |
| `state`        | `'default' \| 'error' \| 'success'` | `'default'` | Stato visivo (bordo + ring)     |
| `helperText`   | `string`                            | —           | Testo sotto l'input             |
| `icon`         | `ReactNode`                         | —           | Icona da mostrare               |
| `iconPosition` | `'left' \| 'right'`                 | `'left'`    | Posizione icona                 |
| `className`    | `string`                            | `''`        | Classi aggiuntive               |
| `ref`          | `Ref<HTMLInputElement>`             | —           | Forward ref                     |
| `...props`     | `InputHTMLAttributes`               | —           | Tutti gli attributi HTML nativi |

### `<FormLabel>`

| Prop        | Tipo                  | Default | Descrizione                                       |
| ----------- | --------------------- | ------- | ------------------------------------------------- |
| `required`  | `boolean`             | `false` | Mostra asterisco rosso                            |
| `className` | `string`              | `''`    | Classi aggiuntive                                 |
| `...props`  | `LabelHTMLAttributes` | —       | Tutti gli attributi HTML nativi (incl. `htmlFor`) |

---

## Riepilogo quantitativo

| Fase                             | File coinvolti | Istanze ~        | Priorità    |
| -------------------------------- | -------------- | ---------------- | ----------- |
| Fase 0 — Token Tailwind          | 1              | 0 modifiche      | P0          |
| Fase 1 — Focus ring blue→brand   | 6              | 18               | 🔴 P0        |
| Fase 2 — `<Button>` migration    | 35+            | 60+              | 🔴 P0 / 🟡 P1 |
| Fase 3 — `<Input>` migration     | 20+            | 40+              | 🟡 P1        |
| Fase 4 — `<FormLabel>` migration | 23+            | 50+              | 🟡 P1        |
| Fase 5 — Hex hardcoded residui   | 10+            | 50+              | 🟡 P1        |
| Fase 6 — QA                      | tutti          | —                | —           |
| **Totale**                       | **~50 file**   | **~220 istanze** |             |
