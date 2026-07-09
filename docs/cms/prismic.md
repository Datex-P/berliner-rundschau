# Prismic — Adapter-Guide

> SaaS Headless CMS mit Document-basiertem Content-Modell. REST + GraphQL API.

## Voraussetzungen

- Prismic-Repository
- Access Token (falls Repository nicht public)

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=prismic
PRISMIC_REPO=your-repo-name
# PRISMIC_ACCESS_TOKEN=           # nur bei privaten Repos
CMS_IMAGE_DOMAINS=images.prismic.io
```

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-prismic.mjs --repo <repo-name> --write-token <write-api-token>
```

- **Token-Typ:** Write API Token (Settings → API & Security → Generate a Write Token)
- Content API Token (Read) reicht nicht für das Seed-Script
- Erstellt Custom Types + Documents + publiziert
- Idempotent

## Besonderheiten

- **Document-basiert:** Content ist in "Documents" mit Custom Types organisiert — jeder Custom Type definiert die Felder
- **Rich Text als Slices:** Body-Feld als Prismic Rich Text (proprietäres Format) — der Adapter konvertiert zu HTML
- **CDN-Bilder:** Bilder über `images.prismic.io`
- **Predicates-API:** Abfragen über Predicates (`at`, `fulltext`, `similar`) statt SQL/GROQ
- **Ref-basiert:** Jede API-Abfrage braucht eine `ref` (Master-Ref für published Content)

## Troubleshooting

| Problem | Lösung |
|---|---|
| Leere Ergebnisse | Repository-Name korrekt? Content published? |
| Bilder fehlen | `CMS_IMAGE_DOMAINS=images.prismic.io` gesetzt? |
| 403 Forbidden | Access Token nötig? Unter Settings → API & Security prüfen |
