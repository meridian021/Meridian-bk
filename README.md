# Meridian Bank (demo)

Fictional banking MVP. Not a real bank — does not process real money, real
banking rails, or real crypto.

## Phase 1 status

Working: server boot, MongoDB connection, session auth, single-step
register/login, protected customer dashboard, admin login + overview,
seed script. Multi-step onboarding, transfers, cards, KYC, deposits, and
full admin management land in the phases that follow.

## Local setup

```bash
npm install
cp .env.example .env
# edit .env: set MONGODB_URI to an Atlas connection string (not a local-only
# mongod — we're going to Render immediately, so use Atlas from day one)
npm run seed     # creates the dev admin account
npm run dev      # http://localhost:3000
```

## Deploying to Render

1. Push this repo to GitHub.
2. In Render: New → Web Service → connect the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add every variable from `.env.example` under Render's Environment tab
   (use the same Atlas `MONGODB_URI` — Render's servers need a database
   reachable from the internet, so Atlas rather than local MongoDB).
6. After the first deploy, run the seed script once via Render's Shell tab:
   `npm run seed`.

## Project structure

See the brief's proposed structure — `config/`, `models/`, `middleware/`,
`services/`, `routes/`, `views/`, `public/`, `scripts/`.
