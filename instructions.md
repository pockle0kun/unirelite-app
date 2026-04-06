# Project: Hokudai Gmail & Unire Integrated PWA

## 1. Project Overview & UX Vision
A high-performance PWA for Hokkaido University students. The goal is to eliminate "Nested Information Fatigue" found in legacy systems.
- **Dashboard (Top):** A "No-Hierarchy" zone. Direct access to files/links filtered by AI and user attributes. Focus on "Read this NOW" (e.g., imminent scholarship deadlines).
- **The Hub (Guide Page):** A flat, categorized interface. Replaces Unire’s complex tree-traversal with large, direct category buttons (Tuition, Study Abroad, Career, etc.), removing all unnecessary intermediate steps.
- **Core Interface:** SmartNews-style horizontal swipe between Dashboard, Hub, and Gmail.

## 2. Technical Stack
- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Authentication:** NextAuth.js (Google OAuth 2.0)
- **Database:** Supabase (User profiles, interest tags, and Guide metadata)
- **UI:** Tailwind CSS, Framer Motion, Lucide React
- **PWA:** `serwist` for offline caching of Guide PDFs and info.

## 3. Data Strategy: Direct-to-Content
The system must crawl the Unire Guide tree but **flatten** it for the user.

### 3.1 Flattened Guide Schema
Each item must be treated as a standalone "Actionable Object":
```json
{
  "id": "string (guideId)",
  "title": "string",
  "direct_url": "string (Direct link to ELMS/PDF/Link)",
  "category": "scholarship | career | tuition | event | etc",
  "importance_score": "number (Calculated)",
  "tags": {
    "faculty": ["string"],
    "grade": [1, 2, 3, 4],
    "is_international": "boolean",
    "deadline": "ISO8601"
  }
}
```

## 4. API & Proxy (The Crawler)
All requests must bypass CORS via `/api/unire/*` using the `.AspNetCore.saml2` cookie.
- **Recursive Fetching:** Implement a background logic to traverse `Categories` -> `ContentFolderFamilies` -> `Guides`.
- **Flattening:** Extract the final `Guide` items from deep within the tree and store/cache them with category tags.

## 5. Implementation Phases

### Phase 1: The Personalization Engine
- **Onboarding:** Collect Faculty, Grade, and Interests (Teacher track, Job hunting, etc.).
- **Scoring Logic:** - **Tier 1 (+50):** Faculty/Grade exact match.
    - **Tier 2 (+30):** Specific life-path match (e.g., Career goals).
    - **Urgency (+20):** Deadlines within 7 days.
    - **Admin Boost:** Manual override for university-wide alerts.

### Phase 2: Dashboard Implementation (Direct Access)
- **UI:** "Important for You" section.
- **Rule:** **Zero Nesting.** Clicking a card must open the document or the direct URL immediately.
- **Visuals:** Use "Flat Card Design" with clear "X days left" badges.

### Phase 3: The Hub Implementation (Flat Navigation)
- **UI:** A grid of large, recognizable buttons based on categories.
- **Logic:** Clicking a category shows a simple, filtered list of all relevant items, bypassing the "Parent Folder > Child Folder" structure of Unire.

### Phase 4: Gmail Integration
- **Hokudai Tab:** `from:(@hokudai.ac.jp)`
- **External Tab:** `-from:(@hokudai.ac.jp) category:primary`
- Integrate these as peer tabs to the Dashboard and Hub.

## 6. UI/UX Principles
- **Speed over Structure:** Information proximity is the priority.
- **Skeleton Screens:** Zero-white-out transitions during data fetching.
- **Thumb-Friendly:** All primary navigation and "Action" buttons within the bottom 40% of the screen.

## 7. Environment Variables
- `UNIRE_SAML2_COOKIE`, `UNIRE_WAPID`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`