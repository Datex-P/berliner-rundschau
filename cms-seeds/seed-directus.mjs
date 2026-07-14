#!/usr/bin/env node
/**
 * Berliner Rundschau — Directus Seed Script
 *
 * Erstellt Collections + Felder + Demo-Inhalte in einer Directus-Instanz:
 *   6 Kategorien, 4 Autoren, 8 Artikel, 6 Newsticker,
 *   3 Videos, 2 Breaking-News, Navigation, Site-Config,
 *   Börsendaten und Tagesquiz.
 *
 * Aufruf:
 *   node cms-seeds/seed-directus.mjs --url http://localhost:8055 --token <static-token>
 *
 * Voraussetzungen:
 *   - Directus-Instanz (Docker oder selbst-gehostet)
 *   - Admin Static Token (ADMIN_TOKEN in Docker env)
 *
 * Idempotent: Collections werden nur erstellt wenn nicht vorhanden.
 *   Vorhandene Demo-Datensätze werden gelöscht und neu erstellt.
 */

/* ============================================================
   CLI ARGS
   ============================================================ */

const rawArgs = process.argv.slice(2);
function getArg(n) {
  const i = rawArgs.indexOf(`--${n}`);
  return i !== -1 ? rawArgs[i + 1] : undefined;
}

const URL = (getArg("url") ?? "http://localhost:8055").replace(/\/$/, "");
const TOKEN = getArg("token");

if (!TOKEN) {
  console.error("Usage: node cms-seeds/seed-directus.mjs --url <directus-url> --token <static-token>");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
};

/* ============================================================
   API HELPERS
   ============================================================ */

async function api(method, path, body) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = JSON.stringify(json?.errors ?? json).slice(0, 300);
    if (res.status === 400 && msg.includes("already exists")) return null;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json?.data ?? json;
}

const SYSTEM_FIELDS = [
  { field: "date_created", type: "timestamp", schema: {}, meta: { special: ["date-created"], interface: "datetime", readonly: true, hidden: true, width: "half" } },
  { field: "date_updated", type: "timestamp", schema: {}, meta: { special: ["date-updated"], interface: "datetime", readonly: true, hidden: true, width: "half" } },
];

async function createCollection(collection, fields = []) {
  try {
    await api("POST", "/collections", {
      collection,
      schema: {},
      meta: { icon: "article", note: "Berliner Rundschau Demo" },
    });
    console.log(`    Created collection "${collection}"`);
  } catch (e) {
    if (e.message.includes("already exists")) {
      console.log(`    Collection "${collection}" exists`);
    } else {
      throw e;
    }
  }
  // System fields first (date_created, date_updated)
  for (const sf of SYSTEM_FIELDS) {
    try {
      await api("POST", `/fields/${collection}`, sf);
    } catch { /* ignore if exists */ }
  }
  for (const field of fields) {
    const { relation, ...fieldDef } = field;
    try {
      await api("POST", `/fields/${collection}`, fieldDef);
    } catch (e) {
      if (!e.message.includes("already exists") && !e.message.includes("Field")) {
        console.warn(`    Warning: field ${field.field} — ${e.message.slice(0, 100)}`);
      }
    }
    // Create M2O relation separately
    if (relation) {
      try {
        await api("POST", "/relations", {
          collection,
          field: field.field,
          related_collection: relation.related_collection,
        });
      } catch (e) {
        if (!e.message.includes("already exists")) {
          console.warn(`    Warning: relation ${field.field} — ${e.message.slice(0, 100)}`);
        }
      }
    }
  }
}

async function deleteAllItems(collection) {
  try {
    const res = await api("GET", `/items/${collection}?limit=-1&fields=id`);
    const items = Array.isArray(res) ? res : [];
    if (items.length === 0) return 0;
    const ids = items.map((i) => i.id);
    await api("DELETE", `/items/${collection}`, ids);
    return ids.length;
  } catch {
    return 0;
  }
}

async function createItem(collection, data) {
  const res = await api("POST", `/items/${collection}`, data);
  return res?.id ?? null;
}

/* ============================================================
   SCHEMA DEFINITIONS
   ============================================================ */

const COLLECTIONS = {
  categories: [
    { field: "name", type: "string", schema: {}, meta: { interface: "input", required: true } },
    { field: "slug", type: "string", schema: { is_unique: true }, meta: { interface: "input", required: true } },
    { field: "description", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "color", type: "string", schema: {}, meta: { interface: "input" } },
  ],
  authors: [
    { field: "name", type: "string", schema: {}, meta: { interface: "input", required: true } },
    { field: "slug", type: "string", schema: { is_unique: true }, meta: { interface: "input", required: true } },
    { field: "bio", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "role", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "avatarUrl", type: "string", schema: {}, meta: { interface: "input" } },
  ],
  articles: [
    { field: "headline", type: "string", schema: {}, meta: { interface: "input", required: true } },
    { field: "slug", type: "string", schema: { is_unique: true }, meta: { interface: "input", required: true } },
    { field: "teaser", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "body", type: "text", schema: {}, meta: { interface: "input-rich-text-html" } },
    { field: "imageUrl", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "category", type: "integer", schema: { foreign_key_table: "categories", foreign_key_column: "id" }, meta: { interface: "select-dropdown-m2o", special: ["m2o"] }, relation: { related_collection: "categories" } },
    { field: "author", type: "integer", schema: { foreign_key_table: "authors", foreign_key_column: "id" }, meta: { interface: "select-dropdown-m2o", special: ["m2o"] }, relation: { related_collection: "authors" } },
    { field: "tags", type: "json", schema: {}, meta: { interface: "tags" } },
    { field: "readingTimeMinutes", type: "integer", schema: {}, meta: { interface: "input" } },
    { field: "isPremium", type: "boolean", schema: { default_value: false }, meta: { interface: "boolean" } },
    { field: "paywall", type: "string", schema: { default_value: "free" }, meta: { interface: "input" } },
    { field: "isLive", type: "boolean", schema: { default_value: false }, meta: { interface: "boolean" } },
    { field: "isOpinion", type: "boolean", schema: { default_value: false }, meta: { interface: "boolean" } },
    { field: "isFeatured", type: "boolean", schema: { default_value: false }, meta: { interface: "boolean" } },
    { field: "isBreaking", type: "boolean", schema: { default_value: false }, meta: { interface: "boolean" } },
    { field: "aiSummary", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "region", type: "string", schema: {}, meta: { interface: "input" } },
  ],
  newsticker: [
    { field: "headline", type: "string", schema: {}, meta: { interface: "input", required: true } },
    { field: "text", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "url", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "topic", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "isPremium", type: "boolean", schema: { default_value: false }, meta: { interface: "boolean" } },
  ],
  videos: [
    { field: "title", type: "string", schema: {}, meta: { interface: "input", required: true } },
    { field: "videoUrl", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "thumbnailUrl", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "durationSeconds", type: "integer", schema: {}, meta: { interface: "input" } },
    { field: "caption", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "category", type: "string", schema: {}, meta: { interface: "input" } },
  ],
  breaking_news: [
    { field: "headline", type: "string", schema: {}, meta: { interface: "input", required: true } },
    { field: "text", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "url", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "severity", type: "string", schema: { default_value: "normal" }, meta: { interface: "input" } },
  ],
  navigation: [
    { field: "slug", type: "string", schema: { is_unique: true }, meta: { interface: "input" } },
    { field: "items", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
    { field: "footerMenu", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
    { field: "socialLinks", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
  ],
  site_config: [
    { field: "slug", type: "string", schema: { is_unique: true }, meta: { interface: "input" } },
    { field: "siteName", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "siteDescription", type: "text", schema: {}, meta: { interface: "input-multiline" } },
    { field: "socialLinks", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
  ],
  quiz: [
    { field: "title", type: "string", schema: {}, meta: { interface: "input", required: true } },
    { field: "date", type: "string", schema: {}, meta: { interface: "input" } },
    { field: "questions", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
    { field: "streakRewards", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
  ],
  stock_data: [
    { field: "slug", type: "string", schema: { is_unique: true }, meta: { interface: "input" } },
    { field: "stocks", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
    { field: "indices", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
    { field: "watchlist", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
    { field: "chartData", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
  ],
};

/* ============================================================
   DEMO DATA
   ============================================================ */

const CATEGORIES = [
  { name: "Politik", slug: "politik", description: "Aktuelle politische Nachrichten aus Berlin, Deutschland und der Welt.", color: "#15803d" },
  { name: "Wirtschaft", slug: "wirtschaft", description: "Wirtschaftsnachrichten, Börse, Unternehmen und Start-ups aus Berlin.", color: "#16a34a" },
  { name: "Berlin", slug: "berlin", description: "Lokalnachrichten aus allen Berliner Bezirken — Verkehr, Wohnen, Stadtentwicklung.", color: "#0ea5e9" },
  { name: "Kultur", slug: "kultur", description: "Kunst, Musik, Theater, Film und Ausstellungen in Berlin.", color: "#8b5cf6" },
  { name: "Sport", slug: "sport", description: "Sportnachrichten aus Berlin — Hertha BSC, Union Berlin, Alba und mehr.", color: "#3b82f6" },
  { name: "Meinung", slug: "meinung", description: "Kommentare, Analysen und Gastbeiträge zu aktuellen Themen.", color: "#f59e0b" },
];

const AUTHORS = [
  { name: "Anna Schmidt", slug: "anna-schmidt", bio: "Chefredakteurin der Berliner Rundschau. Schwerpunkte: Landespolitik, Infrastruktur und Stadtentwicklung.", role: "Chefredakteurin", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face" },
  { name: "Markus Weber", slug: "markus-weber", bio: "Wirtschaftsredakteur mit Fokus auf Start-ups, Immobilien und Berliner Wirtschaftspolitik.", role: "Wirtschaftsredakteur", avatarUrl: "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face" },
  { name: "Lisa Müller", slug: "lisa-mueller", bio: "Kulturredakteurin der Berliner Rundschau. Berichtet über Ausstellungen, Theater und die Berliner Kunstszene.", role: "Kulturredakteurin", avatarUrl: "https://images.unsplash.com/photo-1573496527892-904f897eb744?auto=format&fit=crop&w=200&h=200&q=80&crop=face" },
  { name: "Thomas Becker", slug: "thomas-becker", bio: "Sportredakteur mit Leidenschaft für Berliner Fußball. Begleitet Hertha BSC und Union Berlin seit über zehn Jahren.", role: "Sportredakteur", avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80&crop=faces" },
];

const ARTICLES = [
  {
    headline: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    teaser: "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
    body: '<p>Berlin steht vor einem grundlegenden Wandel im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann.</p><blockquote>Die Investitionen in Höhe von 2,3 Milliarden Euro sind die größten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "politik", authorSlug: "anna-schmidt", isFeatured: true,
    tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"], readingTimeMinutes: 5, region: "Berlin",
  },
  {
    headline: "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    teaser: "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
    body: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte über 200 neue Unternehmen gegründet.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen.</p><h2>Venture Capital fließt in Rekordhöhe</h2><p>Im ersten Halbjahr 2026 flossen 3,8 Milliarden Euro Risikokapital in Berliner Jungunternehmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "wirtschaft", authorSlug: "markus-weber",
    tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"], readingTimeMinutes: 4, region: "Berlin-Mitte",
  },
  {
    headline: "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    teaser: "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    body: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein außergewöhnlich vielfältiges Programm.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "kultur", authorSlug: "lisa-mueller",
    tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"], readingTimeMinutes: 3, region: "Berlin",
  },
  {
    headline: "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
    slug: "hertha-bsc-nachwuchs-talente",
    teaser: "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
    body: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben Profiverträge erhalten.</p><h2>Die drei Neuzugänge</h2><p>Emre Yilmaz (18), Jonas Hartmann (19) und Karim Benali (18) haben den Sprung geschafft.</p><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehört mittlerweile zu den produktivsten im deutschen Profifußball.</p>',
    imageUrl: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "sport", authorSlug: "thomas-becker",
    tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"], readingTimeMinutes: 4, region: "Berlin",
  },
  {
    headline: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    slug: "wohnungsmarkt-berlin-mietpreise",
    teaser: "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten.",
    body: '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete hat im Juni 2026 erstmals 15 Euro pro Quadratmeter überschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit 19,50 Euro/m², gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m²).</p><h2>Neubau stockt weiter</h2><p>Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt.</p>',
    imageUrl: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "berlin", authorSlug: "markus-weber",
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"], readingTimeMinutes: 5, region: "Berlin",
  },
  {
    headline: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    teaser: "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse.",
    body: '<p>Es ist eine Geschichte des Scheiterns. Während Estland längst eine volldigitale Verwaltung betreibt, kämpfen Berliner Bürgerämter noch mit Faxgeräten.</p><h2>Die drei Hauptprobleme</h2><p>Fehlender politischer Wille, mangelhafte Projektsteuerung, föderale Zuständigkeiten.</p><h2>Europäische Vorbilder</h2><p>In Dänemark werden 92 Prozent aller Behördengänge digital erledigt.</p>',
    imageUrl: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "meinung", authorSlug: "anna-schmidt", isOpinion: true,
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"], readingTimeMinutes: 6, region: "Deutschland",
  },
  {
    headline: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    teaser: "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes.",
    body: '<p>Die BVG hat ihren Modernisierungsplan vorgestellt. 4,1 Milliarden Euro in zehn Jahren.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof bis nach Jungfernheide verlängert werden.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER reichen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "berlin", authorSlug: "anna-schmidt",
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"], readingTimeMinutes: 5, region: "Berlin",
  },
  {
    headline: "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    teaser: "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen.</p><h2>Die wichtigsten Maßnahmen</h2><p>Solarenergie auf allen öffentlichen Gebäuden bis 2028. Verdopplung des Radwegenetzes bis 2030.</p><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor.</p>',
    imageUrl: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "politik", authorSlug: "anna-schmidt",
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"], readingTimeMinutes: 4, region: "Berlin",
  },
];

const NEWSTICKER = [
  { headline: "Bundestag beschließt neues Digitalgesetz", text: "Der Bundestag hat mit großer Mehrheit das neue Digitalgesetz verabschiedet.", topic: "Politik", isPremium: false },
  { headline: "S-Bahn-Störung auf der Ringbahn behoben", text: "Nach einer zweistündigen Störung fährt die Ringbahn wieder regulär.", topic: "Berlin", isPremium: false },
  { headline: "DAX schließt mit Rekordhoch bei 24.987 Punkten", text: "Der deutsche Leitindex erreicht ein neues Allzeithoch.", topic: "Wirtschaft", isPremium: true },
  { headline: "Union Berlin verpflichtet schwedischen Stürmer", text: "Der 1. FC Union Berlin hat den Transfer eines schwedischen Nationalspielers bekanntgegeben.", topic: "Sport", isPremium: false },
  { headline: "Berlinale kündigt Jury-Präsidentin für 2027 an", text: "Die Internationalen Filmfestspiele Berlin haben die Jury-Präsidentin benannt.", topic: "Kultur", isPremium: false },
  { headline: "Neue Fahrradstraße in Friedrichshain eröffnet", text: "Die neue Fahrradstraße verbindet Friedrichshain mit dem Treptower Park.", topic: "Berlin", isPremium: false },
];

const VIDEOS = [
  { title: "Berlins neue Tramlinien: So sieht der Plan aus", videoUrl: "/videos/tram-plan.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1280&h=720&q=80", durationSeconds: 384, caption: "Der Berliner Senat stellt die neuen Tramlinien vor.", category: "Politik" },
  { title: "Start-up-Szene Berlin: Ein Tag im Co-Working-Space", videoUrl: "/videos/startup-coworking.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1280&h=720&q=80", durationSeconds: 542, caption: "Einblicke in die Berliner Gründerszene.", category: "Wirtschaft" },
  { title: "Sommer in Berlin: Die schönsten Badestellen", videoUrl: "/videos/badestellen.mp4", thumbnailUrl: "https://images.unsplash.com/photo-1758912299313-36430bb41c44?auto=format&fit=crop&w=1280&h=720&q=80", durationSeconds: 267, caption: "Top-Badestellen für den Berliner Sommer.", category: "Berlin" },
];

const BREAKING_NEWS = [
  { headline: "Eilmeldung: Berliner Senat beschließt Klimaschutzpaket", text: "Umfassendes Paket mit Maßnahmen für Gebäude, Verkehr und Energie beschlossen.", url: "/artikel/klimaschutz-berlin-klimaneutral", severity: "critical" },
  { headline: "BVG: Signalstörung auf der U2 — Verspätungen erwartet", text: "Aufgrund einer Signalstörung kommt es auf der U2 zu Verspätungen von bis zu 15 Minuten.", url: "/artikel/bvg-ubahn-netz-ausbau", severity: "normal" },
];

const NAVIGATION = {
  slug: "singleton",
  items: [
    { label: "Start", href: "/", isActive: true },
    { label: "Politik", href: "/kategorie/politik", isActive: false },
    { label: "Wirtschaft", href: "/kategorie/wirtschaft", isActive: false },
    { label: "Berlin", href: "/kategorie/berlin", isActive: false },
    { label: "Kultur", href: "/kategorie/kultur", isActive: false },
    { label: "Sport", href: "/kategorie/sport", isActive: false },
    { label: "Meinung", href: "/kategorie/meinung", isActive: false },
  ],
  footerMenu: [
    { label: "Impressum", href: "/impressum" },
    { label: "Datenschutz", href: "/datenschutz" },
    { label: "Kontakt", href: "/kontakt" },
  ],
  socialLinks: [
    { platform: "twitter", url: "https://twitter.com/BerlinerRundschau", label: "Twitter" },
    { platform: "instagram", url: "https://instagram.com/BerlinerRundschau", label: "Instagram" },
  ],
};

const SITE_CONFIG = {
  slug: "singleton",
  siteName: "Berliner Rundschau",
  siteDescription: "Aktuelle Nachrichten aus Berlin — Politik, Wirtschaft, Kultur, Sport und Meinung.",
  socialLinks: NAVIGATION.socialLinks,
};

const QUIZ = {
  title: "Berlin-Quiz des Tages",
  date: new Date().toISOString().slice(0, 10),
  questions: [
    { question: "Wie viele Bezirke hat Berlin?", options: ["10", "12", "14", "16"], correctIndex: 1 },
    { question: "Welcher Fluss fließt durch Berlin?", options: ["Elbe", "Spree", "Rhein", "Main"], correctIndex: 1 },
    { question: "In welchem Jahr fiel die Berliner Mauer?", options: ["1987", "1988", "1989", "1990"], correctIndex: 2 },
  ],
  streakRewards: [
    { days: 3, reward: "Bronze-Berliner" },
    { days: 7, reward: "Silber-Berliner" },
    { days: 30, reward: "Gold-Berliner" },
  ],
};

const STOCK_DATA = {
  slug: "singleton",
  stocks: [
    { id: "sap", symbol: "SAP.DE", name: "SAP SE", price: 142.85, change: 2.15, changePercent: 1.53 },
    { id: "sie", symbol: "SIE.DE", name: "Siemens AG", price: 268.45, change: 3.8, changePercent: 1.44 },
    { id: "bayn", symbol: "BAYN.DE", name: "Bayer AG", price: 48.92, change: -0.73, changePercent: -1.47 },
  ],
  indices: [
    { id: "dax", name: "DAX", value: 24987.45, change: 148.72, changePercent: 0.60 },
    { id: "mdax", name: "MDAX", value: 30743.1, change: -45.2, changePercent: -0.16 },
    { id: "dow", name: "Dow Jones", value: 52387.42, change: 234.56, changePercent: 0.55 },
  ],
  watchlist: [
    { id: "sap", symbol: "SAP.DE", name: "SAP SE", price: 142.85, change: 3.2 },
    { id: "sie", symbol: "SIE.DE", name: "Siemens AG", price: 268.45, change: -1.45 },
  ],
  chartData: {},
};

/* ============================================================
   SEED FUNCTIONS
   ============================================================ */

async function seedSchema() {
  console.log("\n  Creating collections + fields...");
  for (const [name, fields] of Object.entries(COLLECTIONS)) {
    await createCollection(name, fields);
  }
}

async function seedCategories() {
  console.log("\n  Seeding categories...");
  const deleted = await deleteAllItems("categories");
  if (deleted) console.log(`    Deleted ${deleted} existing categories`);

  const idMap = {};
  for (const cat of CATEGORIES) {
    const id = await createItem("categories", cat);
    idMap[cat.slug] = id;
    console.log(`    "${cat.name}" → ${id}`);
  }
  return idMap;
}

async function seedAuthors() {
  console.log("\n  Seeding authors...");
  const deleted = await deleteAllItems("authors");
  if (deleted) console.log(`    Deleted ${deleted} existing authors`);

  const idMap = {};
  for (const author of AUTHORS) {
    const id = await createItem("authors", author);
    idMap[author.slug] = id;
    console.log(`    "${author.name}" → ${id}`);
  }
  return idMap;
}

async function seedArticles(categoryIds, authorIds) {
  console.log("\n  Seeding articles...");
  const deleted = await deleteAllItems("articles");
  if (deleted) console.log(`    Deleted ${deleted} existing articles`);

  for (const art of ARTICLES) {
    const data = {
      headline: art.headline,
      slug: art.slug,
      teaser: art.teaser,
      body: art.body,
      imageUrl: art.imageUrl,
      category: categoryIds[art.categorySlug],
      author: authorIds[art.authorSlug],
      tags: art.tags,
      readingTimeMinutes: art.readingTimeMinutes,
      isFeatured: art.isFeatured ?? false,
      isOpinion: art.isOpinion ?? false,
      region: art.region ?? "",
    };
    const id = await createItem("articles", data);
    console.log(`    "${art.headline.slice(0, 50)}..." → ${id}`);
  }
}

async function seedNewsticker() {
  console.log("\n  Seeding newsticker...");
  const deleted = await deleteAllItems("newsticker");
  if (deleted) console.log(`    Deleted ${deleted} existing newsticker`);
  for (const nt of NEWSTICKER) {
    const id = await createItem("newsticker", nt);
    console.log(`    "${nt.headline.slice(0, 50)}" → ${id}`);
  }
}

async function seedVideos() {
  console.log("\n  Seeding videos...");
  const deleted = await deleteAllItems("videos");
  if (deleted) console.log(`    Deleted ${deleted} existing videos`);
  for (const v of VIDEOS) {
    const id = await createItem("videos", v);
    console.log(`    "${v.title}" → ${id}`);
  }
}

async function seedBreakingNews() {
  console.log("\n  Seeding breaking news...");
  const deleted = await deleteAllItems("breaking_news");
  if (deleted) console.log(`    Deleted ${deleted} existing breaking news`);
  for (const bn of BREAKING_NEWS) {
    const id = await createItem("breaking_news", bn);
    console.log(`    "${bn.headline.slice(0, 50)}" → ${id}`);
  }
}

async function seedSingletons() {
  console.log("\n  Seeding singletons (navigation, site_config, quiz, stock_data)...");

  await deleteAllItems("navigation");
  const navId = await createItem("navigation", NAVIGATION);
  console.log(`    Navigation → ${navId}`);

  await deleteAllItems("site_config");
  const cfgId = await createItem("site_config", SITE_CONFIG);
  console.log(`    SiteConfig → ${cfgId}`);

  await deleteAllItems("quiz");
  const quizId = await createItem("quiz", QUIZ);
  console.log(`    Quiz → ${quizId}`);

  await deleteAllItems("stock_data");
  const stockId = await createItem("stock_data", STOCK_DATA);
  console.log(`    StockData → ${stockId}`);
}

/* ============================================================
   MAIN
   ============================================================ */

async function main() {
  console.log(`\n🚀 Berliner Rundschau — Directus Seed`);
  console.log(`   URL: ${URL}`);

  // Verify connection
  const health = await fetch(`${URL}/server/health`).then((r) => r.json()).catch(() => null);
  if (!health || health.status !== "ok") {
    console.error("❌ Directus not reachable or unhealthy");
    process.exit(1);
  }
  console.log("   ✅ Directus is healthy\n");

  await seedSchema();
  const categoryIds = await seedCategories();
  const authorIds = await seedAuthors();
  await seedArticles(categoryIds, authorIds);
  await seedNewsticker();
  await seedVideos();
  await seedBreakingNews();
  await seedSingletons();

  console.log("\n✅ Seed complete!\n");
  console.log("Next steps:");
  console.log(`  1. Set in .env.local:`);
  console.log(`     CMS_ADAPTER=directus`);
  console.log(`     DIRECTUS_URL=${URL}`);
  console.log(`     DIRECTUS_STATIC_TOKEN=${TOKEN}`);
  console.log(`     CMS_IMAGE_DOMAINS=images.unsplash.com`);
  console.log(`  2. npm run dev`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
