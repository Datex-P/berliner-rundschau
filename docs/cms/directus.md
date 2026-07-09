# Directus — Adapter-Guide

> Self-Hosted Headless CMS mit REST + GraphQL API. Docker empfohlen (SQLite oder PostgreSQL).

## Voraussetzungen

- Directus-Instanz (Docker empfohlen)
- Static Admin Token oder Bearer Token

## Setup (Docker)

```bash
mkdir directus-demo && cd directus-demo
```

`docker-compose.yml`:

```yaml
services:
  directus:
    image: directus/directus:11
    ports:
      - "8055:8055"
    environment:
      SECRET: "ein-zufaelliger-secret-string"
      ADMIN_EMAIL: "admin@example.com"
      ADMIN_PASSWORD: "admin1234"
      ADMIN_TOKEN: "directus-demo-static-token"
      DB_CLIENT: "sqlite3"
      DB_FILENAME: "/directus/database/database.sqlite"
      CORS_ENABLED: "true"
      CORS_ORIGIN: "true"
    volumes:
      - ./database:/directus/database
      - ./uploads:/directus/uploads
```

```bash
docker compose up -d
# Admin-Panel: http://localhost:8055
```

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=directus
DIRECTUS_URL=http://localhost:8055
DIRECTUS_STATIC_TOKEN=directus-demo-static-token
CMS_IMAGE_DOMAINS=images.unsplash.com
```

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-directus.mjs --url http://localhost:8055 --token directus-demo-static-token
```

- **Token-Typ:** Static Admin Token (`ADMIN_TOKEN` in Docker Compose)
- Erstellt Collections + Felder + Relationen + Demo-Daten via Schema API
- Idempotent — löscht und erstellt Collections bei erneutem Lauf
- 10 Collections: articles, categories, authors, navigation, siteConfig, breakingNews, newsticker, videos, quizzes, stockData

## Besonderheiten

- **Docker empfohlen:** SQLite für lokales Testing, PostgreSQL für Produktion
- **Keine automatischen Systemfelder:** `date_created` / `date_updated` werden NICHT automatisch erstellt — müssen explizit mit `special: ["date-created"]` angelegt werden
- **M2O-Relationen separat:** `POST /fields/{collection}` akzeptiert kein `relation`-Feld im Body — Relationen müssen über `POST /relations` erstellt werden
- **Rich Text = HTML:** Directus speichert Rich Text direkt als HTML (kein Markdown, kein Structured Text)
- **Dot-Notation für Relations:** `fields=*,category.*,author.*` statt `depth`-Parameter
- **Response-Envelope:** Alle Antworten in `{ data: [...], meta: { total_count } }` — `data` muss ausgepackt werden
- **Duale Bild-Strategie:** Upload-Relation-Feld + `imageUrl`/`avatarUrl` Text-Feld als Fallback für Seed-Daten mit externen URLs
- **CORS manuell:** `CORS_ENABLED=true` + `CORS_ORIGIN=true` in Docker Compose setzen

## Troubleshooting

| Problem | Lösung |
|---|---|
| 403 Permission denied | Token korrekt? Static Token = `ADMIN_TOKEN` aus Docker Compose |
| `date_created` fehlt | Systemfelder explizit anlegen — passiert nicht automatisch |
| `"relation" is not allowed` | M2O-Relation über `POST /relations` erstellen, nicht im Feld-Payload |
| `limit must be a number` | Doppelten `limit`-Parameter in der URL prüfen |
| CORS-Fehler | `CORS_ENABLED` + `CORS_ORIGIN` in Docker Compose auf `true`? |
| Bilder fehlen | Bei externen URLs: Domain in `CMS_IMAGE_DOMAINS` eintragen |
