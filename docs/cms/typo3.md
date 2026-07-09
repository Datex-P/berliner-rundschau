# TYPO3 — Adapter-Guide

> TYPO3 mit EXT:headless + EXT:news. Kein eigener API-Endpoint — JSON über Seiten-URLs.

## Voraussetzungen

- TYPO3-Instanz mit folgenden Extensions:
  - [EXT:headless](https://extensions.typo3.org/extension/headless) — aktiviert JSON-Modus
  - [EXT:news](https://extensions.typo3.org/extension/news) — stellt News-Artikel bereit
  - [friendsoftypo3/headless_news](https://github.com/TYPO3-Headless/headless_news) — serialisiert News ins JSON-Format
- Optional: Bearer Token für geschützte Endpoints

## Konfiguration (.env.local)

```bash
CMS_ADAPTER=typo3
TYPO3_URL=https://cms.example.de
# TYPO3_API_TOKEN=              # nur bei geschützten Endpoints
# TYPO3_ARTICLE_PAGE=/news      # Slug der News-Listenseite (Default: /news)
# TYPO3_LANG_PREFIX=/en         # bei mehrsprachigen Instanzen
# TYPO3_FIELD_MAP={}            # Custom-Felder remappen
CMS_IMAGE_DOMAINS=cms.example.de
```

## Demo-Daten (Seed Script)

```bash
bash cms-seeds/seed-typo3.sh --project-dir ~/Desktop/typo3-demo
```

- **Kein Token nötig:** Schreibt direkt in die DDEV-MySQL-Datenbank
- DDEV muss laufen

## Besonderheiten

- **Kein eigener API-Endpoint:** EXT:headless liefert JSON direkt über die Seiten-URL (`/news` statt `/api/articles`)
- **News-Artikel aus Content-Spalten:** Artikel werden aus `content.colPos*`-Spalten der Seite extrahiert (Content-Elemente mit `type: "news_pi1"`)
- **Synthetische Autoren:** Authors kommen als Objekt `{author, authorEmail}` — der Adapter erzeugt daraus synthetische Author-Objekte
- **Kategorien aus News:** Categories werden aus den News-Items gesammelt und dedupliziert
- **Client-seitige Suche:** Suche über Headline + Teaser — für >200 Artikel wird [EXT:solr](https://extensions.typo3.org/extension/solr) empfohlen

## Troubleshooting

| Problem | Lösung |
|---|---|
| Leere Artikel | EXT:news installiert? News-Seite unter `TYPO3_ARTICLE_PAGE` erreichbar? |
| JSON statt HTML kommt nicht | EXT:headless aktiviert? |
| Bilder fehlen | TYPO3-Domain in `CMS_IMAGE_DOMAINS`? |
