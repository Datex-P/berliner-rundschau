# Berliner Rundschau

Modernes Nachrichtenportal, gebaut mit **Next.js 16**, **React 19** und **Tailwind CSS v4**.

> **Hinweis:** Dies ist ein technisches Demo-Projekt — keine echte Nachrichtenseite. Alle Inhalte und Autoren sind fiktiv.

**[Live Demo](https://berliner-rundschau.vercel.app)** · 61 Testdateien · 500+ Tests · 0 Lint-Errors

---

## Tech-Stack

| Technologie | Version | Einsatz |
|---|---|---|
| **Next.js** | 16 (App Router + Turbopack) | Framework, SSR, ISR, API Routes |
| **React** | 19 (React Compiler) | UI mit automatischer Memoization |
| **TypeScript** | 5.8 (strict mode) | Typsicherheit, 240+ Zeilen Type System |
| **Tailwind CSS** | v4 | Styling über 40+ CSS Custom Properties |
| **Vitest** | 3.1 + Testing Library | 394 Tests, 99% accessible Queries |
| **GitHub Actions** | CI Pipeline | Lint → TSC → Tests → Build |

---

## Schnellstart

```bash
git clone https://github.com/Datex-P/berliner-rundschau.git
cd berliner-rundschau
npm install
npm run dev
```

Keine `.env`-Konfiguration nötig — das Projekt verwendet Mock-Daten und läuft sofort.

---

## Architektur

### Server/Client-Split

19 Server Components (alle Seiten) und 18 gezielte Client Components — nur dort, wo Interaktivität nötig ist:

| Client Component | Grund |
|---|---|
| `SearchClient` | Echtzeit-Suche mit `useDeferredValue` + `useTransition` |
| `ThemeToggle` | localStorage + Click-Handler für Dark Mode |
| `Navigation` | Hamburger-Menu mit Focus Trap + Scroll Lock |
| `ErrorBoundaryContent` | `usePathname()` für kontextuellen Retry |
| `SafeImage` | `onError`-Fallback bei fehlenden Bildern |

### Data Layer (CMS-austauschbar)

```
Seite (Server Component)
  → data.ts ("use cache" + cacheLife + cacheTag)
      → cms/  (Adapter-System — CMS wählbar per Env Var)
          → parseResponse.ts (Runtime-Validierung gegen Schema-Drift)
```

`import "server-only"` verhindert versehentlichen Import im Client Bundle.
17 `"use cache"` Direktiven mit granularem `cacheLife` (Minuten/Stunden/Tage) und `cacheTag` für gezielte Invalidierung via Webhook.

### CMS-Adapter

Das Projekt unterstützt **11 Headless CMS** + einen Mock-Fallback. 4 Adapter sind mit diesem Projekt getestet, die weiteren 7 sind architektonisch identisch aufgebaut und lassen sich per Env Var aktivieren. Der Adapter wird per `CMS_ADAPTER` Env Var gewählt — oder automatisch anhand vorhandener CMS-Env-Vars erkannt:

| CMS | Adapter | SDK/Protokoll | Auth | Status |
|---|---|---|---|---|
| Contentful | `contentful` | SDK (`contentful`) | CDA Token | Getestet |
| Storyblok | `storyblok` | SDK (`storyblok-js-client`) | Access Token | Getestet |
| WordPress | `wordpress` | REST WP-JSON (`safeFetch`) | App Password (Basic Auth, optional) | Getestet |
| TYPO3 | `typo3` | REST (EXT:headless) | Bearer Token (optional) | Getestet |
| DatoCMS | `datocms` | GraphQL via `executeQuery` | API Token | Getestet |
| Sanity | `sanity` | SDK (`@sanity/client`) + GROQ | Token (optional) | Getestet |
| Prismic | `prismic` | SDK (`@prismicio/client`) | Access Token (optional) | Getestet |
| Strapi | `strapi` | REST (`safeFetch`) | API Token (Bearer) | Getestet |
| Directus | `directus` | REST (`safeFetch`) | Static Token (Bearer) | Verfügbar |
| Hygraph | `hygraph` | GraphQL (`safeFetch`) | Access Token (Bearer) | Getestet |
| Payload | `payload` | REST (`safeFetch`) | API Key | Getestet |
| Mock | `mock` | In-Memory | — | Getestet |

**Kein CMS konfiguriert?** → Mock-Daten, Website läuft sofort.

#### Mit eigenem CMS testen

Jeder der 11 Adapter lässt sich lokal in drei Schritten anbinden — kein Redeploy nötig:

```bash
# 1. Repo klonen und starten (läuft sofort mit Mock-Daten)
git clone https://github.com/Datex-P/berliner-rundschau.git
cd berliner-rundschau
npm install
npm run dev          # → http://localhost:3000 (Mock-Daten)

# 2. .env.local anlegen und CMS-Variablen setzen
cp .env.example .env.local
# → .env.local editieren (siehe Beispiele unten)

# 3. Dev-Server neu starten — Health-Check im Terminal zeigt Status
npm run dev
```

**Was im Terminal erscheint:** `[cms] Using adapter: <name>`. Im Dev-Modus läuft automatisch ein Health-Check, der warnt wenn Articles, Categories oder Authors leer sind.

##### Beispiel: SaaS-CMS (Contentful, Storyblok, DatoCMS, Sanity, Prismic, Hygraph)

```bash
# .env.local — Beispiel Contentful
CMS_ADAPTER=contentful
CONTENTFUL_SPACE_ID=your-space-id
CONTENTFUL_ACCESS_TOKEN=your-cda-token
CMS_IMAGE_DOMAINS=images.ctfassets.net

# .env.local — Beispiel Storyblok
CMS_ADAPTER=storyblok
STORYBLOK_ACCESS_TOKEN=your-token
CMS_IMAGE_DOMAINS=a.storyblok.com
```

Kein lokaler Server nötig — nur API-Token eintragen und die CDN-Domain für Bilder freigeben.

##### Beispiel: Self-Hosted CMS (Strapi, Directus, Payload)

```bash
# .env.local — Beispiel Strapi (lokal auf Port 1337)
CMS_ADAPTER=strapi
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your-api-token

# .env.local — Beispiel Directus (lokal auf Port 8055)
CMS_ADAPTER=directus
DIRECTUS_URL=http://localhost:8055
DIRECTUS_STATIC_TOKEN=your-static-token
```

Das CMS muss lokal laufen (Docker oder nativ). Bei nicht-localhost-URLs: Domain in `CMS_IMAGE_DOMAINS` eintragen.

##### Beispiel: WordPress

```bash
# .env.local — WordPress (jede WP-Instanz mit REST API)
CMS_ADAPTER=wordpress
WORDPRESS_URL=https://example.com
# Auth nur nötig wenn Posts nicht public:
# WORDPRESS_USERNAME=user
# WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Funktioniert mit jeder WordPress-Installation — keine Plugins nötig, WP REST API ist eingebaut.

##### Beispiel: TYPO3

```bash
# .env.local — TYPO3 mit EXT:headless + EXT:news
CMS_ADAPTER=typo3
TYPO3_URL=https://cms.example.de
# TYPO3_API_TOKEN=              # nur bei geschützten Endpoints
# TYPO3_ARTICLE_PAGE=/news      # Slug der News-Listenseite (Default: /news)
# TYPO3_LANG_PREFIX=/en         # bei mehrsprachigen Instanzen
# TYPO3_FIELD_MAP={}            # Custom-Felder remappen
```

**Voraussetzungen:** TYPO3 muss [EXT:headless](https://extensions.typo3.org/extension/headless), [EXT:news](https://extensions.typo3.org/extension/news) und [friendsoftypo3/headless_news](https://github.com/TYPO3-Headless/headless_news) installiert haben. EXT:headless aktiviert den JSON-Modus (jede Seiten-URL liefert JSON statt HTML), EXT:news stellt News-Artikel bereit, headless_news serialisiert sie ins JSON-Format.

**TYPO3-Besonderheiten:**
- Kein eigener API-Endpoint — EXT:headless liefert JSON direkt über die Seiten-URL (`/news` statt `/api/articles`)
- News-Artikel werden aus `content.colPos*`-Spalten der Seite extrahiert (Content-Elemente mit `type: "news_pi1"`)
- Authors kommen als Objekt `{author, authorEmail}` — der Adapter erzeugt daraus synthetische Author-Objekte
- Categories werden aus den News-Items gesammelt und dedupliziert
- Suche ist client-seitig (Headline + Teaser) — für >200 Artikel wird [EXT:solr](https://extensions.typo3.org/extension/solr) empfohlen

**Strapi-Besonderheiten:**
- **Flat response (v5):** Strapi v5 liefert Felder direkt (`data.title`), NICHT mehr unter `data.attributes.title` wie in v4
- **Bilder auf localhost:** Next.js Image Optimizer verweigert private IPs (`127.0.0.1`). Der Adapter umgeht das automatisch mit `unoptimized` für localhost-URLs — kein Workaround im `.env.local` nötig
- **Populate — kein `*` für verschachtelte Relationen:** `populate=*` liefert nur Level-1-Felder. Author-Avatare und andere tief verschachtelte Medien brauchen explizite Dot-Notation: `populate=cover,category,author,author.avatar`
- **Dynamic Zone:** Rich-Text-Blöcke kommen als Array `blocks` mit `__component: "shared.rich-text"`. Der Adapter erkennt automatisch ob `body` HTML oder Markdown ist (per `trimStart().startsWith('<')`)
- **`documentId` statt `id`** für Mutations (PUT, DELETE) — `id` ist nur für Lesezugriffe
- **Beschreibungsfeld:** Strapi erlaubt je nach Schema-Konfiguration ein kürzeres `description`-Feld (z.B. max. 80 Zeichen) — bei Seed-Scripts beachten
- Kein eigenes Seed-Script im Repo — Demo-Daten müssen manuell oder per eigenem Script angelegt werden

**DatoCMS-Besonderheiten:**
- **Async Write API (CMA v3):** Alle Schreiboperationen (`POST /uploads`, `POST /item-types/{id}/fields`) liefern HTTP 202 mit einem Job-Token zurück — nicht das Ergebnis. Das Ergebnis muss per Polling unter `GET /job-results/{job-id}` abgeholt werden. Fehler stehen im Feld `payload.data` als Array von `api_error`-Objekten (NICHT in `payload.status`)
- **`type` ist ein reservierter Field-API-Key** und darf nicht als Feldname verwendet werden (`VALIDATION_RESERVED` Error). Felder die einen Typ repräsentieren (z.B. `ticker_type`) entsprechend benennen
- **GraphQL CDA: automatische camelCase-Konvertierung:** Alle snake_case-Feldnamen (`reading_time_minutes`) werden in der CDA-GraphQL-API automatisch zu camelCase (`readingTimeMinutes`). Im Adapter immer camelCase-Namen verwenden
- **Link-Felder brauchen zwingend einen `item_item_type`-Validator** mit mindestens einem erlaubten Modell. Ein leeres `item_types: []` ist valide, bedeutet aber „kein Modell erlaubt" — nicht „alle Modelle erlaubt"
- **JSON-Felder über CDA:** JSON-Felder in der CDA liefern den gespeicherten Wert direkt zurück (oder `null`). Über die CMA können nur flache JSON-Objekte gespeichert werden — Arrays auf oberster Ebene werden mit `INVALID_FORMAT` abgelehnt. Workaround: `{ list: [...] }` oder JSON als Text-Feld speichern
- **Slug-Felder brauchen einen `slug_title_field`-Validator** mit der ID des Titelfeldes — sonst schlägt die Feldanlage fehl
- **Singleton-Modelle** (`singleton: true`) haben in der CDA kein `all`-Präfix, sondern werden direkt per Modell-Name abgefragt (z.B. `query { siteConfig { ... } }` statt `allSiteConfigs`)

**Hygraph-Besonderheiten:**
- **JSON-Felder liefern geparste Objekte:** Hygraph JSON-Felder (`type: JSON`) kommen über die Content API als JavaScript-Objekte, NICHT als Strings. `JSON.parse()` auf bereits geparste Objekte crasht leise — der Adapter prüft mit `typeof === "string"` vor dem Parsen
- **Management API ist asynchron:** Jede Schema-Mutation (Model/Field erstellen) startet eine Migration. Nur eine gleichzeitig erlaubt — das Seed-Script pollt nach jeder Mutation auf `status: "SUCCESS"` bevor die nächste gesendet wird
- **Kein eingebautes Singleton:** Navigation, SiteConfig etc. werden über ein `slug`-Feld mit festem Wert `"singleton"` und `where: { slug: "singleton" }` abgefragt
- **Public Content API für Mutations:** PAT-Token Content Permissions können trotz korrekter UI-Konfiguration fehlschlagen. Das Seed-Script nutzt die Public Content API (unauthentifiziert) als zuverlässige Alternative
- **Body als String-Feld:** RichText-Felder benötigen Slate AST für Mutations — der Adapter speichert HTML als STRING-Feld und rendert es im Frontend mit DOMPurify
- **Bilder als JSON-Feld:** Das Asset-Model hat kein `altText`-Feld. Bilder werden als JSON mit `url` + `alt` + `width` + `height` gespeichert
- **Stages als Query-Variable:** Jede Query braucht `stage: $stage` (PUBLISHED/DRAFT) — ohne Stage-Variable werden nur DRAFT-Inhalte geliefert

**Payload-Besonderheiten:**
- **Lexical Rich Text:** Payload v3 verwendet den Lexical Editor. Body-Inhalte werden als Lexical AST JSON gespeichert (`{root: {children: [{type, children, ...}]}}`). Der Adapter konvertiert den AST rekursiv zu HTML — verschachtelte Inline-Formatting (bold + italic + underline) wird über Bit-Flags im `format`-Feld kodiert (1=bold, 2=italic, 8=underline, kombinierbar)
- **REST API mit `depth`-Parameter:** Relations werden per Default als IDs geliefert. `?depth=2` löst verschachtelte Relationen auf (z.B. Article → Author → Avatar). Ohne `depth` kommen nur IDs statt Objekten
- **MongoDB erforderlich:** Payload v3 läuft mit MongoDB (oder PostgreSQL). Lokal: `brew services start mongodb-community` auf macOS, dann `mongodb://127.0.0.1:27017/<db-name>` in `payload.config.ts`
- **Collection-Schema in Code:** Content-Types werden als TypeScript-Dateien definiert (`src/collections/*.ts`), nicht über eine API. Schema-Änderungen erfordern einen Server-Neustart
- **JWT-Authentifizierung:** Login über `POST /api/users/login` liefert ein JWT-Token. Seed-Scripts nutzen `Authorization: JWT <token>` für alle Schreiboperationen
- **Port-Trennung:** Payload ist selbst eine Next.js-App — bei parallelem Betrieb mit der Berliner Rundschau auf separatem Port starten (z.B. Port 3001 für Payload, Port 3000 für die App)
- **`createdAt`/`updatedAt` automatisch:** Payload fügt diese Felder automatisch zu allen Collections hinzu — nicht im Schema definieren, aber im Adapter verfügbar
- **Bilder als Upload-Collection:** Media-Dateien werden über eine eigene Upload-Collection verwaltet. Der Adapter nutzt externe Bild-URLs (Unsplash) direkt per `CMS_IMAGE_DOMAINS`

##### Verifizierung: So prüfst du ob es funktioniert

Nach `npm run dev` die folgenden Seiten im Browser öffnen:

| Seite | URL | Was du siehst |
|---|---|---|
| **Startseite** | `http://localhost:3000` | Hero-Artikel + Artikelliste aus deinem CMS |
| **Artikel-Detail** | `http://localhost:3000/artikel/{slug}` | Einzelner Artikel mit Bild, Body, Author |
| **Kategorie** | `http://localhost:3000/kategorie/{slug}` | Alle Artikel einer Kategorie |
| **Suche** | `http://localhost:3000/suche?q=test` | Live-Suchergebnisse |
| **Health-Check** | Terminal-Output beim Start | `[cms] Using adapter: <name>` + Warnungen bei leeren Daten |

**Wenn alles leer ist:** Zurück auf `CMS_ADAPTER=mock` wechseln. Wenn Mock funktioniert, liegt das Problem bei den CMS-Zugangsdaten oder dem Content-Modell.

#### Pflicht-Content im CMS

**Minimum:** Artikel (mit Headline, Slug, Body) + Kategorien + Autoren müssen im CMS existieren. Alle anderen Content-Typen (Newsticker, Videos, Navigation, Site-Config, Breaking News, Quiz, Stock Data) zeigen Fallback-Daten wenn sie fehlen.

**Empfehlung zum Testen:** 3–5 Artikel mit je einer Kategorie und einem Autor anlegen. Das reicht für alle Seiten.

#### Demo-Daten per Seed-Script erstellen

Statt Inhalte manuell anzulegen, können die mitgelieferten Seed-Scripts ein komplettes Demo-Set erstellen: 8 Artikel, 6 Kategorien, 4 Autoren, 6 Newsticker-Einträge, Börsendaten und ein Tagesquiz — alles idempotent (wiederholtes Ausführen ist sicher).

```bash
# Contentful (Management API Token von https://app.contentful.com/account/profile/cma_tokens)
node cms-seeds/seed-contentful.mjs \
  --space-id <space-id> \
  --management-token <cma-token> \
  [--environment master]

# Storyblok (Personal Access Token von app.storyblok.com → My Account)
node cms-seeds/seed-storyblok.mjs \
  --space-id <space-id> \
  --token <personal-access-token>

# WordPress.com (OAuth2 Bearer Token)
node cms-seeds/seed-wordpress.mjs \
  --site example.wordpress.com \
  --token <bearer-token>

# WordPress Self-Hosted (Application Password)
node cms-seeds/seed-wordpress.mjs \
  --url https://example.com \
  --user admin \
  --app-password <app-password>

# Sanity (API Token mit Editor-Rechten aus sanity.io/manage → API → Tokens)
node cms-seeds/seed-sanity.mjs \
  --project-id <project-id> \
  --token <editor-token> \
  [--dataset production]

# Prismic (Permanent Access Token aus Settings → API & Security)
node cms-seeds/seed-prismic.mjs \
  --repository <repo-name> \
  --write-token <token> \
  --custom-types-token <token>

# TYPO3 (DDEV + MySQL — kein REST-API, braucht laufendes DDEV-Projekt)
bash cms-seeds/seed-typo3.sh \
  [--project-dir ~/Desktop/typo3-demo]

# DatoCMS (Full-Access API Token aus Settings → API Tokens)
node cms-seeds/seed-datocms.mjs \
  --token <full-access-api-token>

# Hygraph (PAT mit Management + Content API Permissions aus Settings → API Access → Permanent Auth Tokens)
node cms-seeds/seed-hygraph.mjs \
  --token <permanent-auth-token> \
  --project-id <project-id> \
  --region eu-west-2

# Payload (Admin-Account mit Schreibrechten)
node cms-seeds/seed-payload.mjs \
  --url http://localhost:3001 \
  --email <admin-email> \
  --password <admin-password>
```

##### Hinweise zu einzelnen CMS

| CMS | Token-Typ | Besonderheit |
|---|---|---|
| **Contentful** | CMA Token (Management API) | Erstellt Content-Types + Einträge + publiziert automatisch |
| **Storyblok** | Personal Access Token | Erstellt Components + Stories, publiziert automatisch |
| **WordPress** | Bearer Token (WP.com) oder App Password (Self-Hosted) | Autoren = WordPress-User-Accounts, können nicht per Script erstellt werden |
| **Sanity** | API Token (Editor-Rechte) | Dokumente sind **sofort live** — kein manuelles Publizieren nötig |
| **Prismic** | Permanent Access Token | Erstellt Custom Types + Dokumente als **Drafts** — nach dem Seed im Dashboard über "Migration release" publizieren |
| **TYPO3** | Kein Token | Schreibt direkt in die DDEV-MySQL-Datenbank, DDEV muss laufen |
| **DatoCMS** | Full-Access API Token | Erstellt Content-Models (idempotent) + Einträge, publiziert automatisch |
| **Hygraph** | Permanent Auth Token (Management + Content API) | Schema-Erstellung asynchron (Migration-Polling), Content über Public API, publiziert automatisch |
| **Payload** | Admin-Account (Email + Passwort) | JWT-Login, Lexical-Body als AST (nicht HTML), MongoDB muss lokal laufen, idempotent (löscht + erstellt neu) |

##### Nach dem Seed

1. `.env.local` auf das gesedte CMS umstellen (siehe Beispiele oben)
2. **Prismic:** Im Dashboard alle Dokumente über "Migration release" publizieren (CDN liefert nur Published Content)
3. `npm run dev` — die Seite sollte alle Demo-Inhalte anzeigen

#### Field Mapping

Wenn CMS-Felder anders heißen als die internen Keys:

```bash
CONTENTFUL_FIELD_MAP={"headline":"title","teaser":"description","body":"content"}
```

Unterstützte interne Keys: `headline`, `slug`, `teaser`, `body`, `image`, `category`, `author`, `tags`, `readingTimeMinutes`, `isPremium`, `paywall`, `isLive`, `isOpinion`, `isFeatured`, `isBreaking`, `aiSummary`, `region`.

#### Token-Scope pro CMS

| CMS | Minimaler Token-Typ |
|---|---|
| Contentful | **CDA Token** (Content Delivery API), NICHT CMA/Preview |
| Storyblok | **Public/Private Token** (CDN API) |
| DatoCMS | **Read-only API Token** |
| Sanity | Ohne Token = public dataset; mit Token = private/draft |
| Prismic | **Permanent Access Token** (optional bei public Repos) |
| Strapi | **API Token** (read-only Scope reicht) |
| Directus | **Static Token** (read-only Rolle reicht) |
| Hygraph | **Permanent Auth Token** (Content API, read-only) |
| Payload | **API Key** (User mit read-only Rolle) |
| WordPress | **App Password** (nur wenn Posts nicht public) |
| TYPO3 | Bearer Token (optional, nur bei geschützten Endpoints). Voraussetzung: EXT:headless + EXT:news |

#### Image-Domains

Für `next/image` Optimierung müssen externe CMS-CDN-Domains freigegeben werden:

```bash
CMS_IMAGE_DOMAINS=images.ctfassets.net,a.storyblok.com
```

**Selbst-gehostete CMS** (Strapi, Directus, Payload, TYPO3): Wenn die CMS-URL nicht `localhost` ist, muss die Domain ebenfalls in `CMS_IMAGE_DOMAINS` stehen. **Änderung erfordert Redeploy.**

#### CMS wechseln — Checkliste

1. `CMS_ADAPTER` und zugehörige Env Vars in `.env.local` ändern
2. `CMS_IMAGE_DOMAINS` auf neue CDN-Domain anpassen
3. Content-Modell prüfen: Articles, Categories, Authors als Collections/Content-Types anlegen
4. Pflichtfelder prüfen: `headline`, `slug`, `body` müssen existieren (oder per `FIELD_MAP` gemappt)
5. `npm run dev` starten — Health-Check im Terminal zeigt fehlende Inhalte
6. Revalidation-Webhook im CMS auf `/api/revalidate` mit `REVALIDATION_SECRET` einrichten
7. Redeploy (Vercel/Docker) — Env Vars dort ebenfalls setzen

#### Troubleshooting

| Problem | Lösung |
|---|---|
| Leere Seiten | `CMS_ADAPTER=mock` setzen — wenn Mock funktioniert, liegt es am CMS |
| "Unknown adapter" Error | Tippfehler in `CMS_ADAPTER`? Gültig: contentful, storyblok, datocms, sanity, prismic, strapi, directus, hygraph, payload, wordpress, typo3, mock |
| Leere Artikel (TYPO3) | EXT:news installiert? News-Seite unter `TYPO3_ARTICLE_PAGE` erreichbar? EXT:headless aktiviert? |
| Bilder fehlen (Strapi, lokal) | Next.js blockiert localhost-Bilder — der Adapter bypassed das automatisch. Wenn trotzdem leer: Strapi-Medien hochgeladen und veröffentlicht? |
| Author-Avatare fehlen (Strapi) | `populate=*` liefert keine verschachtelten Medien. Der Adapter nutzt bereits `populate=cover,category,author,author.avatar` — Avatare müssen in Strapi unter dem Author-Eintrag hochgeladen sein |
| "Multiple CMS env var sets" | Mehrere CMS-Vars gesetzt ohne explizites `CMS_ADAPTER` — einen setzen |
| Bilder laden nicht | `CMS_IMAGE_DOMAINS` prüfen, Redeploy nötig nach Änderung |
| Build bricht ab mit "NEXT_PUBLIC_" | Token-Leak-Schutz: CMS-Tokens dürfen NICHT mit `NEXT_PUBLIC_` beginnen |

#### Eigenen Adapter schreiben

Falls dein CMS nicht dabei ist: Die Datei `src/lib/cms/mock.adapter.ts` ist die einfachste Vorlage. Ein Adapter implementiert das `CmsAdapter`-Interface (17 Methoden in `types.ts`) und wird als `default export` bereitgestellt. Dann in `detect.ts` und `index.ts` registrieren — fertig.

#### Kommentare

Kommentare unter Artikeln sind Demo-Daten (aus Mock generiert) und werden nicht aus dem CMS geladen.

### Design Token System

Alle Farben als CSS Custom Properties in `:root` / `.dark` — keine hardcoded Tailwind-Farben:

```css
:root {
  --color-primary: #15803d;
  --color-primary-hover: color-mix(in srgb, #15803d, black 12%);
  /* 40+ Variablen für Light + Dark Mode */
}
```

Bridged zu Tailwind via `@theme inline` — Klassen wie `bg-(--color-primary)` funktionieren überall.

---

## Security

| Maßnahme | Detail |
|---|---|
| **Content Security Policy** | 8 Direktiven inkl. `frame-ancestors 'none'`, `object-src 'none'` |
| **HSTS** | `max-age=63072000; includeSubDomains; preload` (2 Jahre) |
| **XSS-Sanitization** | DOMPurify mit restriktiver Tag/Attribut-Allowlist, `ALLOW_DATA_ATTR: false` |
| **Zod-Validierung** | Alle API-Eingaben (Slugs, Suchbegriffe, Webhooks) schema-validiert |
| **Timing-Safe Auth** | `crypto.timingSafeEqual()` gegen Timing-Attacks auf Revalidation-Secret |
| **XML-Injection-Schutz** | RSS-Feed escaped `& < > " '` in CMS-Daten |
| **External Link Security** | Automatisches `rel="noopener noreferrer"` + Screen-Reader-Hinweis |
| **Error Message Security** | Keine Stack Traces oder DB-Strings in der UI — nur Digest-Referenzcodes |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=()` — Hardware-Zugriff gesperrt |

---

## Accessibility

| Feature | Implementierung |
|---|---|
| **Skip-Link** | Server Component, sichtbar bei Fokus, verlinkt auf `#main-content` |
| **Focus Trap** | Custom Hook (`useFocusTrap`) für Mobile-Menu — Tab/Shift+Tab gefangen, Escape schließt |
| **Focus Management** | Reset auf `#main-content` bei jeder Client-Navigation via `FocusManager` |
| **ARIA durchgehend** | `aria-live="polite"` auf Suchstatus, `role="alert"` auf Errors, `aria-current="page"` auf aktiver Navigation, `aria-expanded` + `aria-controls` auf Mobile-Menu |
| **Keyboard-Navigation** | Escape schließt Menu, Focus Return zum Trigger, Click-Outside-Handler |
| **Reduced Motion** | Globale `prefers-reduced-motion` Media Query — alle Animationen deaktiviert |
| **Focus-Visible Styles** | Einheitlicher `outline: 2px solid` auf allen interaktiven Elementen |
| **Semantisches HTML** | `<article>`, `<nav>`, `<aside>`, `<time dateTime>`, `<figure>`, konfigurierbares `headingLevel` |
| **Screen-Reader-Support** | `.sr-only` Texte für Zähler, Labels, externe Links ("öffnet in neuem Tab") |
| **Scroll Margin** | `scroll-margin-top: 5rem` auf `[id]`-Elementen für Ankerlinks unter dem Header |

---

## SEO

| Feature | Detail |
|---|---|
| **JSON-LD** | 3 Schema-Typen: `Article` (Headline, Author, Publisher), `CollectionPage`, `Person` |
| **OpenGraph** | Pro Seite: Titel, Beschreibung, Bilder mit Dimensionen, `type: "article"` mit `publishedTime` |
| **Twitter Cards** | `summary_large_image` auf allen Seiten |
| **Sitemap** | Dynamisch generiert aus CMS-Daten, mit `changeFrequency` und `priority` |
| **RSS-Feed** | RSS 2.0 mit Dublin Core (`dc:creator`), Atom Self-Link, 1h Cache |
| **Static Generation** | `generateStaticParams` auf allen dynamischen Routen — Build-Time Pre-Rendering |
| **Metadata** | `metadataBase` für absolute URLs, `title.template` für konsistente Seitentitel, `lang="de"` |

---

## Performance

| Optimierung | Detail |
|---|---|
| **React Compiler** | Automatische Memoization — kein manuelles `useMemo`/`useCallback` nötig |
| **`"use cache"`** | 17 Funktionen im Data Layer mit granularem `cacheLife` + `cacheTag` |
| **Cache Components** | `cacheComponents: true` in `next.config.ts` |
| **On-Demand Revalidation** | Webhook-Endpoint `/api/revalidate` mit `revalidateTag()` — CMS-Adapter-Tags für selektive Invalidierung |
| **Paralleles Fetching** | `Promise.all()` auf Homepage (3 Calls), Kategorie, Autor, Sitemap |
| **Font Optimization** | `next/font/google` mit `display: "swap"` und CSS Variables |
| **Image Optimization** | `next/image` via `SafeImage` Wrapper mit Error-Fallback, `sizes`, `priority` |
| **Turbopack** | Dev-Server mit `--turbopack` für schnelle HMR |
| **CSS color-mix()** | Farbvarianten browser-nativ berechnet — zero runtime cost |

---

## Error Handling (5-Schicht-System)

```
1. Global Error Boundary    → Fängt Root-Layout-Fehler, rendert eigenes HTML-Shell
2. Route Error Boundary     → Retry mit Limit (max 3), Countdown sichtbar
3. Per-Route Error Pages    → Kontextuelle Meldungen ("Artikel konnte nicht geladen werden")
4. Component Error States   → Inline-Fehler mit optionalem Retry-Callback
5. Global Error Reporter    → Fängt unhandled Rejections + window.onerror
```

Alle Error Boundaries nutzen `role="alert"` und zeigen nur Digest-Referenzcodes — keine sensiblen Daten.
CMS-Ausfälle werden graceful abgefangen (Sitemap/RSS liefern Fallback-Daten statt 500er).

---

## Dark Mode (Flash-frei)

Drei-Schicht-System verhindert White Flash beim Laden:

1. **Blocking Inline Script** — Liest `localStorage` + `matchMedia` und setzt `.dark` Klasse **vor dem First Paint**
2. **ThemeProvider (React Context)** — Synchronisiert State, persistiert Auswahl, lauscht auf System-Änderungen live
3. **40+ CSS Custom Properties** — Vollständiges Dual-Token-System für Light + Dark

---

## Testing

**61+ Testdateien · 500+ Test Cases · 0 Failures**

```bash
npm test              # Watch-Mode (Entwicklung)
npm run test:run      # Single Run (CI)
npm run lint          # ESLint (0 Errors)
npx tsc --noEmit      # TypeScript-Check
```

### Abdeckung

| Bereich | Dateien | Was getestet wird |
|---|---|---|
| Components | 15 | Rendering, Interaktion, Error/Loading States |
| UI Primitives | 7 | SafeImage, SanitizedHtml, SkipLink, Badges, Tags |
| Pages | 10 | Homepage, Artikel, Kategorie, Autor, Suche, 404 |
| API Routes | 2 | Revalidation, Search mit Validierung + Edge Cases |
| CMS-Adapter | 9 | HTTP, Sanitization, Detection, Field Mapping, Image Utils, Adapter-Tests |
| Lib/Utils | 11 | Schemas, Formatierung, Security Headers, JSON-LD, Navigation |
| Hooks | 1 | Focus Trap Verhalten mit Cleanup |
| Infrastruktur | 2 | Proxy/Middleware, Error Boundaries |

### Test-Qualität

- **222 accessible Queries** (`getByRole`, `getByLabelText`, `getByText`) — nur 1x `getByTestId`
- **39 `userEvent` Aufrufe** für realistische Benutzerinteraktionen
- **CI Pipeline** (`ci.yml`): Lint → TypeScript → Vitest → Build bei jedem Push

---

## Projektstruktur

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Startseite (Hero, Artikelliste, Newsticker)
│   ├── artikel/[slug]/           # Artikel-Detail mit JSON-LD + OG
│   ├── kategorie/[slug]/         # Kategorie-Übersicht
│   ├── autor/[slug]/             # Autoren-Profil + Artikelliste
│   ├── suche/                    # Volltextsuche mit Debouncing
│   ├── api/revalidate/           # CMS-Webhook für On-Demand ISR
│   ├── api/search/               # Such-API mit Zod-Validierung
│   └── feed.xml/                 # RSS 2.0 Feed
│
├── components/
│   ├── ui/                       # Primitives (SafeImage, SanitizedHtml, SkipLink, ...)
│   ├── layout/                   # Navigation mit Focus Trap
│   ├── AppHeader.tsx             # Header + Suche + Dark Mode Toggle
│   ├── AppFooter.tsx             # Footer mit Social Links
│   ├── ArticleCard.tsx           # 3 Varianten (Hero, Default, Compact)
│   ├── SearchClient.tsx          # Live-Suche mit useTransition
│   ├── ThemeProvider.tsx         # Dark Mode (System + Manual)
│   └── ErrorReporter.tsx         # Globaler Error Handler
│
├── hooks/
│   └── useFocusTrap.ts           # Tab/Escape/Focus-Return
│
├── lib/
│   ├── data.ts                   # "use cache" Data Layer (17 cached Functions)
│   ├── mock.ts                   # Mock-Daten für lokale Entwicklung
│   ├── cms/                      # CMS-Adapter-System
│   │   ├── index.ts              # Adapter-Loader (switch/case, server-only)
│   │   ├── detect.ts             # Auto-Detection + Circuit-Breaker + Health-Check
│   │   ├── types.ts              # CmsAdapter Interface (17 Methoden)
│   │   ├── http.ts               # safeFetch, SSRF-Schutz, Retry, Error-Sanitization
│   │   ├── sanitize.ts           # Rich-Text-Sanitization (sanitize-html)
│   │   ├── defaults.ts           # Fallback-Werte für non-essential Content
│   │   └── *.adapter.ts          # 11 CMS-Adapter + Mock-Adapter
│   ├── schemas.ts                # Zod-Schemas für API-Validierung
│   ├── json-ld.ts                # Strukturierte Daten (3 Schema-Typen)
│   ├── security-headers.ts       # CSP, HSTS, X-Frame, Permissions-Policy
│   └── parseResponse.ts          # Runtime-Validierung gegen CMS-Schema-Drift
│
├── types/
│   └── index.ts                  # 20+ TypeScript Interfaces
│
└── docs/                         # Handoff-Dokumentation (DE + EN)
    ├── CLIENT_GUIDE_{DE,EN}.md
    ├── DEPLOY_GUIDE_{DE,EN}.md
    ├── DEVELOPER_HANDOFF_{DE,EN}.md
    └── SECURITY_OVERVIEW_{DE,EN}.md
```

---

## Deployment

Das Projekt ist für Vercel konfiguriert und deployed automatisch bei Push auf `main`:

```bash
vercel              # Preview-Deployment
vercel --prod       # Production-Deployment
```

---

## Lizenz

MIT
