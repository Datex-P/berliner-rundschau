# DatoCMS — Adapter-Guide

> SaaS Headless CMS mit GraphQL API. Adapter nutzt die Content Delivery API (CDA).

## Voraussetzungen

- DatoCMS-Account mit Projekt
- Read-Only API Token (CDA) für Lesezugriff
- Full-Access API Token für Seed-Script

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=datocms
DATOCMS_API_TOKEN=your-read-only-token
CMS_IMAGE_DOMAINS=www.datocms-assets.com
```

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-datocms.mjs --token <full-access-api-token>
```

- **Token-Typ:** Full-Access API Token (Settings → API Tokens) — nicht Read-Only
- Erstellt Models + Records + publiziert automatisch
- Idempotent

## Besonderheiten

- **GraphQL-only:** DatoCMS hat keine REST API für Content — der Adapter nutzt die GraphQL CDA
- **Structured Text:** Body-Feld als DatoCMS Structured Text (DAST) — der Adapter konvertiert zu HTML
- **Responsive Images:** DatoCMS liefert `responsiveImage` mit srcSet — der Adapter mappt das auf die interne Bild-Struktur
- **Lokalisierung:** DatoCMS unterstützt Multi-Locale nativ — bei Bedarf `DATOCMS_LOCALE` setzen
- **Slug-basierte Abfragen:** Einzelne Artikel werden über `filter: { slug: { eq: "..." } }` abgefragt

## Troubleshooting

| Problem | Lösung |
|---|---|
| 401 / Unauthorized | Read-Only Token (nicht Full-Access) für die App verwenden |
| Bilder fehlen | `CMS_IMAGE_DOMAINS=www.datocms-assets.com` gesetzt? |
| Leere Artikel | Content published? Draft-Content nur mit Preview-Token sichtbar |
| Structured Text nicht gerendert | `@datocms/structured-text-to-html-string` installiert? |
