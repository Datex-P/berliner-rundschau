# Payload — Adapter-Guide

> Self-Hosted Headless CMS (Node.js/TypeScript). REST + GraphQL API.

## Voraussetzungen

- Payload-Instanz (Node.js)
- API Key oder Bearer Token mit Lesezugriff

## Setup (lokal)

```bash
npx create-payload-app@latest payload-demo
cd payload-demo
npm run dev
# Admin-Panel: http://localhost:3001/admin
```

**Port-Hinweis:** Payload läuft standardmäßig auf Port 3000 — bei paralleler Nutzung mit der Berliner Rundschau den Port in `server.ts` auf z.B. 3001 ändern.

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=payload
PAYLOAD_URL=http://localhost:3001
PAYLOAD_API_KEY=your-api-key
CMS_IMAGE_DOMAINS=localhost
```

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-payload.mjs --url http://localhost:3001 --api-key <api-key>
```

- **Token-Typ:** API Key (Settings → API Keys im Admin-Panel)
- Collections müssen VOR dem Seed in `payload.config.ts` definiert sein
- Erstellt Einträge via REST API
- Idempotent

## Besonderheiten

- **TypeScript-first:** Collections werden in `payload.config.ts` als TypeScript definiert — nicht über eine UI
- **Port-Konflikt:** Payload nutzt standardmäßig Port 3000 wie Next.js — bei paralleler Nutzung Port ändern
- **Rich Text = Slate/Lexical:** Body als Slate oder Lexical Editor Format — der Adapter konvertiert zu HTML
- **Upload Collection:** Bilder werden über eine Upload-Collection verwaltet — Media ist eine eigene Collection
- **MongoDB/Postgres:** Payload unterstützt MongoDB oder PostgreSQL als Datenbank
- **Auto-Generated Types:** `payload generate:types` erstellt TypeScript-Interfaces aus den Collections

## Troubleshooting

| Problem | Lösung |
|---|---|
| Port belegt | Port in `server.ts` ändern (z.B. 3001) |
| 401 Unauthorized | API Key korrekt? Enable API Keys in der Collection-Config |
| Collections leer | Collections in `payload.config.ts` definiert? `npm run dev` nach Änderungen neu starten |
| Bilder fehlen | `CMS_IMAGE_DOMAINS=localhost` (oder Domain) gesetzt? |
| MongoDB Connection Error | MongoDB läuft? `brew services start mongodb-community` |
