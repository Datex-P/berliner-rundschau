# Sanity — Adapter-Guide

> SaaS Headless CMS mit GROQ-Query-Sprache. Echtzeit-Datenbank mit CDN.

## Voraussetzungen

- Sanity-Account mit Projekt
- Project ID + Dataset Name
- Optional: API Token für private Datasets

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=sanity
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
# SANITY_API_TOKEN=               # nur bei privaten Datasets
# SANITY_API_VERSION=2024-01-01   # optional, Default: aktuelle Version
CMS_IMAGE_DOMAINS=cdn.sanity.io
```

## Demo-Daten (Seed Script)

```bash
# Erfordert vorheriges Login: sanity login (interaktiv im Browser)
node cms-seeds/seed-sanity.mjs --project-id <project-id> --dataset production
```

- **Auth:** Nutzt das Sanity CLI Token (`sanity login` muss vorher ausgeführt werden)
- Erstellt Documents via Mutations API
- Idempotent

## Besonderheiten

- **GROQ statt GraphQL/REST:** Sanity nutzt GROQ (Graph-Relational Object Queries) — eine eigene Query-Sprache
- **Portable Text:** Body als Portable Text (Block Content) — der Adapter konvertiert zu HTML via `@portabletext/to-html`
- **Image Pipeline:** Bilder über `cdn.sanity.io` mit On-the-fly-Transformationen (Crop, Hotspot, Resize)
- **Echtzeit:** Sanity Listener API ermöglicht Live-Updates (nicht im Adapter genutzt)
- **Kein `sanity login` im Script:** Der Login ist interaktiv (Browser-Auth) und muss manuell ausgeführt werden

## Troubleshooting

| Problem | Lösung |
|---|---|
| 401 / Unauthorized | `sanity login` ausgeführt? Token gültig? |
| Bilder fehlen | `CMS_IMAGE_DOMAINS=cdn.sanity.io` gesetzt? |
| GROQ-Fehler | Query-Syntax prüfen — GROQ ≠ GraphQL |
