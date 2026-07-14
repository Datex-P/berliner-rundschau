#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# seed-typo3.sh — Berliner Rundschau Demo-Inhalte für TYPO3
# ══════════════════════════════════════════════════════════════
#
# Erstellt die gleichen 8 Artikel, 6 Kategorien und 8 Bilder
# wie seed-contentful.mjs, seed-storyblok.mjs und seed-wordpress.mjs.
#
# TYPO3-Besonderheit: Kein REST-API für Content-Erstellung.
# Dieses Script nutzt ddev mysql (Datenbank) und ddev exec (Dateisystem).
#
# Voraussetzungen:
#   - DDEV installiert und TYPO3-Projekt gestartet (ddev start)
#   - EXT:news + headless + headless_news installiert
#   - News-Seite existiert (pid=2, Slug "/news")
#
# Aufruf:
#   bash cms-seeds/seed-typo3.sh [--project-dir ~/Desktop/typo3-demo]
#
# Idempotent: Löscht bestehende Seed-Daten und erstellt sie neu.
# ══════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="$HOME/Desktop/typo3-demo"

while [[ $# -gt 0 ]]; do
  case $1 in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) echo "Unbekannter Parameter: $1"; exit 1 ;;
  esac
done

if [[ ! -d "$PROJECT_DIR/.ddev" ]]; then
  echo "❌ Kein DDEV-Projekt in $PROJECT_DIR gefunden."
  exit 1
fi

cd "$PROJECT_DIR"

# Prüfen ob DDEV läuft
if ! ddev describe >/dev/null 2>&1; then
  echo "❌ DDEV-Projekt ist nicht gestartet. Bitte 'ddev start' ausführen."
  exit 1
fi

echo "🔄 TYPO3 Seed: Starte Seeding in $PROJECT_DIR ..."

# ── Zeitstempel (Unix, Sekunden) ──
NOW=$(date +%s)
DAY=$((86400))

# Artikel-Daten: datetime wird gestaffelt (neuester zuerst)
DT1=$((NOW - DAY * 1))   # Verkehrsstrategie
DT2=$((NOW - DAY * 2))   # Start-up Boom
DT3=$((NOW - DAY * 3))   # Kulturhauptstadt
DT4=$((NOW - DAY * 4))   # Hertha BSC
DT5=$((NOW - DAY * 5))   # Wohnungsmarkt
DT6=$((NOW - DAY * 6))   # Digitalisierung
DT7=$((NOW - DAY * 7))   # BVG U-Bahn
DT8=$((NOW - DAY * 8))   # Klimaschutz

NEWS_PID=2  # Seiten-ID der News-Seite

# ── 1. Bestehende Seed-Daten löschen ──
echo "  🗑  Bestehende News/Kategorien/Dateien löschen ..."

ddev mysql -e "
  DELETE FROM sys_category_record_mm WHERE tablenames='tx_news_domain_model_news';
  DELETE FROM sys_file_reference WHERE tablenames='tx_news_domain_model_news' AND fieldname='fal_media';
  DELETE FROM tx_news_domain_model_news WHERE pid=$NEWS_PID;
  DELETE FROM sys_category WHERE pid=1 AND deleted=0;
" 2>/dev/null

# Seed-Bilder aus sys_file + sys_file_metadata löschen
ddev mysql -e "
  DELETE m FROM sys_file_metadata m
    INNER JOIN sys_file f ON m.file = f.uid
    WHERE f.identifier LIKE '/user_upload/seed-%';
  DELETE FROM sys_file WHERE identifier LIKE '/user_upload/seed-%';
" 2>/dev/null

echo "  ✅ Alte Daten gelöscht."

# ── 2. Kategorien anlegen ──
echo "  📂 6 Kategorien anlegen ..."

ddev mysql -e "
  INSERT INTO sys_category (pid, tstamp, crdate, title, parent, sorting) VALUES
    (1, $NOW, $NOW, 'Politik',     0, 256),
    (1, $NOW, $NOW, 'Wirtschaft',  0, 512),
    (1, $NOW, $NOW, 'Kultur',      0, 768),
    (1, $NOW, $NOW, 'Sport',       0, 1024),
    (1, $NOW, $NOW, 'Berlin',      0, 1280),
    (1, $NOW, $NOW, 'Meinung',     0, 1536);
" 2>/dev/null

# Kategorie-UIDs abfragen
CAT_POLITIK=$(ddev mysql -N -e "SELECT uid FROM sys_category WHERE title='Politik' AND pid=1 AND deleted=0 LIMIT 1;" 2>/dev/null)
CAT_WIRTSCHAFT=$(ddev mysql -N -e "SELECT uid FROM sys_category WHERE title='Wirtschaft' AND pid=1 AND deleted=0 LIMIT 1;" 2>/dev/null)
CAT_KULTUR=$(ddev mysql -N -e "SELECT uid FROM sys_category WHERE title='Kultur' AND pid=1 AND deleted=0 LIMIT 1;" 2>/dev/null)
CAT_SPORT=$(ddev mysql -N -e "SELECT uid FROM sys_category WHERE title='Sport' AND pid=1 AND deleted=0 LIMIT 1;" 2>/dev/null)
CAT_BERLIN=$(ddev mysql -N -e "SELECT uid FROM sys_category WHERE title='Berlin' AND pid=1 AND deleted=0 LIMIT 1;" 2>/dev/null)
CAT_MEINUNG=$(ddev mysql -N -e "SELECT uid FROM sys_category WHERE title='Meinung' AND pid=1 AND deleted=0 LIMIT 1;" 2>/dev/null)

echo "  ✅ Kategorien: Politik=$CAT_POLITIK, Wirtschaft=$CAT_WIRTSCHAFT, Kultur=$CAT_KULTUR, Sport=$CAT_SPORT, Berlin=$CAT_BERLIN, Meinung=$CAT_MEINUNG"

# ── 3. Bilder herunterladen ──
echo "  🖼  8 Bilder herunterladen ..."

IMAGES=(
  "seed-verkehrsstrategie.jpg|https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80|Berliner Verkehrsstrategie"
  "seed-startup-boom.jpg|https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80|Start-up Buero in Berlin-Mitte"
  "seed-kulturhauptstadt.jpg|https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80|Berliner Museumslandschaft im Sommer"
  "seed-hertha-nachwuchs.jpg|https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80|Olympiastadion Berlin — Heimat von Hertha BSC"
  "seed-wohnungsmarkt.jpg|https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80|Berliner Wohnhaeuser von oben"
  "seed-digitalisierung.jpg|https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80|Verwaltungsgebaeude in Berlin"
  "seed-bvg-ubahn.jpg|https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=1200&h=675&q=80|Berliner U-Bahn-Station"
  "seed-klimaschutz.jpg|https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80|Gruenes Berlin mit Solaranlage"
)

for entry in "${IMAGES[@]}"; do
  IFS='|' read -r filename url alt <<< "$entry"
  echo "    ⬇ $filename ..."
  ddev exec bash -c "curl -sL -o /var/www/html/public/fileadmin/user_upload/$filename '$url'" 2>/dev/null || true
done

echo "  ✅ Bilder heruntergeladen."

# ── 4. sys_file + sys_file_metadata Einträge ──
echo "  📄 FAL-Einträge anlegen ..."

FILE_ALTS=(
  "seed-verkehrsstrategie.jpg|Berliner Verkehrsstrategie"
  "seed-startup-boom.jpg|Start-up Buero in Berlin-Mitte"
  "seed-kulturhauptstadt.jpg|Berliner Museumslandschaft im Sommer"
  "seed-hertha-nachwuchs.jpg|Olympiastadion Berlin — Heimat von Hertha BSC"
  "seed-wohnungsmarkt.jpg|Berliner Wohnhaeuser von oben"
  "seed-digitalisierung.jpg|Verwaltungsgebaeude in Berlin"
  "seed-bvg-ubahn.jpg|Berliner U-Bahn-Station"
  "seed-klimaschutz.jpg|Gruenes Berlin mit Solaranlage"
)

for entry in "${FILE_ALTS[@]}"; do
  IFS='|' read -r filename alt <<< "$entry"
  basename_noext="${filename%.jpg}"

  # Dateigröße im Container ermitteln
  filesize=$(ddev exec bash -c "stat -c%s /var/www/html/public/fileadmin/user_upload/$filename 2>/dev/null || echo 0" 2>/dev/null | tr -d '[:space:]')

  # SHA1 berechnen
  sha1=$(ddev exec bash -c "sha1sum /var/www/html/public/fileadmin/user_upload/$filename 2>/dev/null | cut -d' ' -f1 || echo ''" 2>/dev/null | tr -d '[:space:]')

  # identifier_hash und folder_hash (SHA1 des Identifier-Pfads)
  identifier="/user_upload/$filename"
  id_hash=$(echo -n "$identifier" | shasum | cut -d' ' -f1)
  folder_hash=$(echo -n "/user_upload/" | shasum | cut -d' ' -f1)

  ddev mysql -e "
    INSERT INTO sys_file (pid, tstamp, last_indexed, identifier, identifier_hash, folder_hash, extension, name, sha1, creation_date, modification_date, size, storage, type, mime_type, missing)
    VALUES (0, $NOW, $NOW, '$identifier', '$id_hash', '$folder_hash', 'jpg', '$filename', '${sha1:-0000000000000000000000000000000000000000}', $NOW, $NOW, ${filesize:-0}, 1, 2, 'image/jpeg', 0);
  " 2>/dev/null

  # sys_file_metadata mit Alt-Text und Dimensionen
  file_uid=$(ddev mysql -N -e "SELECT uid FROM sys_file WHERE identifier='$identifier' ORDER BY uid DESC LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

  ddev mysql -e "
    INSERT INTO sys_file_metadata (pid, tstamp, crdate, file, title, alternative, width, height)
    VALUES (0, $NOW, $NOW, $file_uid, '$basename_noext', '$alt', 1200, 675);
  " 2>/dev/null
done

echo "  ✅ FAL-Einträge erstellt."

# ── 5. News-Artikel anlegen ──
echo "  📰 8 Artikel anlegen ..."

# Artikel 1: Verkehrsstrategie (Politik, featured)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'Berlins neue Verkehrsstrategie: Das aendert sich 2026',
     'Die Hauptstadt plant umfassende Aenderungen im oeffentlichen Nahverkehr. Was Pendler und Anwohner wissen muessen.',
     '<p>Berlin steht vor einem grundlegenden Wandel im oeffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien fuer den Osten</h2><p>Drei neue Strassenbahnlinien sollen die oestlichen Bezirke besser anbinden.</p><blockquote>Die Investitionen in Hoehe von 2,3 Milliarden Euro sind die groessten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschuetzte Radwege entlang der grossen Ausfallstrassen.</p>',
     $DT1, 'Lisa Mueller', 'lisa.mueller@berliner-rundschau.de', 'berlins-neue-verkehrsstrategie', 1, 1, 1,
     'Verkehr,BVG,Infrastruktur,Berlin');
" 2>/dev/null

# Artikel 2: Start-up Boom (Wirtschaft)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'Start-up Boom in Berlin-Mitte: Ueber 200 Gruendungen im ersten Quartal',
     'Die Berliner Gruenderszene erlebt einen neuen Hoehenflug. Besonders KI-Start-ups treiben das Wachstum.',
     '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte ueber 200 neue Unternehmen gegruendet — ein Plus von 34 Prozent gegenueber dem Vorjahreszeitraum.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffaellig ist der Anstieg im Bereich Kuenstliche Intelligenz. Fast jede dritte Neugruendung beschaeftigt sich mit KI-Anwendungen.</p><h2>Venture Capital fliesst in Rekordhoehe</h2><p>Im ersten Halbjahr 2026 flossen 3,8 Milliarden Euro Risikokapital in Berliner Jungunternehmen.</p>',
     $DT2, 'Thomas Weber', 'thomas.weber@berliner-rundschau.de', 'startup-boom-berlin-mitte', 0, 1, 1,
     'Start-ups,KI,Wirtschaft,Gruenderszene');
" 2>/dev/null

# Artikel 3: Kulturhauptstadt (Kultur)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026',
     'Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.',
     '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein aussergewoehnlich vielfaeltiges Programm.</p><h2>Berlinische Galerie: Zukunft Metropole</h2><p>Die grosse Sommerausstellung widmet sich der urbanen Transformation Berlins. Ueber 150 Werke zeitgenoessischer Kuenstler zeigen Visionen fuer die Stadt von morgen.</p><h2>Humboldt Forum: Seidenstrasse Digital</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenstroemem.</p>',
     $DT3, 'Lisa Bergmann', 'lisa.bergmann@berliner-rundschau.de', 'kulturhauptstadt-berlin-sommer', 0, 1, 1,
     'Kultur,Ausstellungen,Museum,Sommer');
" 2>/dev/null

# Artikel 4: Hertha BSC (Sport)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung',
     'Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profivertraege.',
     '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben Profivertraege erhalten.</p><h2>Die drei Neuzugaenge</h2><ul><li>Emre Yilmaz (18) — zentrales Mittelfeld, 14 Tore in der A-Junioren-Bundesliga</li><li>Jonas Hartmann (19) — Innenverteidiger, U19-Nationalspieler</li><li>Karim Benali (18) — Linksaussen, schnellster Spieler der Jugendabteilung</li></ul><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehoert mittlerweile zu den produktivsten im deutschen Profifussball.</p>',
     $DT4, 'Thomas Weber', 'thomas.weber@berliner-rundschau.de', 'hertha-bsc-nachwuchs-talente', 0, 1, 1,
     'Hertha BSC,Bundesliga,Nachwuchs,Fussball');
" 2>/dev/null

# Artikel 5: Wohnungsmarkt (Berlin)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'Wohnungsmarkt Berlin: Mietpreise steigen weiter',
     'Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke ueberschritten. Ein Ueberblick.',
     '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete fuer Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter ueberschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m2, gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m2) und Friedrichshain-Kreuzberg (16,90 Euro/m2).</p><h2>Neubau stockt weiter</h2><p>Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt.</p>',
     $DT5, 'Maria Schmidt', 'maria.schmidt@berliner-rundschau.de', 'wohnungsmarkt-berlin-mietpreise', 0, 1, 1,
     'Wohnen,Mieten,Immobilien,Berlin');
" 2>/dev/null

# Artikel 6: Digitalisierung (Meinung)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'Kommentar: Warum die Digitalisierung der Verwaltung scheitert',
     'Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse der Ursachen.',
     '<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Waehrend Estland laengst eine volldigitale Verwaltung betreibt, kaempfen Berliner Buergeraemter noch mit Faxgeraeten und Papierformularen.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. Zweitens scheitern Grossprojekte an mangelhafter Projektsteuerung. Drittens blockieren foederale Zustaendigkeiten einheitliche Loesungen.</p><h2>Europaeische Vorbilder</h2><p>In Daenemark werden 92 Prozent aller Behoerdengaenge digital erledigt.</p>',
     $DT6, 'Lisa Mueller', 'lisa.mueller@berliner-rundschau.de', 'kommentar-digitalisierung-verwaltung', 0, 1, 1,
     'Digitalisierung,Verwaltung,Kommentar,Politik');
" 2>/dev/null

# Artikel 7: BVG U-Bahn (Berlin)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut',
     'Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.',
     '<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan fuer das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den naechsten zehn Jahren investiert werden.</p><h2>U5-Verlaengerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof ueber die Turmstrasse bis nach Jungfernheide verlaengert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlaengert werden.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzuege, moderne Beleuchtung und digitale Fahrgastinformation.</p>',
     $DT7, 'Thomas Weber', 'thomas.weber@berliner-rundschau.de', 'bvg-ubahn-netz-ausbau', 0, 1, 1,
     'BVG,U-Bahn,Infrastruktur,Mobilitaet');
" 2>/dev/null

# Artikel 8: Klimaschutz (Politik)
ddev mysql -e "
  INSERT INTO tx_news_domain_model_news
    (pid, tstamp, crdate, title, teaser, bodytext, datetime, author, author_email, path_segment, istopnews, fal_media, categories, keywords)
  VALUES
    ($NEWS_PID, $NOW, $NOW,
     'Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt',
     'Berlin will bis 2045 klimaneutral werden. Neue Massnahmen sollen den CO2-Ausstoss drastisch senken.',
     '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Massnahmen</h2><ul><li>Ausbau der Solarenergie auf allen oeffentlichen Gebaeuden bis 2028</li><li>Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030</li><li>Foerderung energetischer Gebaeudesanierung mit bis zu 40 Prozent Zuschuss</li></ul><h2>Gebaeudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebaeudesektor. Deshalb setzt der Senat hier den groessten Hebel an.</p>',
     $DT8, 'Maria Schmidt', 'maria.schmidt@berliner-rundschau.de', 'klimaschutz-berlin-klimaneutral', 0, 1, 1,
     'Klimaschutz,Nachhaltigkeit,Energie,Politik');
" 2>/dev/null

echo "  ✅ 8 Artikel angelegt."

# ── 6. News-UIDs abfragen ──
NEWS_1=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='berlins-neue-verkehrsstrategie' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
NEWS_2=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='startup-boom-berlin-mitte' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
NEWS_3=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='kulturhauptstadt-berlin-sommer' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
NEWS_4=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='hertha-bsc-nachwuchs-talente' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
NEWS_5=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='wohnungsmarkt-berlin-mietpreise' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
NEWS_6=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='kommentar-digitalisierung-verwaltung' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
NEWS_7=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='bvg-ubahn-netz-ausbau' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')
NEWS_8=$(ddev mysql -N -e "SELECT uid FROM tx_news_domain_model_news WHERE path_segment='klimaschutz-berlin-klimaneutral' AND deleted=0 LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

echo "  📋 News UIDs: $NEWS_1 $NEWS_2 $NEWS_3 $NEWS_4 $NEWS_5 $NEWS_6 $NEWS_7 $NEWS_8"

# ── 7. Kategorie-Zuordnungen (sys_category_record_mm) ──
echo "  🔗 Kategorie-Zuordnungen ..."

# Artikel 1: Politik
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_POLITIK, $NEWS_1, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null
# Artikel 2: Wirtschaft
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_WIRTSCHAFT, $NEWS_2, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null
# Artikel 3: Kultur
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_KULTUR, $NEWS_3, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null
# Artikel 4: Sport
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_SPORT, $NEWS_4, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null
# Artikel 5: Berlin
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_BERLIN, $NEWS_5, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null
# Artikel 6: Meinung
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_MEINUNG, $NEWS_6, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null
# Artikel 7: Berlin
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_BERLIN, $NEWS_7, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null
# Artikel 8: Politik
ddev mysql -e "INSERT INTO sys_category_record_mm (uid_local, uid_foreign, sorting, sorting_foreign, tablenames, fieldname) VALUES ($CAT_POLITIK, $NEWS_8, 1, 0, 'tx_news_domain_model_news', 'categories');" 2>/dev/null

# categories-Counter auf den News-Records aktualisieren
ddev mysql -e "UPDATE tx_news_domain_model_news SET categories=1 WHERE pid=$NEWS_PID AND deleted=0;" 2>/dev/null

echo "  ✅ Kategorie-Zuordnungen erstellt."

# ── 8. Bild-Referenzen (sys_file_reference) ──
echo "  🖼  Bild-Referenzen anlegen ..."

IMAGE_MAP=(
  "$NEWS_1|seed-verkehrsstrategie.jpg|Berliner Verkehrsstrategie"
  "$NEWS_2|seed-startup-boom.jpg|Start-up Buero in Berlin-Mitte"
  "$NEWS_3|seed-kulturhauptstadt.jpg|Berliner Museumslandschaft im Sommer"
  "$NEWS_4|seed-hertha-nachwuchs.jpg|Olympiastadion Berlin — Heimat von Hertha BSC"
  "$NEWS_5|seed-wohnungsmarkt.jpg|Berliner Wohnhaeuser von oben"
  "$NEWS_6|seed-digitalisierung.jpg|Verwaltungsgebaeude in Berlin"
  "$NEWS_7|seed-bvg-ubahn.jpg|Berliner U-Bahn-Station"
  "$NEWS_8|seed-klimaschutz.jpg|Gruenes Berlin mit Solaranlage"
)

for entry in "${IMAGE_MAP[@]}"; do
  IFS='|' read -r news_uid filename alt <<< "$entry"
  file_uid=$(ddev mysql -N -e "SELECT uid FROM sys_file WHERE identifier='/user_upload/$filename' ORDER BY uid DESC LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

  if [[ -n "$file_uid" && "$file_uid" -gt 0 ]]; then
    ddev mysql -e "
      INSERT INTO sys_file_reference
        (pid, tstamp, crdate, uid_local, uid_foreign, tablenames, fieldname, sorting_foreign, title, alternative)
      VALUES
        ($NEWS_PID, $NOW, $NOW, $file_uid, $news_uid, 'tx_news_domain_model_news', 'fal_media', 1, '', '$alt');
    " 2>/dev/null
  else
    echo "    ⚠️  Datei $filename nicht gefunden, Referenz übersprungen."
  fi
done

echo "  ✅ Bild-Referenzen erstellt."

# ── 9. TYPO3 Cache leeren ──
echo "  🧹 TYPO3 Cache leeren ..."
ddev exec php vendor/bin/typo3 cache:flush 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ TYPO3 Seed abgeschlossen!"
echo ""
echo "  8 Artikel, 6 Kategorien, 8 Bilder"
echo "  URL: http://typo3-demo.ddev.site/news"
echo "═══════════════════════════════════════════════════════════"
