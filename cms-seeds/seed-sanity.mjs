#!/usr/bin/env node
/**
 * Berliner Rundschau — Sanity CMS Seed Script
 *
 * Erstellt Demo-Inhalte im Sanity-Projekt:
 *   8 Artikel, 6 Kategorien, 4 Autoren, 6 Newsticker,
 *   Börsendaten (StockData) und ein Tagesquiz.
 *
 * Aufruf:
 *   node cms-seeds/seed-sanity.mjs \
 *     --project-id <id> \
 *     --token <editor-token> \
 *     [--dataset production]
 *
 * Voraussetzungen:
 *   - Sanity-Projekt unter sanity.io/manage
 *   - Ein API Token mit Editor-Rechten (Settings → API → Tokens)
 *
 * Idempotent: Verwendet createOrReplace — sicher bei wiederholtem Aufruf.
 * Dokumente sind sofort live (kein manuelles Publizieren nötig).
 */

/* ---------- CLI Args ---------- */

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

const PROJECT_ID = getArg("project-id");
const TOKEN = getArg("token");
const DATASET = getArg("dataset") ?? "production";
const API_VERSION = "2024-01-01";
const API_BASE = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}`;

if (!PROJECT_ID || !TOKEN) {
  console.error(
    "Usage: node seed-sanity.mjs --project-id <id> --token <editor-token> [--dataset production]",
  );
  process.exit(1);
}

/* ---------- Helpers ---------- */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mutate(mutations, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}/data/mutate/${DATASET}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mutations }),
    });
    if (res.status === 429 && attempt < retries) {
      const wait = 3000 * attempt;
      console.log(`  Rate limited, waiting ${wait / 1000}s (attempt ${attempt}/${retries})...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mutation failed (${res.status}): ${text}`);
    }
    return res.json();
  }
}

async function uploadImageFromUrl(url, filename) {
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${url}`);
  const blob = await imgRes.blob();

  const uploadRes = await fetch(
    `${API_BASE}/assets/images/${DATASET}?filename=${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": blob.type || "image/jpeg",
      },
      body: blob,
    },
  );
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Image upload failed (${uploadRes.status}): ${text}`);
  }
  const data = await uploadRes.json();
  return data.document._id;
}

function portableText(html) {
  const blocks = [];
  let key = 0;

  const parts = html.split(/(<\/?[^>]+>)/);
  let currentStyle = "normal";
  let currentChildren = [];
  let inList = false;

  for (const part of parts) {
    if (part === "<p>") {
      currentStyle = "normal";
      currentChildren = [];
    } else if (part === "</p>") {
      if (currentChildren.length > 0) {
        blocks.push({
          _key: `b${++key}`,
          _type: "block",
          style: currentStyle,
          markDefs: [],
          children: currentChildren,
        });
        currentChildren = [];
      }
    } else if (part === "<h2>") {
      currentStyle = "h2";
      currentChildren = [];
    } else if (part === "</h2>") {
      blocks.push({
        _key: `b${++key}`,
        _type: "block",
        style: "h2",
        markDefs: [],
        children: currentChildren,
      });
      currentChildren = [];
    } else if (part === "<h3>") {
      currentStyle = "h3";
      currentChildren = [];
    } else if (part === "</h3>") {
      blocks.push({
        _key: `b${++key}`,
        _type: "block",
        style: "h3",
        markDefs: [],
        children: currentChildren,
      });
      currentChildren = [];
    } else if (part === "<ul>") {
      inList = true;
    } else if (part === "</ul>") {
      inList = false;
    } else if (part === "<li>") {
      currentStyle = "normal";
      currentChildren = [];
    } else if (part === "</li>") {
      blocks.push({
        _key: `b${++key}`,
        _type: "block",
        style: "normal",
        listItem: "bullet",
        level: 1,
        markDefs: [],
        children: currentChildren,
      });
      currentChildren = [];
    } else if (
      !part.startsWith("<") &&
      part.trim().length > 0
    ) {
      currentChildren.push({
        _key: `s${++key}`,
        _type: "span",
        text: part.replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü")
          .replace(/&szlig;/g, "ß").replace(/&amp;/g, "&"),
        marks: [],
      });
    }
  }

  if (currentChildren.length > 0) {
    blocks.push({
      _key: `b${++key}`,
      _type: "block",
      style: currentStyle,
      markDefs: [],
      children: currentChildren,
    });
  }

  return blocks;
}

/* ---------- Seed Data ---------- */

const CATEGORIES = [
  { _id: "cat-politik", name: "Politik", slug: "politik", description: "Nachrichten aus der Politik", color: "#1e40af" },
  { _id: "cat-wirtschaft", name: "Wirtschaft", slug: "wirtschaft", description: "Wirtschaftsnachrichten und Finanzen", color: "#047857" },
  { _id: "cat-berlin", name: "Berlin", slug: "berlin", description: "Lokalnachrichten aus Berlin", color: "#dc2626" },
  { _id: "cat-kultur", name: "Kultur", slug: "kultur", description: "Kultur, Kunst und Unterhaltung", color: "#7c3aed" },
  { _id: "cat-sport", name: "Sport", slug: "sport", description: "Sportnachrichten", color: "#ea580c" },
  { _id: "cat-meinung", name: "Meinung", slug: "meinung", description: "Kommentare und Meinungsbeiträge", color: "#64748b" },
];

const AUTHORS = [
  {
    _id: "author-anna-schmidt",
    name: "Anna Schmidt",
    slug: "anna-schmidt",
    bio: "Politikredakteurin mit Schwerpunkt Berliner Landespolitik und Stadtentwicklung.",
    role: "Politikredakteurin",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    _id: "author-markus-weber",
    name: "Markus Weber",
    slug: "markus-weber",
    bio: "Wirtschaftsjournalist, berichtet über Start-ups und Berliner Wirtschaftspolitik.",
    role: "Wirtschaftsredakteur",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    _id: "author-lisa-mueller",
    name: "Lisa Müller",
    slug: "lisa-mueller",
    bio: "Kulturjournalistin mit Fokus auf Berliner Kunst- und Musikszene.",
    role: "Kulturredakteurin",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    _id: "author-thomas-becker",
    name: "Thomas Becker",
    slug: "thomas-becker",
    bio: "Sportreporter mit Schwerpunkt Berliner Fußball und Leichtathletik.",
    role: "Sportredakteur",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80",
  },
];

const ARTICLES = [
  {
    _id: "art-berlins-neue-verkehrsstrategie",
    headline: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    teaser: "Der Senat hat eine umfassende Verkehrswende beschlossen. Mehr Radwege, neue Tramlinien und eine autofreie Innenstadt.",
    body: '<p>Der Berliner Senat hat heute seine neue Verkehrsstrategie vorgestellt. Bis 2030 soll der Anteil des Radverkehrs auf 30 Prozent steigen.</p><h2>Neue Radschnellwege</h2><p>Insgesamt 12 neue Radschnellwege sollen die Außenbezirke mit dem Zentrum verbinden. Die erste Strecke von Adlershof zum Alexanderplatz wird bereits 2027 eröffnet.</p><h2>Tram-Ausbau nach Westen</h2><p>Die Straßenbahn soll erstmals seit der Teilung der Stadt wieder im Westteil fahren. Geplant sind Linien zum Kurfürstendamm und nach Steglitz.</p><h2>Autofreie Friedrichstraße wird dauerhaft</h2><p>Nach dem erfolgreichen Pilotprojekt wird die Friedrichstraße zwischen Französischer Straße und Leipziger Straße dauerhaft zur Fußgängerzone.</p>',
    imageUrl: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Fahrradweg in Berlin mit Fernsehturm im Hintergrund",
    categoryId: "cat-berlin",
    authorId: "author-anna-schmidt",
    tags: ["Verkehr", "Radverkehr", "Stadtentwicklung"],
    isFeatured: true,
  },
  {
    _id: "art-startup-boom-berlin-mitte",
    headline: "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    teaser: "Berlin festigt seine Position als Start-up-Hauptstadt Europas. Besonders KI- und GreenTech-Unternehmen boomen.",
    body: '<p>Die Berliner Start-up-Szene erlebt einen neuen Höhenflug. Im ersten Quartal 2026 wurden allein in Mitte über 200 neue Unternehmen gegründet.</p><h2>KI-Start-ups führend</h2><p>Fast 40 Prozent der Neugründungen entfallen auf den Bereich Künstliche Intelligenz. Berlin hat sich als wichtigster KI-Hub in Europa etabliert.</p><h2>Venture Capital fließt</h2><p>Insgesamt 2,3 Milliarden Euro an Risikokapital flossen im ersten Quartal nach Berlin — ein Anstieg von 45 Prozent gegenüber dem Vorjahr.</p>',
    imageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Modernes Bürogebäude in Berlin-Mitte",
    categoryId: "cat-wirtschaft",
    authorId: "author-markus-weber",
    tags: ["Start-ups", "Wirtschaft", "KI", "Technologie"],
    isFeatured: false,
  },
  {
    _id: "art-kulturhauptstadt-berlin-sommer",
    headline: "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    teaser: "Von der Neuen Nationalgalerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    body: '<p>Berlin bietet in diesem Sommer ein kulturelles Programm der Superlative. Hier sind die Highlights.</p><h2>Neue Nationalgalerie: „Berlin Modern"</h2><p>Die große Sommerausstellung zeigt 200 Werke Berliner Künstler aus den letzten 100 Jahren. Besonderer Fokus liegt auf der Street-Art-Bewegung der 2020er.</p><h2>Humboldt Forum: Ozeanien-Sammlung</h2><p>Erstmals werden 3.000 Objekte aus der Ozeanien-Sammlung in einer eigenen Etage präsentiert.</p><h2>Berlinische Galerie: Fotografie-Biennale</h2><p>50 internationale Fotografen zeigen Arbeiten zum Thema „Stadt im Wandel".</p>',
    imageUrl: "https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Museumsinsel Berlin bei Sonnenuntergang",
    categoryId: "cat-kultur",
    authorId: "author-lisa-mueller",
    tags: ["Kultur", "Ausstellungen", "Museen", "Sommer"],
    isFeatured: false,
  },
  {
    _id: "art-hertha-bsc-nachwuchs-talente",
    headline: "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Durchbruch",
    slug: "hertha-bsc-nachwuchs-talente",
    teaser: "Die Hertha-Akademie liefert: Drei junge Spieler haben sich in der ersten Mannschaft etabliert.",
    body: '<p>Hertha BSC erntet die Früchte seiner Nachwuchsarbeit. Gleich drei Spieler aus der eigenen Akademie haben sich in dieser Saison in der ersten Mannschaft etabliert.</p><h2>Talent aus Kreuzberg</h2><p>Der 19-jährige Mittelfeldspieler aus Berlin-Kreuzberg begeistert mit seiner Technik und Spielintelligenz. Bereits jetzt wird er als möglicher Nationalspieler gehandelt.</p><h2>Verteidiger-Duo aus der U19</h2><p>Zwei Innenverteidiger aus der U19 haben den Sprung in den Profikader geschafft und bilden bereits das stabilste Duo der Liga.</p>',
    imageUrl: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Olympiastadion Berlin — Heimat von Hertha BSC",
    categoryId: "cat-sport",
    authorId: "author-thomas-becker",
    tags: ["Sport", "Fußball", "Hertha BSC", "Nachwuchs"],
    isFeatured: false,
  },
  {
    _id: "art-wohnungsmarkt-berlin-mietpreise",
    headline: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    slug: "wohnungsmarkt-berlin-mietpreise",
    teaser: "Die durchschnittliche Kaltmiete in Berlin liegt erstmals über 14 Euro pro Quadratmeter. Was Mieter jetzt wissen müssen.",
    body: '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete ist auf 14,20 Euro pro Quadratmeter gestiegen.</p><h2>Bezirke im Vergleich</h2><p>Am teuersten bleibt Mitte mit durchschnittlich 18,50 Euro, gefolgt von Charlottenburg-Wilmersdorf. Günstigere Alternativen finden sich in Spandau und Marzahn.</p><h2>Neubau-Offensive</h2><p>Der Senat hat ein Programm für 20.000 neue Wohnungen pro Jahr angekündigt. Kritiker bezweifeln die Umsetzbarkeit.</p>',
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Wohnhäuser in Berlin",
    categoryId: "cat-berlin",
    authorId: "author-markus-weber",
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
    isFeatured: false,
  },
  {
    _id: "art-kommentar-digitalisierung-verwaltung",
    headline: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    teaser: "Seit Jahren wird die digitale Verwaltung versprochen. Warum es nicht vorangeht — eine Analyse.",
    body: '<p>Es ist zum Verzweifeln. Seit über einem Jahrzehnt versprechen Berliner Politiker die Digitalisierung der Verwaltung. Passiert ist wenig.</p><h2>Das Bürgeramt-Problem</h2><p>Wer einen Termin beim Bürgeramt braucht, wartet im Schnitt sechs Wochen. Online-Termine sind innerhalb von Sekunden vergriffen. Ein digitaler Antrag? Fehlanzeige.</p><h2>Was andere Städte besser machen</h2><p>Tallinn, Kopenhagen, Wien — sie alle zeigen, dass digitale Verwaltung funktioniert. Berlin könnte von ihnen lernen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Laptop mit Verwaltungsformular",
    categoryId: "cat-meinung",
    authorId: "author-anna-schmidt",
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Meinung"],
    isOpinion: true,
    isFeatured: false,
  },
  {
    _id: "art-bvg-ubahn-netz-ausbau",
    headline: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    teaser: "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    body: '<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung und digitale Fahrgastinformation.</p>',
    imageUrl: "https://images.unsplash.com/photo-1752771433743-47a49376fb63?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "U-Bahn-Station in Berlin",
    categoryId: "cat-berlin",
    authorId: "author-anna-schmidt",
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
    isFeatured: false,
  },
  {
    _id: "art-klimaschutz-berlin-klimaneutral",
    headline: "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    teaser: "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030</li><li>Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss</li></ul><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an.</p>',
    imageUrl: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Solaranlage auf einem Berliner Dach",
    categoryId: "cat-politik",
    authorId: "author-anna-schmidt",
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
    isFeatured: false,
  },
];

const NEWSTICKER_ITEMS = [
  { _id: "nt-bundestag-digitalgesetz", headline: "Bundestag beschließt neues Digitalgesetz", href: "/artikel/bundestag-digitalgesetz", topic: "Politik", isPremium: false },
  { _id: "nt-sbahn-ringbahn", headline: "S-Bahn-Störung auf der Ringbahn behoben", href: "/artikel/sbahn-ringbahn-stoerung", topic: "Berlin", isPremium: false },
  { _id: "nt-dax-rekordhoch", headline: "DAX schließt mit Rekordhoch bei 21.450 Punkten", href: "/artikel/dax-rekordhoch", topic: "Wirtschaft", isPremium: true },
  { _id: "nt-union-berlin-transfer", headline: "Union Berlin verpflichtet schwedischen Stürmer", href: "/artikel/union-berlin-transfer", topic: "Sport", isPremium: false },
  { _id: "nt-berlinale-jury", headline: "Berlinale kündigt Jury-Präsidentin für 2027 an", href: "/artikel/berlinale-jury", topic: "Kultur", isPremium: false },
  { _id: "nt-fahrradstrasse", headline: "Neue Fahrradstraße in Friedrichshain eröffnet", href: "/artikel/fahrradstrasse-friedrichshain", topic: "Berlin", isPremium: false },
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
  console.log(`\nSeeding Sanity project "${PROJECT_ID}" (dataset: ${DATASET})...\n`);

  // 1. Delete old demo data
  console.log("1/5 Cleaning old demo data...");
  const oldIds = [
    ...Array.from({ length: 20 }, (_, i) => `art-${String(i + 1).padStart(3, "0")}`),
    "author-mueller", "author-fischer", "author-schmidt", "author-weber",
    "cat-politik", "cat-wirtschaft", "cat-technologie", "cat-wissenschaft", "cat-kultur", "cat-sport",
  ];
  const deleteMutations = oldIds.map((_id) => ({ delete: { id: _id } }));
  await mutate(deleteMutations);
  console.log(`  Deleted ${oldIds.length} old documents.`);

  // 2. Upload images
  console.log("2/5 Uploading images...");
  const imageMap = {};

  for (const author of AUTHORS) {
    try {
      const assetId = await uploadImageFromUrl(author.avatarUrl, `${author.slug}-avatar.jpg`);
      imageMap[`${author.slug}-avatar`] = assetId;
      console.log(`  Avatar: ${author.name}`);
    } catch (e) {
      console.log(`  Avatar SKIP (${author.name}): ${e.message}`);
    }
    await sleep(500);
  }

  for (const art of ARTICLES) {
    try {
      const assetId = await uploadImageFromUrl(art.imageUrl, `${art.slug}-hero.jpg`);
      imageMap[`${art.slug}-hero`] = assetId;
      console.log(`  Hero: ${art.headline.substring(0, 50)}...`);
    } catch (e) {
      console.log(`  Hero SKIP: ${e.message}`);
    }
    await sleep(500);
  }
  console.log(`  ${Object.keys(imageMap).length} images uploaded.`);

  // 3. Create categories + authors
  console.log("3/5 Creating categories + authors...");

  const catMutations = CATEGORIES.map((cat) => ({
    createOrReplace: {
      _id: cat._id,
      _type: "category",
      name: cat.name,
      slug: { _type: "slug", current: cat.slug },
      description: cat.description,
      color: cat.color,
    },
  }));

  const authorMutations = AUTHORS.map((author) => {
    const doc = {
      _id: author._id,
      _type: "author",
      name: author.name,
      slug: { _type: "slug", current: author.slug },
      bio: author.bio,
      role: author.role,
    };
    const avatarAssetId = imageMap[`${author.slug}-avatar`];
    if (avatarAssetId) {
      doc.avatar = {
        _type: "image",
        asset: { _type: "reference", _ref: avatarAssetId },
      };
    }
    return { createOrReplace: doc };
  });

  await mutate([...catMutations, ...authorMutations]);
  console.log(`  ${CATEGORIES.length} categories + ${AUTHORS.length} authors created.`);

  // 4. Create articles
  console.log("4/5 Creating articles + supplemental data...");

  const articleMutations = ARTICLES.map((art) => {
    const doc = {
      _id: art._id,
      _type: "article",
      headline: art.headline,
      slug: { _type: "slug", current: art.slug },
      teaser: art.teaser,
      body: portableText(art.body),
      category: { _type: "reference", _ref: art.categoryId },
      author: { _type: "reference", _ref: art.authorId },
      tags: art.tags,
      isPremium: false,
      isFeatured: art.isFeatured ?? false,
      isOpinion: art.isOpinion ?? false,
      isBreaking: false,
      isLive: false,
      region: "Berlin",
      aiSummary: "",
    };
    const heroAssetId = imageMap[`${art.slug}-hero`];
    if (heroAssetId) {
      doc.image = {
        _type: "image",
        asset: { _type: "reference", _ref: heroAssetId },
        alt: art.imageAlt,
      };
    }
    return { createOrReplace: doc };
  });

  const newstickerMutations = NEWSTICKER_ITEMS.map((nt) => ({
    createOrReplace: {
      _id: nt._id,
      _type: "newsticker",
      headline: nt.headline,
      href: nt.href,
      topic: nt.topic,
      isPremium: nt.isPremium,
    },
  }));

  const stockMutation = {
    createOrReplace: {
      _id: "stockdata-current",
      _type: "stockData",
      json: STOCK_DATA_JSON,
    },
  };

  const quizMutation = {
    createOrReplace: {
      _id: "quiz-daily",
      _type: "quiz",
      json: QUIZ_DATA_JSON,
    },
  };

  await mutate([
    ...articleMutations,
    ...newstickerMutations,
    stockMutation,
    quizMutation,
  ]);

  console.log(`  ${ARTICLES.length} articles created.`);
  console.log(`  ${NEWSTICKER_ITEMS.length} newsticker items created.`);
  console.log(`  1 stockData document created.`);
  console.log(`  1 quiz document created.`);

  // 5. Summary
  console.log(`\n5/5 Done!\n`);
  console.log(`  Dokumente sind sofort live (kein manuelles Publizieren nötig).`);
  console.log(`\n  .env.local konfigurieren:`);
  console.log(`     CMS_ADAPTER=sanity`);
  console.log(`     SANITY_PROJECT_ID=${PROJECT_ID}`);
  console.log(`     SANITY_DATASET=${DATASET}`);
  console.log(`     # SANITY_TOKEN=...  (nur bei privatem Dataset)`);
  console.log(`     CMS_IMAGE_DOMAINS=cdn.sanity.io`);
  console.log(`\n  npm run dev → http://localhost:3000\n`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
