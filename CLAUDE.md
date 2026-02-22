# CLAUDE.md — Skim Project Context

## What is Skim?

A research paper reader app. Search arXiv, bioRxiv, PubMed from one place.
Upload PDFs from the web app on your laptop, sync to iOS, read anywhere.
Highlight text, ask AI questions with full document context, get paper
recommendations. Personal-use app by Dieter, invite-only via access code.

GitHub: https://github.com/Deetschoe/skimpapers

## Architecture

Three clients, one backend:

```
iOS App (SwiftUI)  ──── JWT Bearer ────→  skim-backend (Express + SQLite)  ←→  Claude API
                                                                                arXiv API
Web App (Next.js)  ── /api/* proxy ───→   skim-backend                         PubMed API
                                                                                Resend Email
```

- **skim-backend/** — Node.js + Express API, port 3001 in dev
- **skim-web/** — Next.js 14 frontend, port 3000 in dev, proxies `/api/*` to backend
- **Skim/** — Native iOS app (SwiftUI), talks directly to backend over HTTPS

### Data Flow
1. Next.js runs on port 3000, `next.config.js` rewrites proxy `/api/*` to Express backend on port 3001
2. iOS app calls the backend API directly via `APIService.swift`
3. Backend uses SQLite (`better-sqlite3`) stored at `./data/skim.db`
4. AI features use Claude API via `@anthropic-ai/sdk`
5. Email OTP login via Resend API

## Auth Flow

1. User enters email → `POST /api/auth/check-email` → `{ exists: bool }`
2. New users must provide access code (env: `ACCESS_CODE`)
3. `POST /api/auth/request-code` → generates 6-digit OTP, stores in `login_codes` table, emails via Resend
4. User enters code → `POST /api/auth/verify-code` → validates, returns JWT (30-day expiry)
5. JWT stored in localStorage (web) / Keychain (iOS)
6. All API requests use `Authorization: Bearer <token>` header

## Project Structure

```
Skim/
├── CLAUDE.md                  # This file
├── README.md
├── docker-compose.yml         # Docker config (backend only)
│
├── skim-backend/              # Express API
│   ├── .env                   # Environment vars (gitignored)
│   ├── .env.example           # Template for .env
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.js           # Express app entry, CORS, routes
│       ├── db.js              # SQLite setup, schema, migrations
│       ├── middleware/
│       │   └── auth.js        # JWT verify, generateToken, authMiddleware
│       ├── routes/
│       │   ├── auth.js        # Login: check-email, request-code, verify-code
│       │   ├── papers.js      # CRUD papers, search arXiv/PubMed, AI chat, annotations
│       │   ├── collections.js # Paper collections/folders CRUD
│       │   └── admin.js       # Admin endpoint (x-admin-secret header)
│       └── services/
│           ├── email.js       # Resend email service
│           ├── claude.js      # Claude API: paper analysis, annotations, chat
│           └── pdf.js         # PDF download, text extraction, markdown conversion
│
├── skim-web/                  # Next.js 14 frontend
│   ├── next.config.js         # API proxy rewrite to backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx           # Root layout, fonts, metadata
│       │   ├── globals.css          # Global styles (CSS custom properties)
│       │   ├── page.tsx             # Landing page
│       │   ├── login/page.tsx       # OTP login (email → access code → PIN)
│       │   ├── dashboard/page.tsx   # Main library, search, add paper
│       │   ├── paper/[id]/page.tsx  # Paper reader: summary, full text, annotations
│       │   ├── collections/page.tsx # Collections grid + detail
│       │   └── settings/page.tsx    # Usage stats, sign out
│       ├── components/
│       │   ├── AiChat.tsx           # Sliding AI chat sidebar
│       │   ├── PaperCard.tsx        # Library grid card
│       │   ├── CollectionCard.tsx   # Collection folder card
│       │   └── AddPaperModal.tsx    # Add paper by URL (unused, inline version used)
│       └── lib/
│           └── api.ts              # API client, token mgmt, auth helpers
│
└── Skim/                      # iOS app (SwiftUI)
    ├── SkimApp.swift           # App entry point
    ├── ContentView.swift       # Screen switcher: splash/auth/home
    ├── Components/
    │   └── Theme.swift         # SkimTheme: colors, fonts, spacing
    ├── Models/
    │   ├── Paper.swift         # Paper + Annotation structs, enums
    │   ├── User.swift          # SkimUser, AuthResponse, UsageInfo
    │   └── Collection.swift    # PaperCollection, icon/color enums
    ├── Services/
    │   ├── APIService.swift    # HTTP client for all backend endpoints
    │   ├── ClaudeService.swift # Direct Claude API (needs real API key)
    │   └── KeychainService.swift # JWT token secure storage
    ├── ViewModels/
    │   └── AppState.swift      # Central ObservableObject: all state + actions
    └── Views/
        ├── SplashView.swift
        ├── Auth/AuthView.swift          # 3-step auth: invite code, email, OTP
        ├── Home/HomeView.swift          # Library: search, collections, papers
        ├── Library/
        │   ├── LibraryView.swift
        │   └── PaperCardView.swift
        ├── AddPaper/AddPaperView.swift  # URL paste sheet
        ├── Reader/
        │   ├── ReaderView.swift         # 4-tab reader: Summary/Full/PDF/Annotations
        │   ├── PDFReaderView.swift      # PDFKit viewer
        │   └── AIAssistantSheet.swift   # AI chat bottom sheet
        └── Settings/SettingsView.swift
```

## Database Schema (SQLite)

Tables: `users`, `login_codes`, `papers`, `annotations`, `usage`, `collections`, `collection_papers`

Key tables:
- **papers**: id, user_id, title, authors (JSON), abstract, url, pdf_url, markdown_content, summary, rating, category, tags (JSON), source, published_date, added_date, is_read
- **annotations**: id, paper_id, user_id, selected_text, note, ai_response, page_number
- **collections**: id, user_id, name, icon, color_name
- **collection_papers**: collection_id, paper_id (composite PK)

Full schema in `skim-backend/src/db.js`.

## Environment Variables (skim-backend/.env)

```
PORT=3001                    # Backend port (3001 to avoid Next.js collision)
JWT_SECRET=<random-string>   # MUST be a real random string
CLAUDE_API_KEY=sk-ant-...    # Anthropic API key for AI features
DATABASE_PATH=./data/skim.db
FRONTEND_URL=http://localhost:3000
RESEND_API_KEY=re_...        # Resend email API key
FROM_EMAIL=skim@serenidad.app  # Must be verified domain (not sandbox)
ACCESS_CODE=<invite-code>    # Invite code for new user registration
ADMIN_SECRET=<random-string> # Secret for /api/admin endpoints
```

## Dev Commands

```bash
# Backend (starts on port 3001)
cd skim-backend && npm run dev

# Frontend (starts on port 3000, proxies /api to backend)
cd skim-web && npm run dev

# Both together (two terminal tabs)
```

## Paper Ingestion Pipeline

```
URL submitted → detectSource() → fetch metadata (arXiv/PubMed/bioRxiv API)
  → findPdfUrl()
  → processPdf(): download → extract text (pdf-parse) → convert to markdown
  → analyzePaper(): Claude API → { summary, rating, category, tags, keyFindings }
  → INSERT INTO papers → return formatted paper
```

## iOS App Notes

- `APIService.baseURL` must be set to actual backend URL (currently placeholder)
- `ClaudeService.swift` calls Claude directly from iOS — needs real API key
- Collections are local-only (UserDefaults) — not synced with backend yet
- Reading progress bar is hardcoded at 60% — not yet tracked

## Known Tech Debt

- No rate limiting on `/api/auth/request-code`
- No cleanup job for expired `login_codes` rows
- No search within local library (dashboard search queries remote APIs only)
- No pagination on `GET /api/papers` — returns all papers
- iOS collections don't sync with backend collections API
- `is_read` flag never updated via API
- `AddPaperModal.tsx` is dead code (dashboard uses inline version)
- Duplicate color constants across web components (should use CSS vars)
