#!/usr/bin/env node
/**
 * Seeds a Storyblok space with Berliner Rundschau demo data.
 *
 * Usage:
 *   node cms-seeds/seed-storyblok.mjs --space-id <id> --token <pat>
 *
 * Prerequisites:
 *   - Node.js 18+ (uses built-in fetch)
 *   - A Storyblok space (free Joyride trial works)
 *   - A Personal Access Token from app.storyblok.com → My Account → Personal access tokens
 */

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

const SPACE_ID = getArg("space-id");
const TOKEN = getArg("token");

if (!SPACE_ID || !TOKEN) {
  console.error(
    "Usage: node seed-storyblok.mjs --space-id <id> --token <pat>",
  );
  process.exit(1);
}

const BASE = `https://mapi.storyblok.com/v1/spaces/${SPACE_ID}`;

let requestCount = 0;

async function api(method, path, body) {
  requestCount++;
  if (requestCount % 3 === 0) await sleep(1200);

  const url = `${BASE}${path}`;
  const options = {
    method,
    headers: {
      Authorization: TOKEN,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);

  if (res.status === 429) {
    console.log("  Rate limited, waiting 3s...");
    await sleep(3000);
    return api(method, path, body);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Rich Text (Storyblok ProseMirror format) ---

function storyblokRichText(htmlBody) {
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
      nodes.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: cleanText }],
      });
    } else if (tag.startsWith("<h3")) {
      nodes.push({
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: cleanText }],
      });
    } else if (tag.startsWith("<blockquote")) {
      nodes.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: cleanText }],
          },
        ],
      });
    } else if (tag.startsWith("<ul")) {
      const items = trimmed.match(/<li[^>]*>(.*?)<\/li>/gs) || [];
      nodes.push({
        type: "bullet_list",
        content: items.map((li) => ({
          type: "list_item",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: li
                    .replace(/<\/?(?:li|strong|em)[^>]*>/g, "")
                    .trim(),
                },
              ],
            },
          ],
        })),
      });
    } else {
      nodes.push({
        type: "paragraph",
        content: [{ type: "text", text: cleanText }],
      });
    }
    tagIdx++;
  }

  if (nodes.length === 0) {
    nodes.push({
      type: "paragraph",
      content: [
        { type: "text", text: htmlBody.replace(/<[^>]+>/g, "").trim() },
      ],
    });
  }

  return { type: "doc", content: nodes };
}

// --- Component definitions ---

const COMPONENTS = [
  {
    name: "category",
    display_name: "Kategorie",
    schema: {
      name: { type: "text", pos: 0, required: true },
      slug: { type: "text", pos: 1 },
      description: { type: "textarea", pos: 2 },
      color: { type: "text", pos: 3 },
    },
    is_root: true,
    is_nestable: false,
  },
  {
    name: "author",
    display_name: "Autor",
    schema: {
      name: { type: "text", pos: 0, required: true },
      slug: { type: "text", pos: 1 },
      bio: { type: "textarea", pos: 2 },
      avatar: { type: "asset", filetypes: ["images"], pos: 3 },
      role: { type: "text", pos: 4 },
    },
    is_root: true,
    is_nestable: false,
  },
  {
    name: "article",
    display_name: "Artikel",
    schema: {
      headline: { type: "text", pos: 0, required: true },
      body: { type: "richtext", pos: 1 },
      teaser: { type: "textarea", pos: 2 },
      image: { type: "asset", filetypes: ["images"], pos: 3 },
      category: {
        type: "option",
        pos: 4,
        source: "internal_stories",
        filter_content_type: "category",
        use_uuid: true,
      },
      author: {
        type: "option",
        pos: 5,
        source: "internal_stories",
        filter_content_type: "author",
        use_uuid: true,
      },
      isFeatured: { type: "boolean", pos: 6 },
    },
    is_root: true,
    is_nestable: false,
  },
];

// --- Seed Data ---

const CATEGORIES = [
  { name: "Politik", slug: "politik", description: "Aktuelle politische Nachrichten aus Berlin, Deutschland und der Welt.", color: "#15803d" },
  { name: "Wirtschaft", slug: "wirtschaft", description: "Wirtschaftsnachrichten, Börse, Unternehmen und Start-ups aus Berlin.", color: "#16a34a" },
  { name: "Berlin", slug: "berlin", description: "Lokalnachrichten aus allen Berliner Bezirken — Verkehr, Wohnen, Stadtentwicklung.", color: "#0ea5e9" },
  { name: "Kultur", slug: "kultur", description: "Kunst, Musik, Theater, Film und Ausstellungen in Berlin.", color: "#8b5cf6" },
  { name: "Sport", slug: "sport", description: "Sportnachrichten aus Berlin — Hertha BSC, Union Berlin, Alba und mehr.", color: "#3b82f6" },
  { name: "Meinung", slug: "meinung", description: "Kommentare, Analysen und Gastbeiträge zu aktuellen Themen.", color: "#f59e0b" },
];

const AUTHORS = [
  { name: "Anna Schmidt", slug: "anna-schmidt", bio: "Chefredakteurin der Berliner Rundschau. Schwerpunkte: Landespolitik, Infrastruktur und Stadtentwicklung.", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face" },
  { name: "Markus Weber", slug: "markus-weber", bio: "Wirtschaftsredakteur mit Fokus auf Start-ups, Immobilien und Berliner Wirtschaftspolitik.", avatarUrl: "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face" },
  { name: "Lisa Müller", slug: "lisa-mueller", bio: "Kulturredakteurin der Berliner Rundschau. Berichtet über Ausstellungen, Theater und die Berliner Kunstszene.", avatarUrl: "https://images.unsplash.com/photo-1573496527892-904f897eb744?auto=format&fit=crop&w=200&h=200&q=80&crop=face" },
  { name: "Thomas Becker", slug: "thomas-becker", bio: "Sportredakteur mit Leidenschaft für Berliner Fußball. Begleitet Hertha BSC und Union Berlin seit über zehn Jahren.", avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80&crop=faces" },
];

const ARTICLES = [
  {
    headline: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    teaser: "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
    body: '<p>Berlin steht vor einem grundlegenden Wandel im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann.</p><blockquote>Die Investitionen in Höhe von 2,3 Milliarden Euro sind die größten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg, wo bisher viele Bewohner auf Busverbindungen angewiesen waren.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "politik",
    authorSlug: "anna-schmidt",
    featured: true,
    tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"],
  },
  {
    headline: "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    teaser: "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
    body: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte über 200 neue Unternehmen gegründet — ein Plus von 34 Prozent gegenüber dem Vorjahreszeitraum.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen.</p><h2>Venture Capital fließt in Rekordhöhe</h2><p>Im ersten Halbjahr 2026 flossen 3,8 Milliarden Euro Risikokapital in Berliner Jungunternehmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "wirtschaft",
    authorSlug: "markus-weber",
    featured: false,
    tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"],
  },
  {
    headline: "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    teaser: "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    body: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein außergewöhnlich vielfältiges Programm.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins. Über 150 Werke zeitgenössischer Künstler zeigen Visionen für die Stadt von morgen.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen.</p>',
    imageUrl: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "kultur",
    authorSlug: "lisa-mueller",
    featured: false,
    tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"],
  },
  {
    headline: "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
    slug: "hertha-bsc-nachwuchs-talente",
    teaser: "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
    body: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben Profiverträge erhalten.</p><h2>Die drei Neuzugänge</h2><ul><li>Emre Yilmaz (18) — zentrales Mittelfeld, 14 Tore in der A-Junioren-Bundesliga</li><li>Jonas Hartmann (19) — Innenverteidiger, U19-Nationalspieler</li><li>Karim Benali (18) — Linksaußen, schnellster Spieler der Jugendabteilung</li></ul><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehört mittlerweile zu den produktivsten im deutschen Profifußball.</p>',
    imageUrl: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "sport",
    authorSlug: "thomas-becker",
    featured: false,
    tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"],
  },
  {
    headline: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    slug: "wohnungsmarkt-berlin-mietpreise",
    teaser: "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten. Ein Überblick.",
    body: '<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete für Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter überschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m², gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m²) und Friedrichshain-Kreuzberg (16,90 Euro/m²).</p><h2>Neubau stockt weiter</h2><p>Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt.</p>',
    imageUrl: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "berlin",
    authorSlug: "markus-weber",
    featured: false,
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
  },
  {
    headline: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    teaser: "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse der Ursachen.",
    body: '<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Während Estland längst eine volldigitale Verwaltung betreibt, kämpfen Berliner Bürgerämter noch mit Faxgeräten und Papierformularen.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. Zweitens scheitern Großprojekte an mangelhafter Projektsteuerung. Drittens blockieren föderale Zuständigkeiten einheitliche Lösungen.</p><h2>Europäische Vorbilder</h2><p>In Dänemark werden 92 Prozent aller Behördengänge digital erledigt. Selbst das wirtschaftlich schwächere Portugal bietet mehr digitale Verwaltungsleistungen als Deutschland.</p>',
    imageUrl: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "meinung",
    authorSlug: "anna-schmidt",
    featured: false,
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"],
  },
  {
    headline: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    teaser: "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    body: '<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung und digitale Fahrgastinformation.</p>',
    imageUrl: "https://images.unsplash.com/photo-1752771433743-47a49376fb63?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "berlin",
    authorSlug: "anna-schmidt",
    featured: false,
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
  },
  {
    headline: "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    teaser: "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: '<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030</li><li>Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss</li></ul><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an.</p>',
    imageUrl: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
    categorySlug: "politik",
    authorSlug: "anna-schmidt",
    featured: false,
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
  },
];

// --- Asset Upload ---

async function uploadAsset(filename, imageUrl) {
  // 1. Register asset with Storyblok
  const registered = await api("POST", "/assets", {
    filename,
    size: "0x0",
  });

  // 2. Download image from Unsplash
  const imgRes = await fetch(imageUrl, { redirect: "follow" });
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  // 3. Upload to S3 via signed URL
  const form = new FormData();
  for (const [key, val] of Object.entries(registered.fields)) {
    form.append(key, String(val));
  }
  form.append(
    "file",
    new Blob([imgBuffer], { type: "image/jpeg" }),
    filename,
  );

  const uploadRes = await fetch(registered.post_url, {
    method: "POST",
    body: form,
  });

  if (!uploadRes.ok && uploadRes.status !== 204) {
    throw new Error(`S3 upload failed: ${uploadRes.status}`);
  }

  // 4. Finalize upload
  let finalUrl = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(1500);
    try {
      const result = await api(
        "GET",
        `/assets/${registered.id}/finish_upload`,
      );
      if (result?.filename) {
        finalUrl = result.filename.replace("s3.amazonaws.com/", "");
        break;
      }
    } catch {
      // Not ready yet
    }
  }

  if (!finalUrl && registered.pretty_url) {
    finalUrl = registered.pretty_url;
  }

  if (finalUrl.startsWith("//")) finalUrl = `https:${finalUrl}`;

  return { id: registered.id, url: finalUrl };
}

// --- Main ---

async function main() {
  console.log(`\nSeeding Storyblok space ${SPACE_ID}...\n`);

  // 1. Create/check components
  console.log("1/5 Creating components...");
  const existingRes = await api("GET", "/components");
  const existingComponents = existingRes?.components ?? [];
  const componentMap = {};
  for (const c of existingComponents) {
    componentMap[c.name] = c;
  }

  for (const comp of COMPONENTS) {
    if (componentMap[comp.name]) {
      console.log(`  ${comp.name}: already exists (id: ${componentMap[comp.name].id})`);
      continue;
    }

    const created = await api("POST", "/components", { component: comp });
    componentMap[comp.name] = created.component;
    console.log(`  ${comp.name}: created (id: ${created.component.id})`);
    await sleep(300);
  }

  // 2. Upload assets (hero images + avatars)
  console.log("2/5 Uploading assets...");
  const assetUrlMap = {};

  // Check existing assets
  const existingAssetsRes = await api("GET", "/assets?per_page=100");
  const existingAssets = existingAssetsRes?.assets ?? [];
  const existingAssetNames = new Set(
    existingAssets.map((a) => a.filename?.split("/").pop()),
  );

  const allAssetJobs = [];
  for (const author of AUTHORS) {
    const filename = `${author.slug}-avatar.jpg`;
    allAssetJobs.push({
      key: `author-${author.slug}`,
      filename,
      url: author.avatarUrl,
    });
  }
  for (const article of ARTICLES) {
    const filename = `${article.slug}-hero.jpg`;
    allAssetJobs.push({
      key: `article-${article.slug}`,
      filename,
      url: article.imageUrl,
    });
  }

  for (const job of allAssetJobs) {
    if (existingAssetNames.has(job.filename)) {
      const existing = existingAssets.find(
        (a) => a.filename?.split("/").pop() === job.filename,
      );
      if (existing) {
        let url = existing.filename;
        if (url.startsWith("//")) url = `https:${url}`;
        assetUrlMap[job.key] = { id: existing.id, url };
        console.log(`  ${job.filename}: already exists, skipping`);
        continue;
      }
    }

    try {
      const result = await uploadAsset(job.filename, job.url);
      assetUrlMap[job.key] = result;
      console.log(`  ${job.filename}: uploaded → ${result.url.substring(0, 60)}...`);
    } catch (err) {
      console.warn(`  ${job.filename}: upload failed — ${err.message}`);
      assetUrlMap[job.key] = { id: null, url: "" };
    }
    await sleep(500);
  }

  // 3. Create category stories
  console.log("3/5 Creating categories...");
  const categoryUuidMap = {};

  const existingStoriesRes = await api("GET", "/stories?per_page=100");
  const existingStories = existingStoriesRes?.stories ?? [];
  const existingSlugMap = {};
  for (const s of existingStories) {
    existingSlugMap[s.slug] = s;
  }

  for (const cat of CATEGORIES) {
    if (existingSlugMap[cat.slug]) {
      categoryUuidMap[cat.slug] = existingSlugMap[cat.slug].uuid;
      console.log(
        `  "${cat.name}": exists (uuid: ${existingSlugMap[cat.slug].uuid})`,
      );
      continue;
    }

    const created = await api("POST", "/stories", {
      story: {
        name: cat.name,
        slug: cat.slug,
        content: {
          component: "category",
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          color: cat.color,
        },
      },
      publish: 1,
    });
    categoryUuidMap[cat.slug] = created.story.uuid;
    console.log(`  "${cat.name}": created (uuid: ${created.story.uuid})`);
    await sleep(300);
  }

  // 4. Create author stories
  console.log("4/5 Creating authors...");
  const authorUuidMap = {};

  for (const author of AUTHORS) {
    if (existingSlugMap[author.slug]) {
      authorUuidMap[author.slug] = existingSlugMap[author.slug].uuid;
      console.log(
        `  "${author.name}": exists (uuid: ${existingSlugMap[author.slug].uuid})`,
      );
      continue;
    }

    const avatarAsset = assetUrlMap[`author-${author.slug}`];
    const avatarField = avatarAsset?.url
      ? {
          id: avatarAsset.id,
          alt: author.name,
          filename: avatarAsset.url,
          fieldtype: "asset",
        }
      : null;

    const created = await api("POST", "/stories", {
      story: {
        name: author.name,
        slug: author.slug,
        content: {
          component: "author",
          name: author.name,
          slug: author.slug,
          bio: author.bio,
          avatar: avatarField,
        },
      },
      publish: 1,
    });
    authorUuidMap[author.slug] = created.story.uuid;
    console.log(`  "${author.name}": created (uuid: ${created.story.uuid})`);
    await sleep(300);
  }

  // 5. Create article stories
  console.log("5/5 Creating articles...");

  for (const art of ARTICLES) {
    if (existingSlugMap[art.slug]) {
      console.log(
        `  "${art.headline.substring(0, 40)}...": exists, skipping`,
      );
      continue;
    }

    const heroAsset = assetUrlMap[`article-${art.slug}`];
    const imageField = heroAsset?.url
      ? {
          id: heroAsset.id,
          alt: art.headline,
          filename: heroAsset.url,
          fieldtype: "asset",
        }
      : null;

    const created = await api("POST", "/stories", {
      story: {
        name: art.headline,
        slug: art.slug,
        tag_list: art.tags,
        content: {
          component: "article",
          headline: art.headline,
          body: storyblokRichText(art.body),
          teaser: art.teaser,
          image: imageField,
          category: categoryUuidMap[art.categorySlug] ?? "",
          author: authorUuidMap[art.authorSlug] ?? "",
          isFeatured: art.featured,
        },
      },
      publish: 1,
    });
    console.log(
      `  "${art.headline.substring(0, 40)}...": created (uuid: ${created.story.uuid})`,
    );
    await sleep(300);
  }

  // Summary
  console.log("\nDone!\n");
  console.log(
    `  Created: ${CATEGORIES.length} categories, ${AUTHORS.length} authors, ${ARTICLES.length} articles, ${allAssetJobs.length} assets`,
  );
  console.log(`\n  Next steps:`);
  console.log(`  1. Add to .env.local:`);
  console.log(`     CMS_ADAPTER=storyblok`);
  console.log(`     STORYBLOK_ACCESS_TOKEN=<your-preview-token>`);
  console.log(`     CMS_IMAGE_DOMAINS=a.storyblok.com`);
  console.log(`  2. npm run dev`);
  console.log(`  3. Open http://localhost:3000\n`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
