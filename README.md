# Discord Boost System

Automated Discord server boosting web application built with Next.js 14, deployable on Vercel.

## ⚠️ Warning

Self-bots violate Discord's Terms of Service. Use at your own risk.

---

## Features

- **4-step guided workflow**: Server ID → Bot Setup → Token Config → Results
- **Automated boost process**: Join server + apply boosts via Discord API
- **Token validation**: Checks Nitro status and available boost slots before processing
- **Real-time progress**: Live updates via Server-Sent Events (SSE)
- **Security hardened**: XSS protection, CSRF tokens, rate limiting, httpOnly session cookies
- **Mobile-first responsive**: Works on all screen sizes

---

## Setup

### 1. Discord Developer Portal

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Create a new application
3. Under **Bot** tab: create a bot, copy the token (`BOT_TOKEN`)
4. Under **OAuth2** tab:
   - Copy Client ID (`OAUTH2_CLIENT_ID`) and Client Secret (`OAUTH2_CLIENT_SECRET`)
   - Add redirect URI: `https://your-domain.vercel.app/api/auth/callback`
5. Required bot permissions: `268435456` (Manage Server / Add Members)

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
BOT_TOKEN=your_bot_token
OAUTH2_CLIENT_ID=your_client_id
OAUTH2_CLIENT_SECRET=your_client_secret
OAUTH2_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback
JWT_SECRET=random_32+_char_secret
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Settings > Environment Variables
```

Or connect your GitHub repo in the Vercel dashboard for automatic deploys.

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in your .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Architecture

```
User Flow:
Step 1 (/) → Enter Server ID → Creates secure session cookie
Step 2 (/setup) → Bot invite check + auto-poll
Step 3 (/boost) → Paste tokens → Validate Nitro/boosts → Configure
Step 4 (/result) → Live boost execution with SSE streaming
```

### Security Measures

- JWT session with httpOnly + Secure + SameSite=Strict cookie
- Content Security Policy (CSP) headers
- HSTS + X-Frame-Options + X-Content-Type-Options
- Rate limiting per endpoint (session/IP-based)
- Input sanitization and Zod schema validation
- Tokens never stored — processed in memory and discarded
- All secrets server-side only (no NEXT_PUBLIC_ leakage)

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + custom Discord-inspired theme
- **Auth**: JWT via `jose` + httpOnly cookies
- **Discord**: `discord.js` v14 + `discord.js-selfbot-v13`
- **Validation**: `zod`
- **Streaming**: Server-Sent Events (SSE)
- **Deploy**: Vercel (serverless functions)
