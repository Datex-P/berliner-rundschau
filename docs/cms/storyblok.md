# Storyblok — Adapter-Guide

> SaaS Headless CMS mit Visual Editor. SDK-basierter Adapter über `storyblok-js-client`.

## Voraussetzungen

- Storyblok-Account mit Space
- Access Token (Public oder Private)

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=storyblok
STORYBLOK_ACCESS_TOKEN=your-token
CMS_IMAGE_DOMAINS=a.storyblok.com
```

## Demo-Daten (Seed Script)

```bash
node cms-seeds/seed-storyblok.mjs --space-id <space-id> --token <personal-access-token>
```

- **Token-Typ:** Personal Access Token von app.storyblok.com → My Account
- Erstellt Components + Stories, publiziert automatisch
- Idempotent

## Besonderheiten

- **SDK-basiert:** Adapter nutzt `storyblok-js-client`
- **Asset-CDN:** Bilder über `a.storyblok.com`
- **Visual Editor:** Storyblok hat einen integrierten Visual Editor — für Preview muss die App als Storyblok-Preview-URL konfiguriert werden
- **Stories als Content:** Artikel sind "Stories" mit einem definierten Content-Type (Component)

## Troubleshooting

| Problem | Lösung |
|---|---|
| Bilder fehlen | `CMS_IMAGE_DOMAINS=a.storyblok.com` gesetzt? |
| Leere Daten | Token-Typ prüfen — Public Token reicht für published Content |
