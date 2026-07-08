#!/usr/bin/env node
/**
 * Seed-Script fuer WordPress / WordPress.com
 *
 * Erstellt Kategorien, laedt Bilder hoch und erstellt Artikel.
 * Identische Inhalte wie seed-contentful.mjs und seed-storyblok.mjs.
 * Idempotent: prueft vorhandene Slugs, ueberspringt Existierendes.
 *
 * Nutzung (WordPress.com mit OAuth2 Bearer Token):
 *   node cms-seeds/seed-wordpress.mjs \
 *     --site berlinerrundschau.wordpress.com \
 *     --token <bearer-token>
 *
 * Nutzung (Self-hosted mit Application Password):
 *   node cms-seeds/seed-wordpress.mjs \
 *     --url https://example.com \
 *     --user admin \
 *     --app-password xxxx-xxxx-xxxx-xxxx
 *
 * Hinweis Autoren: WordPress nutzt User-Accounts als Autoren — alle Artikel
 * werden automatisch dem ausfuehrenden Account zugeordnet. Im Gegensatz zu
 * Contentful/Storyblok (wo Autoren eigene Content-Eintraege sind) kann das
 * Seed-Script den Autor-Namen nicht steuern.
 *
 * Keine externen Abhaengigkeiten — nur Node.js 18+ fetch().
 */

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

const site = flag("site");
const bearerToken = flag("token");
const selfHostedUrl = flag("url");
const wpUser = flag("user");
const appPassword = flag("app-password");

const isWpCom = Boolean(site && bearerToken);
const isSelfHosted = Boolean(selfHostedUrl && wpUser && appPassword);

if (!isWpCom && !isSelfHosted) {
  console.error(`Nutzung:
  WordPress.com:  --site <host> --token <bearer-token>
  Self-hosted:    --url <base-url> --user <username> --app-password <app-pwd>`);
  process.exit(1);
}

const API_BASE = isWpCom
  ? `https://public-api.wordpress.com/wp/v2/sites/${site}`
  : `${selfHostedUrl.replace(/\/$/, "")}/wp-json/wp/v2`;

function authHeaders() {
  if (isWpCom) {
    return { Authorization: `Bearer ${bearerToken}` };
  }
  return {
    Authorization: `Basic ${Buffer.from(`${wpUser}:${appPassword}`).toString("base64")}`,
  };
}

const RATE_LIMIT_MS = 300;
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  await sleep(RATE_LIMIT_MS);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   Shared Data — identisch mit seed-contentful.mjs / seed-storyblok.mjs
   ══════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  { name: "Politik", slug: "politik", description: "Aktuelle politische Nachrichten aus Berlin, Deutschland und der Welt." },
  { name: "Wirtschaft", slug: "wirtschaft", description: "Wirtschaftsnachrichten, Börse, Unternehmen und Start-ups aus Berlin." },
  { name: "Berlin", slug: "berlin", description: "Lokalnachrichten aus allen Berliner Bezirken — Verkehr, Wohnen, Stadtentwicklung." },
  { name: "Kultur", slug: "kultur", description: "Kunst, Musik, Theater, Film und Ausstellungen in Berlin." },
  { name: "Sport", slug: "sport", description: "Sportnachrichten aus Berlin — Hertha BSC, Union Berlin, Alba und mehr." },
  { name: "Meinung", slug: "meinung", description: "Kommentare, Analysen und Gastbeiträge zu aktuellen Themen." },
];

const IMAGES = [
  { name: "berlins-neue-verkehrsstrategie-hero", url: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Berliner Verkehrsstrategie — Straßenszene" },
  { name: "startup-boom-berlin-mitte-hero", url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Start-up Büro in Berlin-Mitte" },
  { name: "kulturhauptstadt-berlin-sommer-hero", url: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Berliner Museumslandschaft im Sommer" },
  { name: "hertha-bsc-nachwuchs-hero", url: "https://images.unsplash.com/photo-1602453870769-970391ee6fc1?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Fußball-Nachwuchsspieler beim Training" },
  { name: "wohnungsmarkt-berlin-hero", url: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Berliner Wohnhäuser von oben" },
  { name: "kommentar-digitalisierung-hero", url: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Verwaltungsgebäude in Berlin" },
  { name: "bvg-ubahn-netz-hero", url: "https://images.unsplash.com/photo-1752771433743-47a49376fb63?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Berliner U-Bahn-Station" },
  { name: "klimaschutz-berlin-hero", url: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80", alt: "Grünes Berlin — Solaranlage auf Dach" },
];

const ARTICLES = [
  {
    title: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    excerpt: "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
    content: '<p>Berlin steht vor einem grundlegenden Wandel im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann.</p><blockquote>Die Investitionen in Höhe von 2,3 Milliarden Euro sind die größten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg, wo bisher viele Bewohner auf Busverbindungen angewiesen waren.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen.</p>',
    category: "politik",
    image: "berlins-neue-verkehrsstrategie-hero",
    featured: true,
    tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"],
  },
  {
    title: "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    excerpt: "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
    content: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte über 200 neue Unternehmen gegründet — ein Plus von 34 Prozent gegenüber dem Vorjahreszeitraum.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen.</p><h2>Venture Capital fließt in Rekordhöhe</h2><p>Im ersten Halbjahr 2026 flossen 3,8 Milliarden Euro Risikokapital in Berliner Jungunternehmen.</p>',
    category: "wirtschaft",
    image: "startup-boom-berlin-mitte-hero",
    featured: false,
    tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"],
  },
  {
    title: "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    excerpt: "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    content: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein außergewöhnlich vielfältiges Programm.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins. Über 150 Werke zeitgenössischer Künstler zeigen Visionen für die Stadt von morgen.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen.</p>',
    category: "kultur",
    image: "kulturhauptstadt-berlin-sommer-hero",
    featured: false,
    tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"],
  },
  {
    title: "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
    slug: "hertha-bsc-nachwuchs-talente",
    excerpt: "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
    content: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben Profiverträge erhalten.</p><h2>Die drei Neuzugänge</h2><ul><li>Emre Yilmaz (18) — zentrales Mittelfeld, 14 Tore in der A-Junioren-Bundesliga</li><li>Jonas Hartmann (19) — Innenverteidiger, U19-Nationalspieler</li><li>Karim Benali (18) — Linksaußen, schnellster Spieler der Jugendabteilung</li></ul><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehört mittlerweile zu den produktivsten im deutschen Profifußball.</p>',
    category: "sport",
    image: "hertha-bsc-nachwuchs-hero",
    featured: false,
    tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"],
  },
  {
    title: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    slug: "wohnungsmarkt-berlin-mietpreise",
    excerpt: "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten. Ein Überblick.",
    content: '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete für Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter überschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m², gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m²) und Friedrichshain-Kreuzberg (16,90 Euro/m²).</p><h2>Neubau stockt weiter</h2><p>Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt.</p>',
    category: "berlin",
    image: "wohnungsmarkt-berlin-hero",
    featured: false,
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
  },
  {
    title: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    excerpt: "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse der Ursachen.",
    content: '<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Während Estland längst eine volldigitale Verwaltung betreibt, kämpfen Berliner Bürgerämter noch mit Faxgeräten und Papierformularen.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. Zweitens scheitern Großprojekte an mangelhafter Projektsteuerung. Drittens blockieren föderale Zuständigkeiten einheitliche Lösungen.</p><h2>Europäische Vorbilder</h2><p>In Dänemark werden 92 Prozent aller Behördengänge digital erledigt. Selbst das wirtschaftlich schwächere Portugal bietet mehr digitale Verwaltungsleistungen als Deutschland.</p>',
    category: "meinung",
    image: "kommentar-digitalisierung-hero",
    featured: false,
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"],
  },
  {
    title: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    excerpt: "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    content: '<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung und digitale Fahrgastinformation.</p>',
    category: "berlin",
    image: "bvg-ubahn-netz-hero",
    featured: false,
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
  },
  {
    title: "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    excerpt: "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    content: '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030</li><li>Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss</li></ul><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an.</p>',
    category: "politik",
    image: "klimaschutz-berlin-hero",
    featured: false,
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
  },
];

/* ── Helpers ── */

async function findBySlug(endpoint, slug) {
  try {
    const items = await apiFetch(`/${endpoint}?slug=${encodeURIComponent(slug)}`);
    return Array.isArray(items) && items.length > 0 ? items[0] : null;
  } catch {
    return null;
  }
}

async function findTagByName(name) {
  try {
    const items = await apiFetch(`/tags?search=${encodeURIComponent(name)}`);
    if (!Array.isArray(items)) return null;
    return items.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

async function getOrCreateTag(name) {
  const existing = await findTagByName(name);
  if (existing) return existing.id;
  try {
    const created = await apiFetch("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return created.id;
  } catch {
    return null;
  }
}

async function uploadImage(img) {
  console.log(`  Lade Bild herunter: ${img.name}...`);
  const imgRes = await fetch(img.url, { redirect: "follow" });
  if (!imgRes.ok) throw new Error(`Bild-Download fehlgeschlagen: ${img.url}`);
  const blob = await imgRes.arrayBuffer();
  const buffer = Buffer.from(blob);

  console.log(`  Lade hoch: ${img.name} (${(buffer.length / 1024).toFixed(0)} KB)...`);

  const formBoundary = `----SeedBoundary${Date.now()}`;
  const filename = `${img.name}.jpg`;
  const header = `--${formBoundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`;
  const altPart = `\r\n--${formBoundary}\r\nContent-Disposition: form-data; name="alt_text"\r\n\r\n${img.alt}`;
  const footer = `\r\n--${formBoundary}--\r\n`;

  const headerBuf = Buffer.from(header);
  const altBuf = Buffer.from(altPart);
  const footerBuf = Buffer.from(footer);
  const body = Buffer.concat([headerBuf, buffer, altBuf, footerBuf]);

  const res = await fetch(`${API_BASE}/media`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": `multipart/form-data; boundary=${formBoundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Media-Upload fehlgeschlagen: ${res.status} ${errText}`);
  }

  await sleep(RATE_LIMIT_MS);
  return res.json();
}

/* ── Main ── */

async function main() {
  console.log(`\nWordPress Seed — ${isWpCom ? "WordPress.com" : "Self-hosted"}`);
  console.log(`API: ${API_BASE}`);
  console.log(`Identische Inhalte wie Contentful + Storyblok Seeds\n`);

  /* 1. Kategorien */
  console.log("=== Kategorien ===");
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    const existing = await findBySlug("categories", cat.slug);
    if (existing) {
      console.log(`  ✓ ${cat.name} existiert bereits (ID: ${existing.id})`);
      categoryMap[cat.slug] = existing.id;
    } else {
      const created = await apiFetch("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cat),
      });
      console.log(`  + ${cat.name} erstellt (ID: ${created.id})`);
      categoryMap[cat.slug] = created.id;
    }
  }

  /* 2. Bilder */
  console.log("\n=== Bilder ===");
  const imageMap = {};
  for (const img of IMAGES) {
    try {
      const media = await uploadImage(img);
      console.log(`  + ${img.name} hochgeladen (ID: ${media.id})`);
      imageMap[img.name] = media.id;
    } catch (err) {
      console.error(`  ✗ ${img.name} fehlgeschlagen: ${err.message}`);
    }
  }

  /* 3. Tags */
  console.log("\n=== Tags ===");
  const allTags = [...new Set(ARTICLES.flatMap((a) => a.tags))];
  const tagMap = {};
  for (const tagName of allTags) {
    const tagId = await getOrCreateTag(tagName);
    if (tagId) {
      tagMap[tagName] = tagId;
      console.log(`  ✓ Tag "${tagName}" (ID: ${tagId})`);
    }
  }

  /* 4. Artikel */
  console.log("\n=== Artikel ===");
  for (const article of ARTICLES) {
    const existing = await findBySlug("posts", article.slug);
    if (existing) {
      console.log(`  ✓ "${article.title.substring(0, 50)}..." existiert bereits`);
      continue;
    }

    const postData = {
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt,
      status: "publish",
      categories: [categoryMap[article.category]].filter(Boolean),
      tags: article.tags.map((t) => tagMap[t]).filter(Boolean),
      sticky: article.featured ?? false,
    };

    if (imageMap[article.image]) {
      postData.featured_media = imageMap[article.image];
    }

    try {
      const post = await apiFetch("/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      console.log(`  + "${article.title.substring(0, 50)}..." erstellt (ID: ${post.id})`);
    } catch (err) {
      console.error(`  ✗ "${article.title.substring(0, 50)}..." fehlgeschlagen: ${err.message}`);
    }
  }

  /* 5. Default-Post loeschen */
  console.log("\n=== Aufräumen ===");
  const helloWorld = await findBySlug("posts", "hello-world");
  if (helloWorld) {
    try {
      await apiFetch(`/posts/${helloWorld.id}?force=true`, { method: "DELETE" });
      console.log('  - "Hello World!" gelöscht');
    } catch {
      console.log('  ~ "Hello World!" konnte nicht gelöscht werden (OK)');
    }
  } else {
    console.log("  ~ Kein Hello World Post vorhanden");
  }

  console.log("\n✅ Seed abgeschlossen!\n");
  console.log("Konfiguration fuer .env.local:");
  console.log("  CMS_ADAPTER=wordpress");
  console.log(`  WORDPRESS_URL=https://${site ?? new URL(selfHostedUrl).host}`);
  if (isWpCom) {
    console.log(`  WORDPRESS_API_BASE=${API_BASE}`);
    console.log("  WORDPRESS_BEARER_TOKEN=<token>");
  } else {
    console.log(`  WORDPRESS_USERNAME=${wpUser}`);
    console.log("  WORDPRESS_APP_PASSWORD=<app-password>");
  }
  console.log(`  CMS_IMAGE_DOMAINS=${isWpCom ? site + ",wp.com,i0.wp.com,secure.gravatar.com" : new URL(selfHostedUrl).host + ",secure.gravatar.com"}`);
  console.log("\nDann: npm run dev\n");
}

main().catch((err) => {
  console.error("\n❌ Seed fehlgeschlagen:", err.message);
  process.exit(1);
});
