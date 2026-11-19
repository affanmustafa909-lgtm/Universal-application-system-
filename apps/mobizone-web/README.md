# Zivra MobiZone Web (iPhone / Safari)

Simple React web app for MobiZone — same Railway users as the Android APK and desktop EXE.

## Features

- Email/password login (empty fields, no admin autofill)
- Branch select
- Home dashboard (today sales / buy / profit)
- Sale + Purchase entry
- Bill / receipt design (colors, paper, live preview)
- Syncs ledger with live API when available

## API

Default:

```
https://backend-system-production-28a3.up.railway.app
```

Override with `VITE_API_BASE_URL` (see `.env.example`).

## Local

```bash
npm install
npm run dev
```

## Deploy on Vercel (you do this)

1. Import this GitHub repo in [Vercel](https://vercel.com/new)
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy

`vercel.json` already rewrites all routes to `index.html` for the SPA.

Expected live URL after you connect Vercel:

`https://<your-vercel-project>.vercel.app`
