# Email Templates per Supabase

Questi template vanno configurati nel **Supabase Dashboard** → **Authentication** → **Email Templates**

---

## 1. Template Invito Utente (Invite User)

**Quando si usa**: Quando admin/trainer crea un nuovo utente con `inviteUserByEmail()`  
**Percorso in Dashboard**: Authentication → Email Templates → **Invite user**

### Configurazione

**Subject:**
```
Benvenuto su ZeroCento - Completa la tua registrazione
```

**Email Template (HTML):**
```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benvenuto su ZeroCento</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header con Logo -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <!-- Opzione 1: Logo da URL pubblico (consigliata) -->
                            <img src="{{ .SiteURL }}/images/logo/logo.png" 
                                 alt="ZeroCento Logo" 
                                 width="80" 
                                 height="80" 
                                 style="display: block; margin: 0 auto 20px; max-width: 80px; height: auto;" />
                            
                            <!-- Opzione 2 alternativa: Fallback con gradiente se logo non carica
                            <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #FFA700 0%, #FF8C00 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <span style="color: #ffffff; font-size: 32px; font-weight: bold;">0→100</span>
                            </div>
                            -->
                            
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827; line-height: 1.2;">
                                Benvenuto su ZeroCento!
                            </h1>
                        </td>
                    </tr>

                    <!-- Corpo del messaggio -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Ciao{{ if .Data.firstName }} <strong>{{ .Data.firstName }}</strong>{{ end }},
                            </p>
                            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Il tuo trainer ha creato un account per te sulla piattaforma <strong>ZeroCento</strong>, 
                                il sistema di gestione allenamenti personalizzato.
                            </p>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Per iniziare il tuo percorso, clicca sul pulsante qui sotto per impostare la tua password personale:
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding: 10px 0 30px;">
                                        <a href="{{ .ConfirmationURL }}" 
                                           style="display: inline-block; padding: 16px 40px; background-color: #FFA700; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(255, 167, 0, 0.3);">
                                            Completa la Registrazione
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Info Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #FEF3C7; border-left: 4px solid #FFA700; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400E;">
                                            <strong>⏱️ Link valido per 24 ore</strong><br>
                                            Per motivi di sicurezza, questo link scadrà tra 24 ore. Se non completi la registrazione entro questo periodo, contatta il tuo trainer per ricevere un nuovo invito.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Link alternativo -->
                            <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #6B7280;">
                                Se il pulsante non funziona, copia e incolla questo link nel tuo browser:<br>
                                <a href="{{ .ConfirmationURL }}" style="color: #FFA700; word-break: break-all;">{{ .ConfirmationURL }}</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0 0 8px; font-size: 12px; line-height: 1.5; color: #9CA3AF; text-align: center;">
                                Se non hai richiesto questa registrazione, ignora questa email.
                            </p>
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9CA3AF; text-align: center;">
                                © 2026 ZeroCento - La tua piattaforma di allenamento personalizzato
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## 2. Template Reset Password (Magic Link)

**Quando si usa**: Quando l'utente clicca "Password dimenticata?" e richiede il reset  
**Percorso in Dashboard**: Authentication → Email Templates → **Reset Password**

### Configurazione

**Subject:**
```
Recupero password - ZeroCento
```

**Email Template (HTML):**
```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recupero Password - ZeroCento</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header con Logo -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <img src="{{ .SiteURL }}/images/logo/logo.png" 
                                 alt="ZeroCento Logo" 
                                 width="80" 
                                 height="80" 
                                 style="display: block; margin: 0 auto 20px; max-width: 80px; height: auto;" />
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827; line-height: 1.2;">
                                Recupero Password
                            </h1>
                        </td>
                    </tr>

                    <!-- Corpo del messaggio -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Ciao,
                            </p>
                            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Abbiamo ricevuto una richiesta per reimpostare la password del tuo account <strong>ZeroCento</strong>.
                            </p>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Clicca sul pulsante qui sotto per creare una nuova password:
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding: 10px 0 30px;">
                                        <a href="{{ .ConfirmationURL }}" 
                                           style="display: inline-block; padding: 16px 40px; background-color: #FFA700; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(255, 167, 0, 0.3);">
                                            Reimposta Password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Security Alert -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #FEE2E2; border-left: 4px solid #DC2626; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #7F1D1D; font-weight: 600;">
                                            🔒 Importante - Sicurezza
                                        </p>
                                        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #991B1B;">
                                            • Questo link è valido per <strong>1 ora</strong><br>
                                            • Se non hai richiesto il reset, <strong>ignora questa email</strong> e la tua password rimarrà invariata<br>
                                            • Non condividere mai questo link con nessuno
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Link alternativo -->
                            <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #6B7280;">
                                Se il pulsante non funziona, copia e incolla questo link nel tuo browser:<br>
                                <a href="{{ .ConfirmationURL }}" style="color: #FFA700; word-break: break-all;">{{ .ConfirmationURL }}</a>
                            </p>

                            <!-- Help text -->
                            <p style="margin: 24px 0 0; padding: 16px; background-color: #F3F4F6; border-radius: 6px; font-size: 13px; line-height: 1.5; color: #4B5563;">
                                <strong>Problemi con il recupero password?</strong><br>
                                Contatta il tuo trainer o l'amministratore di sistema per assistenza.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0 0 8px; font-size: 12px; line-height: 1.5; color: #9CA3AF; text-align: center;">
                                Questa email è stata inviata a {{ .Email }} perché è stato richiesto un reset password.
                            </p>
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9CA3AF; text-align: center;">
                                © 2026 ZeroCento - La tua piattaforma di allenamento personalizzato
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## 3. Template Conferma Email (opzionale)

**Quando si usa**: Se abiliti la conferma email per nuovi utenti  
**Percorso in Dashboard**: Authentication → Email Templates → **Confirm signup**

### Configurazione

**Subject:**
```
Conferma il tuo indirizzo email - ZeroCento
```

**Email Template (HTML):**
```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conferma Email - ZeroCento</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center;">
                            <img src="{{ .SiteURL }}/images/logo/logo.png" 
                                 alt="ZeroCento Logo" 
                                 width="80" 
                                 height="80" 
                                 style="display: block; margin: 0 auto 20px; max-width: 80px; height: auto;" />
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827; line-height: 1.2;">
                                Conferma il tuo indirizzo email
                            </h1>
                        </td>
                    </tr>

                    <!-- Corpo -->
                    <tr>
                        <td style="padding: 20px 40px;">
                            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Grazie per esserti registrato su <strong>ZeroCento</strong>!
                            </p>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
                                Clicca sul pulsante qui sotto per confermare il tuo indirizzo email:
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center; padding: 10px 0 30px;">
                                        <a href="{{ .ConfirmationURL }}" 
                                           style="display: inline-block; padding: 16px 40px; background-color: #FFA700; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(255, 167, 0, 0.3);">
                                            Conferma Email
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Link alternativo -->
                            <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #6B7280;">
                                Oppure copia questo link:<br>
                                <a href="{{ .ConfirmationURL }}" style="color: #FFA700; word-break: break-all;">{{ .ConfirmationURL }}</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9CA3AF; text-align: center;">
                                Se non ti sei registrato, ignora questa email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## Come Applicare i Template in Supabase

### 1. Accedi al Dashboard Supabase
- Vai su https://app.supabase.com/
- Seleziona il progetto **ZeroCento**

### 2. Naviga alle Email Templates
- Sidebar → **Authentication**
- Tab → **Email Templates**

### 3. Per ogni template:

#### **Invite User** (Onboarding)
1. Clicca su **"Invite user"** nella lista
2. Copia il Subject da questo documento
3. Incolla nella sezione **"Subject"**
4. Copia tutto il codice HTML del template
5. Incolla nella sezione **"Message (HTML)"**
6. **Save** (in alto a destra)

#### **Reset Password**
1. Clicca su **"Reset Password"** nella lista
2. Copia il Subject
3. Incolla nella sezione **"Subject"**
4. Copia tutto il codice HTML
5. Incolla nella sezione **"Message (HTML)"**
6. **Save**

#### **Confirm Signup** (opzionale)
Stesso processo per il template di conferma email.

---

## Variabili Supabase Disponibili

Nei template puoi usare queste variabili:

| Variabile                | Descrizione               | Esempio                           |
| ------------------------ | ------------------------- | --------------------------------- |
| `{{ .ConfirmationURL }}` | Link magico completo      | `https://app.com/reset?token=xxx` |
| `{{ .Token }}`           | Token a 6 cifre (OTP)     | `123456`                          |
| `{{ .Email }}`           | Email dell'utente         | `user@example.com`                |
| `{{ .Data.firstName }}`  | Nome (custom metadata)    | `Mario`                           |
| `{{ .Data.lastName }}`   | Cognome (custom metadata) | `Rossi`                           |
| `{{ .Data.role }}`       | Ruolo (custom metadata)   | `trainee`                         |
| `{{ .SiteURL }}`         | URL base dell'app         | `https://zerocento.app`           |

### Esempio di condizionale

```html
{{ if .Data.firstName }}
    Ciao {{ .Data.firstName }}!
{{ else }}
    Ciao!
{{ end }}
```

---

## Opzioni per Embeddare il Logo

Nei template forniti, il logo viene caricato tramite URL pubblico usando `{{ .SiteURL }}`. Ecco le diverse opzioni disponibili:

### Opzione 1: URL Pubblico (Consigliata) ✅

**Come funziona**: Il logo viene caricato dal tuo server web pubblico.

```html
<img src="{{ .SiteURL }}/images/logo/logo.png" 
     alt="ZeroCento Logo" 
     width="80" 
     height="80" 
     style="display: block; margin: 0 auto 20px; max-width: 80px; height: auto;" />
```

**Pro**:
- ✅ Semplice da implementare
- ✅ Template leggeri (no embed pesanti)
- ✅ Facile aggiornare il logo (modifica solo il file sul server)
- ✅ Funziona con tutti i client email moderni

**Contro**:
- ⚠️ Richiede che l'app sia online
- ⚠️ Alcuni client bloccano immagini remote per default (Gmail, Outlook)

**Quando usare**: 
- Per produzione quando l'app è deployata
- Quando vuoi poter aggiornare il logo facilmente

---

### Opzione 2: Base64 Embedded (Alternativa)

**Come funziona**: Il logo viene encodato in Base64 e embeddato direttamente nell'HTML.

#### Passo 1: Converti il logo in Base64

**Online** (più semplice):
1. Vai su https://www.base64-image.de/
2. Upload `public/images/logo/logo.png`
3. Copia il codice generato

**Oppure da terminale**:
```powershell
# Windows PowerShell
$imageBytes = [System.IO.File]::ReadAllBytes("public/images/logo/logo.png")
$base64 = [Convert]::ToBase64String($imageBytes)
Write-Output "data:image/png;base64,$base64"
```

#### Passo 2: Usa il Base64 nel template

```html
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." 
     alt="ZeroCento Logo" 
     width="80" 
     height="80" 
     style="display: block; margin: 0 auto 20px; max-width: 80px; height: auto;" />
```

**Pro**:
- ✅ Nessuna dipendenza da URL esterni
- ✅ Il logo appare sempre (no blocco immagini remote)
- ✅ Funziona anche offline

**Contro**:
- ❌ Template più pesante (~30-50% più grande)
- ❌ Impossibile aggiornare il logo senza modificare il template
- ❌ Alcuni client email (rari) non supportano Base64

**Quando usare**:
- Per testing in sviluppo
- Se vuoi garantire che il logo appaia sempre
- Se il logo è piccolo (<50KB)

---

### Opzione 3: CDN Esterno (Per Produzione Enterprise)

**Come funziona**: Hostare il logo su un CDN come Cloudinary, AWS S3, o ImgIx.

```html
<img src="https://res.cloudinary.com/zerocento/image/upload/v1/logo.png" 
     alt="ZeroCento Logo" 
     width="80" 
     height="80" 
     style="display: block; margin: 0 auto 20px; max-width: 80px; height: auto;" />
```

**Pro**:
- ✅ Altissima disponibilità (99.9% uptime)
- ✅ Ottimizzazione automatica (resize, compressione)
- ✅ Cache globale (caricamento velocissimo)

**Contro**:
- ⚠️ Richiede account CDN (spesso a pagamento)
- ⚠️ Setup più complesso

**Quando usare**:
- Per applicazioni enterprise
- Quando hai molti utenti internazionali
- Se vuoi analytics sulle aperture email

---

### Configurazione Consigliata per ZeroCento

**Ambiente di Sviluppo (localhost)**:
```html
<!-- Usa URL assoluto in sviluppo -->
<img src="http://localhost:3000/images/logo/logo.png" alt="ZeroCento Logo" ... />
```

**Produzione**:
```html
<!-- Usa variabile dinamica Supabase -->
<img src="{{ .SiteURL }}/images/logo/logo.png" alt="ZeroCento Logo" ... />
```

`{{ .SiteURL }}` verrà automaticamente sostituito con:
- `http://localhost:3000` in sviluppo
- `https://zerocento.app` in produzione

---

### Fallback per Client che Bloccano Immagini

Alcuni utenti hanno impostazioni che bloccano immagini remote. Puoi aggiungere un fallback con testo:

```html
<table>
    <tr>
        <td style="text-align: center;">
            <!-- Logo immagine -->
            <img src="{{ .SiteURL }}/images/logo/logo.png" 
                 alt="ZeroCento" 
                 width="80" 
                 height="80" 
                 style="display: block; margin: 0 auto 20px; max-width: 80px; height: auto;" />
            
            <!-- Fallback testuale (nascosto se immagine carica) -->
            <div style="display: none; width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #FFA700 0%, #FF8C00 100%); border-radius: 50%; line-height: 80px; text-align: center;">
                <span style="color: #ffffff; font-size: 24px; font-weight: bold;">0→100</span>
            </div>
        </td>
    </tr>
</table>
```

**Nota**: Questo approccio avanzato richiede media query o logica client-side, quindi è consigliato solo per esigenze specifiche.

---

### Test Visivo delle Email

Dopo aver configurato il logo, testa l'email su diversi client:

**Tool consigliati**:
- [Litmus](https://www.litmus.com/) - Testing email professionale (a pagamento)
- [Email on Acid](https://www.emailonacid.com/) - Preview su 90+ client
- **Mailtrap** - Testing gratuito in sviluppo
- **Send test email** da Supabase Dashboard (gratis)

**Client da testare**:
- ✉️ Gmail (web + app mobile)
- ✉️ Outlook 2016/2019/365
- ✉️ Apple Mail (macOS + iOS)
- ✉️ Thunderbird
- ✉️ Yahoo Mail

---

### Risoluzione Problemi Logo

**Il logo non appare?**

1. **Verifica URL**: Apri `{{ .SiteURL }}/images/logo/logo.png` nel browser
2. **Controlla CORS**: Il server deve permettere richieste da client email
3. **Dimensione file**: Mantieni il logo <100KB
4. **Formato**: PNG o JPG (evita SVG che alcuni client bloccano)
5. **HTTPS**: In produzione usa sempre HTTPS

**Il logo è troppo grande?**

```html
<!-- Forza dimensioni fisse -->
<img src="..." 
     width="80" 
     height="80" 
     style="max-width: 80px; height: 80px; object-fit: contain;" />
```

**Il logo non è centrato?**

```html
<img src="..." 
     style="display: block; margin-left: auto; margin-right: auto;" />
```

---

## Test delle Email

### Test in Sviluppo

1. **Invia email di test** dal Dashboard Supabase:
   - Authentication → Email Templates → [Template] → **Send test email**
   - Inserisci il tuo indirizzo email
   - Verifica che arrivi e che sia formattata correttamente

2. **Test end-to-end**:
   - Crea un utente dalla dashboard admin
   - Verifica che l'email arrivi
   - Clicca il link e completa l'onboarding

### Problemi Comuni

**Email non arriva?**
- Controlla spam/posta indesiderata
- Verifica che SMTP sia configurato (Settings → Project Settings → SMTP)
- In sviluppo, Supabase usa il loro SMTP (limitato a ~3 email/ora per indirizzo)

**Link non funziona?**
- Verifica che `NEXT_PUBLIC_APP_URL` sia corretto nel `.env`
- Controlla che `/onboarding/set-password` sia accessibile

**Template non si vede bene?**
- Alcuni client email (Gmail, Outlook) hanno limitazioni CSS
- I template qui forniti sono ottimizzati per compatibilità

---

## SMTP Personalizzato (Opzionale per Produzione)

Per maggiore affidabilità e personalizzazione, configura un provider SMTP esterno:

### SendGrid
```
Host: smtp.sendgrid.net
Port: 587
User: apikey
Password: <your-sendgrid-api-key>
Sender: noreply@zerocento.app
```

### Resend
```
Host: smtp.resend.com
Port: 587
User: resend
Password: <your-resend-api-key>
Sender: noreply@zerocento.app
```

Configuralo in: **Settings** → **Project Settings** → **SMTP Settings**

---

## Checklist Post-Configurazione

- [ ] Template "Invite user" salvato
- [ ] Template "Reset Password" salvato
- [ ] Subject personalizzati in italiano
- [ ] Email di test inviata e ricevuta
- [ ] Link nel template funzionanti
- [ ] Logo/branding visibile correttamente
- [ ] SMTP configurato (se produzione)
- [ ] Variabili `{{ .Data.firstName }}` popolate correttamente

Una volta completati questi step, il sistema di onboarding via email sarà completamente operativo! 🎉
