#!/usr/bin/env node
/**
 * Seeds a Prismic repository with Berliner Rundschau demo data.
 *
 * Usage:
 *   node cms-seeds/seed-prismic.mjs \
 *     --repository <repo-name> \
 *     --write-token <migration-api-token> \
 *     --custom-types-token <custom-types-api-token>
 *
 * Prerequisites:
 *   - Node.js 20+ (uses @prismicio/client createWriteClient + createMigration)
 *   - npm install @prismicio/client (already in this project)
 *   - A Prismic repository (free tier works)
 *   - Write Token: Dashboard → Settings → API & Security → Content Migration API
 *   - Custom Types API Token: Dashboard → Settings → API & Security → Custom Types API
 *
 * Identische Inhalte wie seed-contentful.mjs und seed-wordpress.mjs.
 * Idempotent: Custom Types werden per GET geprueft, Migration API dedupliziert Assets.
 */

import * as prismic from "@prismicio/client";

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

const REPOSITORY = getArg("repository");
const WRITE_TOKEN = getArg("write-token");
const CT_TOKEN = getArg("custom-types-token");

if (!REPOSITORY || !WRITE_TOKEN || !CT_TOKEN) {
  console.error(
    `Usage: node seed-prismic.mjs \\
  --repository <repo-name> \\
  --write-token <migration-api-token> \\
  --custom-types-token <custom-types-api-token>

Tokens:
  --write-token         Settings → API & Security → Content Migration API
  --custom-types-token  Settings → API & Security → Custom Types API`,
  );
  process.exit(1);
}

const CT_API = "https://customtypes.prismic.io";
const MIGRATION_API = "https://migration.prismic.io";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------- Custom Types API ---------- */

async function ctApi(method, path, body) {
  const res = await fetch(`${CT_API}${path}`, {
    method,
    headers: {
      repository: REPOSITORY,
      Authorization: `Bearer ${CT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 409) return "exists";
  if (res.status === 204 || res.status === 200 || res.status === 201) return null;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CT API ${method} ${path} → ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return null;
}

/* ---------- Rich Text helpers (HTML → Prismic AST) ---------- */

function htmlToRichText(html) {
  const nodes = [];
  const regex =
    /<(p|h2|h3|blockquote|ul)(?:\s[^>]*)?>(?<content>[\s\S]*?)<\/\1>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1];
    const inner = match.groups.content.trim();
    if (!inner) continue;

    if (tag === "h2") {
      nodes.push(richHeading("heading2", inner));
    } else if (tag === "h3") {
      nodes.push(richHeading("heading3", inner));
    } else if (tag === "blockquote") {
      const blockInner = inner.replace(/<\/?p>/g, "").trim();
      nodes.push(richParagraph(blockInner));
    } else if (tag === "ul") {
      const items = [...inner.matchAll(/<li[^>]*>(.*?)<\/li>/gs)];
      for (const li of items) {
        nodes.push(richListItem(stripHtml(li[1])));
      }
    } else {
      nodes.push(richParagraph(inner));
    }
  }

  if (nodes.length === 0) {
    nodes.push(richParagraph(stripHtml(html)));
  }

  return nodes;
}

function richParagraph(htmlText) {
  const { text, spans } = parseInlineMarks(htmlText);
  return { type: "paragraph", text, spans };
}

function richHeading(type, htmlText) {
  const { text, spans } = parseInlineMarks(htmlText);
  return { type, text, spans };
}

function richListItem(plainText) {
  return { type: "list-item", text: plainText, spans: [] };
}

function parseInlineMarks(html) {
  const spans = [];
  let text = "";
  let pos = 0;

  const markRegex = /<(strong|em)>([\s\S]*?)<\/\1>/g;
  let cleaned = html;

  const allMarks = [];
  let m;
  while ((m = markRegex.exec(html)) !== null) {
    allMarks.push({
      tag: m[1],
      full: m[0],
      inner: m[2],
      index: m.index,
    });
  }

  if (allMarks.length === 0) {
    return { text: stripHtml(html), spans: [] };
  }

  let result = "";
  let lastEnd = 0;

  for (const mark of allMarks) {
    const before = stripHtml(html.substring(lastEnd, mark.index));
    result += before;
    const start = result.length;
    const inner = stripHtml(mark.inner);
    result += inner;
    const end = result.length;

    spans.push({
      start,
      end,
      type: mark.tag === "strong" ? "strong" : "em",
    });

    lastEnd = mark.index + mark.full.length;
  }

  result += stripHtml(html.substring(lastEnd));

  return { text: result, spans };
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/­/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- Custom Type definitions (Prismic JSON schema) ---------- */

const CUSTOM_TYPES = [
  {
    id: "category",
    label: "Category",
    repeatable: true,
    status: true,
    json: {
      Main: {
        uid: {
          type: "UID",
          config: { label: "UID (Slug)" },
        },
        name: {
          type: "Text",
          config: { label: "Name" },
        },
        description: {
          type: "Text",
          config: { label: "Description" },
        },
        color: {
          type: "Text",
          config: { label: "Color", placeholder: "#15803d" },
        },
      },
    },
  },
  {
    id: "author",
    label: "Author",
    repeatable: true,
    status: true,
    json: {
      Main: {
        uid: {
          type: "UID",
          config: { label: "UID (Slug)" },
        },
        name: {
          type: "Text",
          config: { label: "Name" },
        },
        bio: {
          type: "Text",
          config: { label: "Bio" },
        },
        avatar: {
          type: "Image",
          config: {
            label: "Avatar",
            constraint: {},
            thumbnails: [],
          },
        },
        role: {
          type: "Text",
          config: { label: "Role" },
        },
      },
    },
  },
  {
    id: "article",
    label: "Article",
    repeatable: true,
    status: true,
    json: {
      Main: {
        uid: {
          type: "UID",
          config: { label: "UID (Slug)" },
        },
        headline: {
          type: "Text",
          config: { label: "Headline" },
        },
        teaser: {
          type: "Text",
          config: { label: "Teaser" },
        },
        body: {
          type: "StructuredText",
          config: {
            label: "Body",
            multi:
              "paragraph,heading2,heading3,strong,em,hyperlink,list-item,o-list-item,image,embed",
          },
        },
        image: {
          type: "Image",
          config: {
            label: "Hero Image",
            constraint: {},
            thumbnails: [],
          },
        },
        category: {
          type: "Link",
          config: {
            label: "Category",
            select: "document",
            customtypes: ["category"],
          },
        },
        author: {
          type: "Link",
          config: {
            label: "Author",
            select: "document",
            customtypes: ["author"],
          },
        },
        isPremium: {
          type: "Boolean",
          config: { label: "Premium", default_value: false },
        },
        isFeatured: {
          type: "Boolean",
          config: { label: "Featured", default_value: false },
        },
        isOpinion: {
          type: "Boolean",
          config: { label: "Opinion", default_value: false },
        },
        isBreaking: {
          type: "Boolean",
          config: { label: "Breaking", default_value: false },
        },
        isLive: {
          type: "Boolean",
          config: { label: "Live", default_value: false },
        },
        region: {
          type: "Text",
          config: { label: "Region" },
        },
        aiSummary: {
          type: "Text",
          config: { label: "AI Summary" },
        },
      },
    },
  },
  {
    id: "newsticker",
    label: "Newsticker",
    repeatable: true,
    status: true,
    json: {
      Main: {
        uid: { type: "UID", config: { label: "UID" } },
        headline: { type: "Text", config: { label: "Headline" } },
        href: { type: "Text", config: { label: "Link" } },
        topic: { type: "Text", config: { label: "Topic" } },
        isPremium: {
          type: "Boolean",
          config: { label: "Premium", default_value: false },
        },
      },
    },
  },
  {
    id: "stockData",
    label: "Stock Data",
    repeatable: false,
    status: true,
    json: {
      Main: {
        uid: { type: "UID", config: { label: "UID" } },
        json: { type: "Text", config: { label: "JSON Data" } },
      },
    },
  },
  {
    id: "quiz",
    label: "Quiz",
    repeatable: false,
    status: true,
    json: {
      Main: {
        uid: { type: "UID", config: { label: "UID" } },
        json: { type: "Text", config: { label: "JSON Data" } },
      },
    },
  },
];

/* ---------- Seed Data ---------- */

const CATEGORIES = [
  {
    name: "Politik",
    slug: "politik",
    description:
      "Aktuelle politische Nachrichten aus Berlin, Deutschland und der Welt.",
    color: "#15803d",
  },
  {
    name: "Wirtschaft",
    slug: "wirtschaft",
    description:
      "Wirtschaftsnachrichten, Börse, Unternehmen und Start-ups aus Berlin.",
    color: "#16a34a",
  },
  {
    name: "Berlin",
    slug: "berlin",
    description:
      "Lokalnachrichten aus allen Berliner Bezirken — Verkehr, Wohnen, Stadtentwicklung.",
    color: "#0ea5e9",
  },
  {
    name: "Kultur",
    slug: "kultur",
    description:
      "Kunst, Musik, Theater, Film und Ausstellungen in Berlin.",
    color: "#8b5cf6",
  },
  {
    name: "Sport",
    slug: "sport",
    description:
      "Sportnachrichten aus Berlin — Hertha BSC, Union Berlin, Alba und mehr.",
    color: "#3b82f6",
  },
  {
    name: "Meinung",
    slug: "meinung",
    description:
      "Kommentare, Analysen und Gastbeiträge zu aktuellen Themen.",
    color: "#f59e0b",
  },
];

const AUTHORS = [
  {
    name: "Anna Schmidt",
    slug: "anna-schmidt",
    bio: "Chefredakteurin der Berliner Rundschau. Schwerpunkte: Landespolitik, Infrastruktur und Stadtentwicklung.",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    avatarAlt: "Anna Schmidt",
    role: "Chefredakteurin",
  },
  {
    name: "Markus Weber",
    slug: "markus-weber",
    bio: "Wirtschaftsredakteur mit Fokus auf Start-ups, Immobilien und Berliner Wirtschaftspolitik.",
    avatarUrl:
      "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    avatarAlt: "Markus Weber",
    role: "Wirtschaftsredakteur",
  },
  {
    name: "Lisa Müller",
    slug: "lisa-mueller",
    bio: "Kulturredakteurin der Berliner Rundschau. Berichtet über Ausstellungen, Theater und die Berliner Kunstszene.",
    avatarUrl:
      "https://images.unsplash.com/photo-1573496527892-904f897eb744?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    avatarAlt: "Lisa Müller",
    role: "Kulturredakteurin",
  },
  {
    name: "Thomas Becker",
    slug: "thomas-becker",
    bio: "Sportredakteur mit Leidenschaft für Berliner Fußball. Begleitet Hertha BSC und Union Berlin seit über zehn Jahren.",
    avatarUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80&crop=faces",
    avatarAlt: "Thomas Becker",
    role: "Sportredakteur",
  },
];

const ARTICLES = [
  {
    headline: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    teaser:
      "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
    body: '<p>Berlin steht vor einem <strong>grundlegenden Wandel</strong> im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann.</p><blockquote>Die Investitionen in Höhe von 2,3 Milliarden Euro sind die größten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg, wo bisher viele Bewohner auf Busverbindungen angewiesen waren.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Straßenbahn fährt durch Berlin-Mitte",
    categorySlug: "politik",
    authorSlug: "anna-schmidt",
    tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"],
    isFeatured: true,
  },
  {
    headline:
      "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    teaser:
      "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
    body: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte über 200 neue Unternehmen gegründet — ein Plus von 34 Prozent gegenüber dem Vorjahreszeitraum.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen.</p><h2>Venture Capital fließt in Rekordhöhe</h2><p>Im ersten Halbjahr 2026 flossen 3,8 Milliarden Euro Risikokapital in Berliner Jungunternehmen.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Modernes Büro eines Berliner Start-ups",
    categorySlug: "wirtschaft",
    authorSlug: "markus-weber",
    tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"],
    isFeatured: false,
  },
  {
    headline:
      "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    teaser:
      "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    body: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein außergewöhnlich vielfältiges Programm.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins. Über 150 Werke zeitgenössischer Künstler zeigen Visionen für die Stadt von morgen.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Berlinische Galerie Ausstellungsraum",
    categorySlug: "kultur",
    authorSlug: "lisa-mueller",
    tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"],
    isFeatured: false,
  },
  {
    headline:
      "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
    slug: "hertha-bsc-nachwuchs-talente",
    teaser:
      "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
    body: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben Profiverträge erhalten.</p><h2>Die drei Neuzugänge</h2><ul><li>Emre Yilmaz (18) — zentrales Mittelfeld, 14 Tore in der A-Junioren-Bundesliga</li><li>Jonas Hartmann (19) — Innenverteidiger, U19-Nationalspieler</li><li>Karim Benali (18) — Linksaußen, schnellster Spieler der Jugendabteilung</li></ul><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehört mittlerweile zu den produktivsten im deutschen Profifußball.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Olympiastadion Berlin — Heimat von Hertha BSC",
    categorySlug: "sport",
    authorSlug: "thomas-becker",
    tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"],
    isFeatured: false,
  },
  {
    headline: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    slug: "wohnungsmarkt-berlin-mietpreise",
    teaser:
      "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten. Ein Überblick.",
    body: '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete für Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter überschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m², gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m²) und Friedrichshain-Kreuzberg (16,90 Euro/m²).</p><h2>Neubau stockt weiter</h2><p>Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Wohnhäuser in Berlin-Kreuzberg",
    categorySlug: "berlin",
    authorSlug: "markus-weber",
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
    isFeatured: false,
  },
  {
    headline:
      "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    teaser:
      "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse der Ursachen.",
    body: '<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Während Estland längst eine volldigitale Verwaltung betreibt, kämpfen Berliner Bürgerämter noch mit Faxgeräten und Papierformularen.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. Zweitens scheitern Großprojekte an mangelhafter Projektsteuerung. Drittens blockieren föderale Zuständigkeiten einheitliche Lösungen.</p><h2>Europäische Vorbilder</h2><p>In Dänemark werden 92 Prozent aller Behördengänge digital erledigt. Selbst das wirtschaftlich schwächere Portugal bietet mehr digitale Verwaltungsleistungen als Deutschland.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Warteschlange vor einem Berliner Bürgeramt",
    categorySlug: "meinung",
    authorSlug: "anna-schmidt",
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"],
    isFeatured: false,
    isOpinion: true,
  },
  {
    headline:
      "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    teaser:
      "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    body: '<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung und digitale Fahrgastinformation.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1752771433743-47a49376fb63?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "U-Bahn-Station in Berlin",
    categorySlug: "berlin",
    authorSlug: "anna-schmidt",
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
    isFeatured: false,
  },
  {
    headline:
      "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    teaser:
      "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030</li><li>Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss</li></ul><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an.</p>',
    imageUrl:
      "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Solaranlage auf einem Berliner Dach",
    categorySlug: "politik",
    authorSlug: "anna-schmidt",
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
    isFeatured: false,
  },
];

const NEWSTICKER_ITEMS = [
  { slug: "nt-bundestag-digitalgesetz", headline: "Bundestag beschließt neues Digitalgesetz", href: "/artikel/bundestag-digitalgesetz", topic: "Politik", isPremium: false },
  { slug: "nt-sbahn-ringbahn", headline: "S-Bahn-Störung auf der Ringbahn behoben", href: "/artikel/sbahn-ringbahn-stoerung", topic: "Berlin", isPremium: false },
  { slug: "nt-dax-rekordhoch", headline: "DAX schließt mit Rekordhoch bei 21.450 Punkten", href: "/artikel/dax-rekordhoch", topic: "Wirtschaft", isPremium: true },
  { slug: "nt-union-berlin-transfer", headline: "Union Berlin verpflichtet schwedischen Stürmer", href: "/artikel/union-berlin-transfer", topic: "Sport", isPremium: false },
  { slug: "nt-berlinale-jury", headline: "Berlinale kündigt Jury-Präsidentin für 2027 an", href: "/artikel/berlinale-jury", topic: "Kultur", isPremium: false },
  { slug: "nt-fahrradstrasse", headline: "Neue Fahrradstraße in Friedrichshain eröffnet", href: "/artikel/fahrradstrasse-friedrichshain", topic: "Berlin", isPremium: false },
];

const STOCK_DATA_JSON = JSON.stringify({
  indices: [
    { id: "dax", name: "DAX", value: 21450.32, change: 123.45, changePercent: 0.58, currency: "EUR", sparkline: [21200, 21280, 21350, 21400, 21450] },
    { id: "mdax", name: "MDAX", value: 28932.1, change: -45.2, changePercent: -0.16, currency: "EUR", sparkline: [29000, 28980, 28950, 28940, 28932] },
    { id: "dow", name: "Dow Jones", value: 42567.89, change: 234.56, changePercent: 0.55, currency: "USD", sparkline: [42300, 42400, 42450, 42500, 42568] },
    { id: "eurusd", name: "EUR/USD", value: 1.0892, change: 0.0023, changePercent: 0.21, currency: "", sparkline: [1.086, 1.087, 1.088, 1.089, 1.089] },
  ],
  watchlist: [
    { id: "sap", symbol: "SAP.DE", name: "SAP SE", price: 192.45, change: 3.2, changePercent: 1.69, marketCap: "237.1B", pe: 38.2, sector: "Technologie" },
    { id: "sie", symbol: "SIE.DE", name: "Siemens AG", price: 178.9, change: -1.45, changePercent: -0.8, marketCap: "142.8B", pe: 22.1, sector: "Industrie" },
    { id: "bayn", symbol: "BAYN.DE", name: "Bayer AG", price: 28.34, change: -0.56, changePercent: -1.94, marketCap: "27.8B", pe: 8.5, sector: "Pharma" },
  ],
  chartData: {},
});

const QUIZ_DATA_JSON = JSON.stringify({
  dailyQuiz: {
    date: "2026-06-28",
    title: "Wie gut kennen Sie Berlin?",
    questions: [
      {
        id: 1,
        question: "Wie viele Bezirke hat Berlin?",
        options: ["10", "12", "14", "16"],
        correctIndex: 1,
        explanation: "Berlin hat 12 Bezirke, die seit der Bezirksreform 2001 bestehen.",
      },
      {
        id: 2,
        question: "Wann fiel die Berliner Mauer?",
        options: ["3. Oktober 1989", "9. November 1989", "1. Januar 1990", "3. Oktober 1990"],
        correctIndex: 1,
        explanation: "Die Berliner Mauer fiel am 9. November 1989 nach der legendären Pressekonferenz von Günter Schabowski.",
      },
      {
        id: 3,
        question: "Wie heißt Berlins größter See?",
        options: ["Wannsee", "Müggelsee", "Tegeler See", "Schlachtensee"],
        correctIndex: 1,
        explanation: "Der Müggelsee in Treptow-Köpenick ist mit 7,4 km² der größte See Berlins.",
      },
    ],
  },
  streakRewards: [
    { days: 3, badge: "Berlin-Kenner", emoji: "\u{1F3C5}" },
    { days: 7, badge: "Hauptstadt-Experte", emoji: "\u{1F393}" },
    { days: 14, badge: "Berlin-Meister", emoji: "\u{1F3C6}" },
  ],
});

/* ---------- Main ---------- */

async function main() {
  console.log(`\nSeeding Prismic repository "${REPOSITORY}"...\n`);

  // 1. Create Custom Types
  console.log("1/5 Creating/updating Custom Types...");
  for (const ct of CUSTOM_TYPES) {
    const result = await ctApi("POST", "/customtypes/insert", ct);
    if (result === "exists") {
      await ctApi("POST", "/customtypes/update", ct);
      console.log(`  ${ct.id}: updated`);
    } else {
      console.log(`  ${ct.id}: created`);
    }
    await sleep(300);
  }

  // 2. Set up clients
  console.log("2/5 Preparing...");
  const writeClient = prismic.createWriteClient(REPOSITORY, {
    writeToken: WRITE_TOKEN,
  });
  const readClient = prismic.createClient(REPOSITORY);

  // 3. Upload assets via SDK migration (assets are deduplicated automatically)
  console.log("3/5 Uploading assets...");
  const assetMigration = prismic.createMigration();
  const assetRefs = {};

  for (const author of AUTHORS) {
    assetRefs[`${author.slug}-avatar`] = assetMigration.createAsset(
      author.avatarUrl, `${author.slug}-avatar.jpg`,
      { alt: author.avatarAlt, notes: `Avatar fuer ${author.name}` },
    );
  }
  for (const art of ARTICLES) {
    assetRefs[`${art.slug}-hero`] = assetMigration.createAsset(
      art.imageUrl, `${art.slug}-hero.jpg`,
      { alt: art.imageAlt, notes: `Hero-Bild fuer "${art.headline.substring(0, 40)}..."` },
    );
  }

  await writeClient.migrate(assetMigration, {
    reporter: (event) => {
      if (event.type === "assets:creating") {
        console.log(`  Asset ${event.data.current}/${event.data.total}: ${event.data.asset.config.filename}`);
      }
    },
  });
  console.log(`  ${Object.keys(assetRefs).length} assets ready.`);

  // 4. Create or update documents via Migration API
  console.log("4/5 Creating/updating documents...");
  let created = 0;
  let updated = 0;

  async function migrationApi(method, path, body, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const res = await fetch(`${MIGRATION_API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${WRITE_TOKEN}`,
          "x-api-key": WRITE_TOKEN,
          repository: REPOSITORY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.status === 429 && attempt < retries) {
        const wait = 5000 * attempt;
        console.log(`    Rate limited, waiting ${wait / 1000}s (attempt ${attempt}/${retries})...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = text; }
        const err = new Error(typeof parsed === "object" ? parsed.message ?? text : text);
        err.response = parsed;
        err.status = res.status;
        throw err;
      }
      return res.json();
    }
  }

  async function upsertDoc(spec, title) {
    try {
      await migrationApi("POST", "/documents", { ...spec, title });
      created++;
      return "created";
    } catch (e) {
      if (!String(e.message).includes("UID already exists")) throw e;
    }
    try {
      const existing = await readClient.getByUID(spec.type, spec.uid);
      if (existing) {
        await migrationApi("PUT", `/documents/${existing.id}`, { ...spec, title });
        updated++;
        return "updated";
      }
    } catch { /* draft not queryable via CDN */ }
    return "skipped";
  }

  // -- Build asset map (filename → Prismic image object) --
  const assetRes = await fetch("https://asset-api.prismic.io/assets?limit=50", {
    headers: { Authorization: `Bearer ${WRITE_TOKEN}`, repository: REPOSITORY },
  });
  const assetData = await assetRes.json();
  const assetMap = {};
  for (const a of assetData.items ?? []) {
    if (!assetMap[a.filename]) {
      assetMap[a.filename] = {
        id: a.id,
        url: a.url,
        alt: a.alt ?? "",
        dimensions: { width: a.width ?? 0, height: a.height ?? 0 },
      };
    }
  }

  function getAsset(filename) {
    return assetMap[filename] ?? null;
  }

  // -- Categories --
  const catIds = {};
  for (const cat of CATEGORIES) {
    const result = await upsertDoc(
      {
        type: "category",
        uid: cat.slug,
        lang: "en-us",
        tags: [],
        data: { name: cat.name, description: cat.description, color: cat.color },
      },
      cat.name,
    );
    console.log(`  category: ${cat.name} (${result})`);
    await sleep(1500);

    try {
      const existing = await readClient.getByUID("category", cat.slug);
      if (existing) catIds[cat.slug] = existing.id;
    } catch { /* draft */ }
  }

  // -- Authors --
  const authorIds = {};
  for (const author of AUTHORS) {
    const avatar = getAsset(`${author.slug}-avatar.jpg`);
    const result = await upsertDoc(
      {
        type: "author",
        uid: author.slug,
        lang: "en-us",
        tags: [],
        data: {
          name: author.name,
          bio: author.bio,
          avatar: avatar ?? {},
          role: author.role,
        },
      },
      author.name,
    );
    console.log(`  author: ${author.name} (${result})`);
    await sleep(1500);

    try {
      const existing = await readClient.getByUID("author", author.slug);
      if (existing) authorIds[author.slug] = existing.id;
    } catch { /* draft */ }
  }

  // -- Articles --
  for (const art of ARTICLES) {
    const heroImage = getAsset(`${art.slug}-hero.jpg`);
    const catId = catIds[art.categorySlug];
    const authId = authorIds[art.authorSlug];

    const data = {
      headline: art.headline,
      teaser: art.teaser,
      body: htmlToRichText(art.body),
      image: heroImage ?? {},
      isPremium: false,
      isFeatured: art.isFeatured ?? false,
      isOpinion: art.isOpinion ?? false,
      isBreaking: false,
      isLive: false,
      region: "Berlin",
      aiSummary: "",
    };

    if (catId) data.category = { link_type: "Document", id: catId };
    if (authId) data.author = { link_type: "Document", id: authId };

    const result = await upsertDoc(
      {
        type: "article",
        uid: art.slug,
        lang: "en-us",
        tags: art.tags,
        data,
      },
      art.headline,
    );
    console.log(`  article: ${art.headline.substring(0, 50)}... (${result})`);
    await sleep(1500);
  }

  // -- Newsticker items --
  for (const nt of NEWSTICKER_ITEMS) {
    const result = await upsertDoc(
      {
        type: "newsticker",
        uid: nt.slug,
        lang: "en-us",
        tags: [],
        data: {
          headline: nt.headline,
          href: nt.href,
          topic: nt.topic,
          isPremium: nt.isPremium,
        },
      },
      nt.headline,
    );
    console.log(`  newsticker: ${nt.headline.substring(0, 50)}... (${result})`);
    await sleep(1500);
  }

  // -- Stock Data (single document) --
  const stockResult = await upsertDoc(
    {
      type: "stockData",
      uid: "current",
      lang: "en-us",
      tags: [],
      data: { json: STOCK_DATA_JSON },
    },
    "Stock Data",
  );
  console.log(`  stockData: current (${stockResult})`);
  await sleep(1500);

  // -- Quiz (single document, same JSON-in-Text pattern as stockData) --
  const quizResult = await upsertDoc(
    {
      type: "quiz",
      uid: "daily",
      lang: "en-us",
      tags: [],
      data: { json: QUIZ_DATA_JSON },
    },
    "Tagesquiz",
  );
  console.log(`  quiz: daily (${quizResult})`);
  await sleep(1500);

  // 5. Summary
  console.log(`\n5/5 Done! Created: ${created}, Updated: ${updated}`);
  console.log(`\n  Next steps:`);
  console.log(`  1. Publish documents in Prismic dashboard (CDN only returns published content)`);
  console.log(`  2. Add to .env.local:`);
  console.log(`     CMS_ADAPTER=prismic`);
  console.log(`     PRISMIC_REPOSITORY=${REPOSITORY}`);
  console.log(`     PRISMIC_ACCESS_TOKEN=<your-content-api-token>  # nur bei Private API`);
  console.log(`     CMS_IMAGE_DOMAINS=images.prismic.io`);
  console.log(`  3. npm run dev`);
  console.log(`  4. Open http://localhost:3000\n`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  if (err.response) {
    console.error("Response:", JSON.stringify(err.response, null, 2));
  }
  process.exit(1);
});
