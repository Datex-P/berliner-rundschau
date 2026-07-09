# Hygraph — Adapter-Guide

> SaaS Headless CMS (ehemals GraphCMS). Ausschließlich GraphQL API.

## Voraussetzungen

- Hygraph-Account mit Projekt
- Content API Endpoint (Permanent Auth Token oder Public API)
- Optional: Management API Token für Seed-Script

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=hygraph
HYGRAPH_ENDPOINT=https://api-eu-central-1.hygraph.com/v2/your-project-id/master
# HYGRAPH_TOKEN=                  # nur bei Permanent Auth Token
CMS_IMAGE_DOMAINS=media.graphassets.com
```

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-hygraph.mjs --endpoint <content-api-endpoint> --token <management-api-token>
```

- **Token-Typ:** Management API Token (Settings → API Access → Permanent Auth Tokens) mit `Mutations`-Permission
- Content API Endpoint aus Settings → API Access → Content API
- Erstellt Schema + Content via GraphQL Mutations
- Idempotent

## Besonderheiten

- **GraphQL-only:** Hygraph hat keine REST API — alle Abfragen und Mutationen über GraphQL
- **Rich Text als AST:** Body-Feld als Hygraph Rich Text (AST-Format) — der Adapter konvertiert zu HTML
- **Asset-CDN:** Bilder über `media.graphassets.com`
- **Stages:** Hygraph unterstützt Content Stages (DRAFT, PUBLISHED) — nur PUBLISHED wird über die Content API geliefert
- **Lokalisierung:** Multi-Locale Support nativ eingebaut

## Troubleshooting

| Problem | Lösung |
|---|---|
| 401 / Unauthorized | Token als Permanent Auth Token mit Lese-Permissions? |
| Bilder fehlen | `CMS_IMAGE_DOMAINS=media.graphassets.com` gesetzt? |
| Leere Daten | Content auf Stage PUBLISHED? Draft-Content nur mit Draft-Token |
| GraphQL-Fehler | Endpoint korrekt? Format: `https://api-{region}.hygraph.com/v2/{id}/master` |
