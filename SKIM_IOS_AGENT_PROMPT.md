# Skim iOS Agent Prompt

You are working on the iOS app for **Skim**, a research paper reader. The project root is at `/Users/dieterschoening/Developer/Skim/Skim/`.

## Project Overview

Skim lets users save research papers (from arXiv, PubMed, bioRxiv, medRxiv, or direct PDF uploads), get AI-generated summaries/ratings, chat with papers via Claude, and organize them into collections. There are 3 clients: this iOS app (SwiftUI), a Next.js web app, and an Express + SQLite backend.

## Deployed URLs

- **Backend API**: `https://api.skimpapers.org/api`
- **Frontend**: `https://skimpapers.org`
- The iOS `APIService.baseURL` is already set to `https://api.skimpapers.org/api`

## Auth Flow

The auth flow is: **access code -> email -> 6-digit OTP verification**.

1. User enters an invite code (access code) — this is the first screen
2. User enters their email
3. Backend calls `POST /api/auth/check-email` to see if user exists
4. Backend calls `POST /api/auth/request-code` with email (and `accessCode` for new users)
5. User receives 6-digit code via email, enters it
6. Backend calls `POST /api/auth/verify-code` — returns JWT + user object
7. Token is stored in Keychain, user is redirected to main app

**Important**: The iOS `AuthView.swift` currently validates the access code locally on line 367 (`if accessCodeText == "dieter"`). This should be removed — the access code should only be validated server-side when `requestCode` is called with the `accessCode` parameter. The local check prevents the code from ever being sent to the backend for validation.

## iOS File Structure

```
Skim/
├── SkimApp.swift              # App entry point
├── ContentView.swift          # Root view (auth vs main)
├── Models/
│   ├── Paper.swift            # Paper model
│   ├── User.swift             # User + auth response models
│   └── Collection.swift       # Collection model
├── ViewModels/
│   └── AppState.swift         # Global app state (auth, papers, etc.)
├── Services/
│   ├── APIService.swift       # All API calls (already complete)
│   ├── KeychainService.swift  # Token storage
│   └── ClaudeService.swift    # Direct Claude API (placeholder key)
├── Views/
│   ├── Auth/AuthView.swift    # Login flow (access code → email → OTP)
│   ├── Home/HomeView.swift    # Main tab view
│   ├── Library/
│   │   ├── LibraryView.swift  # Paper list
│   │   └── PaperCardView.swift
│   ├── Reader/
│   │   ├── ReaderView.swift   # Paper detail view
│   │   ├── PDFReaderView.swift
│   │   └── AIAssistantSheet.swift
│   ├── AddPaper/AddPaperView.swift
│   ├── Settings/SettingsView.swift
│   └── SplashView.swift
└── Components/
    └── Theme.swift            # Design system (SkimTheme)
```

## API Endpoints

All endpoints are at `https://api.skimpapers.org/api`. Auth endpoints don't need a token; all others need `Authorization: Bearer <token>`.

### Auth
- `POST /auth/check-email` — body: `{ email }` → `{ exists: bool }`
- `POST /auth/request-code` — body: `{ email, accessCode? }` → `{ success: true }`
- `POST /auth/verify-code` — body: `{ email, code }` → `{ token, user: { id, email, createdAt } }`
- `GET /auth/validate` — header: Bearer token → `{ user: { id, email, createdAt } }`

### Papers
- `GET /papers` → `Paper[]`
- `POST /papers` — body: `{ url }` → `Paper` (adds paper from URL)
- `POST /papers/upload` — multipart form, field `file` (PDF) → `Paper` (adds paper from uploaded PDF)
- `GET /papers/:id` → `Paper` (with markdownContent)
- `DELETE /papers/:id` → `{ success: true }`
- `GET /papers/search?q=...` → `{ results: SearchResult[], total }`
- `GET /papers/usage` → usage stats

### Paper Chat
- `POST /papers/:id/chat` — body: `{ messages: [{ role, content }] }` → `{ response }`

### Annotations
- `GET /papers/:id/annotations` → `Annotation[]`
- `POST /papers/:id/annotations` — body: `{ selectedText?, note?, pageNumber? }` → `Annotation`

### Collections
- `GET /collections` → `Collection[]`
- `POST /collections` — body: `{ name, icon?, colorName? }` → `Collection`
- `PUT /collections/:id` — body: `{ name?, icon?, colorName? }` → `Collection`
- `DELETE /collections/:id`
- `GET /collections/:id/papers` → `Paper[]`
- `POST /collections/:id/papers` — body: `{ paperId }` (add paper to collection)
- `DELETE /collections/:id/papers/:paperId` (remove paper from collection)

## Known Issues to Fix

1. **Local access code validation** — `AuthView.swift:367` hardcodes `"dieter"` check. Remove the local validation; the backend validates the access code when `requestCode` is called with `accessCode` parameter. Just save the code text and pass it along.

2. **ClaudeService has placeholder API key** — `ClaudeService.swift` has a placeholder Anthropic API key. The app should use the backend's `/papers/:id/chat` endpoint instead of calling Claude directly. Remove or deprecate the direct Claude integration.

3. **Collections don't sync with backend** — The collections UI may be using local state only. Ensure all collection CRUD operations go through `APIService`.

4. **PDF upload not implemented** — The `AddPaperView` only supports URL input. Add support for picking a PDF from Files and uploading it via `POST /papers/upload` (multipart form data).

## Design Language

The app uses `SkimTheme` (in `Components/Theme.swift`) with these key values:
- **Accent**: `#C75B38` (terracotta)
- **Accent Secondary**: `#4D8570` (sage green)
- **Background**: `#FAF9F5` (warm off-white)
- **Surface**: `#FFFFFF`
- **Text Primary**: `#1A1A1A`
- **Text Secondary**: `#5C5C58`
- **Destructive**: `#C0392B`
- **Corner Radius**: 12
- **Logo Font**: Linndale Square NF (or Georgia fallback)

The design is minimal, warm, and paper-inspired. No harsh colors. Subtle shadows and rounded corners.
