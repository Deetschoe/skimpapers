# Skim — Coolify Backend Deployment + Web Frontend Update Guide

This is a complete reference for setting up the Skim backend on Coolify (Hetzner) and updating the web frontend to match the new gated auth flow. The iOS app and backend code already exist in the `Deetschoe/skim` repo. The web frontend will live in its own separate repo (`skim-web`).

---

## PART 1: COOLIFY BACKEND DEPLOYMENT

### What You're Deploying

The backend lives in `skim-backend/` inside the main repo. It's a Node.js + Express API using SQLite (via `better-sqlite3`) for the database. There's already a working `Dockerfile`.

### Dockerfile (already exists, no changes needed)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Coolify Setup Steps

1. **Create a new service** in Coolify pointing to the GitHub repo `Deetschoe/skim`
2. **Set the build pack** to Docker
3. **Set the base directory** to `skim-backend/` (this tells Coolify to look for the Dockerfile inside that subdirectory)
4. **Set the exposed port** to `3000`
5. **Add a persistent volume** for the SQLite database:
   - Container path: `/app/data`
   - This is CRITICAL — without a volume, the database is destroyed every deploy
6. **Set the domain** — whatever subdomain you want (e.g., `skim-api.yourdomain.com`)
7. **Enable HTTPS** (Coolify handles this with Let's Encrypt automatically)

### Environment Variables (set in Coolify)

All of these must be set in Coolify's environment variables section for the service:

```
PORT=3000
JWT_SECRET=<generate a strong random string, e.g. openssl rand -hex 32>
CLAUDE_API_KEY=<your Anthropic API key from console.anthropic.com>
DATABASE_PATH=./data/skim.db
FRONTEND_URL=<your Vercel web URL, e.g. https://skim-web.vercel.app>
RESEND_API_KEY=<your Resend API key from resend.com>
FROM_EMAIL=<your verified sender email on Resend, e.g. noreply@yourdomain.com>
ADMIN_SECRET=<generate a strong random string for admin endpoints>
```

**Important notes:**
- `DATABASE_PATH=./data/skim.db` — this must point inside the Docker volume mount (`/app/data`)
- `FRONTEND_URL` — this is used for CORS. Set it to your actual Vercel domain. Multiple origins are supported in the code (the CORS config allows both FRONTEND_URL and localhost:5173)
- If you don't have a Resend API key yet, the email service gracefully falls back to console logging (emails will appear in Coolify's container logs instead of being sent)
- The `ADMIN_SECRET` is a shared secret sent via `X-Admin-Secret` header to protect admin endpoints

### Health Check

Once deployed, verify the backend is running:
```
GET https://skim-api.yourdomain.com/health
→ { "status": "ok", "timestamp": "2026-02-15T..." }
```

### Database

SQLite with WAL mode. The database auto-creates all tables on first boot. No migrations needed. Tables:

- `users` — id, email, password_hash, created_at
- `papers` — id, user_id, title, authors (JSON), abstract, url, pdf_url, markdown_content, summary, rating, category, tags (JSON), source, published_date, added_date, is_read
- `annotations` — id, paper_id, user_id, selected_text, note, ai_response, page_number, created_at
- `usage` — id, user_id, action, cost_estimate, created_at
- `collections` — id, user_id, name, icon, color_name, created_at
- `collection_papers` — collection_id, paper_id, added_at (composite PK)
- `waitlist` — id, email (unique), created_at
- `access_codes` — id, code (unique), email (nullable), is_used, created_at
- `password_resets` — id, user_id, code, expires_at, is_used, created_at

---

## PART 2: COMPLETE API REFERENCE

All endpoints return JSON. Authentication is via `Authorization: Bearer <jwt_token>` header.

### Auth Endpoints (no auth required)

#### `POST /api/auth/check-email`
**This is the entry point for the gated auth flow.** The client sends an email, and the server returns one of three statuses.
```json
Request:  { "email": "user@example.com" }
Response: { "status": "registered" }   // user exists → show sign-in
       OR { "status": "invited" }      // has unused access code → show create account
       OR { "status": "unknown" }      // not recognized → show waitlist
```

#### `POST /api/auth/signin`
```json
Request:  { "email": "user@example.com", "password": "password123" }
Response: { "user": { "id": "...", "email": "...", "createdAt": "..." }, "token": "jwt..." }
```

#### `POST /api/auth/signup`
Accepts optional `accessCode` for gated signup.
```json
Request:  { "email": "user@example.com", "password": "password123", "accessCode": "12345" }
Response: { "user": { "id": "...", "email": "...", "createdAt": "..." }, "token": "jwt..." }
```
- Password must be >= 8 characters
- If `accessCode` is provided, it's validated against `access_codes` table (must exist and not be used)
- Access code is marked as used after successful signup
- Email is lowercased and checked for uniqueness

#### `GET /api/auth/validate` (auth required)
Validates a JWT token and returns the user.
```json
Response: { "user": { "id": "...", "email": "...", "createdAt": "..." } }
```

#### `POST /api/auth/join-waitlist`
```json
Request:  { "email": "user@example.com" }
Response: { "success": true, "message": "You're on the waitlist!" }
```
- Sends a confirmation email via Resend (or logs to console if no API key)
- Uses INSERT OR IGNORE so duplicate emails don't error

#### `POST /api/auth/verify-access-code`
```json
Request:  { "code": "12345" }
Response: { "valid": true, "email": "user@example.com" }  // email may be null
   OR 401: { "error": "Invalid or expired access code" }
```
- Does NOT mark the code as used (that happens at signup)
- Returns the email associated with the code if one was set

#### `POST /api/auth/forgot-password`
```json
Request:  { "email": "user@example.com" }
Response: { "success": true }
```
- Always returns success (doesn't leak whether email exists)
- If user exists, generates a 6-digit code (expires in 15 minutes) and emails it
- Code stored in `password_resets` table

#### `POST /api/auth/reset-password`
```json
Request:  { "email": "user@example.com", "code": "123456", "newPassword": "newpass123" }
Response: { "success": true }
```
- Validates the code against `password_resets` (must be unused and not expired)
- Updates the user's password hash
- Marks the reset code as used

### Papers Endpoints (all require auth)

#### `GET /api/papers`
Returns all papers for the authenticated user (sorted by added_date DESC). Note: `markdownContent` is omitted from list responses for performance.

#### `POST /api/papers`
```json
Request:  { "url": "https://arxiv.org/abs/2301.12345" }
Response: Full paper object with all fields including markdownContent
```
Pipeline: detect source → fetch metadata (arxiv API for arxiv URLs) → download PDF → extract text → convert to markdown → Claude analysis (summary, rating, category, tags, key findings) → save to DB.

#### `GET /api/papers/:id`
Returns full paper including `markdownContent`.

#### `DELETE /api/papers/:id`
Deletes a paper (cascades to annotations).

#### `GET /api/papers/search?q=...&start=0&max=10`
Searches arXiv API. Returns `{ results: [...], total: N }`.

#### `GET /api/papers/usage`
```json
Response: {
  "totalPapers": 12,
  "totalQueries": 45,
  "apiCostEstimate": 0.0234,
  "monthlyCost": 0.0150,
  "periodStart": "2026-02-01T...",
  "periodEnd": "2026-02-28T..."
}
```

#### `POST /api/papers/:id/chat`
Multi-turn AI chat about a paper.
```json
Request:  { "messages": [{ "role": "user", "content": "What's the main finding?" }] }
Response: { "response": "The main finding is..." }
```
Messages array follows Claude format (alternating user/assistant roles).

### Annotations Endpoints (all require auth)

#### `GET /api/papers/:id/annotations`
Returns all annotations for a paper.

#### `POST /api/papers/:id/annotations`
```json
Request:  { "selectedText": "...", "note": "What does this mean?", "pageNumber": 3 }
Response: { "id": "...", "paperId": "...", "selectedText": "...", "note": "...", "aiResponse": "...", "pageNumber": 3, "createdAt": "..." }
```
If `note` is provided without `aiResponse`, the backend auto-generates an AI response using Claude.

### Collections Endpoints (all require auth)

#### `GET /api/collections`
```json
Response: [{ "id": "...", "name": "...", "icon": "folder.fill", "colorName": "accent", "paperCount": 5, "createdAt": "..." }]
```

#### `POST /api/collections`
```json
Request:  { "name": "Favorites", "icon": "star.fill", "colorName": "accent" }
```

#### `PUT /api/collections/:id`
```json
Request:  { "name": "Updated Name", "icon": "heart.fill", "colorName": "destructive" }
```

#### `DELETE /api/collections/:id`

#### `GET /api/collections/:id/papers`
Returns all papers in a collection.

#### `POST /api/collections/:id/papers`
```json
Request:  { "paperId": "paper-uuid-here" }
```

#### `DELETE /api/collections/:id/papers/:paperId`

### Admin Endpoints (require `X-Admin-Secret` header)

#### `POST /api/admin/generate-codes`
```json
Request:  { "count": 5, "email": "optional@example.com" }
Response: { "codes": [{ "code": "12345", "email": null }, ...] }
```
- If `email` is provided, sends the access code via email
- Max 100 codes per request

#### `GET /api/admin/waitlist`
Returns all waitlist entries sorted by created_at DESC.

#### `POST /api/admin/invite`
```json
Request:  { "email": "user@example.com" }
Response: { "code": "12345", "email": "user@example.com" }
```
Generates an access code and emails it to the user.

#### `GET /api/admin/codes`
Returns all access codes sorted by created_at DESC.

---

## PART 3: WEB FRONTEND UPDATES NEEDED

The existing web frontend (`skim-web/`) was built before the gated auth flow was added. It currently has basic `/signin` and `/signup` pages. **These need to be replaced with the new multi-step gated auth flow.**

### Current Web Stack
- Next.js 14 (App Router)
- React 18
- TypeScript
- API client in `src/lib/api.ts` using `fetch` + localStorage for token
- Custom font: Linndale Square NF (already in `public/fonts/linndale-square.ttf`)

### Auth Flow to Implement (replaces signin/signup pages)

The web should have a **single auth page** (e.g., `/` or `/login`) with the same multi-step flow as iOS:

**Step 1: Email Entry**
- "skim" logo (Linndale Square font)
- "Research, distilled." subtitle
- Email input field
- "Continue" button → calls `POST /api/auth/check-email`
- "Have an access code?" link → goes to access code step

**Step 2a: Sign In** (if status = "registered")
- "Welcome back" + show email
- Password field
- "Sign In" button → calls `POST /api/auth/signin`
- "Forgot password?" link → goes to forgot password step
- "Use a different email" back link

**Step 2b: Create Account** (if status = "invited")
- "You're in!" heading
- Show email
- "Create a password" field (8 char minimum)
- "Create Account" button → calls `POST /api/auth/signup` with accessCode
- "Use a different email" back link

**Step 2c: Waitlist** (if status = "unknown")
- Auto-calls `POST /api/auth/join-waitlist`
- Checkmark icon animation
- "You're on the waitlist!" heading
- "We'll send you an access code when it's your turn."
- "Use a different email" back link

**Step 3: Access Code Entry**
- "Enter access code" heading
- 5-digit PIN input (individual boxes)
- Auto-verifies when all digits entered → calls `POST /api/auth/verify-access-code`
- On success: stores code, goes to Create Account step
- On failure: clears digits, shows error

**Step 4a: Forgot Password**
- Calls `POST /api/auth/forgot-password` on load
- "Check your email" heading
- "We sent a 6-digit code to {email}"
- 6-digit PIN input
- When complete → goes to reset password step

**Step 4b: Reset Password**
- "Create new password" heading
- Password field
- "Reset Password" button → calls `POST /api/auth/reset-password`
- On success → auto signs in via `POST /api/auth/signin`

### New API Methods Needed in `src/lib/api.ts`

Add these functions (they don't exist yet):

```typescript
export async function checkEmail(email: string): Promise<{ status: string }> {
  return post('/auth/check-email', { email });
}

export async function joinWaitlist(email: string): Promise<void> {
  return post('/auth/join-waitlist', { email });
}

export async function verifyAccessCode(code: string): Promise<{ valid: boolean; email: string | null }> {
  return post('/auth/verify-access-code', { code });
}

export async function forgotPassword(email: string): Promise<void> {
  return post('/auth/forgot-password', { email });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  return post('/auth/reset-password', { email, code, newPassword });
}

export async function signUp(email: string, password: string, accessCode?: string): Promise<{ user: User; token: string }> {
  return post('/auth/signup', { email, password, ...(accessCode ? { accessCode } : {}) });
}
```

### Environment Variable for Vercel

Set in Vercel project settings:
```
NEXT_PUBLIC_API_URL=https://skim-api.yourdomain.com/api
```

This is already referenced in `src/lib/api.ts` line 4:
```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
```

---

## PART 4: DESIGN SYSTEM

The web version should match the iOS app's warm, paper-like aesthetic. NO blue anywhere.

### Colors
```css
--background:     #FAF9F5;   /* warm cream */
--surface:        #FFFFFF;
--accent:         #C75B38;   /* terracotta — primary buttons, links, active states */
--accent-secondary: #7A9E7E; /* sage green — secondary accents */
--text-primary:   #1A1A1A;
--text-secondary: #5C5C58;
--text-tertiary:  #9E9E99;
--border:         #E0DFDA;
--destructive:    #C0392B;   /* red — errors, delete buttons */
--rating-yellow:  #D4A537;
```

### Typography
- **Logo & big headings**: Linndale Square NF font (already at `public/fonts/linndale-square.ttf`)
- **Body/UI text**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`)
- Logo always lowercase: "skim"

### Component Patterns
- Cards: white background, rounded corners (14px), subtle border
- Input fields: white bg, 1.5px border (2px + terracotta glow on focus), icon on the left
- Primary buttons: terracotta background, white text, full-width, rounded
- Error banners: destructive red text + warning icon on light red background
- PIN code inputs: individual square boxes (48x56px), active box gets terracotta border + shadow
- Transitions between auth steps: slide left/right with opacity fade

---

## PART 5: VERCEL DEPLOYMENT

1. Create a new repo for the web frontend (e.g., `skim-web`)
2. Copy the contents of `skim-web/` from the main repo into it
3. In Vercel, import the new repo
4. Framework preset: Next.js (auto-detected)
5. Set environment variable: `NEXT_PUBLIC_API_URL=https://skim-api.yourdomain.com/api`
6. Deploy

### CORS

The backend CORS config (in `src/index.js`) allows:
- `process.env.FRONTEND_URL` (set this to your Vercel domain in Coolify env vars)
- `http://localhost:5173` (for local dev)

If you need to add more origins, update the CORS array in `skim-backend/src/index.js` line 16.

---

## PART 6: AFTER DEPLOYMENT CHECKLIST

1. Backend health check: `GET https://skim-api.yourdomain.com/health`
2. Generate your first access code:
   ```bash
   curl -X POST https://skim-api.yourdomain.com/api/admin/generate-codes \
     -H "Content-Type: application/json" \
     -H "X-Admin-Secret: YOUR_ADMIN_SECRET" \
     -d '{"count": 1, "email": "youremail@example.com"}'
   ```
3. Set up Resend: verify your sender domain at resend.com, add the API key to Coolify env vars
4. Update iOS app's `APIService.swift` line 6 to point to your Coolify backend URL
5. Test the full flow: email entry → waitlist / access code → create account → sign in
