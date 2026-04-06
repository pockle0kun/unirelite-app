# Project: Hokudai Gmail & Unire Integrated PWA

## 1. Project Overview
Hokkaido University student-focused PWA that integrates Gmail and Unire information.
- **Core Experience:** Fast, lightweight, and swipeable tab interface (SmartNews-style).
- **Key Constraint:** All external API calls must bypass CORS via Next.js Route Handlers.

## 2. Technical Stack
- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Authentication:** NextAuth.js (Google OAuth 2.0)
- **Scopes:** `https://www.googleapis.com/auth/gmail.readonly`
- **UI & Animation:** Tailwind CSS, Framer Motion
- **Swipe Component:** `react-swipeable-views-react-18-fix`
- **PWA / Service Worker:** `serwist` (or `next-pwa`)
- **Database:** Supabase (for user-specific tab settings)

## 3. API & Proxy Architecture (CORS Bypass)
All requests to external domains must be proxied through `/app/api/*.ts`.

### 3.1 Gmail API Proxy (`/api/gmail`)
- Fetch messages using the Google Access Token from NextAuth session.
- Implement server-side filtering based on the tab's query.

### 3.2 Unire API Proxy (`/api/unire`)
- **Endpoint:** `https://unire.hokudai.ac.jp/api/ElmsInformations/detailElmsInformations`
- **Method:** GET
- **Required Headers:**
  - `Referer: https://unire.hokudai.ac.jp/`
  - `Cookie: .AspNetCore.saml2=${process.env.UNIRE_SAML2_COOKIE}; WAPID=${process.env.UNIRE_WAPID}`
- **Query Params:** `itemSkipCount` (offset), `itemTakeCount` (limit)

## 4. Feature: Smart Tabs (Swipeable)
Implement a horizontal swipe UI for the following categories:


| **Unire** | Proxied data from unire.hokudai.ac.jp |
| **Custom** | User-defined keywords stored in Supabase |

## 5. UI/UX Principles
- **Performance First:** Minimize client-side JS. Use Server Components (RSC) where possible.
- **Visual Feedback:** Implement Skeleton Screens for loading states.
- **Mobile Optimized:** Large touch targets and "Thumb-friendly" navigation.
- **Smooth Animation:** Use `framer-motion` for page transitions and `react-swipeable-views` for tab switching.

## 6. Environment Variables (`.env.local`)
The following variables are pre-configured. Use them in the implementation:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `UNIRE_WAPID`
- `UNIRE_SAML2_COOKIE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 7. Development Steps
1. **Initialize:** Setup Next.js with Tailwind, Lucide React, and Framer Motion.
2. **Auth:** Implement NextAuth.js with Google Provider.
3. **API Proxy:** Create `/api/gmail` and `/api/unire` handlers.
4. **UI - Layout:** Build the SmartNews-style swipeable tab container.
5. **UI - List:** Build the email/information list with 2-line previews and sender icons.
6. **PWA:** Configure Serwist for offline support and manifest settings.
7. **Custom Tabs:** Integrate Supabase to save/load user tab preferences.