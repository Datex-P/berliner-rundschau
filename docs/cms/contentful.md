# Contentful — Adapter-Guide

> SaaS Headless CMS mit GraphQL + REST API. SDK-basierter Adapter über `contentful`.

## Voraussetzungen

- Contentful-Account mit Space
- CMA Token (Content Management API) für Seed-Script — von https://app.contentful.com/account/profile/cma_tokens
- Nach Erstellung den Token für deinen Space **autorisieren** (Button "Authorize" in der Token-Liste)

## 1. Demo-Daten erstellen

```bash
node cms-seeds/seed-contentful.mjs --space-id <space-id> --management-token <cma-token>
```

Optional: `--environment master` (Default)

- Erstellt Content-Types + Einträge + publiziert automatisch
- Idempotent — wiederholtes Ausführen ist sicher
- **Am Ende gibt das Script die exakten `.env.local`-Werte aus** — einfach kopieren

## 2. Konfiguration (.env.local)

Die Ausgabe vom Seed-Script in `.env.local` eintragen:

```bash
CMS_ADAPTER=contentful
CONTENTFUL_SPACE_ID=<deine-space-id>
CONTENTFUL_ACCESS_TOKEN=<dein-cda-token>
CMS_IMAGE_DOMAINS=images.ctfassets.net
CONTENTFUL_FIELD_MAP={"headline":"title","teaser":"excerpt","image":"heroImage","isFeatured":"featured"}
```

Den **CDA Token** (Content Delivery API) findest du unter: Settings → API Keys → dein Key. Das ist ein anderer Token als der CMA Token vom Seed-Script.

## 3. Starten

```bash
npm run dev
# → http://localhost:3000
```

## Besonderheiten

- **SDK-basiert:** Adapter nutzt das offizielle `contentful` SDK (nicht raw REST)
- **Asset-CDN:** Bilder über `images.ctfassets.net` — Domain muss in `CMS_IMAGE_DOMAINS` stehen
- **Rich Text:** Body als Contentful Rich Text JSON. Der Adapter konvertiert zu HTML
- **Zwei Token-Typen:** CDA Token (Lesen, für die App) und CMA Token (Schreiben, für Seed-Script) — nicht verwechseln
- **Environments:** Optional ein anderes Environment als `master` über `CONTENTFUL_ENVIRONMENT` Env Var

## Troubleshooting

| Problem | Lösung |
|---|---|
| `OrganizationAccessGrantRequired` | CMA Token muss für den Space autorisiert werden (Button "Authorize") |
| `Access token invalid` beim Seed | CDA Token statt CMA Token verwendet? CMA Token von Profil-Seite holen |
| Bilder fehlen | `CMS_IMAGE_DOMAINS=images.ctfassets.net` gesetzt? |
| Leere Artikel | CDA Token korrekt? Content published? |
| Falsche Feldnamen | `CONTENTFUL_FIELD_MAP` prüfen — Contentful-Felder auf interne Keys mappen |
