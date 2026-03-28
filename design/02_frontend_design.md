# Frontend Design

## Pagine principali

### Condivise
| Route    | Descrizione                                                | Ruoli |
| -------- | ---------------------------------------------------------- | ----- |
| `/login` | Pagina di autenticazione                                   | tutti |
| `/`      | Redirect automatico alla dashboard del ruolo dopo il login | tutti |

### Admin
| Route                           | Descrizione                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `/admin/dashboard`              | Panoramica sistema                                                                           |
| `/admin/users`                  | Lista utenti (CRUD admin/trainer/trainee) con toggle attivo/disabilitato per tutti i trainee |
| `/admin/users/new`              | Creazione nuovo utente (trainer o trainee)                                                   |
| `/admin/users/[id]`             | Dettaglio/modifica utente (include cambio ruolo e toggle attivazione)                        |
| `/admin/programs`               | **Lista globale schede di TUTTI i trainer** (filtri trainer/trainee/status, ricerca)         |
| `/admin/programs/[id]`          | **Dettaglio/modifica scheda di qualsiasi trainer** (override immutabilità)                   |
| `/admin/programs/[id]/progress` | **Monitoraggio avanzamento scheda** di qualsiasi trainer con feedback trainee                |
| `/admin/trainees/[id]/reassign` | **Riassegnazione trainee a nuovo trainer** (handover gestito)                                |
| `/admin/reports`                | **Dashboard report globali** (volume, SBD, feedback per tutti i trainer)                     |

### trainer
| Route                                  | Descrizione                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/trainer/dashboard`                   | Panoramica trainee assegnati e stato schede                                                  |
| `/trainer/exercises`                   | Libreria esercizi condivisa (lista + crea)                                                   |
| `/trainer/exercises/[id]`              | Dettaglio esercizio (video YouTube + modifica)                                               |
| `/trainer/exercises/new`               | Creazione nuovo esercizio con campi completi                                                 |
| `/trainer/trainees`                    | Lista trainee gestiti (solo propri, con toggle attivo/disabilitato)                          |
| `/trainer/trainees/[id]`               | Profilo trainee + schede assegnate                                                           |
| `/trainer/trainees/new`                | Creazione nuovo profilo trainee (genera password)                                            |
| `/trainer/trainees/[id]/records`       | Gestione completa massimali trainee (CRUD)                                                   |
| `/trainer/programs`                    | Lista schede (draft, active, completed) con filtri e ricerca                                 |
| `/trainer/programs/new`                | **Step 1**: Setup scheda (durata, allenamenti/settimana, trainee)                            |
| `/trainer/programs/[id]/week-overview` | **Step 2**: Vista alto livello settimana tipo (aggiungi esercizi con colori MovementPattern) |
| `/trainer/programs/[id]/workout/[wId]` | **Step 3**: Dettaglio singolo allenamento (compila serie/reps/RPE/peso/recupero)             |
| `/trainer/programs/[id]/publish`       | **Step 4**: Pubblicazione scheda (scelta data inizio Week 1)                                 |
| `/trainer/programs/[id]`               | Dettaglio / modifica scheda (post-pubblicazione, read-only o edit draft)                     |
| `/trainer/programs/[id]/progress`      | Monitoraggio avanzamento + feedback trainee                                                  |
| `/trainer/programs/[id]/reports`       | Reportistica SBD e serie allenanti                                                           |
| `/trainer/settings/movement-colors`    | Personalizzazione colori MovementPattern per vista alto livello                              |

### Trainee
| Route                                        | Descrizione                                       |
| -------------------------------------------- | ------------------------------------------------- |
| `/trainee/dashboard`                         | Scheda corrente in evidenza                       |
| `/trainee/programs/current`                  | Scheda attiva con esercizi per settimana/giorno   |
| `/trainee/programs/[id]/workout/[workoutId]` | Singolo allenamento + form feedback per esercizio |
| `/trainee/history`                           | Storico schede completate/passate                 |
| `/trainee/records`                           | Visualizzazione massimali personali (1RM, nRM)    |
| `/trainee/records/[exerciseId]`              | Storico massimali per esercizio specifico         |

## Componenti riutilizzabili
- `ExerciseCard` — mostra nome, thumbnail YouTube, parametri (serie/rip/RPE), gruppi muscolari, tipo (fondamentale/accessorio).
- `MuscleGroupBadge` — badge per gruppo muscolare con coefficiente d'incidenza (es. "Pettorali 80%").
- `MovementPatternIcon` — icona per schema motorio (accosciata, spinta, ecc.).
- `MovementPatternTag` — badge colorato per schema motorio con colore personalizzato trainer (usato in vista alto livello).
- `WeekOverviewGrid` — griglia settimana tipo per aggiunta rapida esercizi con vista MovementPattern colorati.
- `WorkoutDayColumn` — colonna singolo giorno in vista overview con esercizi + colori pattern.
- `ColorPicker` — selector colore per personalizzazione MovementPattern (HEX input + palette predefinita).
- `UserStatusToggle` — toggle per attivare/disabilitare trainee (admin: tutti, trainer: solo propri; mostra stato attivo/disabilitato).
- `WorkoutProgramBuilder` — editor drag-and-drop settimane/giorni/esercizi (trainer).
- `WorkoutExerciseForm` — form per aggiungere esercizio con serie, reps (stringa o intervallo), RPE, peso, recupero, riscaldamento.
- `WeightTypeSelector` — selector per tipo peso (assoluto, %1RM, %nRM, %riga precedente) con validazione e helper visivi.
- `FeedbackForm` — form per il trainee su un singolo esercizio (RPE effettivo, array di serie con reps/kg, note, completato).
- `SetInput` — input ripetibile per ogni serie (reps + kg) nel feedback.
- `ProgressTracker` — visualizzazione stato avanzamento scheda (trainer view).
- `PersonalRecordCard` — card per visualizzare massimale (1RM o nRM) con data e note.
- `PersonalRecordForm` — form per aggiungere/modificare massimale (esercizio, reps, peso, data) — **solo trainer**.
- `SBDReportChart` — grafico per reportistica SBD (FRQ, NBL, IM) con filtro periodo.
- `TrainingVolumeChart` — grafico per serie/ripetizioni totali per gruppo muscolare.
- `YoutubeEmbed` — wrapper per iframe YouTube con lazy load.
- `RoleGuard` — HOC / middleware che reindirizza se il ruolo non è autorizzato.
- `RPESelector` — selector per RPE (5.0-10.0 con incrementi 0.5) con icone/colori.
- `RestTimeSelector` — selector per tempo recupero (30s, 1m, 2m, 3m, 5m).
- `RepsInput` — input per ripetizioni che supporta numero singolo, intervallo (6/8), o range (8-10).
- `WeekTypeBadge` — badge per indicare tipologia settimana (normale, test, scarico) con icone e colori specifici.
- `WeekTypeBanner` — banner full-width per header settimana trainee con messaggi contestuali in base al tipo (test: colori vivaci rosso/arancione, scarico: colori rilassanti verde/azzurro).
- `WeekTypeSelector` — dropdown per trainer per selezionare tipo settimana durante configurazione scheda (normale, test, scarico).
- `WeekConfigurationTable` — tabella per configurare tipo settimana e feedback obbligatorio per tutte le settimane di una scheda (trainer view).

### WeightTypeSelector — Dettaglio Componente

Componente fondamentale per inserimento esercizi con supporto completo per riferimenti al carico relativo (riga precedente).

**Props**:
```typescript
interface WeightTypeSelectorProps {
  value: {
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
    weight: number | null
  }
  onChange: (value: { weightType: string; weight: number | null }) => void
  exerciseId: string       // Per verificare occorrenze precedenti
  workoutId: string        // Per cercare nella stessa giornata
  currentOrder: number     // Ordine corrente dell'esercizio
  disabled?: boolean
}
```

**UI Design**:
```
┌────────── Tipo Peso ──────────────────────────────────────┐
│                                                            │
│ ○ Peso Assoluto (kg)                                      │
│   └─ [____100____] kg                                     │
│                                                            │
│ ○ Percentuale 1RM                                         │
│   └─ [____80____] %  →  85.0 kg  (1RM: 106.25kg)        │
│                                                            │
│ ○ Percentuale nRM                                         │
│   └─ [____85____] % di [__5__] RM                        │
│                                                            │
│ ● Riferimento Riga Precedente                             │
│   ↳ Prima occorrenza: Squat @ 100kg (riga 1)             │
│   └─ [____-5____] %  →  95.0 kg  (100kg - 5%)           │
│                                                            │
│ 💡 Hint: Usa riferimento riga precedente per wave        │
│   loading, cluster set, o back-off set progressivi       │
└────────────────────────────────────────────────────────────┘
```

**Logica validazione e feedback visivo**:

1. **Selezione "Riferimento Riga Precedente"**:
   - Sistema cerca occorrenza precedente dello stesso esercizio nel workout (`workoutId` + `exerciseId` + `order < currentOrder`)
   - Se **trovata**: Mostra dettagli riga precedente (peso calcolato) + input percentuale attivo
   - Se **non trovata**: Mostra errore inline "⚠️ Nessuna occorrenza precedente dello stesso esercizio. Seleziona prima un altro tipo di peso."

2. **Preview calcolo in tempo reale**:
   - Quando trainer inserisce percentuale (es. -5), mostra preview: "95.0 kg (100kg - 5%)"
   - Se percentuale positiva (es. +10): "110.0 kg (100kg + 10%)"
   - Se percentuale zero: "100.0 kg (identico)"

3. **Errori validazione**:
   - Percentuale < -100: "⚠️ Percentuale troppo bassa (min -100%)"
   - Percentuale > +100: "⚠️ Percentuale troppo alta (max +100%)"
   - Campo vuoto: "⚠️ Inserisci percentuale relativa"

**Workflow trainer (aggiunta esercizio ripetuto)**:
```typescript
// Esempio: trainer aggiunge Squat seconda volta nel workout

// Step 1: Sistema rileva che Squat è già presente (riga 1)
// Step 2: UI mostra automatically opzione "Riferimento Riga Precedente" abilitata
// Step 3: Trainer seleziona "Riferimento Riga Precedente"
// Step 4: UI carica dettagli riga 1: "Squat @ 100kg assoluti"
// Step 5: Trainer inserisce -5 nel campo percentuale
// Step 6: Preview mostra "95.0 kg (100kg - 5%)"
// Step 7: Submit → backend valida + salva weightType=percentage_previous, weight=-5
```

**Query per trovare occorrenza precedente**:
```typescript
// Frontend helper
async function findPreviousOccurrence(
  workoutId: string, 
  exerciseId: string, 
  currentOrder: number
): Promise<WorkoutExercise | null> {
  const response = await fetch(
    `/api/workout-exercises?workoutId=${workoutId}&exerciseId=${exerciseId}&orderLt=${currentOrder}`
  )
  const data = await response.json()
  return data.data[0] || null // Prima occorrenza con order < currentOrder
}

// Uso nel componente
const WeightTypeSelector: React.FC<WeightTypeSelectorProps> = ({ 
  exerciseId, 
  workoutId, 
  currentOrder,
  ...props 
}) => {
  const [previousOccurrence, setPreviousOccurrence] = useState<WorkoutExercise | null>(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (props.value.weightType === 'percentage_previous') {
      setLoading(true)
      findPreviousOccurrence(workoutId, exerciseId, currentOrder)
        .then(setPreviousOccurrence)
        .finally(() => setLoading(false))
    }
  }, [props.value.weightType, workoutId, exerciseId, currentOrder])
  
  const calculatePreview = () => {
    if (!previousOccurrence || !props.value.weight) return null
    const baseWeight = previousOccurrence.weight // Semplificato, nella realtà usa calculateEffectiveWeight
    const modifier = props.value.weight
    const resultWeight = baseWeight * (1 + modifier / 100)
    return { baseWeight, resultWeight, modifier }
  }
  
  return (
    <div className="space-y-4">
      {/* Radio options per weightType */}
      
      {props.value.weightType === 'percentage_previous' && (
        <div className="ml-6 space-y-2">
          {loading && <Spinner />}
          
          {!loading && previousOccurrence && (
            <>
              <div className="text-sm text-gray-600">
                ↳ Prima occorrenza: {previousOccurrence.exercise.name} @ {previousOccurrence.weight}kg (riga {previousOccurrence.order})
              </div>
              
              <TextField
                type="number"
                label="Percentuale relativa"
                value={props.value.weight || ''}
                onChange={(e) => props.onChange({ 
                  ...props.value, 
                  weight: parseFloat(e.target.value) 
                })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
                helperText={
                  calculatePreview() 
                    ? `→ ${calculatePreview().resultWeight.toFixed(1)} kg (${calculatePreview().baseWeight}kg ${calculatePreview().modifier > 0 ? '+' : ''}${calculatePreview().modifier}%)`
                    : 'Inserisci percentuale (es. -5 per -5%, +10 per +10%)'
                }
              />
            </>
          )}
          
          {!loading && !previousOccurrence && (
            <Alert severity="error">
              ⚠️ Nessuna occorrenza precedente dello stesso esercizio. Seleziona prima un altro tipo di peso.
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
```

**Casi d'uso UI**:
1. **Wave loading**: Riga 1 @ 100kg → Riga 2 @ -5% (95kg) → Riga 3 @ -10% da riga 2 (85.5kg)
2. **Cluster set**: Riga 1 @ 90kg → Riga 2 @ 0% (90kg identico) → Riga 3 @ -15% (76.5kg drop set)
3. **Back-off set**: Riga 1 @ 100% 1RM (120kg) → Riga 2 @ -20% (96kg volume)

**Note implementative**:
- Preview calcolo peso è **client-side** per UX immediata
- Backend **ri-valida** sempre il calcolo (trust no client input)
- Se riga precedente usa anch'essa `percentage_previous`, sistema risolve ricorsivamente tutta la catena
- Limite ricorsione: max 10 livelli (previene loop infiniti se dati corrotti)



## Gestione stato
- **Locale**: `useState` / `useReducer` per form e UI state effimero.
- **Globale**: **Context API** per sessione utente e dati condivisi semplici (React nativo, zero dipendenze).
- **Server state**: **TanStack Query (React Query)** per fetching, caching, sincronizzazione con API; pattern consolidati e ottima coverage AI.
- **React Server Components**: Utilizzati per rendering SSR di pagine statiche/semi-statiche dove possibile.

## UX states
- **Loading**: skeleton loader su card e tabelle; spinner su azioni brevi.
- **Empty**: illustrazione + CTA contestuale (es. "Nessuna scheda — crea la prima" per il trainer).
- **Error**: banner non-invasivo con messaggio di errore leggibile + retry action.

## PWA (Progressive Web App) per Trainee

**Requisito**: Trainee usa app in palestra (60-90+ min) con frequente app switching tra esercizi. Necessario:
- ✅ Installazione come app standalone (no barra browser)
- ✅ Funzionamento anche con connessione intermittente
- ✅ Persistenza stato feedback parziale (non perdere dati se app va in background)
- ✅ Session management seamless (no re-login durante allenamento)

**Implementazione**:

### Web App Manifest
```json
// public/manifest.json
{
  "name": "ZeroCento Training",
  "short_name": "ZeroCento",
  "description": "Gestione schede allenamento",
  "start_url": "/trainee/dashboard",
  "display": "standalone",  // App full-screen senza browser UI
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait",  // Lock portrait per trainee (uso palestra)
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "categories": ["health", "fitness"],
  "screenshots": [
    {
      "src": "/screenshots/workout-mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### Service Worker per Offline Support
```typescript
// public/sw.js (generato da next-pwa)
// Cache strategia:
// - Scheda corrente: Cache-first (disponibile anche offline)
// - API feedback: Network-first con fallback queue
// - Assets statici: Cache-first con stale-while-revalidate

// Installazione PWA prompt
// app/components/InstallPrompt.tsx
import { useEffect, useState } from 'react'

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Mostra solo a trainee (non admin/trainer desktop)
      if (window.innerWidth < 768) {
        setShowPrompt(true)
      }
    }
    
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  
  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowPrompt(false)
  }
  
  if (!showPrompt) return null
  
  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
      <p className="font-semibold">Installa ZeroCento</p>
      <p className="text-sm mt-1">Accesso rapido durante gli allenamenti</p>
      <div className="flex gap-2 mt-3">
        <button onClick={handleInstall} className="bg-white text-blue-600 px-4 py-2 rounded">
          Installa
        </button>
        <button onClick={() => setShowPrompt(false)} className="text-white">
          Dopo
        </button>
      </div>
    </div>
  )
}
```

### State Persistence per Feedback Parziali
```typescript
// hooks/useFeedbackPersistence.ts
import { useEffect } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

interface FeedbackDraft {
  workoutExerciseId: string
  sets: Array<{ setNumber: number; reps: number; weight: number }> // Array normalizzato per DB
  actualRpe?: number
  notes?: string // Note testuali libere del trainee
  timestamp: number
}

export function useFeedbackPersistence(workoutExerciseId: string) {
  const [draft, setDraft] = useLocalStorage<FeedbackDraft | null>(
    `feedback-draft-${workoutExerciseId}`,
    null
  )
  
  // Auto-save ogni 5 secondi
  useEffect(() => {
    const interval = setInterval(() => {
      if (draft) {
        setDraft({ ...draft, timestamp: Date.now() })
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [draft])
  
  const saveDraft = (data: Partial<FeedbackDraft>) => {
    setDraft({ ...draft, ...data, workoutExerciseId, timestamp: Date.now() })
  }
  
  const clearDraft = () => {
    setDraft(null)
  }
  
  // Auto-clear draft dopo 24h (evita accumulo storage)
  useEffect(() => {
    if (draft && Date.now() - draft.timestamp > 86400000) {
      clearDraft()
    }
  }, [draft])
  
  return { draft, saveDraft, clearDraft }
}

// Uso nel form feedback
// app/trainee/programs/[id]/workout/[workoutId]/page.tsx
export default function WorkoutPage() {
  const { draft, saveDraft, clearDraft } = useFeedbackPersistence(workoutExerciseId)
  
  // Ripristina draft se esiste
  useEffect(() => {
    if (draft) {
      setFormData(draft)
    }
  }, [draft])
  
  const handleSubmit = async (data: FeedbackData) => {
    await submitFeedback(data)
    clearDraft() // Clear dopo submit success
  }
  
  // Auto-save mentre utente compila
  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value })
    saveDraft({ ...formData, [field]: value })
  }
}
```

**Benefici PWA trainee**:
- ✅ **Installazione**: Icona home screen, apertura senza browser UI (esperienza app nativa)
- ✅ **Offline support**: Scheda corrente disponibile anche senza rete (cache service worker)
- ✅ **State persistence**: Feedback parziale salvato in localStorage, recuperabile dopo app switch
- ✅ **Session seamless**: JWT 4h + auto-refresh = no re-login durante allenamento
- ✅ **Performance**: Asset cached, caricamento istantaneo

**Note trainer/admin**:
- PWA installabile anche per loro ma **non prioritario** (uso desktop)
- Manifest con `display: "browser"` per desktop (mantiene browser UI)
- Service worker cache meno aggressiva (contenuti cambiano frequentemente)

## Design system
- **Librerie UI**: **Tailwind CSS** (styling utility-first, coverage AI eccellente) + **Material UI (MUI)** (componenti accessibili pronti, vastissima documentazione nei training data AI).
  - **Alternativa valutata**: shadcn/ui + Tailwind (più moderno, ma MUI ha maggiore coverage AI).
- **Responsive**: mobile-first; breakpoint standard Tailwind (sm: 640px / md: 768px / lg: 1024px / xl: 1280px).
- **Gestione form**: **React Hook Form** (performance ottimale, pattern semplici) + **Zod** (validation type-safe, schema riutilizzabili, altissima presenza training data AI).
- **Convenzioni CSS**: utility-first con Tailwind; MUI styled con `sx` prop o Emotion quando necessario; nessun CSS globale custom salvo reset e variabili tema.

## Ottimizzazione UI per ruolo

**Strategia di design differenziata:**

### Admin & trainer → Desktop-first
- **Target primario**: Desktop (1280px+)
- **Rationale**: Workflow intensivi di creazione contenuti (schede multi-settimana, libreria esercizi, monitoraggio trainee)
- **Layout**: Sidebar persistente, tabelle multi-colonna, drag-and-drop avanzato, dashboard dense con grafici
- **Responsive**: Funzionale su tablet landscape (768px+), ma **non ottimizzato per mobile portrait**
- **Componenti chiave desktop-oriented**:
  - `WorkoutProgramBuilder` — editor complesso con drag-and-drop
  - Tabelle estese per lista trainee/esercizi con sorting/filtering
  - Dashboard multi-widget con metriche affiancate
  - Form multi-step con preview side-by-side

### Trainee → Mobile portrait-first
- **Target primario**: Mobile portrait (360px - 428px)
- **Rationale**: Uso principale in palestra durante allenamento (consultazione scheda, inserimento feedback immediato)
- **Layout**: Single column, CTA prominenti, input touch-friendly (min 44px), bottom navigation
- **UX mobile-centric**:
  - Workout cards a stack verticale con scroll
  - Form feedback ottimizzati per input rapido (tastierino numerico per kg/reps)
  - Bottom sheet per azioni secondarie
  - Swipe gestures per navigazione tra esercizi
  - Sticky header con contesto allenamento corrente
- **Responsive**: Usabile su desktop ma esperienza ottimizzata per telefono
- **Pattern mobile-first**:
  - `FeedbackForm` — input serie ottimizzato per touch (stepper +/- per reps/kg)
  - `WorkoutExercise` card — video collassabile, parametri in evidenza
  - Navigation — bottom tab bar per accesso rapido dashboard/current/records/reports

### Implicazioni implementative

**CSS condizionale per ruolo**:
```typescript
// Hook custom per applicare classi basate su ruolo
const useRoleLayout = () => {
  const { user } = useAuth()
  const isTrainee = user?.role === 'trainee'
  
  return {
    containerClass: isTrainee 
      ? 'container-mobile px-4 max-w-md' // mobile-first
      : 'container-desktop px-8 max-w-7xl', // desktop-first
    gridClass: isTrainee
      ? 'grid-cols-1' // sempre single column
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' // responsive multi-column
  }
}
```

**Componenti role-aware**:
- Admin/trainer: MUI `DataGrid` per tabelle dense, `Drawer` per sidebar
- Trainee: MUI `BottomNavigation`, `SwipeableDrawer`, `Stepper` touch-friendly

**Testing responsive per ruolo**:
- Admin/trainer: test su 1280px, 1440px, 1920px (desktop standard)
- Trainee: test su 360px (Android small), 390px (iPhone 12/13), 428px (iPhone 14 Pro Max)

**Nota**: Entrambe le esperienze rimangono **responsive** (funzionali su tutti i device), ma l'ottimizzazione UX è polarizzata per il caso d'uso principale di ciascun ruolo.

## Rationale scelte per sviluppo AI-first
Stack selezionato per massimizzare efficacia generazione codice AI:
- **Tailwind CSS**: sintassi concisa, pattern ripetitivi, coverage eccellente nei training data.
- **Material UI**: libreria matura (2014+), vastissima documentazione pubblica, componenti accessibili WCAG, pattern consolidati.
- **React Hook Form + Zod**: standard de facto industry per form validation, schemi dichiarativi, typing forte.
- **TanStack Query**: pattern fetchint/caching consolidati, hooks semantici, documentazione dettagliata.
- **Context API**: React nativo, nessuna libreria esterna, pattern semplici e universali.
