# Active Program Card Redesign

**Date:** 2026-04-27  
**File:** `src/app/trainee/dashboard/_content.tsx`

## Goal

Ridisegnare la card "Programma Attivo" nella trainee dashboard per allinearla visivamente e tipograficamente alla card "Prossimo Allenamento". L'obiettivo primario è comunicare lo stato d'avanzamento del programma.

## Current State

```
[border-l-4 accent] PROGRAMMA ATTIVO (text-xs uppercase)
Titolo Programma (text-xl font-bold)
Trainer: Nome Cognome (text-sm)
Durata: 12 sett. | Progressione: 18/27 | Completamento: 67% (text-sm inline)
[progress bar h-2]
[CTA button]
```

## New Design

```
PROGRAMMA ATTIVO                ← text-sm font-semibold uppercase tracking-[0.12em] brand-primary
                                   (era text-xs)

          67%                   ← text-6xl sm:text-7xl font-black leading-none brand-primary
       completato               ← text-xs uppercase tracking-[0.12em] text-gray-500 mt-1
                                   (tutto centrato, come day/week nel next workout card)

████████████████░░░░░           ← progress bar h-2 brand-primary, full-width, mt-4

   18 / 27 allenamenti          ← text-sm text-gray-500 text-center mt-2
   Forza Base · 12 sett.        ← text-sm text-gray-600 text-center mt-1
                                   (titolo programma + durata in riga secondaria)

[📋 Vai al programma completo]  ← CTA, stile invariato
```

## Changes

| Elemento | Prima | Dopo |
|---|---|---|
| Container | `rounded-lg border-l-4 border-l-brand-primary` | `rounded-2xl` (no left border) |
| Label sezione | `text-xs` | `text-sm` |
| Hero | nessuno | `%` completamento `text-6xl sm:text-7xl font-black` centrato |
| Sub-label hero | n/a | "completato" `text-xs uppercase tracking` |
| Progress bar | rimane | rimane, posizionata sotto hero |
| Contatore allenamenti | inline testo | `text-sm text-center` sotto bar |
| Titolo programma | `text-xl font-bold` prominent | `text-sm text-gray-600 text-center` secondario |
| Trainer | visibile | rimosso |
| Durata | inline con stats | inline con titolo programma (`Titolo · N sett.`) |

## Decisions

- **Trainer rimosso**: info non rilevante per lo stato d'avanzamento
- **Progress bar mantenuta**: complementa il `%` hero con rappresentazione grafica
- **Titolo + durata**: collassati in un'unica riga secondaria sotto il contatore
- **Centrato**: allinea la grammatica visiva al next workout card

## Out of Scope

- Nessuna modifica al next workout card
- Nessuna modifica alle navigation card sotto
- Nessuna modifica alle API o al data fetching
