#!/usr/bin/env node
/**
 * Berliner Rundschau — Payload CMS Seed Script
 *
 * Erstellt Demo-Inhalte in einer Payload v3 Instanz:
 *   6 Kategorien, 4 Autoren, 8 Artikel, 6 Newsticker,
 *   3 Videos, 2 Breaking-News, Navigation, SiteConfig,
 *   Börsendaten und Tagesquiz.
 *
 * Aufruf:
 *   node cms-seeds/seed-payload.mjs \
 *     --url http://localhost:3001 \
 *     --email admin@demo.local \
 *     --password admin1234
 *
 * Voraussetzungen:
 *   - Payload v3 Instanz mit den benötigten Collections
 *     (articles, categories, authors, newsticker, videos,
 *      breaking-news, navigation, site-config, quiz, stock-data)
 *   - Admin-User mit Schreibrechten
 *
 * Idempotent: Vorhandene Demo-Daten werden gelöscht und neu erstellt.
 */

/* ============================================================
   CLI ARGS
   ============================================================ */

const rawArgs = process.argv.slice(2);
function getArg(name) {
  const i = rawArgs.indexOf(`--${name}`);
  return i !== -1 ? rawArgs[i + 1] : undefined;
}

const BASE_URL = (getArg("url") ?? "http://localhost:3001").replace(/\/$/, "");
const EMAIL = getArg("email");
const PASSWORD = getArg("password");
const API_KEY = getArg("api-key");

if (!API_KEY && (!EMAIL || !PASSWORD)) {
  console.error(
    "Usage: node cms-seeds/seed-payload.mjs --url <payload-url> --email <admin-email> --password <password>",
  );
  console.error(
    "   or: node cms-seeds/seed-payload.mjs --url <payload-url> --api-key <api-key>",
  );
  process.exit(1);
}

/* ============================================================
   HELPERS
   ============================================================ */

let AUTH_TOKEN = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login() {
  if (API_KEY) {
    AUTH_TOKEN = API_KEY;
    console.log("  Using API Key authentication");
    return;
  }
  const res = await fetch(`${BASE_URL}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  AUTH_TOKEN = data.token;
  console.log("  Logged in successfully");
}

function headers() {
  const h = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) {
    if (API_KEY) {
      h["Authorization"] = `users API-Key ${AUTH_TOKEN}`;
    } else {
      h["Authorization"] = `JWT ${AUTH_TOKEN}`;
    }
  }
  return h;
}

async function api(method, path, body, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const opts = { method, headers: headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}/api${path}`, opts);

    if (res.status === 429 && attempt < retries) {
      const wait = 2000 * attempt;
      console.log(`  Rate limited, waiting ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      if (attempt < retries && res.status >= 500) {
        await sleep(1000 * attempt);
        continue;
      }
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json();
  }
}

async function createDoc(collection, data) {
  const result = await api("POST", `/${collection}`, data);
  return result.doc?.id ?? result.id;
}

async function deleteAllDocs(collection) {
  try {
    const res = await api("GET", `/${collection}?limit=100`);
    if (!res.docs || res.docs.length === 0) return 0;
    let count = 0;
    for (const doc of res.docs) {
      await api("DELETE", `/${collection}/${doc.id}`);
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

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

function lexicalBody(html) {
  const nodes = [];
  const tagRegex = /<(p|h2|h3|blockquote|ul|li)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const [, tag, content] = match;
    const textContent = content.replace(/<[^>]+>/g, "");
    switch (tag) {
      case "p":
        nodes.push({ type: "paragraph", children: [{ type: "text", text: textContent, format: 0, mode: "normal" }], direction: "ltr", format: "", indent: 0, version: 1 });
        break;
      case "h2":
        nodes.push({ type: "heading", tag: "h2", children: [{ type: "text", text: textContent, format: 0, mode: "normal" }], direction: "ltr", format: "", indent: 0, version: 1 });
        break;
      case "h3":
        nodes.push({ type: "heading", tag: "h3", children: [{ type: "text", text: textContent, format: 0, mode: "normal" }], direction: "ltr", format: "", indent: 0, version: 1 });
        break;
      case "blockquote":
        nodes.push({ type: "quote", children: [{ type: "text", text: textContent, format: 0, mode: "normal" }], direction: "ltr", format: "", indent: 0, version: 1 });
        break;
      case "li":
        break;
      default:
        nodes.push({ type: "paragraph", children: [{ type: "text", text: textContent, format: 0, mode: "normal" }], direction: "ltr", format: "", indent: 0, version: 1 });
    }
  }
  if (nodes.length === 0) {
    nodes.push({ type: "paragraph", children: [{ type: "text", text: html.replace(/<[^>]+>/g, ""), format: 0, mode: "normal" }], direction: "ltr", format: "", indent: 0, version: 1 });
  }
  return { root: { type: "root", children: nodes, direction: "ltr", format: "", indent: 0, version: 1 } };
}

const ARTICLES = [
  {
    headline: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    teaser: "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
    body: '<p>Berlin steht vor einem grundlegenden Wandel im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann.</p><blockquote>Die Investitionen in Höhe von 2,3 Milliarden Euro sind die größten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg, wo bisher viele Bewohner auf Busverbindungen angewiesen waren.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "politik",
    authorSlug: "anna-schmidt",
    isFeatured: true,
    tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"],
    readingTimeMinutes: 5,
    region: "Berlin",
  },
  {
    headline: "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    teaser: "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
    body: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte über 200 neue Unternehmen gegründet — ein Plus von 34 Prozent gegenüber dem Vorjahreszeitraum.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen.</p><h2>Venture Capital fließt in Rekordhöhe</h2><p>Im ersten Halbjahr 2026 flossen 3,8 Milliarden Euro Risikokapital in Berliner Jungunternehmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "wirtschaft",
    authorSlug: "markus-weber",
    isFeatured: false,
    tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"],
    readingTimeMinutes: 4,
    region: "Berlin-Mitte",
  },
  {
    headline: "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    teaser: "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    body: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein außergewöhnlich vielfältiges Programm.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins. Über 150 Werke zeitgenössischer Künstler zeigen Visionen für die Stadt von morgen.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "kultur",
    authorSlug: "lisa-mueller",
    isFeatured: false,
    tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"],
    readingTimeMinutes: 3,
    region: "Berlin",
  },
  {
    headline: "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
    slug: "hertha-bsc-nachwuchs-talente",
    teaser: "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
    body: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben Profiverträge erhalten.</p><h2>Die drei Neuzugänge</h2><p>Emre Yilmaz (18) — zentrales Mittelfeld, 14 Tore in der A-Junioren-Bundesliga. Jonas Hartmann (19) — Innenverteidiger, U19-Nationalspieler. Karim Benali (18) — Linksaußen, schnellster Spieler der Jugendabteilung.</p><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehört mittlerweile zu den produktivsten im deutschen Profifußball.</p>',
    imageUrl: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "sport",
    authorSlug: "thomas-becker",
    isFeatured: false,
    tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"],
    readingTimeMinutes: 4,
    region: "Berlin",
  },
  {
    headline: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    slug: "wohnungsmarkt-berlin-mietpreise",
    teaser: "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten. Ein Überblick.",
    body: '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete für Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter überschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m², gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m²) und Friedrichshain-Kreuzberg (16,90 Euro/m²).</p><h2>Neubau stockt weiter</h2><p>Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt.</p>',
    imageUrl: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "berlin",
    authorSlug: "markus-weber",
    isFeatured: false,
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
    readingTimeMinutes: 5,
    region: "Berlin",
  },
  {
    headline: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    teaser: "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse der Ursachen.",
    body: '<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Während Estland längst eine volldigitale Verwaltung betreibt, kämpfen Berliner Bürgerämter noch mit Faxgeräten und Papierformularen.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. Zweitens scheitern Großprojekte an mangelhafter Projektsteuerung. Drittens blockieren föderale Zuständigkeiten einheitliche Lösungen.</p><h2>Europäische Vorbilder</h2><p>In Dänemark werden 92 Prozent aller Behördengänge digital erledigt. Selbst das wirtschaftlich schwächere Portugal bietet mehr digitale Verwaltungsleistungen als Deutschland.</p>',
    imageUrl: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "meinung",
    authorSlug: "anna-schmidt",
    isFeatured: false,
    isOpinion: true,
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"],
    readingTimeMinutes: 6,
    region: "Deutschland",
  },
  {
    headline: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    teaser: "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    body: '<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung und digitale Fahrgastinformation.</p>',
    imageUrl: "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "berlin",
    authorSlug: "anna-schmidt",
    isFeatured: false,
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
    readingTimeMinutes: 5,
    region: "Berlin",
  },
  {
    headline: "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    teaser: "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><p>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028. Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030. Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030. Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss.</p><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an.</p>',
    imageUrl: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "politik",
    authorSlug: "anna-schmidt",
    isFeatured: false,
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
    readingTimeMinutes: 4,
    region: "Berlin",
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
  { title: "Berlins neue Tramlinien: So sieht der Plan aus", url: "/videos/tram-plan.mp4", thumbnail: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1280&h=720&q=80", duration: 384 },
  { title: "Start-up-Szene Berlin: Ein Tag im Co-Working-Space", url: "/videos/startup-coworking.mp4", thumbnail: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1280&h=720&q=80", duration: 542 },
  { title: "Sommer in Berlin: Die schönsten Badestellen", url: "/videos/badestellen.mp4", thumbnail: "https://images.unsplash.com/photo-1758912299313-36430bb41c44?auto=format&fit=crop&w=1280&h=720&q=80", duration: 267 },
];

const BREAKING_NEWS = [
  { headline: "Eilmeldung: Berliner Senat beschließt Klimaschutzpaket", text: "Umfassendes Paket mit Maßnahmen für Gebäude, Verkehr und Energie beschlossen.", url: "/artikel/klimaschutz-berlin-klimaneutral", severity: "critical" },
  { headline: "BVG: Signalstörung auf der U2 — Verspätungen erwartet", text: "Aufgrund einer Signalstörung kommt es auf der U2 zu Verspätungen von bis zu 15 Minuten.", url: "/artikel/bvg-ubahn-netz-ausbau", severity: "normal" },
];

const NAVIGATION = {
  slug: "singleton",
  items: [
    { label: "Start", href: "/", isActive: true },
    { label: "Politik", href: "/kategorie/politik" },
    { label: "Wirtschaft", href: "/kategorie/wirtschaft" },
    { label: "Berlin", href: "/kategorie/berlin" },
    { label: "Kultur", href: "/kategorie/kultur" },
    { label: "Sport", href: "/kategorie/sport" },
    { label: "Meinung", href: "/kategorie/meinung" },
  ],
};

const SITE_CONFIG = {
  slug: "singleton",
  siteName: "Berliner Rundschau",
  siteDescription: "Nachrichten aus Berlin und der Welt — Politik, Wirtschaft, Kultur, Sport und Meinung.",
  socialLinks: [
    { platform: "twitter", url: "https://twitter.com/berliner_rundschau" },
    { platform: "facebook", url: "https://facebook.com/berlinerrundschau" },
    { platform: "instagram", url: "https://instagram.com/berlinerrundschau" },
  ],
};

const QUIZ = {
  title: "Wie gut kennen Sie Berlin?",
  questions: [
    { id: 1, question: "Wie viele Bezirke hat Berlin?", options: ["10", "12", "14", "16"], correctIndex: 1, explanation: "Berlin hat 12 Bezirke, die seit der Bezirksreform 2001 bestehen." },
    { id: 2, question: "Wann fiel die Berliner Mauer?", options: ["3. Oktober 1989", "9. November 1989", "1. Januar 1990", "3. Oktober 1990"], correctIndex: 1, explanation: "Die Berliner Mauer fiel am 9. November 1989." },
    { id: 3, question: "Wie heißt Berlins größter See?", options: ["Wannsee", "Müggelsee", "Tegeler See", "Schlachtensee"], correctIndex: 1, explanation: "Der Müggelsee in Treptow-Köpenick ist mit 7,4 km² der größte See Berlins." },
  ],
  streakRewards: [
    { days: 3, badge: "Berlin-Kenner", emoji: "🏅" },
    { days: 7, badge: "Hauptstadt-Experte", emoji: "🎓" },
    { days: 14, badge: "Berlin-Meister", emoji: "🏆" },
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

async function seedCategories() {
  console.log("\n  Seeding categories...");
  const deleted = await deleteAllDocs("categories");
  if (deleted) console.log(`    Deleted ${deleted} existing categories`);

  const idMap = {};
  for (const cat of CATEGORIES) {
    const id = await createDoc("categories", cat);
    idMap[cat.slug] = id;
    console.log(`    "${cat.name}" → ${id}`);
  }
  return idMap;
}

async function seedAuthors() {
  console.log("\n  Seeding authors...");
  const deleted = await deleteAllDocs("authors");
  if (deleted) console.log(`    Deleted ${deleted} existing authors`);

  const idMap = {};
  for (const author of AUTHORS) {
    const id = await createDoc("authors", author);
    idMap[author.slug] = id;
    console.log(`    "${author.name}" → ${id}`);
  }
  return idMap;
}

async function seedArticles(categoryIds, authorIds) {
  console.log("\n  Seeding articles...");
  const deleted = await deleteAllDocs("articles");
  if (deleted) console.log(`    Deleted ${deleted} existing articles`);

  for (const art of ARTICLES) {
    const data = {
      headline: art.headline,
      slug: art.slug,
      teaser: art.teaser,
      body: lexicalBody(art.body),
      category: categoryIds[art.categorySlug],
      author: authorIds[art.authorSlug],
      imageUrl: art.imageUrl ?? "",
      tags: art.tags,
      readingTimeMinutes: art.readingTimeMinutes,
      isFeatured: art.isFeatured ?? false,
      isOpinion: art.isOpinion ?? false,
      region: art.region ?? "",
    };
    const id = await createDoc("articles", data);
    console.log(`    "${art.headline.slice(0, 50)}..." → ${id}`);
  }
}

async function seedNewsticker() {
  console.log("\n  Seeding newsticker...");
  const deleted = await deleteAllDocs("newsticker");
  if (deleted) console.log(`    Deleted ${deleted} existing newsticker`);

  for (const nt of NEWSTICKER) {
    const id = await createDoc("newsticker", nt);
    console.log(`    "${nt.headline.slice(0, 50)}" → ${id}`);
  }
}

async function seedVideos() {
  console.log("\n  Seeding videos...");
  const deleted = await deleteAllDocs("videos");
  if (deleted) console.log(`    Deleted ${deleted} existing videos`);

  for (const v of VIDEOS) {
    const id = await createDoc("videos", v);
    console.log(`    "${v.title}" → ${id}`);
  }
}

async function seedBreakingNews() {
  console.log("\n  Seeding breaking news...");
  const deleted = await deleteAllDocs("breaking-news");
  if (deleted) console.log(`    Deleted ${deleted} existing breaking news`);

  for (const bn of BREAKING_NEWS) {
    const id = await createDoc("breaking-news", bn);
    console.log(`    "${bn.headline.slice(0, 40)}..." → ${id}`);
  }
}

async function seedNavigation() {
  console.log("\n  Seeding navigation...");
  const deleted = await deleteAllDocs("navigation");
  if (deleted) console.log(`    Deleted ${deleted} existing navigation`);

  const id = await createDoc("navigation", NAVIGATION);
  console.log(`    Navigation → ${id}`);
}

async function seedSiteConfig() {
  console.log("\n  Seeding site config...");
  const deleted = await deleteAllDocs("site-config");
  if (deleted) console.log(`    Deleted ${deleted} existing site config`);

  const id = await createDoc("site-config", SITE_CONFIG);
  console.log(`    SiteConfig → ${id}`);
}

async function seedQuiz() {
  console.log("\n  Seeding quiz...");
  const deleted = await deleteAllDocs("quiz");
  if (deleted) console.log(`    Deleted ${deleted} existing quiz`);

  const id = await createDoc("quiz", QUIZ);
  console.log(`    Quiz → ${id}`);
}

async function seedStockData() {
  console.log("\n  Seeding stock data...");
  const deleted = await deleteAllDocs("stock-data");
  if (deleted) console.log(`    Deleted ${deleted} existing stock data`);

  const id = await createDoc("stock-data", STOCK_DATA);
  console.log(`    StockData → ${id}`);
}

/* ============================================================
   MAIN
   ============================================================ */

async function main() {
  console.log("Berliner Rundschau — Payload CMS Seed Script\n");
  console.log(`Payload URL: ${BASE_URL}\n`);

  console.log("[1/2] Authenticating...");
  await login();

  console.log("\n[2/2] Seeding content...");
  const categoryIds = await seedCategories();
  const authorIds = await seedAuthors();
  await seedArticles(categoryIds, authorIds);
  await seedNewsticker();
  await seedVideos();
  await seedBreakingNews();
  await seedNavigation();
  await seedSiteConfig();
  await seedQuiz();
  await seedStockData();

  console.log("\n✅ Seed complete! Update .env.local:");
  console.log(`  CMS_ADAPTER=payload`);
  console.log(`  PAYLOAD_URL=${BASE_URL}`);
  console.log(`  # Optional: PAYLOAD_API_KEY=<api-key>`);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
