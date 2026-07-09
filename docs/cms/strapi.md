# Strapi — Adapter-Guide

> Self-Hosted Headless CMS (Node.js). REST + GraphQL API mit Admin-Panel.

## Voraussetzungen

- Strapi-Instanz (lokal oder gehostet)
- API Token mit Lesezugriff

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=strapi
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your-api-token
CMS_IMAGE_DOMAINS=localhost
```

Bei gehosteter Instanz: `localhost` durch die Domain ersetzen.

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-strapi.mjs --url http://localhost:1337 --token <admin-api-token>
```

- **Token-Typ:** Full-Access API Token (Settings → API Tokens → Create)
- Erstellt Content-Types existieren bereits (müssen im Admin-Panel angelegt sein)
- Erstellt Einträge + publiziert
- Idempotent

## Besonderheiten

- **Collection Types:** Content-Types müssen VOR dem Seed im Admin-Panel oder per CLI angelegt werden — Strapi hat keine Schema-API wie Directus
- **Rich Text:** Body als Markdown — der Adapter konvertiert zu HTML
- **Media Library:** Bilder werden über die Media Library verwaltet — Upload via REST API
- **Populate:** Relations müssen explizit mit `populate=*` oder `populate[relation]=*` angefragt werden (Standard: keine Relations)
- **Draft/Publish:** Strapi hat ein eingebautes Draft-System — nur published Content wird über die API geliefert (Default)

## Troubleshooting

| Problem | Lösung |
|---|---|
| 401 / Forbidden | API Token mit korrekten Permissions? Mindestens `find` + `findOne` |
| Relations leer | `populate` Parameter gesetzt? `populate=*` für alle Relations |
| Bilder fehlen | `CMS_IMAGE_DOMAINS` auf die Strapi-Domain gesetzt? |
| Content-Types fehlen | Types müssen vor dem Seed im Admin-Panel angelegt werden |
