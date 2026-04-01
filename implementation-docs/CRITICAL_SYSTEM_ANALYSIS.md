# Analisi Critica Completa del Sistema ZeroCento

Data: 2026-04-01  
Ambito review: design + implementation-docs

## 1. EXECUTIVE SUMMARY

### Valutazione ad alto livello

**Punti di forza**
- Architettura di base ben strutturata per un MVP SaaS fitness (Next.js + Prisma + Supabase) con RBAC, schema dati ricco e flussi principali chiari.
- Ottima profondita documentale sul dominio training (programmi multi-settimana, feedback per set, reportistica SBD, gestione trainer-trainee).
- Buona attenzione iniziale a i18n, testing strategy, CI/CD e operativita.

**Rischi principali**
- Drift documentale mitigato: stato avanzamento canonico definito (CHECKLIST/NEXT_ACTIONS), con residui solo in snapshot storici.
- Rischio di copy non uniforme: il posizionamento trainer-led e stato definito, ma va mantenuto coerente in tutti i documenti.
- Rischio release: alcune aree operative (deploy, monitoring, test finale, PWA completa) risultano ancora parziali in checklist.

### Maturity level complessivo
- **MVP quasi pronto** per un posizionamento "training management platform trainer-led".
- **Non target attuale:** AI coaching runtime come capability core di prodotto.

---

## 2. PRODUCT & UX ANALYSIS

### Chiarezza value proposition
- Value proposition molto chiara per trainer e admin (gestione programmi, feedback, report, operativita).
- Value proposition ora allineata al posizionamento trainer-led; eventuali funzionalita AI restano evolutive e non core MVP.

### Criticita nel journey utente
- Journey trainee forte a livello concettuale (mobile-first, sessioni lunghe, autosave), ma rischia incoerenza se endpoint e pagine non sono allineati al 100% in prod.
- Journey trainer ricco ma molto ampio: alto rischio di complessita UX e manutenzione se non si consolida il nucleo dei flussi core.

### Engagement risks
- Mancano meccaniche forti di engagement continuo (goal loops, nudges intelligenti, strategie anti-dropoff).
- Il sistema e orientato alla gestione, meno alla motivazione comportamentale progressiva.

### Feature mancanti o deboli
- Policy UX esplicite per casi critici (dolore/infortunio/fatica eccessiva) con escalation immediata.
- Definizione univoca di cosa e "obbligatorio" vs "consigliato" in alcuni punti (feedback richiesto, completion behavior).
- Singola fonte ufficiale affidabile dello stato reale di implementazione.

---

## 3. AI SYSTEM ANALYSIS

### Prompt design quality
- Non emerge una prompt architecture runtime per coaching AI utente.
- I "prompt" presenti sono per sviluppo interno/documentazione, non per inferenza prodotto.

### Consistenza delle risposte AI
- Non valutabile in termini LLM runtime, perche non e documentato un motore AI in produzione.

### Personalizzazione
- Personalizzazione attuale principalmente deterministic + trainer-driven (non model-driven).
- Buona base dati per futura personalizzazione AI, ma strato inferenziale assente o non esplicitato.

### Rischio hallucination / coaching fuorviante
- Oggi rischio hallucination basso (nessun layer LLM evidente nel prodotto runtime).
- Se introdotto AI velocemente senza guardrail, rischio alto di suggerimenti non sicuri o incoerenti.

### Failure modes / edge cases
- Mancanza massimali puo produrre fallback incompleti (effectiveWeight null).
- Catene percentage_previous ricorsive richiedono test e UX fail-safe robusti.
- Ambiguita su completion/submit puo creare stati percepiti come incoerenti.

---

## 4. TECHNICAL & ARCHITECTURE REVIEW

### Allineamento design vs implementazione
- Buon allineamento su stack e modello dati.
- Disallineamenti concreti su stato reale di completamento, contratti API e policy operative.

### Scalabilita
- Adeguata alla scala MVP dichiarata.
- Da validare meglio sotto carico reale nei flussi con query profonde e feedback frequenti.

### Performance bottlenecks
- Query annidate e report aggregati possono degradare senza tuning continuo.
- Alcune rotte dense lato trainer possono diventare pesanti su rendering e fetch multipli.

### Manutenibilita
- Rischio alto dovuto a documentazione non perfettamente sincronizzata.
- Scope ampio per il team e per lo stadio attuale: rischio regressioni.

### Osservabilita
- Buona direzione (health, Sentry, uptime), ma da chiudere operativamente e verificare in modo ripetibile.

---

## 5. SAFETY & ETHICS

### Rischio advice dannoso
- Anche senza LLM, il prodotto influenza decisioni fisiche ad alto impatto.
- Mancano protocolli safety espliciti su segnali clinicamente rilevanti (pain red flags, vertigini, stop conditions).

### Bias / output inappropriati
- Se evoluzione AI prevista, mancano policy anti-bias e controlli su linguaggio/tono/sensibilita.

### Safeguard mancanti
- Safety policy formale per coaching ad alto rischio.
- Escalation protocol con human override obbligatorio in casi critici.
- Boundary messaging costante: cosa il sistema puo/non puo consigliare.

---

## 6. CONSISTENCY CHECK (DESIGN vs IMPLEMENTATION)

### Mismatch rilevati
- Stato avanzamento consolidato su fonte canonica; restano metriche legacy in appendici/changelog storico.
- Le differenze residue sono tracciate come snapshot storici, non come stato operativo corrente.
- Contratti endpoint e naming/metodi non sempre uniformi tra documenti.
- Regole ownership / CRUD condiviso non sempre raccontate in modo identico.
- Policy data lifecycle (soft-delete vs hard-delete) non sempre perfettamente consistente.

### Impatto dei mismatch
- Rischio decisioni errate di release.
- Rischio QA non focalizzato sui veri gap.
- Rischio onboarding lento per nuovi contributor.

---

## 7. CRITICAL RISKS (TOP PRIORITY)

1. **Safety governance insufficiente per coaching fitness** (Critical)
2. **Residuo rischio regressione documentale (governance continuativa)** (Medium)
3. **Incoerenze autorizzative/policy in documentazione** (High)
4. **Ambiguita su lifecycle e feedback semantics** (High)
5. **Runbook/operativita non completamente chiusi** (Medium-High)
6. **Rischio regressioni con scope troppo ampio** (Medium)

---

## 8. ACTIONABLE CHECKLIST

- [x] Definire in modo ufficiale il posizionamento release (trainer-led)  
  Severity: Risolto  
  Recommended action: mantenere coerenza copy e scope nei documenti core  
  Area: Product / Documentation

- [x] Consolidare un solo stato avanzamento ufficiale  
  Severity: Risolto  
  Recommended action: mantenere CHECKLIST/NEXT_ACTIONS come fonte canonica e marcare i numeri storici come legacy  
  Area: Tech / Process

- [x] Normalizzare contratti API e metodi endpoint  
  Severity: High  
  Recommended action: contract tests + tabella endpoint canonica versionata  
  Area: Tech  
  Completato: 2026-04-01 — docs/api-contracts.md + tests/integration/api-contracts.test.ts

- [ ] Formalizzare policy safety fitness  
  Severity: High  
  Recommended action: catalogo red-flag + flussi di blocco/escalation + disclaimer operativo  
  Area: Safety

- [ ] Chiudere gap CI/CD e observability residui  
  Severity: Medium-High  
  Recommended action: completare sprint deploy/monitoring con checklist verificabile  
  Area: Tech

- [ ] Definire chiaramente semantics feedback/completion  
  Severity: Medium-High  
  Recommended action: specifica unica con esempi edge-case e acceptance tests  
  Area: UX / Product

- [ ] Ridurre scope non core prima del go-live  
  Severity: Medium  
  Recommended action: freeze feature set, harden critical paths only  
  Area: Product / Tech

- [ ] Se AI e nel piano breve: introdurre guardrail prima della funzionalita  
  Severity: Medium  
  Recommended action: output constraints, escalation humans-in-the-loop, evaluation suite  
  Area: AI / Safety

---

## 9. IMPROVEMENT ROADMAP

### Short-term (quick wins, 1-2 settimane)
- Mantenere allineato lo stato progetto con review documentale periodica (anti-regressione).
- Chiudere sprint 6/8/11 residui con evidenza verificabile (build, deploy, monitoring, test update).
- Definire policy safety minima obbligatoria per il go-live.
- Consolidare checklist di revisione doc per evitare nuovo drift tra README, summary e backlog.

### Medium-term (3-8 settimane)
- Stabilizzare i critical user flows con test e metriche di affidabilita in staging.
- Rafforzare observability (alerting, error budget, runbook DR testati).
- Consolidare UX trainee per sessioni lunghe e casi offline/recovery.

### Long-term (2-6 mesi)
- Se target AI confermato: implementare un vero layer AI con guardrail, evaluation e governance.
- Introdurre processo continuo di model/prompt quality, rollback e safety auditing.
- Evolvere personalizzazione da regole statiche a raccomandazioni data-driven validate.

---

## Assunzioni e limiti della review

- Analisi basata su documentazione presente in design e implementation-docs.
- Alcuni file mostrano stato non perfettamente sincronizzato; le conclusioni sono orientate al rischio.
- Non e stata eseguita una validazione runtime completa in ambiente production.
