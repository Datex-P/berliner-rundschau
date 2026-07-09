# Contentful — Adapter-Guide

> SaaS Headless CMS mit GraphQL + REST API. SDK-basierter Adapter über `contentful`.

## Voraussetzungen

- Contentful-Account mit Space
- CDA Token (Content Delivery API) für Lesezugriff
- Optional: CMA Token (Content Management API) für Seed-Script

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=contentful
CONTENTFUL_SPACE_ID=your-space-id
CONTENTFUL_ACCESS_TOKEN=your-cda-token
CMS_IMAGE_DOMAINS=images.ctfassets.net
```

Optional: Field Mapping wenn CMS-Felder anders heißen als die internen Keys:

```bash
CONTENTFUL_FIELD_MAP={"headline":"title","teaser":"excerpt","image":"heroImage","isFeatured":"featured"}
```

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-contentful.mjs --space-id <space-id> --management-token <cma-token>
```

Optional: `--environment master` (Default)

- **Token-Typ:** CMA Token (Management API) von https://app.contentful.com/account/profile/cma_tokens
- Erstellt Content-Types + Einträge + publiziert automatisch
- Idempotent — wiederholtes Ausführen ist sicher

## Besonderheiten

- **SDK-basiert:** Adapter nutzt das offizielle `contentful` SDK (nicht raw REST)
- **Asset-CDN:** Bilder über `images.ctfassets.net` — Domain muss in `CMS_IMAGE_DOMAINS` stehen
- **Rich Text:** Body als Contentful Rich Text JSON. Der Adapter konvertiert zu HTML
- **Environments:** Optional ein anderes Environment als `master` über `CONTENTFUL_ENVIRONMENT` Env Var

## Troubleshooting

| Problem | Lösung |
|---|---|
| Bilder fehlen | `CMS_IMAGE_DOMAINS=images.ctfassets.net` gesetzt? |
| Leere Artikel | CDA Token korrekt? Content published? |
| Falsche Feldnamen | `CONTENTFUL_FIELD_MAP` prüfen — Contentful-Felder auf interne Keys mappen |
