# Accretive.co.nz Frontend

Frontend-only Next.js project for the Accretive marketing site and dashboard UI shell.

## Included

- Marketing pages under `app/`
- Dashboard UI screens under `app/dashboard/*`
- Shared UI components under `components/`
- Global styles in `app/globals.css`
- Static assets in `public/`

## Excluded

- API route handlers (`app/api/*`)
- Server logic (`lib/server/*`, `src/server/*`)
- Database and migrations (`db/*`)
- Backend tests and migration scripts

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## GitHub + Vercel Publish

1. Create GitHub repo: `Accretive.co.nz`
2. Push this project:
   ```bash
   git init -b main
   git add .
   git commit -m "Initial frontend-only import"
   git remote add origin https://github.com/dearlovelucas-hub/Accretive.co.nz.git
   git push -u origin main
   ```
3. Import repo into Vercel and deploy as a Next.js app.
