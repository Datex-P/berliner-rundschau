#!/usr/bin/env node
/**
 * Berliner Rundschau — DatoCMS Seed Script
 *
 * Erstellt Content-Models + Demo-Inhalte in einem DatoCMS-Space:
 *   6 Kategorien, 4 Autoren, 8 Artikel, 6 Newsticker,
 *   2 Breaking-News, Börsendaten und Tagesquiz.
 *
 * Aufruf:
 *   node cms-seeds/seed-datocms.mjs --token <full-access-api-token>
 *
 * Voraussetzungen:
 *   - DatoCMS-Projekt mit Full-Access API Token (Settings → API Tokens)
 *   - Leerer oder frischer Space
 *
 * Idempotent: Existierende Models werden erkannt und wiederverwendet.
 *   Vorhandene Demo-Datensätze werden gelöscht und neu erstellt.
 *   Alle Records werden automatisch publiziert.
 */

/* ============================================================
   CLI ARGS
   ============================================================ */

const rawArgs = process.argv.slice(2);
function getArg(n) {
  const i = rawArgs.indexOf(`--${n}`);
  return i !== -1 ? rawArgs[i + 1] : undefined;
}

const TOKEN = getArg("token");
const LOCALE = getArg("locale") ?? "en";

if (!TOKEN) {
  console.error(
    "Usage: node cms-seeds/seed-datocms.mjs --token <full-access-api-token>",
  );
  process.exit(1);
}

const BASE = "https://site-api.datocms.com";

/* ============================================================
   CMA HELPER
   ============================================================ */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(method, path, body, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/vnd.api+json",
        "X-Api-Version": "3",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 && attempt < retries) {
      const wait = 3000 * attempt;
      console.log(`  Rate limited, waiting ${wait / 1000}s (attempt ${attempt})...`);
      await sleep(wait);
      continue;
    }

    if (res.status === 204) return null;

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = JSON.stringify(json).slice(0, 300);
      throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
    }
    return json; // also returns body for 202 (contains job token)
  }
}

/* ============================================================
   IMAGE UPLOAD (URL → S3 → DatoCMS Upload)
   ============================================================ */

async function waitForJob(jobId, maxWaitMs = 30_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(1500);
    const res = await api("GET", `/job-results/${jobId}`).catch(() => null);
    if (!res?.data?.attributes) continue; // not ready yet

    const payload = res.data.attributes.payload;
    const data = payload?.data;

    // Error: data is an array of api_error objects
    if (Array.isArray(data) && data[0]?.type === "api_error") {
      const d = data[0]?.attributes?.details;
      const msg = d?.message ?? data[0]?.attributes?.code ?? JSON.stringify(data).slice(0, 200);
      throw new Error(`Job ${jobId} failed: ${msg}`);
    }

    if (data?.id) return data.id; // success — single result object
  }
  throw new Error(`Job ${jobId} timed out`);
}

async function uploadImageFromUrl(imgUrl, filename, alt = "") {
  // Step 1: Get presigned S3 URL from DatoCMS
  const req = await api("POST", "/upload-requests", {
    data: {
      type: "upload_request",
      attributes: { filename },
    },
  });
  const s3Key = req.data.id;
  const s3Url = req.data.attributes.url;

  // Step 2: Fetch image + PUT to S3
  const imgRes = await fetch(imgUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgUrl}`);
  const buf = await imgRes.arrayBuffer();
  const putRes = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: buf,
  });
  if (!putRes.ok) throw new Error(`S3 PUT failed (${putRes.status})`);

  // Step 3: Register upload in DatoCMS (returns async job)
  const upload = await api("POST", "/uploads", {
    data: {
      type: "upload",
      attributes: { path: s3Key },
    },
  });
  if (!upload) throw new Error("Upload returned empty response");
  let uploadId;
  if (upload.data?.type === "job" || upload.data?.type === "job_result") {
    uploadId = await waitForJob(upload.data.id);
  } else {
    uploadId = upload.data?.id ?? null;
  }
  return uploadId;
}

/* ============================================================
   HTML → DAST (Structured Text)
   ============================================================ */

function htmlToDast(html) {
  const children = [];
  const blockRe = /<(p|h[23]|ul)>([\s\S]*?)<\/\1>/gi;
  let m;

  while ((m = blockRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2];
    const strip = (s) => s.replace(/<[^>]+>/g, "").trim();

    if (tag === "p") {
      const t = strip(inner);
      if (t) children.push({ type: "paragraph", children: [{ type: "span", value: t }] });
    } else if (tag === "h2" || tag === "h3") {
      const t = strip(inner);
      if (t) children.push({ type: "heading", level: tag === "h2" ? 2 : 3, children: [{ type: "span", value: t }] });
    } else if (tag === "ul") {
      const items = [];
      const liRe = /<li>(.*?)<\/li>/gi;
      let li;
      while ((li = liRe.exec(inner)) !== null) {
        const t = strip(li[1]);
        if (t) items.push({ type: "listItem", children: [{ type: "paragraph", children: [{ type: "span", value: t }] }] });
      }
      if (items.length) children.push({ type: "list", style: "bulleted", children: items });
    }
  }

  return { schema: "dast", document: { type: "root", children } };
}

/* ============================================================
   SCHEMA BUILDER
   ============================================================ */

function editorFor(ft) {
  const map = {
    string: "single_line", text: "textarea", structured_text: "structured_text",
    file: "file", link: "link_select", boolean: "boolean", integer: "integer",
    json: "json", date: "date_picker", date_time: "date_time_picker", slug: "slug",
  };
  return map[ft] ?? "single_line";
}

async function ensureModel(apiKey, name, singleton, existingModels) {
  if (existingModels[apiKey]) {
    console.log(`    skip: model "${apiKey}" exists`);
    return existingModels[apiKey];
  }
  const res = await api("POST", "/item-types", {
    data: {
      type: "item_type",
      attributes: {
        name, api_key: apiKey, singleton,
        sortable: false, tree: false,
        draft_mode_active: true,
        ordering_direction: null,
        collection_appearance: "table",
      },
    },
  });
  console.log(`    created model "${apiKey}" → ${res.data.id}`);
  return res.data.id;
}

async function getFields(modelId) {
  try {
    const res = await api("GET", `/item-types/${modelId}/fields`);
    const map = {};
    for (const f of (res?.data ?? [])) map[f.attributes.api_key] = f.id;
    return map;
  } catch {
    return {};
  }
}

async function addField(modelId, existingFields, apiKey, label, ft, validators = {}) {
  if (existingFields[apiKey]) {
    console.log(`      skip field "${apiKey}" (already exists)`);
    return existingFields[apiKey];
  }
  console.log(`      create field "${apiKey}" (${ft})...`);
  try {
    const res = await api("POST", `/item-types/${modelId}/fields`, {
      data: {
        type: "field",
        attributes: {
          label, api_key: apiKey, field_type: ft,
          localized: false, hint: null,
          validators,
          appearance: { addons: [], editor: editorFor(ft), parameters: {} },
        },
      },
    });
    let fid;
    if (res?.data?.type === "job" || res?.data?.type === "job_result") {
      // Async field creation — poll for completion
      const jobResult = await waitForJob(res.data.id);
      fid = jobResult ?? null;
    } else {
      fid = res?.data?.id ?? null;
    }
    console.log(`      created field "${apiKey}" → ${fid}`);
    return fid;
  } catch (err) {
    // Field already exists — fetch its ID
    if (err.message.includes("FIELD_API_KEY_ALREADY_TAKEN") || err.message.includes("already been taken")) {
      const fields = await api("GET", `/item-types/${modelId}/fields`).catch(() => null);
      const f = fields?.data?.find((f) => f.attributes.api_key === apiKey);
      return f?.id ?? null;
    }
    console.error(`  addField ERROR: field "${apiKey}" (${ft}) on model ${modelId}: ${err.message}`);
    throw err;
  }
}

async function updateLinkField(fieldId, allowedItemTypes) {
  const res = await api("PUT", `/fields/${fieldId}`, {
    data: {
      type: "field",
      id: fieldId,
      attributes: {
        validators: { item_item_type: { item_types: allowedItemTypes } },
      },
    },
  });
  if (!res) return fieldId;
  if (res?.data?.type === "job" || res?.data?.type === "job_result") {
    await waitForJob(res.data.id).catch(() => {}); // ignore job result, field ID unchanged
  }
  return fieldId;
}

async function setTitleField(modelId, fieldId) {
  if (!fieldId) return;
  await api("PUT", `/item-types/${modelId}`, {
    data: {
      type: "item_type",
      id: modelId,
      attributes: {},
      relationships: {
        title_field: { data: { type: "field", id: fieldId } },
      },
    },
  }).catch(() => {}); // ignore if already set
}

async function buildSchema() {
  console.log("[1/5] Checking / creating models...");

  const list = await api("GET", "/item-types");
  const existingModels = {};
  for (const m of list.data) existingModels[m.attributes.api_key] = m.id;

  // ---- Category ----
  const catId = await ensureModel("category", "Category", false, existingModels);
  const catF = await getFields(catId);
  const catNameId = await addField(catId, catF, "name", "Name", "string", { required: {} });
  await addField(catId, catF, "slug", "Slug", "slug", {
    slug_title_field: { title_field_id: catNameId }, required: {}, unique: {},
  });
  await addField(catId, catF, "description", "Description", "text");
  await addField(catId, catF, "color", "Color", "string");
  await setTitleField(catId, catNameId);

  // ---- Author ----
  const authId = await ensureModel("author", "Author", false, existingModels);
  const authF = await getFields(authId);
  const authNameId = await addField(authId, authF, "name", "Name", "string", { required: {} });
  await addField(authId, authF, "slug", "Slug", "slug", {
    slug_title_field: { title_field_id: authNameId }, required: {}, unique: {},
  });
  await addField(authId, authF, "bio", "Bio", "text");
  await addField(authId, authF, "role", "Role", "string");
  await addField(authId, authF, "avatar", "Avatar", "file", {
    extension: { predefined_list: "image" },
  });
  await setTitleField(authId, authNameId);

  // ---- Article ----
  const artId = await ensureModel("article", "Article", false, existingModels);
  const artF = await getFields(artId);
  const artTitleId = await addField(artId, artF, "title", "Title", "string", { required: {} });
  await addField(artId, artF, "slug", "Slug", "slug", {
    slug_title_field: { title_field_id: artTitleId }, required: {}, unique: {},
  });
  await addField(artId, artF, "teaser", "Teaser", "text");
  await addField(artId, artF, "body", "Body", "structured_text", {
    structured_text_blocks: { item_types: [] },
    structured_text_links: { item_types: [] },
  });
  await addField(artId, artF, "image", "Cover Image", "file", {
    extension: { predefined_list: "image" },
  });
  const catLinkId = await addField(artId, artF, "category", "Category", "link", {
    item_item_type: { item_types: [catId] },
  });
  if (artF["category"]) await updateLinkField(artF["category"], [catId]);

  const authLinkId = await addField(artId, artF, "author", "Author", "link", {
    item_item_type: { item_types: [authId] },
  });
  if (artF["author"]) await updateLinkField(artF["author"], [authId]);
  await addField(artId, artF, "tags", "Tags", "json");
  await addField(artId, artF, "reading_time_minutes", "Reading Time (min)", "integer");
  await addField(artId, artF, "is_premium", "Is Premium", "boolean");
  await addField(artId, artF, "paywall", "Paywall", "string");
  await addField(artId, artF, "is_live", "Is Live", "boolean");
  await addField(artId, artF, "is_opinion", "Is Opinion", "boolean");
  await addField(artId, artF, "is_featured", "Is Featured", "boolean");
  await addField(artId, artF, "is_breaking", "Is Breaking", "boolean");
  await addField(artId, artF, "ai_summary", "AI Summary", "text");
  await addField(artId, artF, "region", "Region", "string");
  await setTitleField(artId, artTitleId);

  // ---- Newsticker ----
  const ntId = await ensureModel("newsticker", "Newsticker", false, existingModels);
  const ntF = await getFields(ntId);
  const ntHeadlineId = await addField(ntId, ntF, "headline", "Headline", "string", { required: {} });
  await addField(ntId, ntF, "slug", "Slug", "string");
  await addField(ntId, ntF, "ticker_type", "Ticker Type", "string");
  await addField(ntId, ntF, "topic", "Topic", "string");
  await addField(ntId, ntF, "is_premium", "Is Premium", "boolean");
  await setTitleField(ntId, ntHeadlineId);

  // ---- Breaking News ----
  const bnId = await ensureModel("breaking_news", "Breaking News", false, existingModels);
  const bnF = await getFields(bnId);
  const bnHeadlineId = await addField(bnId, bnF, "headline", "Headline", "string", { required: {} });
  await addField(bnId, bnF, "href", "Link", "string");
  await addField(bnId, bnF, "severity", "Severity", "string");
  await addField(bnId, bnF, "expires_at", "Expires At", "date_time");
  await setTitleField(bnId, bnHeadlineId);

  // ---- Navigation (singleton) ----
  const navId = await ensureModel("navigation", "Navigation", true, existingModels);
  const navF = await getFields(navId);
  await addField(navId, navF, "primary_menu_json", "Primary Menu (JSON)", "text");
  await addField(navId, navF, "footer_menu_json", "Footer Menu (JSON)", "text");
  await addField(navId, navF, "social_links_json", "Social Links (JSON)", "text");

  // ---- Site Config (singleton) ----
  const cfgId = await ensureModel("site_config", "Site Config", true, existingModels);
  const cfgF = await getFields(cfgId);
  const cfgTitleId = await addField(cfgId, cfgF, "title", "Title", "string");
  await addField(cfgId, cfgF, "description", "Description", "text");
  await addField(cfgId, cfgF, "url", "URL", "string");
  await addField(cfgId, cfgF, "language", "Language", "string");
  await addField(cfgId, cfgF, "tags", "Tags", "json");
  await addField(cfgId, cfgF, "social_links_json", "Social Links (JSON)", "text");
  await addField(cfgId, cfgF, "analytics_gtm_id", "GTM ID", "string");
  await setTitleField(cfgId, cfgTitleId);

  // ---- Quiz (singleton) ----
  const quizId = await ensureModel("quiz", "Quiz", true, existingModels);
  const quizF = await getFields(quizId);
  const quizTitleId = await addField(quizId, quizF, "title", "Title", "string");
  await addField(quizId, quizF, "date", "Date", "date");
  await addField(quizId, quizF, "questions_json", "Questions (JSON)", "text");
  await addField(quizId, quizF, "streak_rewards_json", "Streak Rewards (JSON)", "text");
  await setTitleField(quizId, quizTitleId);

  // ---- Stock (singleton) — api_key "stock" → GraphQL: stock ----
  const stockId = await ensureModel("stock", "Stock Data", true, existingModels);
  const stockF = await getFields(stockId);
  await addField(stockId, stockF, "indices_json", "Indices (JSON)", "text");
  await addField(stockId, stockF, "watchlist_json", "Watchlist (JSON)", "text");
  await addField(stockId, stockF, "chart_data_json", "Chart Data (JSON)", "text");

  console.log("  Schema ready.\n");
  return { catId, authId, artId, ntId, bnId, navId, cfgId, quizId, stockId };
}

/* ============================================================
   SEED DATA
   ============================================================ */

const CATEGORIES = [
  { slug: "politik",    name: "Politik",     description: "Nachrichten aus der Politik",        color: "#1e40af" },
  { slug: "wirtschaft", name: "Wirtschaft",  description: "Wirtschaftsnachrichten und Finanzen", color: "#047857" },
  { slug: "berlin",     name: "Berlin",      description: "Lokalnachrichten aus Berlin",          color: "#dc2626" },
  { slug: "kultur",     name: "Kultur",      description: "Kultur, Kunst und Unterhaltung",       color: "#7c3aed" },
  { slug: "sport",      name: "Sport",       description: "Sportnachrichten",                     color: "#ea580c" },
  { slug: "meinung",    name: "Meinung",     description: "Kommentare und Meinungsbeiträge",    color: "#64748b" },
];

const AUTHORS = [
  {
    slug: "anna-schmidt",
    name: "Anna Schmidt",
    bio: "Politikredakteurin mit Schwerpunkt Berliner Landespolitik und Stadtentwicklung.",
    role: "Politikredakteurin",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    slug: "markus-weber",
    name: "Markus Weber",
    bio: "Wirtschaftsjournalist, berichtet über Start-ups und Berliner Wirtschaftspolitik.",
    role: "Wirtschaftsredakteur",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    slug: "lisa-mueller",
    name: "Lisa Mueller",
    bio: "Kulturjournalistin mit Fokus auf Berliner Kunst- und Musikszene.",
    role: "Kulturredakteurin",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&h=200&q=80",
  },
  {
    slug: "thomas-becker",
    name: "Thomas Becker",
    bio: "Sportreporter mit Schwerpunkt Berliner Fußball und Leichtathletik.",
    role: "Sportredakteur",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80",
  },
];

const ARTICLES = [
  {
    slug: "berlins-neue-verkehrsstrategie",
    title: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    teaser: "Der Senat hat eine umfassende Verkehrswende beschlossen. Mehr Radwege, neue Tramlinien und eine autofreie Innenstadt.",
    body: "<p>Der Berliner Senat hat heute seine neue Verkehrsstrategie vorgestellt. Bis 2030 soll der Anteil des Radverkehrs auf 30 Prozent steigen.</p><h2>Neue Radschnellwege</h2><p>Insgesamt 12 neue Radschnellwege sollen die Außenbezirke mit dem Zentrum verbinden. Die erste Strecke von Adlershof zum Alexanderplatz wird bereits 2027 eröffnet.</p><h2>Tram-Ausbau nach Westen</h2><p>Die Straßenbahn soll erstmals seit der Teilung der Stadt wieder im Westteil fahren. Geplant sind Linien zum Kurfürstendamm und nach Steglitz.</p><h2>Autofreie Friedrichstraße wird dauerhaft</h2><p>Nach dem erfolgreichen Pilotprojekt wird die Friedrichstraße zwischen Französischer Straße und Leipziger Straße dauerhaft zur Fußgängerzone.</p>",
    imageUrl: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Fahrradweg in Berlin mit Fernsehturm im Hintergrund",
    category: "berlin",
    author: "anna-schmidt",
    tags: ["Verkehr", "Radverkehr", "Stadtentwicklung"],
    isFeatured: true,
  },
  {
    slug: "startup-boom-berlin-mitte",
    title: "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    teaser: "Berlin festigt seine Position als Start-up-Hauptstadt Europas. Besonders KI- und GreenTech-Unternehmen boomen.",
    body: "<p>Die Berliner Start-up-Szene erlebt einen neuen Höhenflug. Im ersten Quartal 2026 wurden allein in Mitte über 200 neue Unternehmen gegründet.</p><h2>KI-Start-ups führend</h2><p>Fast 40 Prozent der Neugründungen entfallen auf den Bereich Künstliche Intelligenz. Berlin hat sich als wichtigster KI-Hub in Europa etabliert.</p><h2>Venture Capital fließt</h2><p>Insgesamt 2,3 Milliarden Euro an Risikokapital flossen im ersten Quartal nach Berlin - ein Anstieg von 45 Prozent gegenüber dem Vorjahr.</p>",
    imageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Modernes Bürogebäude in Berlin-Mitte",
    category: "wirtschaft",
    author: "markus-weber",
    tags: ["Start-ups", "Wirtschaft", "KI", "Technologie"],
    isFeatured: false,
  },
  {
    slug: "kulturhauptstadt-berlin-sommer",
    title: "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    teaser: "Von der Neuen Nationalgalerie bis zum Humboldt Forum - diese Ausstellungen sollten Sie nicht verpassen.",
    body: "<p>Berlin bietet in diesem Sommer ein kulturelles Programm der Superlative. Hier sind die Highlights.</p><h2>Neue Nationalgalerie: Berlin Modern</h2><p>Die große Sommerausstellung zeigt 200 Werke Berliner Künstler aus den letzten 100 Jahren. Besonderer Fokus liegt auf der Street-Art-Bewegung der 2020er.</p><h2>Humboldt Forum: Ozeanien-Sammlung</h2><p>Erstmals werden 3.000 Objekte aus der Ozeanien-Sammlung in einer eigenen Etage präsentiert.</p><h2>Berlinische Galerie: Fotografie-Biennale</h2><p>50 internationale Fotografen zeigen Arbeiten zum Thema Stadt im Wandel.</p>",
    imageUrl: "https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Museumsinsel Berlin bei Sonnenuntergang",
    category: "kultur",
    author: "lisa-mueller",
    tags: ["Kultur", "Ausstellungen", "Museen", "Sommer"],
    isFeatured: false,
  },
  {
    slug: "hertha-bsc-nachwuchs-talente",
    title: "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Durchbruch",
    teaser: "Die Hertha-Akademie liefert: Drei junge Spieler haben sich in der ersten Mannschaft etabliert.",
    body: "<p>Hertha BSC erntet die Früchte seiner Nachwuchsarbeit. Gleich drei Spieler aus der eigenen Akademie haben sich in dieser Saison in der ersten Mannschaft etabliert.</p><h2>Talent aus Kreuzberg</h2><p>Der 19-jährige Mittelfeldspieler aus Berlin-Kreuzberg begeistert mit seiner Technik und Spielintelligenz. Bereits jetzt wird er als möglicher Nationalspieler gehandelt.</p><h2>Verteidiger-Duo aus der U19</h2><p>Zwei Innenverteidiger aus der U19 haben den Sprung in den Profikader geschafft und bilden bereits das stabilste Duo der Liga.</p>",
    imageUrl: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Olympiastadion Berlin — Heimat von Hertha BSC",
    category: "sport",
    author: "thomas-becker",
    tags: ["Sport", "Fußball", "Hertha BSC", "Nachwuchs"],
    isFeatured: false,
  },
  {
    slug: "wohnungsmarkt-berlin-mietpreise",
    title: "Wohnungsmarkt Berlin: Mietpreise steigen weiter",
    teaser: "Die durchschnittliche Kaltmiete in Berlin liegt erstmals über 14 Euro pro Quadratmeter. Was Mieter jetzt wissen müssen.",
    body: "<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die durchschnittliche Kaltmiete ist auf 14,20 Euro pro Quadratmeter gestiegen.</p><h2>Bezirke im Vergleich</h2><p>Am teuersten bleibt Mitte mit durchschnittlich 18,50 Euro, gefolgt von Charlottenburg-Wilmersdorf. Günstigere Alternativen finden sich in Spandau und Marzahn.</p><h2>Neubau-Offensive</h2><p>Der Senat hat ein Programm für 20.000 neue Wohnungen pro Jahr angekündigt. Kritiker bezweifeln die Umsetzbarkeit.</p>",
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Wohnhäuser in Berlin",
    category: "berlin",
    author: "markus-weber",
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
    isFeatured: false,
  },
  {
    slug: "kommentar-digitalisierung-verwaltung",
    title: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    teaser: "Seit Jahren wird die digitale Verwaltung versprochen. Warum es nicht vorangeht - eine Analyse.",
    body: "<p>Es ist zum Verzweifeln. Seit über einem Jahrzehnt versprechen Berliner Politiker die Digitalisierung der Verwaltung. Passiert ist wenig.</p><h2>Das Bürgeramt-Problem</h2><p>Wer einen Termin beim Bürgeramt braucht, wartet im Schnitt sechs Wochen. Online-Termine sind innerhalb von Sekunden vergriffen. Ein digitaler Antrag? Fehlanzeige.</p><h2>Was andere Städte besser machen</h2><p>Tallinn, Kopenhagen, Wien - sie alle zeigen, dass digitale Verwaltung funktioniert. Berlin könnte von ihnen lernen.</p>",
    imageUrl: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Laptop mit Verwaltungsformular",
    category: "meinung",
    author: "anna-schmidt",
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Meinung"],
    isOpinion: true,
  },
  {
    slug: "bvg-ubahn-netz-ausbau",
    title: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    teaser: "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    body: "<p>Die Berliner Verkehrsbetriebe haben ihren Modernisierungsplan für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits.</p><h2>Modernisierung bestehender Stationen</h2><p>47 bestehende Stationen stehen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung und digitale Fahrgastinformation.</p>",
    imageUrl: "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "U-Bahn-Station in Berlin",
    category: "berlin",
    author: "anna-schmidt",
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
  },
  {
    slug: "klimaschutz-berlin-klimaneutral",
    title: "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    teaser: "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: "<p>Der Berliner Senat hat ein umfassendes Klimaschutzpaket beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030</li><li>Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss</li></ul><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an.</p>",
    imageUrl: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
    imageAlt: "Solaranlage auf einem Berliner Dach",
    category: "politik",
    author: "anna-schmidt",
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
  },
];

const NEWSTICKER_ITEMS = [
  { headline: "Bundestag beschließt neues Digitalgesetz", slug: "bundestag-digitalgesetz", topic: "Politik", isPremium: false },
  { headline: "S-Bahn-Störung auf der Ringbahn behoben", slug: "sbahn-ringbahn-stoerung", topic: "Berlin", isPremium: false },
  { headline: "DAX schließt mit Rekordhoch bei 24.987 Punkten", slug: "dax-rekordhoch", topic: "Wirtschaft", isPremium: true },
  { headline: "Union Berlin verpflichtet schwedischen Stürmer", slug: "union-berlin-transfer", topic: "Sport", isPremium: false },
  { headline: "Berlinale kündigt Jury-Präsidentin für 2027 an", slug: "berlinale-jury", topic: "Kultur", isPremium: false },
  { headline: "Neue Fahrradstraße in Friedrichshain eröffnet", slug: "fahrradstrasse-friedrichshain", topic: "Berlin", isPremium: false },
];

const BREAKING_NEWS = [
  {
    headline: "Eilmeldung: Berliner Senat beschließt Klimaschutzpaket",
    href: "/artikel/klimaschutz-berlin-klimaneutral",
    severity: "breaking",
  },
  {
    headline: "BVG: Signalstörung auf der U2 – Verspätungen erwartet",
    href: "/artikel/bvg-ubahn-netz-ausbau",
    severity: "alert",
  },
];

const QUIZ_QUESTIONS_JSON = JSON.stringify([
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
    question: "Wie heisst Berlins groesster See?",
    options: ["Wannsee", "Mueggelsee", "Tegeler See", "Schlachtensee"],
    correctIndex: 1,
    explanation: "Der Müggelsee in Treptow-Köpenick ist mit 7,4 km² der größte See Berlins.",
  },
]);

const QUIZ_REWARDS_JSON = JSON.stringify([
  { days: 3, badge: "Berlin-Kenner", emoji: "🏅" },
  { days: 7, badge: "Hauptstadt-Experte", emoji: "🎓" },
  { days: 14, badge: "Berlin-Meister", emoji: "🏆" },
]);

const INDICES_JSON = JSON.stringify([
  { id: "dax", name: "DAX", value: 24987.45, change: 148.72, changePercent: 0.60, currency: "EUR", sparkline: [21200, 21280, 21350, 21400, 24987] },
  { id: "mdax", name: "MDAX", value: 30743.1, change: -45.2, changePercent: -0.16, currency: "EUR", sparkline: [29000, 28980, 28950, 28940, 30743] },
  { id: "dow", name: "Dow Jones", value: 52387.42, change: 234.56, changePercent: 0.55, currency: "USD", sparkline: [42300, 42400, 42450, 42500, 42568] },
  { id: "eurusd", name: "EUR/USD", value: 1.1392, change: 0.0023, changePercent: 0.21, currency: "", sparkline: [1.086, 1.087, 1.088, 1.089, 1.089] },
]);

const WATCHLIST_JSON = JSON.stringify([
  { id: "sap", symbol: "SAP.DE", name: "SAP SE", price: 142.85, change: 2.15, changePercent: 1.53, marketCap: "165.8B", pe: 32.4, sector: "Technologie" },
  { id: "sie", symbol: "SIE.DE", name: "Siemens AG", price: 268.45, change: 3.8, changePercent: 1.44, marketCap: "214.5B", pe: 20.8, sector: "Industrie" },
  { id: "bayn", symbol: "BAYN.DE", name: "Bayer AG", price: 48.92, change: -0.73, changePercent: -1.47, marketCap: "48.2B", pe: null, sector: "Pharma" },
]);

/* ============================================================
   CONTENT CREATION
   ============================================================ */

async function deleteAllOfModel(modelId) {
  let page = 1;
  const ids = [];
  for (;;) {
    const res = await api("GET", `/items?filter[type]=${modelId}&page[number]=${page}&page[size]=100`);
    if (!res.data.length) break;
    for (const item of res.data) ids.push(item.id);
    if (res.data.length < 100) break;
    page++;
  }
  for (const id of ids) {
    await api("DELETE", `/items/${id}`).catch(() => {});
  }
  return ids.length;
}

async function getSingletonItem(modelId) {
  const res = await api("GET", `/items?filter[type]=${modelId}`);
  return res.data.length ? res.data[0] : null;
}

async function createItem(modelId, attrs, links = {}) {
  // DatoCMS CMA v3: link field values go in attributes as plain item IDs
  const allAttrs = { ...attrs };
  for (const [key, id] of Object.entries(links)) {
    if (id) allAttrs[key] = id;
  }
  const res = await api("POST", "/items", {
    data: {
      type: "item",
      attributes: allAttrs,
      relationships: {
        item_type: { data: { type: "item_type", id: modelId } },
      },
    },
  });
  return res.data.id;
}

async function updateItem(itemId, attrs, links = {}) {
  const allAttrs = { ...attrs };
  for (const [key, id] of Object.entries(links)) {
    allAttrs[key] = id ?? null;
  }
  const res = await api("PUT", `/items/${itemId}`, {
    data: { type: "item", id: itemId, attributes: allAttrs },
  });
  return res.data.id;
}

async function publishItem(itemId) {
  await api("PUT", `/items/${itemId}/publish`).catch(() => {});
}

/* ============================================================
   MAIN
   ============================================================ */

async function main() {
  console.log("\nBerliner Rundschau — DatoCMS Seed\n");

  // --- Schema ---
  const { catId, authId, artId, ntId, bnId, navId, cfgId, quizId, stockId } =
    await buildSchema();

  // --- Clear existing demo content ---
  console.log("[2/5] Clearing existing demo records...");
  const counts = await Promise.all([
    deleteAllOfModel(artId),
    deleteAllOfModel(catId),
    deleteAllOfModel(authId),
    deleteAllOfModel(ntId),
    deleteAllOfModel(bnId),
  ]);
  console.log(`  Deleted: ${counts.join(" + ")} records.\n`);

  // --- Upload images ---
  console.log("[3/5] Uploading images...");
  const uploadMap = {};

  for (const auth of AUTHORS) {
    try {
      const id = await uploadImageFromUrl(auth.avatarUrl, `${auth.slug}-avatar.jpg`, auth.name);
      uploadMap[`${auth.slug}-avatar`] = id;
      console.log(`  Avatar: ${auth.name}`);
    } catch (e) {
      console.log(`  Avatar SKIP (${auth.name}): ${e.message}`);
    }
    await sleep(400);
  }

  for (const art of ARTICLES) {
    try {
      const id = await uploadImageFromUrl(art.imageUrl, `${art.slug}-hero.jpg`, art.imageAlt);
      uploadMap[`${art.slug}-hero`] = id;
      console.log(`  Hero: ${art.title.slice(0, 50)}...`);
    } catch (e) {
      console.log(`  Hero SKIP (${art.slug}): ${e.message}`);
    }
    await sleep(400);
  }
  console.log(`  ${Object.keys(uploadMap).length} images uploaded.`);
  if (Object.keys(uploadMap).length > 0) {
    console.log("  Waiting 5s for DatoCMS to process uploads...");
    await sleep(5000);
    // Verify uploads are accessible
    for (const [key, uid] of Object.entries(uploadMap)) {
      const check = await api("GET", `/uploads/${uid}`).catch(() => null);
      if (!check) console.log(`  [WARN] Upload ${key} (${uid}) not found in API`);
      else console.log(`  [OK] Upload ${key}: path=${check.data?.attributes?.path}`);
    }
  }
  console.log();

  // --- Categories ---
  console.log("[4/5] Creating categories, authors, articles, singletons...");
  const catIds = {};
  for (const cat of CATEGORIES) {
    const id = await createItem(catId, {
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      color: cat.color,
    });
    catIds[cat.slug] = id;
    await publishItem(id);
  }
  console.log(`  ${CATEGORIES.length} categories created + published.`);

  // --- Authors ---
  const authorIds = {};
  for (const auth of AUTHORS) {
    const attrs = {
      name: auth.name,
      slug: auth.slug,
      bio: auth.bio,
      role: auth.role,
    };
    const avatarUploadId = uploadMap[`${auth.slug}-avatar`];
    if (avatarUploadId) {
      attrs.avatar = { upload_id: avatarUploadId, alt: auth.name, title: null, custom_data: {}, focal_point: null };
    }
    const id = await createItem(authId, attrs);
    authorIds[auth.slug] = id;
    await publishItem(id);
  }
  console.log(`  ${AUTHORS.length} authors created + published.`);

  // --- Articles ---
  const publishedArticleIds = [];
  for (const art of ARTICLES) {
    const attrs = {
      title: art.title,
      slug: art.slug,
      teaser: art.teaser,
      body: htmlToDast(art.body),
      reading_time_minutes: Math.ceil(art.body.split(" ").length / 200),
      is_premium: false,
      paywall: "free",
      is_live: false,
      is_opinion: art.isOpinion ?? false,
      is_featured: art.isFeatured ?? false,
      is_breaking: false,
      ai_summary: "",
      region: "Berlin",
    };
    const heroUploadId = uploadMap[`${art.slug}-hero`];
    if (heroUploadId) {
      attrs.image = { upload_id: heroUploadId, alt: art.imageAlt, title: null, custom_data: {}, focal_point: null };
    }
    const links = {
      category: catIds[art.category],
      author: authorIds[art.author],
    };
    const id = await createItem(artId, attrs, links);
    publishedArticleIds.push(id);
    await publishItem(id);
    await sleep(200);
  }
  console.log(`  ${ARTICLES.length} articles created + published.`);

  // --- Newsticker ---
  for (const nt of NEWSTICKER_ITEMS) {
    const id = await createItem(ntId, {
      headline: nt.headline,
      slug: nt.slug,
      ticker_type: "TimelineTeaser",
      topic: nt.topic,
      is_premium: nt.isPremium,
    });
    await publishItem(id);
  }
  console.log(`  ${NEWSTICKER_ITEMS.length} newsticker items created + published.`);

  // --- Breaking News ---
  for (const bn of BREAKING_NEWS) {
    const id = await createItem(bnId, {
      headline: bn.headline,
      href: bn.href,
      severity: bn.severity,
    });
    await publishItem(id);
  }
  console.log(`  ${BREAKING_NEWS.length} breaking news items created + published.`);

  // --- Singletons (create or update) ---

  // Navigation
  const navItem = await getSingletonItem(navId);
  const navAttrs = {
    primary_menu_json: JSON.stringify([
      { href: "/", label: "Start" },
      { href: "/kategorie/politik", label: "Politik" },
      { href: "/kategorie/wirtschaft", label: "Wirtschaft" },
      { href: "/kategorie/berlin", label: "Berlin" },
      { href: "/kategorie/kultur", label: "Kultur" },
      { href: "/kategorie/sport", label: "Sport" },
      { href: "/kategorie/meinung", label: "Meinung" },
    ]),
    footer_menu_json: JSON.stringify([
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/kontakt", label: "Kontakt" },
    ]),
    social_links_json: JSON.stringify([]),
  };
  const navRecordId = navItem
    ? await updateItem(navItem.id, navAttrs)
    : await createItem(navId, navAttrs);
  await publishItem(navRecordId);
  console.log("  Navigation singleton set.");

  // Site Config
  const cfgItem = await getSingletonItem(cfgId);
  const cfgAttrs = {
    title: "Berliner Rundschau",
    description: "Das Nachrichtenportal für Berlin und die Welt.",
    url: "https://berliner-rundschau.vercel.app",
    language: "de",
    social_links_json: JSON.stringify([]),
    analytics_gtm_id: "",
  };
  const cfgRecordId = cfgItem
    ? await updateItem(cfgItem.id, cfgAttrs)
    : await createItem(cfgId, cfgAttrs);
  await publishItem(cfgRecordId);
  console.log("  Site Config singleton set.");

  // Quiz
  const quizItem = await getSingletonItem(quizId);
  const quizAttrs = {
    title: "Wie gut kennen Sie Berlin?",
    date: "2026-06-28",
    questions_json: QUIZ_QUESTIONS_JSON,
    streak_rewards_json: QUIZ_REWARDS_JSON,
  };
  const quizRecordId = quizItem
    ? await updateItem(quizItem.id, quizAttrs)
    : await createItem(quizId, quizAttrs);
  await publishItem(quizRecordId);
  console.log("  Quiz singleton set.");

  // Stock Data
  const stockItem = await getSingletonItem(stockId);
  const stockAttrs = {
    indices_json: INDICES_JSON,
    watchlist_json: WATCHLIST_JSON,
    chart_data_json: JSON.stringify({}),
  };
  const stockRecordId = stockItem
    ? await updateItem(stockItem.id, stockAttrs)
    : await createItem(stockId, stockAttrs);
  await publishItem(stockRecordId);
  console.log("  Stock Data singleton set.");

  // --- Done ---
  console.log("\n[5/5] Done!\n");
  console.log("  .env.local konfigurieren:");
  console.log("  ─────────────────────────────────────────");
  console.log("  CMS_ADAPTER=datocms");
  console.log("  DATOCMS_API_TOKEN=<your-read-only-api-token>");
  console.log("  CMS_IMAGE_DOMAINS=www.datocms-assets.com");
  console.log("  ─────────────────────────────────────────");
  console.log("\n  Hinweis: Fuer Produktion einen Read-only Token verwenden");
  console.log("  (Settings → API Tokens → Read-only API token).\n");
  console.log("  npm run dev → http://localhost:3000\n");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
