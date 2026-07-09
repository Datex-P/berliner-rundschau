# WordPress — Adapter-Guide

> WordPress REST API (WP-JSON). Funktioniert mit jeder WordPress-Installation — keine Plugins nötig.

## Voraussetzungen

- WordPress-Instanz (WordPress.com oder Self-Hosted) mit aktivierter REST API
- Optional: App Password oder Bearer Token für geschützte Inhalte

## Konfiguration (.env.local)

```bash
# WordPress.com
CMS_ADAPTER=wordpress
WORDPRESS_URL=https://example.wordpress.com
WORDPRESS_API_BASE=https://public-api.wordpress.com/wp/v2/sites/example.wordpress.com
CMS_IMAGE_DOMAINS=example.wordpress.com,wp.com,i0.wp.com,secure.gravatar.com

# WordPress Self-Hosted
CMS_ADAPTER=wordpress
WORDPRESS_URL=https://example.com
# Auth nur nötig wenn Posts nicht public:
# WORDPRESS_USERNAME=user
# WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

## Demo-Daten (Seed Script)

```bash
# WordPress.com (OAuth2 Bearer Token)
node cms-seeds/seed-wordpress.mjs --site example.wordpress.com --token <bearer-token>

# WordPress Self-Hosted (Application Password)
node cms-seeds/seed-wordpress.mjs --url https://example.com --user admin --app-password <app-password>
```

- **WordPress.com:** Bearer Token für Schreibzugriff
- **Self-Hosted:** Application Password (unter Users → Edit → Application Passwords)
- Autoren = WordPress-User-Accounts, können nicht per Script erstellt werden

## Besonderheiten

- **Keine Plugins nötig:** WP REST API ist in WordPress eingebaut
- **Image-Domains:** WordPress.com nutzt mehrere CDN-Domains (`wp.com`, `i0.wp.com`, `secure.gravatar.com`) — alle müssen in `CMS_IMAGE_DOMAINS` stehen
- **Autoren:** WordPress-User-Accounts — nicht über die REST API erstellbar, nur über das Dashboard
- **Kategorien:** WordPress hat eingebaute Taxonomien — Categories werden direkt genutzt

## Troubleshooting

| Problem | Lösung |
|---|---|
| 401 Unauthorized | App Password korrekt? Format: `xxxx-xxxx-xxxx-xxxx` |
| Bilder fehlen | Alle CDN-Domains in `CMS_IMAGE_DOMAINS`? Bei WP.com: `wp.com,i0.wp.com` |
| Autoren fehlen | Autoren sind WP-User — müssen im Dashboard angelegt werden |
