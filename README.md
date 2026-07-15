# Berliner Rundschau

A modern news portal built with **Next.js 16**, **React 19**, and **Tailwind CSS v4**.

> **Note:** This is a technical demo project — not a real news site. All content and authors are fictional.

**[Live Demo](https://berliner-rundschau.vercel.app)** · 58 Test Files · 558 Tests · 0 Lint Errors

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16 (App Router + Turbopack) | Framework, SSR, ISR, API Routes |
| **React** | 19 (React Compiler) | UI with automatic memoization |
| **TypeScript** | 5.8 (strict mode) | Type safety, 240+ lines of type definitions |
| **Tailwind CSS** | v4 | Styling via 40+ CSS Custom Properties |
| **Vitest** | 3.1 + Testing Library | 558 tests, 99% accessible queries |
| **GitHub Actions** | CI Pipeline | Lint → TSC → Tests → Build |

---

## Quick Start

```bash
git clone https://github.com/Datex-P/berliner-rundschau.git
cd berliner-rundschau
npm install
npm run dev
```

No `.env` configuration needed — the project uses mock data and runs out of the box.

---

## Architecture

### Server/Client Split

19 Server Components (all pages) and 18 targeted Client Components — only where interactivity is required:

| Client Component | Reason |
|---|---|
| `SearchClient` | Real-time search with `useDeferredValue` + `useTransition` |
| `ThemeToggle` | localStorage + click handler for dark mode |
| `Navigation` | Hamburger menu with focus trap + scroll lock |
| `ErrorBoundaryContent` | `usePathname()` for contextual retry |
| `SafeImage` | `onError` fallback for missing images |

### Data Layer (CMS-Swappable)

```
Page (Server Component)
  → data.ts ("use cache" + cacheLife + cacheTag)
      → cms/  (adapter system — CMS selectable via env var)
          → parseResponse.ts (runtime validation against schema drift)
```

`import "server-only"` prevents accidental import in the client bundle.
17 `"use cache"` directives with granular `cacheLife` (minutes/hours/days) and `cacheTag` for selective invalidation via webhook.

### CMS Adapters

The project supports **11 headless CMS platforms** + a mock fallback. All 11 adapters are tested with this project and can be activated via env var. The adapter is selected via the `CMS_ADAPTER` env var — or auto-detected based on which CMS env vars are present:

| CMS | Adapter | SDK/Protocol | Auth | Status |
|---|---|---|---|---|
| Contentful | `contentful` | SDK (`contentful`) | CDA Token | Tested |
| Storyblok | `storyblok` | SDK (`storyblok-js-client`) | Access Token | Tested |
| WordPress | `wordpress` | REST WP-JSON (`safeFetch`) | App Password (Basic Auth, optional) | Tested |
| TYPO3 | `typo3` | REST (EXT:headless) | Bearer Token (optional) | Tested |
| DatoCMS | `datocms` | GraphQL via `executeQuery` | API Token | Tested |
| Sanity | `sanity` | SDK (`@sanity/client`) + GROQ | Token (optional) | Tested |
| Prismic | `prismic` | SDK (`@prismicio/client`) | Access Token (optional) | Tested |
| Strapi | `strapi` | REST (`safeFetch`) | API Token (Bearer) | Tested |
| Directus | `directus` | REST (`safeFetch`) | Static Token (Bearer) | Tested |
| Hygraph | `hygraph` | GraphQL (`safeFetch`) | Access Token (Bearer) | Tested |
| Payload | `payload` | REST (`safeFetch`) | API Key | Tested |
| Mock | `mock` | In-Memory | — | Tested |

**No CMS configured?** → Mock data is used, and the site runs immediately.

#### Testing with Your Own CMS

Each of the 11 adapters can be connected locally in four steps — no redeployment needed:

```bash
# 1. Clone and start (runs immediately with mock data)
git clone https://github.com/Datex-P/berliner-rundschau.git
cd berliner-rundschau
npm install
npm run dev          # → http://localhost:3000 (mock data)

# 2. Run seed script (creates demo data in the CMS)
#    → see CMS guide below for the exact command

# 3. Create .env.local — the seed script outputs the values at the end
cp .env.example .env.local
#    → paste the output from the seed script

# 4. Restart dev server
npm run dev
```

**What appears in the terminal:** `[cms] Using adapter: <name>`. In dev mode, an automatic health check warns if articles, categories, or authors are empty.

##### CMS-Specific Guides

Each CMS has a dedicated guide covering setup, configuration, seed script, and troubleshooting:

| Type | CMS | Guide |
|---|---|---|
| **SaaS** | Contentful | [docs/cms/contentful.md](docs/cms/contentful.md) |
| | Storyblok | [docs/cms/storyblok.md](docs/cms/storyblok.md) |
| | DatoCMS | [docs/cms/datocms.md](docs/cms/datocms.md) |
| | Sanity | [docs/cms/sanity.md](docs/cms/sanity.md) |
| | Prismic | [docs/cms/prismic.md](docs/cms/prismic.md) |
| | Hygraph | [docs/cms/hygraph.md](docs/cms/hygraph.md) |
| **Self-Hosted** | Strapi | [docs/cms/strapi.md](docs/cms/strapi.md) |
| | Directus | [docs/cms/directus.md](docs/cms/directus.md) |
| | Payload | [docs/cms/payload.md](docs/cms/payload.md) |
| **External** | WordPress | [docs/cms/wordpress.md](docs/cms/wordpress.md) |
| | TYPO3 | [docs/cms/typo3.md](docs/cms/typo3.md) |

SaaS CMS platforms only need an API token — no local server required. Self-hosted CMS (Strapi, Directus, Payload) must be running locally (Docker or native).

##### Verification: How to Check It Works

After `npm run dev`, open the following pages in your browser:

| Page | URL | What You See |
|---|---|---|
| **Home** | `http://localhost:3000` | Hero article + article list from your CMS |
| **Article Detail** | `http://localhost:3000/artikel/{slug}` | Single article with image, body, author |
| **Category** | `http://localhost:3000/kategorie/{slug}` | All articles in a category |
| **Search** | `http://localhost:3000/suche?q=test` | Live search results |
| **Health Check** | Terminal output on start | `[cms] Using adapter: <name>` + warnings for empty data |

**If everything is empty:** Switch back to `CMS_ADAPTER=mock`. If mock works, the issue is with your CMS credentials or content model.

#### Required CMS Content

**Minimum:** Articles (with headline, slug, body) + categories + authors must exist in the CMS. All other content types (newsticker, videos, navigation, site config, breaking news, quiz, stock data) show fallback data when missing.

**Recommendation for testing:** Create 3-5 articles with one category and one author each. That covers all pages.

#### Demo Data via Seed Script

Instead of creating content manually, the included seed scripts can generate a complete demo set: 8 articles, 6 categories, 4 authors, 6 newsticker entries, stock data, and a daily quiz — all idempotent (safe to run multiple times).

Each CMS guide under [docs/cms/](docs/cms/) contains the exact seed command, required token type, and CMS-specific notes.

##### After Seeding

1. Update `.env.local` to point to the seeded CMS (see CMS guide)
2. **Prismic:** Publish all documents via "Migration release" in the dashboard (CDN only serves published content)
3. `npm run dev` — the site should display all demo content

#### Field Mapping

If CMS fields have different names than the internal keys:

```bash
CONTENTFUL_FIELD_MAP={"headline":"title","teaser":"description","body":"content"}
```

Supported internal keys: `headline`, `slug`, `teaser`, `body`, `image`, `category`, `author`, `tags`, `readingTimeMinutes`, `isPremium`, `paywall`, `isLive`, `isOpinion`, `isFeatured`, `isBreaking`, `aiSummary`, `region`.

#### Token Scope per CMS

| CMS | Minimum Token Type |
|---|---|
| Contentful | **CDA Token** (Content Delivery API), NOT CMA/Preview |
| Storyblok | **Public/Private Token** (CDN API) |
| DatoCMS | **Read-only API Token** |
| Sanity | Without token = public dataset; with token = private/draft |
| Prismic | **Permanent Access Token** (optional for public repos) |
| Strapi | **API Token** (read-only scope is sufficient) |
| Directus | **Static Token** (read-only role is sufficient) |
| Hygraph | **Permanent Auth Token** (Content API, read-only) |
| Payload | **API Key** (user with read-only role) |
| WordPress | **App Password** (only if posts are not public) |
| TYPO3 | Bearer Token (optional, only for protected endpoints). Requires: EXT:headless + EXT:news |

#### Image Domains

For `next/image` optimization, external CMS CDN domains must be whitelisted:

```bash
CMS_IMAGE_DOMAINS=images.ctfassets.net,a.storyblok.com
```

**Self-hosted CMS** (Strapi, Directus, Payload, TYPO3): If the CMS URL is not `localhost`, the domain must also be in `CMS_IMAGE_DOMAINS`. **Requires redeployment after change.**

#### Switching CMS — Checklist

1. Update `CMS_ADAPTER` and related env vars in `.env.local`
2. Update `CMS_IMAGE_DOMAINS` to the new CDN domain
3. Check content model: articles, categories, authors as collections/content types
4. Check required fields: `headline`, `slug`, `body` must exist (or be mapped via `FIELD_MAP`)
5. Run `npm run dev` — health check in terminal shows missing content
6. Set up revalidation webhook in CMS pointing to `/api/revalidate` with `REVALIDATION_SECRET`
7. Redeploy (Vercel/Docker) — set env vars there as well

#### Troubleshooting

| Problem | Solution |
|---|---|
| Empty pages | Set `CMS_ADAPTER=mock` — if mock works, the issue is with the CMS |
| "Unknown adapter" error | Typo in `CMS_ADAPTER`? Valid values: contentful, storyblok, datocms, sanity, prismic, strapi, directus, hygraph, payload, wordpress, typo3, mock |
| "Multiple CMS env var sets" | Multiple CMS vars set without explicit `CMS_ADAPTER` — set one |
| Images not loading | Check `CMS_IMAGE_DOMAINS`, redeployment required after changes |
| Build fails with "NEXT_PUBLIC_" | Token leak protection: CMS tokens must NOT start with `NEXT_PUBLIC_` |

CMS-specific issues → see the troubleshooting section in the respective [CMS guide](docs/cms/).

#### Writing a Custom Adapter

If your CMS is not listed: `src/lib/cms/mock.adapter.ts` is the simplest template. An adapter implements the `CmsAdapter` interface (17 methods in `types.ts`) and is provided as a `default export`. Then register it in `detect.ts` and `index.ts` — done.

#### Comments

Article comments are demo data (generated from mock) and are not loaded from the CMS.

### Design Token System

All colors as CSS Custom Properties in `:root` / `.dark` — no hardcoded Tailwind colors:

```css
:root {
  --color-primary: #15803d;
  --color-primary-hover: color-mix(in srgb, #15803d, black 12%);
  /* 40+ variables for light + dark mode */
}
```

Bridged to Tailwind via `@theme inline` — classes like `bg-(--color-primary)` work everywhere.

---

## Security

| Measure | Detail |
|---|---|
| **Content Security Policy** | 8 directives including `frame-ancestors 'none'`, `object-src 'none'` |
| **HSTS** | `max-age=63072000; includeSubDomains; preload` (2 years) |
| **XSS Sanitization** | DOMPurify with restrictive tag/attribute allowlist, `ALLOW_DATA_ATTR: false` |
| **Zod Validation** | All API inputs (slugs, search terms, webhooks) schema-validated |
| **Timing-Safe Auth** | `crypto.timingSafeEqual()` for revalidation secret comparison |
| **XML Injection Protection** | RSS feed escapes `& < > " '` in CMS data |
| **External Link Security** | Automatic `rel="noopener noreferrer"` + screen reader hint |
| **Error Message Security** | No stack traces or DB strings in the UI — only digest reference codes |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=()` — hardware access blocked |

---

## Accessibility

| Feature | Implementation |
|---|---|
| **Skip Link** | Server Component, visible on focus, links to `#main-content` |
| **Focus Trap** | Custom hook (`useFocusTrap`) for mobile menu — Tab/Shift+Tab trapped, Escape closes |
| **Focus Management** | Reset to `#main-content` on every client navigation via `FocusManager` |
| **ARIA Throughout** | `aria-live="polite"` on search status, `role="alert"` on errors, `aria-current="page"` on active nav, `aria-expanded` + `aria-controls` on mobile menu |
| **Keyboard Navigation** | Escape closes menu, focus return to trigger, click-outside handler |
| **Reduced Motion** | Global `prefers-reduced-motion` media query — all animations disabled |
| **Focus-Visible Styles** | Consistent `outline: 2px solid` on all interactive elements |
| **Semantic HTML** | `<article>`, `<nav>`, `<aside>`, `<time dateTime>`, `<figure>`, configurable `headingLevel` |
| **Screen Reader Support** | `.sr-only` texts for counters, labels, external links ("opens in new tab") |
| **Scroll Margin** | `scroll-margin-top: 5rem` on `[id]` elements for anchor links beneath the header |

---

## SEO

| Feature | Detail |
|---|---|
| **JSON-LD** | 3 schema types: `Article` (headline, author, publisher), `CollectionPage`, `Person` |
| **OpenGraph** | Per page: title, description, images with dimensions, `type: "article"` with `publishedTime` |
| **Twitter Cards** | `summary_large_image` on all pages |
| **Sitemap** | Dynamically generated from CMS data with `changeFrequency` and `priority` |
| **RSS Feed** | RSS 2.0 with Dublin Core (`dc:creator`), Atom self-link, 1h cache |
| **Static Generation** | `generateStaticParams` on all dynamic routes — build-time pre-rendering |
| **Metadata** | `metadataBase` for absolute URLs, `title.template` for consistent page titles, `lang="de"` |

---

## Performance

| Optimization | Detail |
|---|---|
| **React Compiler** | Automatic memoization — no manual `useMemo`/`useCallback` needed |
| **`"use cache"`** | 17 functions in the data layer with granular `cacheLife` + `cacheTag` |
| **Cache Components** | `cacheComponents: true` in `next.config.ts` |
| **On-Demand Revalidation** | Webhook endpoint `/api/revalidate` with `revalidateTag()` — CMS adapter tags for selective invalidation |
| **Parallel Fetching** | `Promise.all()` on homepage (3 calls), category, author, sitemap |
| **Font Optimization** | `next/font/google` with `display: "swap"` and CSS variables |
| **Image Optimization** | `next/image` via `SafeImage` wrapper with error fallback, `sizes`, `priority` |
| **Turbopack** | Dev server with `--turbopack` for fast HMR |
| **CSS color-mix()** | Color variants computed natively in the browser — zero runtime cost |

---

## Error Handling (5-Layer System)

```
1. Global Error Boundary    → Catches root layout errors, renders its own HTML shell
2. Route Error Boundary     → Retry with limit (max 3), countdown visible
3. Per-Route Error Pages    → Contextual messages ("Article could not be loaded")
4. Component Error States   → Inline errors with optional retry callback
5. Global Error Reporter    → Catches unhandled rejections + window.onerror
```

All error boundaries use `role="alert"` and display only digest reference codes — no sensitive data.
CMS outages are handled gracefully (sitemap/RSS serve fallback data instead of 500 errors).

---

## Dark Mode (Flash-Free)

A three-layer system prevents white flash on load:

1. **Blocking Inline Script** — Reads `localStorage` + `matchMedia` and sets `.dark` class **before first paint**
2. **ThemeProvider (React Context)** — Synchronizes state, persists selection, listens for system changes live
3. **40+ CSS Custom Properties** — Complete dual-token system for light + dark

---

## Testing

**58 Test Files · 558 Test Cases · 0 Failures**

```bash
npm test              # Watch mode (development)
npm run test:run      # Single run (CI)
npm run lint          # ESLint (0 errors)
npx tsc --noEmit      # TypeScript check
```

### Coverage

| Area | Files | What's Tested |
|---|---|---|
| Components | 15 | Rendering, interaction, error/loading states |
| UI Primitives | 7 | SafeImage, SanitizedHtml, SkipLink, badges, tags |
| Pages | 10 | Homepage, article, category, author, search, 404 |
| API Routes | 2 | Revalidation, search with validation + edge cases |
| CMS Adapters | 9 | HTTP, sanitization, detection, field mapping, image utils, adapter tests |
| Lib/Utils | 11 | Schemas, formatting, security headers, JSON-LD, navigation |
| Hooks | 1 | Focus trap behavior with cleanup |
| Infrastructure | 2 | Proxy/middleware, error boundaries |

### Test Quality

- **222 accessible queries** (`getByRole`, `getByLabelText`, `getByText`) — only 1x `getByTestId`
- **39 `userEvent` calls** for realistic user interactions
- **CI Pipeline** (`ci.yml`): Lint → TypeScript → Vitest → Build on every push

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Homepage (hero, article list, newsticker)
│   ├── artikel/[slug]/           # Article detail with JSON-LD + OG
│   ├── kategorie/[slug]/         # Category overview
│   ├── autor/[slug]/             # Author profile + article list
│   ├── suche/                    # Full-text search with debouncing
│   ├── api/revalidate/           # CMS webhook for on-demand ISR
│   ├── api/search/               # Search API with Zod validation
│   └── feed.xml/                 # RSS 2.0 feed
│
├── components/
│   ├── ui/                       # Primitives (SafeImage, SanitizedHtml, SkipLink, ...)
│   ├── layout/                   # Navigation with focus trap
│   ├── AppHeader.tsx             # Header + search + dark mode toggle
│   ├── AppFooter.tsx             # Footer with social links
│   ├── ArticleCard.tsx           # 3 variants (hero, default, compact)
│   ├── SearchClient.tsx          # Live search with useTransition
│   ├── ThemeProvider.tsx         # Dark mode (system + manual)
│   └── ErrorReporter.tsx         # Global error handler
│
├── hooks/
│   └── useFocusTrap.ts           # Tab/Escape/focus return
│
├── lib/
│   ├── data.ts                   # "use cache" data layer (17 cached functions)
│   ├── mock.ts                   # Mock data for local development
│   ├── cms/                      # CMS adapter system
│   │   ├── index.ts              # Adapter loader (switch/case, server-only)
│   │   ├── detect.ts             # Auto-detection + circuit breaker + health check
│   │   ├── types.ts              # CmsAdapter interface (17 methods)
│   │   ├── http.ts               # safeFetch, SSRF protection, retry, error sanitization
│   │   ├── sanitize.ts           # Rich text sanitization (sanitize-html)
│   │   ├── defaults.ts           # Fallback values for non-essential content
│   │   └── *.adapter.ts          # 11 CMS adapters + mock adapter
│   ├── schemas.ts                # Zod schemas for API validation
│   ├── json-ld.ts                # Structured data (3 schema types)
│   ├── security-headers.ts       # CSP, HSTS, X-Frame, Permissions-Policy
│   └── parseResponse.ts          # Runtime validation against CMS schema drift
│
├── types/
│   └── index.ts                  # 20+ TypeScript interfaces
│
└── docs/                         # Handoff documentation (DE + EN)
    ├── CLIENT_GUIDE_{DE,EN}.md
    ├── DEPLOY_GUIDE_{DE,EN}.md
    ├── DEVELOPER_HANDOFF_{DE,EN}.md
    └── SECURITY_OVERVIEW_{DE,EN}.md
```

---

## Deployment

The project is configured for Vercel and deploys automatically on push to `main`:

```bash
vercel              # Preview deployment
vercel --prod       # Production deployment
```

---

## License

MIT
