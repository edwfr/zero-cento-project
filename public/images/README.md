# 📁 Media Folder - ZeroCento Training

Questa cartella contiene tutti i file media statici dell'applicazione.

## 📂 Struttura

```
public/images/
├── logo/           # Loghi dell'applicazione
│   ├── logo.png    # Logo principale (consigliato: 512x512px)
│   ├── logo.svg    # Logo vettoriale
│   └── favicon.ico # Favicon del sito
├── avatars/        # Avatar utenti (se necessari)
├── exercises/      # Immagini dimostrative esercizi
└── icons/          # Icone varie
```

## 🎨 Linee Guida

### Logo Principale
- **File**: `logo/logo.png` o `logo/logo.svg`
- **Dimensioni consigliate**: 512x512px (PNG) o scalabile (SVG)
- **Formato**: PNG con trasparenza o SVG
- **Utilizzo**: Login page, header, PWA icon

### Favicon
- **File**: `logo/favicon.ico`
- **Dimensioni**: 32x32px, 16x16px (multi-size ICO)
- **Utilizzo**: Browser tab icon

### Esercizi
- **Formato**: WebP (preferito per web) o JPG
- **Dimensioni**: Max 1200x800px
- **Ottimizzazione**: Compressi per performance

## 🔗 Come Usare nei Componenti

```tsx
// In qualsiasi componente Next.js
import Image from 'next/image'

<Image 
  src="/images/logo/logo.png" 
  alt="ZeroCento Logo"
  width={128}
  height={128}
/>

// Oppure con tag <img> normale
<img src="/images/logo/logo.png" alt="ZeroCento Logo" />
```

## 📝 Note
- Tutti i file in `public/` sono accessibili direttamente via URL
- Esempio: `public/images/logo/logo.png` → `https://tuodominio.com/images/logo/logo.png`
- Next.js ottimizza automaticamente le immagini con il componente `<Image>`
