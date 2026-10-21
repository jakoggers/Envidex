Link to demo: https://www.loom.com/share/d56b2c04a149444997668ce4c9e575a3

# Envidex

Envidex is a mobile-first species identification app. Capture or upload a mammal photo, run the **local Keras classifier**, review an honest result card, and save a **private** observation to your server-backed field guide.

## Features (Phase A + B)

- **Intentional identify** — Start camera / Upload (no auto-permission on mount)
- **Local classifier default** — Python FastAPI `/predict` via `/api/predict`
- **Explicit external AI opt-in** — Anthropic `/api/identify` only when configured and chosen
- **Private field guide** — MongoDB observations + filesystem media behind auth
- **Auth** — NextAuth JWT with `tokenVersion` revocation; email/password + optional OAuth
- **Light & dark mode** — nature-inspired theme

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| State | Zustand (UI/cache only, scoped by user) |
| Auth | NextAuth.js v4 + MongoDB adapter |
| Database | MongoDB |
| ML backend | Single FastAPI app: `src/backend/main.py` |
| Private images | Local filesystem + `/api/media/[id]` |
| Deployment | Vercel (app); Python service separately |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Required for the Next.js app:

- `MONGODB_URI_REAL`
- `NEXTAUTH_URL` (e.g. `http://localhost:3000`)
- `NEXTAUTH_SECRET` (`openssl rand -base64 32`)

Optional: OAuth, `ANTHROPIC_API_KEY` (external AI opt-in), `PREDICTION_API_BASE_URL`, `STORAGE_ROOT`, size limits.

See [`.env.example`](.env.example) for the full list. Python may use `MONGO_URI` only for optional Gemini animal-info logging — it is **not** required to start `/predict`.

### 3. Start the local prediction service

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r src/backend/requirements.txt
cd src/backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

`GEMINI_API_KEY` is **not** required for `/predict`. Optional `/api/animal-info` stays behind key presence.

Do **not** start `AnimalAiImageRec/Prediction.py` — that second server is retired.

### 4. Run the Next.js app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Checks

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## API Routes (product path)

| Route | Method | Description |
|---|---|---|
| `/api/auth/signup` | POST | Email/password registration |
| `/api/auth/[...nextauth]` | ANY | NextAuth session handling |
| `/api/predict` | POST | Auth + sanitize → local Keras predict → stores inference result |
| `/api/identify` | POST | Explicit Anthropic identify (503 if unset) |
| `/api/observations` | GET/POST | List / save private observation by `inferenceResultId` |
| `/api/observations/[id]` | GET/DELETE | Detail / delete (owner only) |
| `/api/media/[id]` | GET | Authenticated private image bytes |
| `/api/user` | GET/PATCH/DELETE | Profile; password change bumps `tokenVersion` |

## Pages

| Route | Description |
|---|---|
| `/` | Home |
| `/live-feed` | Identify (camera / upload → result → save) |
| `/collection` | Server-backed private field guide |
| `/collection/[id]` | Observation detail |
| `/share/[shareId]` | Legacy public share (read-only; CTA → `/live-feed`) |
| `/settings` | Account settings + honest delete failures |

## Security notes (this pass)

- Observations and images are private by default; no new public Blob uploads.
- JWT `tokenVersion` rejects sessions after password change / account delete.
- OAuth does not merge accounts on unverified email match.
- Image uploads: JPEG/PNG/WebP, magic-byte + decode, max bytes/pixels, EXIF strip, re-encode.
- In-memory rate limits are single-instance only (document Redis for multi-instance later).
