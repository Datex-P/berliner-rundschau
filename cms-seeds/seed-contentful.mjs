#!/usr/bin/env node
/**
 * Seeds a Contentful space with Berliner Rundschau demo data.
 *
 * Usage:
 *   node cms-seeds/seed-contentful.mjs --space-id <id> --management-token <token>
 *
 * Prerequisites:
 *   - Node.js 18+ (uses built-in fetch)
 *   - A Contentful space (free tier works)
 *   - A Personal Access Token from https://app.contentful.com/account/profile/cma_tokens
 */

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

const SPACE_ID = getArg("space-id");
const TOKEN = getArg("management-token");
const ENVIRONMENT = getArg("environment") ?? "master";

if (!SPACE_ID || !TOKEN) {
  console.error(
    "Usage: node seed-contentful.mjs --space-id <id> --management-token <token> [--environment <env>]",
  );
  process.exit(1);
}

const BASE = `https://api.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}`;
const LOCALE = "en-US";

let requestCount = 0;

async function api(method, path, body, extraHeaders = {}) {
  requestCount++;
  // Rate limit: Contentful allows ~7 req/s on CMA
  if (requestCount % 6 === 0) await sleep(1200);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/vnd.contentful.management.v1+json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429) {
    const wait = parseInt(res.headers.get("x-contentful-ratelimit-reset") ?? "2", 10);
    console.log(`  Rate limited, waiting ${wait}s...`);
    await sleep(wait * 1000 + 500);
    return api(method, path, body, extraHeaders);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }

  return res.status === 204 ? null : res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loc(value) {
  return { [LOCALE]: value };
}

function link(type, id) {
  return { [LOCALE]: { sys: { type: "Link", linkType: type, id } } };
}

// --- Rich Text helpers ---

function richText(htmlBody) {
  const nodes = [];
  const parts = htmlBody.split(/<\/?(?:p|h2|h3|blockquote|ul)>/g);
  const tags = htmlBody.match(/<(?:p|h2|h3|blockquote|ul)[^>]*>/g) || [];

  let tagIdx = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      tagIdx++;
      continue;
    }

    const tag = tags[tagIdx - 1] || "<p>";
    const cleanText = trimmed
      .replace(/<\/?(?:strong|em|a|li|br\s*\/?)(?:\s[^>]*)?>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) {
      tagIdx++;
      continue;
    }

    if (tag.startsWith("<h2")) {
      nodes.push(heading(2, cleanText));
    } else if (tag.startsWith("<h3")) {
      nodes.push(heading(3, cleanText));
    } else if (tag.startsWith("<blockquote")) {
      nodes.push(blockquote(cleanText));
    } else if (tag.startsWith("<ul")) {
      const items = trimmed.match(/<li[^>]*>(.*?)<\/li>/gs) || [];
      nodes.push(unorderedList(items.map((li) =>
        li.replace(/<\/?(?:li|strong|em)[^>]*>/g, "").trim()
      )));
    } else {
      nodes.push(paragraph(cleanText));
    }
    tagIdx++;
  }

  if (nodes.length === 0) {
    nodes.push(paragraph(htmlBody.replace(/<[^>]+>/g, "").trim()));
  }

  return {
    nodeType: "document",
    data: {},
    content: nodes,
  };
}

function paragraph(text) {
  return {
    nodeType: "paragraph",
    data: {},
    content: [{ nodeType: "text", value: text, marks: [], data: {} }],
  };
}

function heading(level, text) {
  return {
    nodeType: `heading-${level}`,
    data: {},
    content: [{ nodeType: "text", value: text, marks: [], data: {} }],
  };
}

function blockquote(text) {
  return {
    nodeType: "blockquote",
    data: {},
    content: [paragraph(text)],
  };
}

function unorderedList(items) {
  return {
    nodeType: "unordered-list",
    data: {},
    content: items.map((item) => ({
      nodeType: "list-item",
      data: {},
      content: [paragraph(item)],
    })),
  };
}

// --- Content Type definitions ---

const CONTENT_TYPES = [
  {
    id: "category",
    name: "Category",
    displayField: "name",
    fields: [
      { id: "name", name: "Name", type: "Symbol", required: true },
      { id: "slug", name: "Slug", type: "Symbol", required: true, validations: [{ unique: true }] },
      { id: "description", name: "Description", type: "Text", required: false },
      { id: "color", name: "Color", type: "Symbol", required: false },
    ],
  },
  {
    id: "author",
    name: "Author",
    displayField: "name",
    fields: [
      { id: "name", name: "Name", type: "Symbol", required: true },
      { id: "slug", name: "Slug", type: "Symbol", required: true, validations: [{ unique: true }] },
      { id: "bio", name: "Bio", type: "Text", required: false },
      { id: "avatar", name: "Avatar", type: "Link", linkType: "Asset", required: false },
      { id: "email", name: "Email", type: "Symbol", required: false },
    ],
  },
  {
    id: "article",
    name: "Article",
    displayField: "title",
    fields: [
      { id: "title", name: "Title", type: "Symbol", required: true },
      { id: "slug", name: "Slug", type: "Symbol", required: true, validations: [{ unique: true }] },
      { id: "body", name: "Body", type: "RichText", required: false },
      { id: "excerpt", name: "Excerpt", type: "Text", required: false },
      { id: "heroImage", name: "Hero Image", type: "Link", linkType: "Asset", required: false },
      { id: "category", name: "Category", type: "Link", linkType: "Entry", required: false, validations: [{ linkContentType: ["category"] }] },
      { id: "author", name: "Author", type: "Link", linkType: "Entry", required: false, validations: [{ linkContentType: ["author"] }] },
      { id: "publishedAt", name: "Published At", type: "Date", required: false },
      { id: "featured", name: "Featured", type: "Boolean", required: false },
      { id: "tags", name: "Tags", type: "Array", items: { type: "Symbol" }, required: false },
    ],
  },
];

// --- Seed Data ---

const CATEGORIES = [
  { id: "seed-cat-politik", name: "Politik", slug: "politik", description: "Aktuelle politische Nachrichten aus Berlin, Deutschland und der Welt.", color: "#15803d" },
  { id: "seed-cat-wirtschaft", name: "Wirtschaft", slug: "wirtschaft", description: "Wirtschaftsnachrichten, Börse, Unternehmen und Start-ups aus Berlin.", color: "#16a34a" },
  { id: "seed-cat-berlin", name: "Berlin", slug: "berlin", description: "Lokalnachrichten aus allen Berliner Bezirken — Verkehr, Wohnen, Stadtentwicklung.", color: "#0ea5e9" },
  { id: "seed-cat-kultur", name: "Kultur", slug: "kultur", description: "Kunst, Musik, Theater, Film und Ausstellungen in Berlin.", color: "#8b5cf6" },
  { id: "seed-cat-sport", name: "Sport", slug: "sport", description: "Sportnachrichten aus Berlin — Hertha BSC, Union Berlin, Alba und mehr.", color: "#3b82f6" },
  { id: "seed-cat-meinung", name: "Meinung", slug: "meinung", description: "Kommentare, Analysen und Gastbeiträge zu aktuellen Themen.", color: "#f59e0b" },
];

const AUTHORS = [
  { id: "seed-author-anna", name: "Anna Schmidt", slug: "anna-schmidt", bio: "Chefredakteurin der Berliner Rundschau. Schwerpunkte: Landespolitik, Infrastruktur und Stadtentwicklung.", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face", avatarAlt: "Anna Schmidt" },
  { id: "seed-author-markus", name: "Markus Weber", slug: "markus-weber", bio: "Wirtschaftsredakteur mit Fokus auf Start-ups, Immobilien und Berliner Wirtschaftspolitik.", avatarUrl: "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face", avatarAlt: "Markus Weber" },
  { id: "seed-author-lisa", name: "Lisa Müller", slug: "lisa-mueller", bio: "Kulturredakteurin der Berliner Rundschau. Berichtet über Ausstellungen, Theater und die Berliner Kunstszene.", avatarUrl: "https://images.unsplash.com/photo-1573496527892-904f897eb744?auto=format&fit=crop&w=200&h=200&q=80&crop=face", avatarAlt: "Lisa Müller" },
  { id: "seed-author-thomas", name: "Thomas Becker", slug: "thomas-becker", bio: "Sportredakteur mit Leidenschaft für Berliner Fußball. Begleitet Hertha BSC und Union Berlin seit über zehn Jahren.", avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80&crop=faces", avatarAlt: "Thomas Becker" },
];

const ARTICLES = [
  {
    id: "seed-art-1",
    title: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    excerpt: "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
    body: '<p>Berlin steht vor einem grundlegenden Wandel im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann.</p><blockquote>Die Investitionen in Höhe von 2,3 Milliarden Euro sind die größten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg, wo bisher viele Bewohner auf Busverbindungen angewiesen waren.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Straßenbahn fährt durch Berlin-Mitte",
    categoryId: "seed-cat-politik",
    authorId: "seed-author-anna",
    publishedAt: "2026-06-28T08:00:00Z",
    featured: true,
    tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"],
  },
  {
    id: "seed-art-2",
    title: "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    excerpt: "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
    body: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte über 200 neue Unternehmen gegründet — ein Plus von 34 Prozent gegenüber dem Vorjahreszeitraum.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen.</p><h2>Venture Capital fließt in Rekordhöhe</h2><p>Im ersten Halbjahr 2026 flossen 3,8 Milliarden Euro Risikokapital in Berliner Jungunternehmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Modernes Büro eines Berliner Start-ups",
    categoryId: "seed-cat-wirtschaft",
    authorId: "seed-author-markus",
    publishedAt: "2026-06-27T14:00:00Z",
    featured: false,
    tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"],
  },
  {
    id: "seed-art-3",
    title: "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    excerpt: "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    body: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein außergewöhnlich vielfältiges Programm.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins. Über 150 Werke zeitgenössischer Künstler zeigen Visionen für die Stadt von morgen.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Berlinische Galerie Ausstellungsraum",
    categoryId: "seed-cat-kultur",
    authorId: "seed-author-lisa",
    publishedAt: "2026-06-26T10:00:00Z",
    featured: false,
    tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"],
  },
  {
    id: "seed-art-4",
    title: "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
    slug: "hertha-bsc-nachwuchs-talente",
    excerpt: "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
    body: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben Profiverträge erhalten.</p><h2>Die drei Neuzugänge</h2><ul><li>Emre Yilmaz (18) — zentrales Mittelfeld, 14 Tore in der A-Junioren-Bundesliga</li><li>Jonas Hartmann (19) — Innenverteidiger, U19-Nationalspieler</li><li>Karim Benali (18) — Linksaußen, schnellster Spieler der Jugendabteilung</li></ul><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehört mittlerweile zu den produktivsten im deutschen Profifußball.</p>',
    imageUrl: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Olympiastadion Berlin — Heimat von Hertha BSC",
    categoryId: "seed-cat-sport",
    authorId: "seed-author-thomas",
    publishedAt: "2026-06-25T16:00:00Z",
    featured: false,
    tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"],
  },
  {
    id: "seed-art-5",
    title: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    slug: "wohnungsmarkt-berlin-mietpreise",
    excerpt: "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten. Ein Überblick.",
    body: '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete für Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter überschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m², gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m²) und Friedrichshain-Kreuzberg (16,90 Euro/m²).</p><h2>Neubau stockt weiter</h2><p>Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt.</p>',
    imageUrl: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Wohnhäuser in Berlin-Kreuzberg",
    categoryId: "seed-cat-berlin",
    authorId: "seed-author-markus",
    publishedAt: "2026-06-24T09:00:00Z",
    featured: false,
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
  },
  {
    id: "seed-art-6",
    title: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    excerpt: "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse der Ursachen.",
    body: '<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Während Estland längst eine volldigitale Verwaltung betreibt, kämpfen Berliner Bürgerämter noch mit Faxgeräten und Papierformularen.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. Zweitens scheitern Großprojekte an mangelhafter Projektsteuerung. Drittens blockieren föderale Zuständigkeiten einheitliche Lösungen.</p><h2>Europäische Vorbilder</h2><p>In Dänemark werden 92 Prozent aller Behördengänge digital erledigt. Selbst das wirtschaftlich schwächere Portugal bietet mehr digitale Verwaltungsleistungen als Deutschland.</p>',
    imageUrl: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Warteschlange vor einem Berliner Bürgeramt",
    categoryId: "seed-cat-meinung",
    authorId: "seed-author-anna",
    publishedAt: "2026-06-23T07:00:00Z",
    featured: false,
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"],
  },
  {
    id: "seed-art-7",
    title: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    excerpt: "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    body: '<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung und digitale Fahrgastinformation.</p>',
    imageUrl: "https://images.unsplash.com/photo-1752771433743-47a49376fb63?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "U-Bahn-Station in Berlin",
    categoryId: "seed-cat-berlin",
    authorId: "seed-author-anna",
    publishedAt: "2026-06-22T11:00:00Z",
    featured: false,
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
  },
  {
    id: "seed-art-8",
    title: "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    excerpt: "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030</li><li>Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss</li></ul><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an.</p>',
    imageUrl: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Solaranlage auf einem Berliner Dach",
    categoryId: "seed-cat-politik",
    authorId: "seed-author-anna",
    publishedAt: "2026-06-21T08:00:00Z",
    featured: false,
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
  },
];

// --- Main ---

async function main() {
  console.log(`\nSeeding Contentful space ${SPACE_ID} (${ENVIRONMENT})...\n`);

  // 1. Check locale
  console.log("1/6 Checking space locale...");
  const locales = await api("GET", "/locales");
  const defaultLocale = locales.items.find((l) => l.default);
  if (defaultLocale && defaultLocale.code !== LOCALE) {
    console.log(`  Default locale is "${defaultLocale.code}", adapting...`);
  }
  const L = defaultLocale?.code ?? LOCALE;

  function l(value) {
    return { [L]: value };
  }
  function lnk(type, id) {
    return { [L]: { sys: { type: "Link", linkType: type, id } } };
  }

  // 2. Create/update content types (add missing fields to existing ones)
  console.log("2/6 Creating content types...");

  function buildField(f) {
    const field = {
      id: f.id,
      name: f.name,
      type: f.type,
      required: f.required ?? false,
      localized: false,
    };
    if (f.type === "Link") {
      field.linkType = f.linkType;
      if (f.validations) field.validations = f.validations;
    }
    if (f.type === "Array") field.items = f.items;
    if (f.validations && f.type !== "Link") field.validations = f.validations;
    return field;
  }

  for (const ct of CONTENT_TYPES) {
    let existing = null;
    try {
      existing = await api("GET", `/content_types/${ct.id}`);
    } catch { /* doesn't exist */ }

    if (existing) {
      const existingFieldIds = new Set(existing.fields.map((f) => f.id));
      const missingFields = ct.fields.filter((f) => !existingFieldIds.has(f.id));

      if (missingFields.length === 0) {
        console.log(`  ${ct.id}: already exists, all fields present`);
        continue;
      }

      const updatedFields = [...existing.fields, ...missingFields.map(buildField)];
      await api("PUT", `/content_types/${ct.id}`, {
        name: existing.name,
        displayField: existing.displayField,
        fields: updatedFields,
      }, {
        "X-Contentful-Version": String(existing.sys.version),
      });
      const updated = await api("GET", `/content_types/${ct.id}`);
      await api("PUT", `/content_types/${ct.id}/published`, null, {
        "X-Contentful-Version": String(updated.sys.version),
      });
      console.log(`  ${ct.id}: added fields [${missingFields.map((f) => f.id).join(", ")}]`);
      await sleep(300);
      continue;
    }

    const fields = ct.fields.map(buildField);
    await api("PUT", `/content_types/${ct.id}`, {
      name: ct.name,
      displayField: ct.displayField,
      fields,
    });
    await api("PUT", `/content_types/${ct.id}/published`, null, {
      "X-Contentful-Version": "1",
    });
    console.log(`  ${ct.id}: created + published`);
    await sleep(300);
  }

  // 3. Upload assets (hero images + avatars)
  console.log("3/6 Creating assets...");
  const allAssets = [];

  for (const author of AUTHORS) {
    allAssets.push({
      id: `${author.id}-avatar`,
      title: author.avatarAlt,
      url: author.avatarUrl,
      fileName: `${author.slug}-avatar.jpg`,
      contentType: "image/jpeg",
    });
  }
  for (const article of ARTICLES) {
    allAssets.push({
      id: `${article.id}-hero`,
      title: article.imageAlt,
      url: article.imageUrl,
      fileName: `${article.slug}-hero.jpg`,
      contentType: "image/jpeg",
    });
  }

  for (const asset of allAssets) {
    try {
      const existing = await api("GET", `/assets/${asset.id}`).catch(() => null);
      if (existing) {
        console.log(`  ${asset.id}: already exists, skipping`);
        continue;
      }
    } catch { /* doesn't exist */ }

    await api("PUT", `/assets/${asset.id}`, {
      fields: {
        title: l(asset.title),
        file: {
          [L]: {
            contentType: asset.contentType,
            fileName: asset.fileName,
            upload: asset.url,
          },
        },
      },
    });
    console.log(`  ${asset.id}: created`);
    await sleep(200);
  }

  // 4. Process assets (Contentful needs to download them)
  console.log("4/6 Processing assets (download + publish)...");
  for (const asset of allAssets) {
    try {
      const current = await api("GET", `/assets/${asset.id}`);
      const version = current.sys.version;

      // Check if already processed
      const fileField = current.fields?.file?.[L];
      if (fileField?.url) {
        console.log(`  ${asset.id}: already processed`);
        // Publish if not published
        if (!current.sys.publishedVersion || current.sys.publishedVersion < version) {
          await api("PUT", `/assets/${asset.id}/published`, null, {
            "X-Contentful-Version": String(version),
          });
        }
        continue;
      }

      await api("PUT", `/assets/${asset.id}/files/${L}/process`, null, {
        "X-Contentful-Version": String(version),
      });
      console.log(`  ${asset.id}: processing...`);

      // Wait for processing
      let processed = false;
      for (let attempt = 0; attempt < 15; attempt++) {
        await sleep(2000);
        const check = await api("GET", `/assets/${asset.id}`);
        if (check.fields?.file?.[L]?.url) {
          processed = true;
          await api("PUT", `/assets/${asset.id}/published`, null, {
            "X-Contentful-Version": String(check.sys.version),
          });
          console.log(`  ${asset.id}: processed + published`);
          break;
        }
      }
      if (!processed) {
        console.warn(`  ${asset.id}: processing timeout — skipping`);
      }
    } catch (err) {
      console.warn(`  ${asset.id}: ${err.message}`);
    }
  }

  // 5. Create entries (with existing-entry detection)
  console.log("5/6 Creating entries...");

  // Build slug→id maps for existing entries
  const catIdMap = {};
  const authorIdMap = {};

  async function findBySlug(contentType, slug) {
    const res = await api("GET", `/entries?content_type=${contentType}&fields.slug=${encodeURIComponent(slug)}&limit=1`);
    return res.items?.[0] ?? null;
  }

  async function findByName(contentType, name) {
    const res = await api("GET", `/entries?content_type=${contentType}&fields.name=${encodeURIComponent(name)}&limit=1`);
    return res.items?.[0] ?? null;
  }

  // Categories
  for (const cat of CATEGORIES) {
    // Check if already exists by slug or name
    let existing = await findBySlug("category", cat.slug).catch(() => null);
    if (!existing) existing = await findByName("category", cat.name).catch(() => null);

    if (existing) {
      catIdMap[cat.id] = existing.sys.id;
      console.log(`  category "${cat.name}": exists (${existing.sys.id}), reusing`);
      continue;
    }

    const entry = await api("PUT", `/entries/${cat.id}`, {
      fields: {
        name: l(cat.name),
        slug: l(cat.slug),
        description: l(cat.description),
        color: l(cat.color),
      },
    }, {
      "X-Contentful-Content-Type": "category",
    });
    await api("PUT", `/entries/${cat.id}/published`, null, {
      "X-Contentful-Version": String(entry.sys.version),
    });
    catIdMap[cat.id] = cat.id;
    console.log(`  category "${cat.name}": created + published`);
    await sleep(200);
  }

  // Authors
  for (const author of AUTHORS) {
    let existing = await findByName("author", author.name).catch(() => null);

    if (existing) {
      authorIdMap[author.id] = existing.sys.id;
      console.log(`  author "${author.name}": exists (${existing.sys.id}), reusing`);
      continue;
    }

    const entry = await api("PUT", `/entries/${author.id}`, {
      fields: {
        name: l(author.name),
        slug: l(author.slug),
        bio: l(author.bio),
        avatar: lnk("Asset", `${author.id}-avatar`),
      },
    }, {
      "X-Contentful-Content-Type": "author",
    });
    await api("PUT", `/entries/${author.id}/published`, null, {
      "X-Contentful-Version": String(entry.sys.version),
    });
    authorIdMap[author.id] = author.id;
    console.log(`  author "${author.name}": created + published`);
    await sleep(200);
  }

  // Articles
  for (const art of ARTICLES) {
    let existing = await findBySlug("article", art.slug).catch(() => null);
    if (existing) {
      console.log(`  article "${art.title.substring(0, 40)}...": exists, skipping`);
      continue;
    }

    const resolvedCatId = catIdMap[art.categoryId] ?? art.categoryId;
    const resolvedAuthorId = authorIdMap[art.authorId] ?? art.authorId;

    const entry = await api("PUT", `/entries/${art.id}`, {
      fields: {
        title: l(art.title),
        slug: l(art.slug),
        body: l(richText(art.body)),
        excerpt: l(art.excerpt),
        heroImage: lnk("Asset", `${art.id}-hero`),
        category: lnk("Entry", resolvedCatId),
        author: lnk("Entry", resolvedAuthorId),
        publishedAt: l(art.publishedAt),
        featured: l(art.featured),
        tags: l(art.tags),
      },
    }, {
      "X-Contentful-Content-Type": "article",
    });
    await api("PUT", `/entries/${art.id}/published`, null, {
      "X-Contentful-Version": String(entry.sys.version),
    });
    console.log(`  article "${art.title.substring(0, 40)}...": created + published`);
    await sleep(200);
  }

  // 6. Summary
  console.log("\n6/6 Done!\n");
  console.log(`  Created: ${CATEGORIES.length} categories, ${AUTHORS.length} authors, ${ARTICLES.length} articles, ${allAssets.length} assets`);
  console.log(`\n  Next steps:`);
  console.log(`  1. Add to .env.local:`);
  console.log(`     CMS_ADAPTER=contentful`);
  console.log(`     CONTENTFUL_SPACE_ID=${SPACE_ID}`);
  console.log(`     CONTENTFUL_ACCESS_TOKEN=<your-cda-token>`);
  console.log(`     CMS_IMAGE_DOMAINS=images.ctfassets.net`);
  console.log(`     CONTENTFUL_FIELD_MAP={"headline":"title","teaser":"excerpt","image":"heroImage","isFeatured":"featured"}`);
  console.log(`  2. npm run dev`);
  console.log(`  3. Open http://localhost:3000\n`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
