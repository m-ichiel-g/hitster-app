# Goose Hitster

Zelfgemaakte Hitster-variant voor de NPO Radio 2 Top 2000 (2025).  
Gebouwd met React + Vite + TypeScript + Tailwind CSS.

## Lokaal starten

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in je browser.  
De app heeft drie schermen: welkomst (`/`), deck (`/deck`) en player (`/player`).

## Iconen genereren (eenmalig, al gedaan)

```bash
node scripts/generate-icons.mjs
```

Genereert placeholder PNG-iconen in `public/icons/`.  
In Fase 5 worden deze vervangen door de echte goose-kop illustratie.

## Bouwen

```bash
npm run build
```

De output staat in `dist/`. Vercel deployt automatisch bij elke push naar `main`.

## Fases

| Fase | Inhoud |
|------|--------|
| 0 ✅ | Projectskelet, routing, PWA-manifest, live op Vercel |
| 1    | Databouw-script → dataset JSON met accurate jaartallen |
| 2    | Deck-modus: playlist-kiezer, QR-generatie, omdraaien |
| 3    | Player-login: Spotify PKCE + Web Playback SDK |
| 4    | QR-scanner + bedieningsknoppen + Wake Lock |
| 5    | Polish: goose-illustratie, uitlegscherm, volledige Top 2000 |
