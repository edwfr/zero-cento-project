# 11 — UI/UX Consistency Review

> **Data:** 11 aprile 2026  
> **Tipo:** Audit di coerenza visiva e design system  
> **Scope:** Tutti i file `.tsx` in `src/components/` e `src/app/`

---

## Sommario Esecutivo

L'applicazione presenta una base solida con Tailwind CSS e un token `brand-primary` definito, ma soffre di **incoerenze sistematiche** dovute all'assenza di componenti UI condivisi e riutilizzabili (Button, Input, Card, etc.). Lo stesso elemento visivo viene implementato con classi diverse in file diversi, creando un'esperienza utente non uniforme.

**Problemi critici identificati: 9 categorie, 100+ istanze.**

---

## Indice

1. [Bottoni — Colori e Hover States](#1-bottoni--colori-e-hover-states)
2. [Bottoni — Border Radius](#2-bottoni--border-radius)
3. [Bottoni — Padding e Dimensioni](#3-bottoni--padding-e-dimensioni)
4. [Bottoni — Stato Disabled](#4-bottoni--stato-disabled)
5. [Bottoni — Cancel/Secondary](#5-bottoni--cancelsecondary)
6. [Input — Focus Ring](#6-input--focus-ring)
7. [Input — Border Radius e Padding](#7-input--border-radius-e-padding)
8. [Label — Font Weight](#8-label--font-weight)
9. [Card — Shadow e Border Radius](#9-card--shadow-e-border-radius)
10. [Colori — Hardcoded vs Token](#10-colori--hardcoded-vs-token)
11. [Raccomandazioni e Design System Proposto](#11-raccomandazioni-e-design-system-proposto)

---

## 1. Bottoni — Colori e Hover States

### Problema

Il colore primario `#FFA700` viene referenziato in **tre modi diversi** con **tre hover state diversi**, producendo bottoni visivamente simili ma con sfumature differenti al passaggio del mouse.

### Varianti trovate

| Pattern Background | Pattern Hover               | File esempio                                                                                                                                                                                            |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg-[#FFA700]`     | `hover:bg-[#FF9500]`        | `forgot-password/page.tsx`, `reset-password/page.tsx`, `force-change-password/page.tsx`, `admin/users/_content.tsx`, `trainer/trainees/_content.tsx`, `ErrorBoundary.tsx`                               |
| `bg-brand-primary` | `hover:bg-brand-primary/90` | `ChangePasswordSection.tsx`, `ConfirmationModal.tsx`, `ExerciseCreateModal.tsx`, `ExercisesTable.tsx`, `FeedbackForm.tsx`, `ProfileForm.tsx`, `MovementPatternColorsSection.tsx`, `UserCreateModal.tsx` |
| `bg-brand-primary` | `hover:bg-[#E69500]`        | `login/page.tsx`, `not-found.tsx`, `error.tsx`                                                                                                                                                          |

### Impatto

- **3 hover diversi** per lo stesso bottone primario → l'utente percepisce inconsistenza nei feedback visivi
- `#FF9500` e `#E69500` sono due tonalità diverse di arancione scuro (∆ visibile)
- `brand-primary/90` è una trasparenza, non un colore solido → appare diverso su sfondi non bianchi

### Soluzione

Standardizzare su un unico pattern usando il token Tailwind:
```
bg-brand-primary hover:bg-brand-primary/85
```
Oppure aggiungere un token `brand-primary-hover` al `tailwind.config.ts`.

---

## 2. Bottoni — Border Radius

### Problema

Bottoni con la stessa funzione CTA usano border-radius diversi.

| Radius       | Contesto                       | File esempio                                                                                                           |
| ------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `rounded-lg` | Pagine auth, azioni principali | `forgot-password/page.tsx`, `trainer/trainees/_content.tsx`, `FeedbackForm.tsx`                                        |
| `rounded-md` | Componenti shared              | `ChangePasswordSection.tsx`, `ExerciseCreateModal.tsx`, `ProfileForm.tsx`, `UserCreateModal.tsx`, `ExercisesTable.tsx` |
| `rounded-xl` | Pagina offline                 | `offline/page.tsx`                                                                                                     |

### Impatto

- I bottoni nei componenti shared (`rounded-md`) appaiono diversi da quelli nelle pagine (`rounded-lg`)
- La pagina offline usa `rounded-xl`, unica nell'app

### Soluzione

Standardizzare tutti i bottoni su `rounded-lg` (coerente con il look moderno dell'app).

---

## 3. Bottoni — Padding e Dimensioni

### Problema

Almeno **5 combinazioni di padding** diverse per bottoni CTA primari.

| Padding                    | Contesto                    | File esempio                                                                            |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `px-4 py-2`                | Componenti shared (compact) | `ChangePasswordSection.tsx`, `ExerciseCreateModal.tsx`, `ProfileForm.tsx`               |
| `px-6 py-2`                | Pagine admin/trainer        | `admin/users/_content.tsx`, `trainer/trainees/_content.tsx`                             |
| `px-6 py-3`                | Azioni grandi               | `ConfirmationModal.tsx`, `ErrorBoundary.tsx`, `trainer/programs/[id]/edit/_content.tsx` |
| `py-3 px-4`                | Login                       | `login/page.tsx`                                                                        |
| `py-3` (full-width, no px) | Pagine auth standalone      | `forgot-password/page.tsx`, `force-change-password/page.tsx`, `reset-password/page.tsx` |
| `px-8 py-3`                | Pagina offline              | `offline/page.tsx`                                                                      |

### Impatto

- Bottoni con la stessa importanza gerarchica hanno dimensioni diverse
- Nessuna convenzione chiara tra "bottone compatto" e "bottone full"

### Soluzione

Definire 3 size: `sm` (`px-3 py-1.5 text-sm`), `md` (`px-4 py-2`), `lg` (`px-6 py-3`).

---

## 4. Bottoni — Stato Disabled

### Problema

Lo stato disabled dei bottoni primari usa **tre approcci diversi**.

| Pattern Disabled                                   | File esempio                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `disabled:bg-gray-300 disabled:cursor-not-allowed` | `forgot-password/page.tsx`, `force-change-password/page.tsx`, `reset-password/page.tsx`, `onboarding/set-password/page.tsx` |
| `disabled:bg-gray-400 disabled:cursor-not-allowed` | `ChangePasswordSection.tsx`, `ExerciseCreateModal.tsx`, `ConfirmationModal.tsx`, `trainer/exercises/new/_content.tsx`       |
| `disabled:opacity-50 disabled:cursor-not-allowed`  | `login/page.tsx`, `FeedbackForm.tsx`                                                                                        |
| `disabled:opacity-60 disabled:cursor-not-allowed`  | `trainer/programs/[id]/edit/_content.tsx`                                                                                   |

### Impatto

- Bottoni disabilitati appaiono con colori/opacità diversi a seconda della pagina
- `gray-300` vs `gray-400` è una differenza di tono percepibile
- `opacity-50` mantiene il colore arancione sbiadito, `bg-gray-*` lo rimuove completamente → due UX diverse

### Soluzione

Standardizzare su `disabled:opacity-50 disabled:cursor-not-allowed` (mantiene il contesto del colore originale).

---

## 5. Bottoni — Cancel/Secondary

### Problema

I bottoni "Annulla" / secondari hanno **3 varianti di background** diverse.

| Pattern                                       | File esempio                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg-gray-200 text-gray-700 hover:bg-gray-300` | `ChangePasswordSection.tsx`, `ProfileForm.tsx`, `ExerciseCreateModal.tsx`, `UserCreateModal.tsx`, `UserDeleteModal.tsx`, `MovementPatternColorsSection.tsx` |
| `bg-gray-300 text-gray-800 hover:bg-gray-400` | `ConfirmationModal.tsx`, `ErrorBoundary.tsx`                                                                                                                |
| `bg-gray-100 text-gray-700 hover:bg-gray-200` | `PWAInstallPrompt.tsx`                                                                                                                                      |

### Impatto

- Il pulsante "Annulla" nel `ConfirmationModal` è più scuro (`gray-300`) di quello nei form (`gray-200`)
- L'utente vede lo stesso tipo di azione con intensità visive diverse

### Soluzione

Standardizzare su `bg-gray-200 text-gray-700 hover:bg-gray-300` per tutti i secondary buttons.

---

## 6. Input — Focus Ring

### Problema **CRITICO**

Il focus ring degli input usa **3 colori diversi**, di cui uno completamente fuori brand.

| Focus Ring                              | Contesto                   | File esempio                                                                                                                                                               |
| --------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focus:ring-2 focus:ring-[#FFA700]`     | Pagine auth, admin filters | `force-change-password/page.tsx`, `forgot-password/page.tsx`, `admin/users/_content.tsx`, `admin/programs/_content.tsx`, `trainer/trainees/_content.tsx`, `DatePicker.tsx` |
| `focus:ring-2 focus:ring-brand-primary` | Alcuni componenti          | `ChangePasswordSection.tsx`                                                                                                                                                |
| `focus:ring-1 focus:ring-brand-primary` | Login                      | `login/page.tsx`                                                                                                                                                           |
| **`focus:ring-2 focus:ring-blue-500`**  | **Componenti shared**      | **`ExercisesTable.tsx`, `ExerciseCreateModal.tsx` (7 input), `ProfileForm.tsx`, `UserCreateModal.tsx` (4 input), `UserEditModal.tsx`, `UsersTable.tsx`**                   |

### Impatto

- **18 input** nei componenti shared usano `focus:ring-blue-500` (blu) mentre il resto dell'app usa il brand arancione
- L'utente editor/admin che usa i form di gestione esercizi/utenti vede un focus ring blu, completamente fuori dal design system arancione
- Questo è il problema di coerenza più grave dell'intera app

### Soluzione

Sostituire tutti i `focus:ring-blue-500` con `focus:ring-brand-primary`. Aggiungere `focus:border-transparent` per coerenza.

---

## 7. Input — Border Radius e Padding

### Problema

Gli input usano `rounded-md` o `rounded-lg` e padding diversi senza una regola.

| Radius       | Padding     | Contesto               | File esempio                                                                                                                             |
| ------------ | ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `rounded-lg` | `px-4 py-3` | Pagine auth standalone | `force-change-password/page.tsx`, `forgot-password/page.tsx`, `onboarding/set-password/page.tsx`                                         |
| `rounded-lg` | `px-3 py-2` | Login                  | `login/page.tsx`                                                                                                                         |
| `rounded-lg` | `px-4 py-2` | Filtri admin/trainer   | `admin/users/_content.tsx`, `trainer/trainees/_content.tsx`                                                                              |
| `rounded-md` | `px-3 py-2` | Componenti shared      | `ExerciseCreateModal.tsx`, `UserCreateModal.tsx`, `ProfileForm.tsx`, `ChangePasswordSection.tsx`, `ExercisesTable.tsx`, `UsersTable.tsx` |

### Impatto

- Stessa differenza dei bottoni: i componenti shared usano `rounded-md`, le pagine `rounded-lg`
- Gli input auth sono più alti (`py-3`) di quelli admin (`py-2`) senza giustificazione

### Soluzione

Standardizzare su `rounded-lg px-4 py-2` per tutti gli input. Per i form auth full-width, `py-3` è accettabile come variante "large".

---

## 8. Label — Font Weight

### Problema

Le label dei form usano due font-weight diversi.

| Pattern                                    | File esempio                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `text-sm font-semibold text-gray-700 mb-1` | `forgot-password/page.tsx`, `force-change-password/page.tsx`, `onboarding/set-password/page.tsx`, `AutocompleteSearch.tsx` |
| `text-sm font-medium text-gray-700 mb-1`   | `ChangePasswordSection.tsx`, `login/page.tsx`                                                                              |
| `text-sm font-semibold text-gray-700 mb-2` | `trainer/trainees/new/_content.tsx`                                                                                        |

### Impatto

- `font-semibold` (600) vs `font-medium` (500) → differenza sottile ma percepibile in confronto diretto
- `mb-1` vs `mb-2` → spacing sotto la label inconsistente

### Soluzione

Standardizzare su `text-sm font-medium text-gray-700 mb-1` (più leggero, più standard nei form).

---

## 9. Card — Shadow e Border Radius

### Problema

Le card usano almeno **4 combinazioni shadow/radius** diverse.

| Pattern                                        | Contesto               | File esempio                                                                                                                    |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `rounded-lg shadow-md`                         | Card dashboard, stat   | `StatCard.tsx`, maggior parte dei layout                                                                                        |
| `rounded-xl shadow-md border border-gray-100`  | Tabelle trainee detail | `trainer/trainees/[id]/_content.tsx`, `PersonalRecordsExplorer.tsx`                                                             |
| `rounded-2xl shadow-sm border border-gray-200` | Form auth standalone   | `forgot-password/page.tsx`, `force-change-password/page.tsx`, `reset-password/page.tsx`, `profile/change-password/_content.tsx` |
| `rounded-lg shadow-sm border border-gray-200`  | Tabelle programs       | `ProgramsTable.tsx`                                                                                                             |
| `rounded-xl shadow-2xl`                        | Modal RPE              | `RPESelector.tsx`                                                                                                               |

### Impatto

- Le card auth (`rounded-2xl`) sono più arrotondate di quelle dashboard (`rounded-lg`)
- `shadow-sm` vs `shadow-md` su card dello stesso livello gerarchico
- I bordi (`border border-gray-100` vs `border-gray-200`) hanno tonalità diverse

### Soluzione

Definire 2 livelli di card:
- **Card base**: `rounded-xl bg-white shadow-sm border border-gray-200`
- **Card elevata/modal**: `rounded-xl bg-white shadow-lg` (senza bordo, l'ombra basta)

---

## 10. Colori — Hardcoded vs Token

### Problema

Il colore brand viene referenziato sia come hex hardcoded `#FFA700` sia come token Tailwind `brand-primary`, spesso nello stesso file.

| Approccio                                                          | Conteggio approssimativo | File esempio                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text-[#FFA700]` / `bg-[#FFA700]` / `border-[#FFA700]`             | ~50+ istanze             | `PersonalRecordsExplorer.tsx`, `ProgramsTable.tsx`, `admin/users/_content.tsx`, `trainer/trainees/[id]/_content.tsx`, `trainee/dashboard/_content.tsx`, `offline/page.tsx`, `PWAInstallPrompt.tsx` |
| `text-brand-primary` / `bg-brand-primary` / `border-brand-primary` | ~60+ istanze             | `DashboardLayout.tsx`, `ExerciseCard.tsx`, `FeedbackForm.tsx`, `ExercisesTable.tsx`, componenti trainer/programs                                                                                   |
| `hover:text-[#FF9500]`                                             | ~10 istanze              | `forgot-password/page.tsx`, `onboarding/set-password/page.tsx`                                                                                                                                     |
| `hover:text-brand-primary/80`                                      | ~15 istanze              | `trainer/trainees/_content.tsx`, `admin/users/_content.tsx`                                                                                                                                        |

### Impatto

- Se il brand color cambia, bisogna aggiornare **50+ istanze hardcoded** oltre al token
- Nello stesso file (es. `trainer/programs/_content.tsx` L401 vs L431) si usano entrambi gli approcci → confusione per lo sviluppatore

### Soluzione

Migrare tutti gli hex hardcoded `#FFA700`, `#FF9500`, `#E69500` ai token Tailwind `brand-primary` e definire un nuovo token `brand-primary-dark` per gli hover.

---

## 11. Raccomandazioni e Design System Proposto

### A. Estensione `tailwind.config.ts`

Aggiungere token per colori hover e varianti mancanti:

```ts
colors: {
    brand: {
        primary: '#FFA700',
        'primary-hover': '#E69500',   // hover unico
        secondary: '#000000',
        accent: '#FFFFFF',
    },
}
```

### B. Componenti UI Condivisi da Creare

| Componente                | Scopo              | Beneficio                                              |
| ------------------------- | ------------------ | ------------------------------------------------------ |
| `<Button variant="primary | secondary          | danger" size="sm                                       | md                    | lg">` | Unifica tutti i 100+ bottoni inline | Elimina categorie 1–5 |
| `<Input size="md          | lg">`              | Unifica tutti gli input con focus ring/radius coerente | Elimina categorie 6–7 |
| `<FormLabel>`             | Standardizza label | Elimina categoria 8                                    |
| `<Card variant="base      | elevated">`        | Standardizza card                                      | Elimina categoria 9   |

### C. Token CSS Proposti

```
/* Bottone Primario */
btn-primary:     bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
btn-primary-sm:  + px-3 py-1.5 text-sm
btn-primary-md:  + px-4 py-2
btn-primary-lg:  + px-6 py-3

/* Bottone Secondario */
btn-secondary:   bg-gray-200 text-gray-700 hover:bg-gray-300 font-semibold rounded-lg transition-colors

/* Bottone Danger */
btn-danger:      bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors

/* Input */
input-base:      w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed
input-lg:        + py-3

/* Card */
card-base:       bg-white rounded-xl shadow-sm border border-gray-200
card-elevated:   bg-white rounded-xl shadow-lg

/* Label */
label-base:      block text-sm font-medium text-gray-700 mb-1
```

### D. Piano di Migrazione (priorità)

| Priorità | Azione                                                                           | Impatto                                     |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| 🔴 **P0** | Sostituire tutti i `focus:ring-blue-500` → `focus:ring-brand-primary` (18 input) | Coerenza focus ring su tutta l'app          |
| 🔴 **P0** | Migrare tutti i `bg-[#FFA700]` → `bg-brand-primary`                              | Un unico source-of-truth per il brand color |
| 🟡 **P1** | Unificare hover state su `hover:bg-brand-primary-hover`                          | Feedback hover coerente                     |
| 🟡 **P1** | Standardizzare `disabled:opacity-50` ovunque                                     | Stato disabled uniforme                     |
| 🟢 **P2** | Creare componente `<Button>` shared                                              | Elimina duplicazione futura                 |
| 🟢 **P2** | Creare componente `<Input>` shared                                               | Elimina duplicazione futura                 |
| 🟢 **P2** | Unificare border-radius bottoni su `rounded-lg`                                  | Coerenza visiva bordi                       |
| 🟢 **P3** | Unificare padding bottoni sulle 3 size                                           | Gerarchia dimensionale                      |
| 🟢 **P3** | Unificare card shadow/radius                                                     | Coerenza elevazione                         |

---

## Riepilogo Quantitativo

| Categoria              | Varianti trovate       | Istanze affette  | Severità |
| ---------------------- | ---------------------- | ---------------- | -------- |
| Button — Colore/Hover  | 3 pattern              | ~60              | 🔴 Alta   |
| Button — Border Radius | 3 pattern              | ~40              | 🟡 Media  |
| Button — Padding       | 5+ pattern             | ~50              | 🟡 Media  |
| Button — Disabled      | 4 pattern              | ~20              | 🟡 Media  |
| Button — Secondary     | 3 pattern              | ~15              | 🟢 Bassa  |
| Input — Focus Ring     | 4 pattern (incl. blu!) | ~30              | 🔴 Alta   |
| Input — Radius/Padding | 4 pattern              | ~40              | 🟡 Media  |
| Label — Font Weight    | 3 pattern              | ~20              | 🟢 Bassa  |
| Card — Shadow/Radius   | 5 pattern              | ~25              | 🟡 Media  |
| Colori — Hardcoded     | 50+ hex hardcoded      | ~50              | 🔴 Alta   |
| **TOTALE**             |                        | **~350 istanze** |          |
