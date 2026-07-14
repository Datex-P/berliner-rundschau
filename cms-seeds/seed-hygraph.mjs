#!/usr/bin/env node
/**
 * Berliner Rundschau — Hygraph Seed Script
 *
 * Erstellt Content-Models + Demo-Inhalte in einem Hygraph-Projekt:
 *   6 Kategorien, 4 Autoren, 8 Artikel, 6 Newsticker,
 *   3 Videos, 2 Breaking-News, Navigation, SiteConfig,
 *   Börsendaten und Tagesquiz.
 *
 * Aufruf:
 *   node cms-seeds/seed-hygraph.mjs \
 *     --token <permanent-auth-token> \
 *     --endpoint <content-api-endpoint>
 *
 * Beispiel:
 *   node cms-seeds/seed-hygraph.mjs \
 *     --token eyJhbG... \
 *     --endpoint https://api-eu-west-2.hygraph.com/v2/<projectId>/master
 *
 * Voraussetzungen:
 *   - Hygraph-Projekt mit PAT (Settings → API Access → Permanent Auth Tokens)
 *   - Token braucht Content + Management Scope
 *
 * Idempotent: Existierende Models werden erkannt, vorhandene Demo-Daten
 *   gelöscht und neu erstellt. Alle Records werden publiziert.
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
const CONTENT_API = getArg("endpoint");

if (!TOKEN || !CONTENT_API) {
  console.error(
    "Usage: node cms-seeds/seed-hygraph.mjs --token <pat> --endpoint <content-api-url>",
  );
  console.error(
    "  endpoint: https://api-<region>.hygraph.com/v2/<projectId>/<env>",
  );
  process.exit(1);
}

const regionMatch = CONTENT_API.match(/api-([\w-]+)\.hygraph\.com/);
if (!regionMatch) {
  console.error("Cannot parse region from endpoint URL.");
  process.exit(1);
}
const REGION = regionMatch[1];
const MGMT_API = `https://management-${REGION}.hygraph.com/graphql`;

/* ============================================================
   HELPERS
   ============================================================ */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gql(url, query, variables, { auth = true, retries = 3 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const headers = { "Content-Type": "application/json" };
    if (auth) headers.Authorization = `Bearer ${TOKEN}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429 && attempt < retries) {
      const wait = 3000 * attempt;
      console.log(
        `  Rate limited, waiting ${wait / 1000}s (attempt ${attempt})...`,
      );
      await sleep(wait);
      continue;
    }

    const json = await res.json();
    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join("; ");
      if (attempt < retries && msg.includes("rate")) {
        await sleep(3000 * attempt);
        continue;
      }
      throw new Error(`GraphQL error: ${msg}`);
    }
    return json.data;
  }
}

const mgmt = (q, v) => gql(MGMT_API, q, v);
const content = (q, v) => gql(CONTENT_API, q, v, { auth: false });

async function waitForMigration(envId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    const data = await mgmt(
      `query($envId: ID!) {
        viewer { project { environment(id: $envId) {
          migrations { id status errors createdAt }
        } } }
      }`,
      { envId },
    );
    const migs = data.viewer.project.environment.migrations;
    if (!migs?.length) return;
    migs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = migs[0];
    if (latest.status === "SUCCESS") return;
    if (latest.status === "FAILED") {
      throw new Error(`Migration failed: ${latest.errors || "unknown"}`);
    }
  }
  throw new Error("Migration timed out");
}

async function mgmtAndWait(envId, query, variables) {
  const result = await mgmt(query, variables);
  await waitForMigration(envId);
  return result;
}

/* ============================================================
   PHASE 0: GET ENVIRONMENT ID
   ============================================================ */

async function getEnvironmentId() {
  const envName =
    CONTENT_API.split("/").pop() || "master";
  const data = await mgmt(`
    query { viewer { project { environment(name: "${envName}") { id } } } }
  `);
  return data.viewer.project.environment.id;
}

/* ============================================================
   PHASE 1: CREATE MODELS
   ============================================================ */

async function getExistingModels(envId) {
  const data = await mgmt(
    `query($envId: ID!) {
      viewer { project { environment(id: $envId) {
        contentModel { models { apiId id } }
      } } }
    }`,
    { envId },
  );
  const models = data.viewer.project.environment.contentModel.models;
  const map = {};
  for (const m of models) map[m.apiId] = m.id;
  return map;
}

const MODEL_DEFS = [
  { apiId: "Category", apiIdPlural: "Categories", displayName: "Category" },
  { apiId: "Author", apiIdPlural: "Authors", displayName: "Author" },
  { apiId: "Article", apiIdPlural: "Articles", displayName: "Article" },
  {
    apiId: "Newsticker",
    apiIdPlural: "Newstickers",
    displayName: "Newsticker",
  },
  { apiId: "Video", apiIdPlural: "Videos", displayName: "Video" },
  {
    apiId: "Navigation",
    apiIdPlural: "Navigations",
    displayName: "Navigation",
  },
  {
    apiId: "SiteConfig",
    apiIdPlural: "SiteConfigs",
    displayName: "Site Config",
  },
  {
    apiId: "BreakingNews",
    apiIdPlural: "BreakingNewses",
    displayName: "Breaking News",
  },
  { apiId: "Quiz", apiIdPlural: "Quizzes", displayName: "Quiz" },
  {
    apiId: "StockData",
    apiIdPlural: "StockDatas",
    displayName: "Stock Data",
  },
];

async function createModels(envId) {
  const existing = await getExistingModels(envId);
  const modelIds = { ...existing };

  for (const def of MODEL_DEFS) {
    if (existing[def.apiId]) {
      console.log(`  skip model "${def.apiId}" (exists)`);
      continue;
    }
    await mgmtAndWait(
      envId,
      `mutation($input: CreateModelInput!) {
        createModel(data: $input) { migration { id status } }
      }`,
      {
        input: {
          environmentId: envId,
          apiId: def.apiId,
          apiIdPlural: def.apiIdPlural,
          displayName: def.displayName,
        },
      },
    );
    console.log(`  created model "${def.apiId}"`);
  }

  return getExistingModels(envId);
}

/* ============================================================
   PHASE 2: CREATE FIELDS
   ============================================================ */

async function getExistingFields(envId, modelApiId) {
  const data = await mgmt(
    `query($envId: ID!) {
      viewer { project { environment(id: $envId) {
        contentModel { model(apiId: "${modelApiId}") {
          fields { apiId id }
        } }
      } } }
    }`,
    { envId },
  );
  const fields =
    data.viewer.project.environment.contentModel.model?.fields ?? [];
  const map = {};
  for (const f of fields) map[f.apiId] = f.id;
  return map;
}

async function addSimpleField(
  envId,
  modelId,
  existingFields,
  apiId,
  displayName,
  type,
  opts = {},
) {
  if (existingFields[apiId]) {
    return existingFields[apiId];
  }
  const input = {
    modelId,
    apiId,
    displayName,
    type,
    isRequired: opts.isRequired ?? false,
    isUnique: opts.isUnique ?? false,
    isList: opts.isList ?? false,
    isLocalized: false,
    isTitle: opts.isTitle ?? false,
  };
  try {
    await mgmtAndWait(
      envId,
      `mutation($input: CreateSimpleFieldInput!) {
        createSimpleField(data: $input) { migration { id status } }
      }`,
      { input },
    );
    console.log(`    field "${apiId}" (${type})`);
    return apiId;
  } catch (err) {
    if (err.message.includes("already exists") || err.message.includes("Duplicate")) {
      console.log(`    skip field "${apiId}" (already exists)`);
      return null;
    }
    throw err;
  }
}

async function addRelationalField(
  envId,
  modelId,
  existingFields,
  apiId,
  displayName,
  targetModelId,
  reverseApiId,
  reverseDisplayName,
  opts = {},
) {
  if (existingFields[apiId]) {
    return existingFields[apiId];
  }
  const input = {
    modelId,
    apiId,
    displayName,
    type: "RELATION",
    isList: opts.isList ?? false,
    reverseSide: {
      modelId: targetModelId,
      field: {
        apiId: reverseApiId,
        displayName: reverseDisplayName,
        isList: true,
      },
    },
  };
  try {
    await mgmtAndWait(
      envId,
      `mutation($input: CreateRelationalFieldInput!) {
        createRelationalField(data: $input) { migration { id status } }
      }`,
      { input },
    );
    console.log(`    relation "${apiId}"`);
    return apiId;
  } catch (err) {
    if (err.message.includes("already exists") || err.message.includes("Duplicate")) {
      console.log(`    skip relation "${apiId}" (already exists)`);
      return null;
    }
    throw err;
  }
}

async function createAllFields(envId, modelIds) {
  console.log("\n  --- Category fields ---");
  const catF = await getExistingFields(envId, "Category");
  await addSimpleField(envId, modelIds.Category, catF, "name", "Name", "STRING", {
    isRequired: true,
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.Category, catF, "slug", "Slug", "STRING", {
    isRequired: true,
    isUnique: true,
  });
  await addSimpleField(envId, modelIds.Category, catF, "description", "Description", "STRING");
  await addSimpleField(envId, modelIds.Category, catF, "color", "Color", "STRING");

  console.log("\n  --- Author fields ---");
  const authF = await getExistingFields(envId, "Author");
  await addSimpleField(envId, modelIds.Author, authF, "name", "Name", "STRING", {
    isRequired: true,
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.Author, authF, "slug", "Slug", "STRING", {
    isRequired: true,
    isUnique: true,
  });
  await addSimpleField(envId, modelIds.Author, authF, "bio", "Bio", "STRING");
  await addSimpleField(envId, modelIds.Author, authF, "role", "Role", "STRING");
  await addSimpleField(envId, modelIds.Author, authF, "avatar", "Avatar", "JSON");

  console.log("\n  --- Article fields ---");
  const artF = await getExistingFields(envId, "Article");
  await addSimpleField(envId, modelIds.Article, artF, "headline", "Headline", "STRING", {
    isRequired: true,
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.Article, artF, "slug", "Slug", "STRING", {
    isRequired: true,
    isUnique: true,
  });
  await addSimpleField(envId, modelIds.Article, artF, "teaser", "Teaser", "STRING");
  await addSimpleField(envId, modelIds.Article, artF, "body", "Body", "STRING");
  await addSimpleField(envId, modelIds.Article, artF, "image", "Image", "JSON");
  await addSimpleField(envId, modelIds.Article, artF, "tags", "Tags", "STRING", {
    isList: true,
  });
  await addSimpleField(envId, modelIds.Article, artF, "readingTimeMinutes", "Reading Time", "INT");
  await addSimpleField(envId, modelIds.Article, artF, "isPremium", "Is Premium", "BOOLEAN");
  await addSimpleField(envId, modelIds.Article, artF, "paywall", "Paywall", "STRING");
  await addSimpleField(envId, modelIds.Article, artF, "isLive", "Is Live", "BOOLEAN");
  await addSimpleField(envId, modelIds.Article, artF, "isOpinion", "Is Opinion", "BOOLEAN");
  await addSimpleField(envId, modelIds.Article, artF, "isFeatured", "Is Featured", "BOOLEAN");
  await addSimpleField(envId, modelIds.Article, artF, "isBreaking", "Is Breaking", "BOOLEAN");
  await addSimpleField(envId, modelIds.Article, artF, "aiSummary", "AI Summary", "STRING");
  await addSimpleField(envId, modelIds.Article, artF, "region", "Region", "STRING");

  // Relations: Article → Category, Article → Author
  await addRelationalField(envId, modelIds.Article, artF, "category", "Category", modelIds.Category, "articles", "Articles", { isList: false });
  await addRelationalField(envId, modelIds.Article, artF, "author", "Author", modelIds.Author, "articles", "Articles", { isList: false });

  console.log("\n  --- Newsticker fields ---");
  const ntF = await getExistingFields(envId, "Newsticker");
  await addSimpleField(envId, modelIds.Newsticker, ntF, "type", "Type", "STRING");
  await addSimpleField(envId, modelIds.Newsticker, ntF, "topic", "Topic", "STRING");
  await addSimpleField(envId, modelIds.Newsticker, ntF, "headline", "Headline", "STRING", {
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.Newsticker, ntF, "slug", "Slug", "STRING", {
    isUnique: true,
  });
  await addSimpleField(envId, modelIds.Newsticker, ntF, "isPremium", "Is Premium", "BOOLEAN");

  console.log("\n  --- Video fields ---");
  const vidF = await getExistingFields(envId, "Video");
  await addSimpleField(envId, modelIds.Video, vidF, "title", "Title", "STRING", {
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.Video, vidF, "videoUrl", "Video URL", "STRING");
  await addSimpleField(envId, modelIds.Video, vidF, "poster", "Poster", "STRING");
  await addSimpleField(envId, modelIds.Video, vidF, "durationSeconds", "Duration (s)", "INT");
  await addSimpleField(envId, modelIds.Video, vidF, "caption", "Caption", "STRING");
  await addSimpleField(envId, modelIds.Video, vidF, "category", "Category Slug", "STRING");

  console.log("\n  --- Navigation fields ---");
  const navF = await getExistingFields(envId, "Navigation");
  await addSimpleField(envId, modelIds.Navigation, navF, "slug", "Slug", "STRING", {
    isRequired: true,
    isUnique: true,
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.Navigation, navF, "primaryMenuJson", "Primary Menu", "JSON");
  await addSimpleField(envId, modelIds.Navigation, navF, "footerMenuJson", "Footer Menu", "JSON");
  await addSimpleField(envId, modelIds.Navigation, navF, "socialLinksJson", "Social Links", "JSON");

  console.log("\n  --- SiteConfig fields ---");
  const scF = await getExistingFields(envId, "SiteConfig");
  await addSimpleField(envId, modelIds.SiteConfig, scF, "slug", "Slug", "STRING", {
    isRequired: true,
    isUnique: true,
  });
  await addSimpleField(envId, modelIds.SiteConfig, scF, "title", "Title", "STRING", {
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.SiteConfig, scF, "description", "Description", "STRING");
  await addSimpleField(envId, modelIds.SiteConfig, scF, "url", "URL", "STRING");
  await addSimpleField(envId, modelIds.SiteConfig, scF, "language", "Language", "STRING");
  await addSimpleField(envId, modelIds.SiteConfig, scF, "tags", "Tags", "STRING", {
    isList: true,
  });
  await addSimpleField(envId, modelIds.SiteConfig, scF, "socialLinksJson", "Social Links", "JSON");
  await addSimpleField(envId, modelIds.SiteConfig, scF, "analyticsGtmId", "GTM ID", "STRING");

  console.log("\n  --- BreakingNews fields ---");
  const bnF = await getExistingFields(envId, "BreakingNews");
  await addSimpleField(envId, modelIds.BreakingNews, bnF, "headline", "Headline", "STRING", {
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.BreakingNews, bnF, "href", "Link", "STRING");
  await addSimpleField(envId, modelIds.BreakingNews, bnF, "severity", "Severity", "STRING");
  await addSimpleField(envId, modelIds.BreakingNews, bnF, "expiresAt", "Expires At", "DATETIME");

  console.log("\n  --- Quiz fields ---");
  const qF = await getExistingFields(envId, "Quiz");
  await addSimpleField(envId, modelIds.Quiz, qF, "slug", "Slug", "STRING", {
    isRequired: true,
    isUnique: true,
  });
  await addSimpleField(envId, modelIds.Quiz, qF, "date", "Date", "STRING");
  await addSimpleField(envId, modelIds.Quiz, qF, "title", "Title", "STRING", {
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.Quiz, qF, "questionsJson", "Questions", "JSON");
  await addSimpleField(envId, modelIds.Quiz, qF, "streakRewardsJson", "Streak Rewards", "JSON");

  console.log("\n  --- StockData fields ---");
  const sdF = await getExistingFields(envId, "StockData");
  await addSimpleField(envId, modelIds.StockData, sdF, "slug", "Slug", "STRING", {
    isRequired: true,
    isUnique: true,
    isTitle: true,
  });
  await addSimpleField(envId, modelIds.StockData, sdF, "indicesJson", "Indices", "JSON");
  await addSimpleField(envId, modelIds.StockData, sdF, "watchlistJson", "Watchlist", "JSON");
  await addSimpleField(envId, modelIds.StockData, sdF, "chartDataJson", "Chart Data", "JSON");
}

/* ============================================================
   PHASE 3: SEED CONTENT
   ============================================================ */

async function deleteExisting(pluralName) {
  try {
    const data = await content(`
      query { ${pluralName}(first: 100, stage: DRAFT) { id } }
    `);
    const items = data[pluralName];
    if (!items?.length) return;
    const modelName =
      pluralName.charAt(0).toUpperCase() + pluralName.slice(1);
    const singularGuesses = [
      pluralName.replace(/ses$/, "s"),
      pluralName.replace(/zes$/, "z"),
      pluralName.replace(/ies$/, "y"),
      pluralName.replace(/s$/, ""),
    ];
    for (const item of items) {
      for (const singular of singularGuesses) {
        const mutName = `delete${singular.charAt(0).toUpperCase() + singular.slice(1)}`;
        try {
          await content(
            `mutation($id: ID!) { ${mutName}(where: { id: $id }) { id } }`,
            { id: item.id },
          );
          break;
        } catch {
          continue;
        }
      }
    }
    console.log(`  deleted ${items.length} ${pluralName}`);
  } catch {
    // Model might not have content yet
  }
}

async function createAndPublish(mutationName, data) {
  const createMut = `create${mutationName}`;
  const publishMut = `publish${mutationName}`;

  const result = await content(
    `mutation($data: ${mutationName}CreateInput!) {
      ${createMut}(data: $data) { id }
    }`,
    { data },
  );
  const id = result[createMut].id;

  await content(
    `mutation($id: ID!) {
      ${publishMut}(where: { id: $id }, to: PUBLISHED) { id }
    }`,
    { id },
  );

  return id;
}

async function seedCategories() {
  console.log("\n  --- Seeding Categories ---");
  await deleteExisting("categories");
  const ids = {};

  const cats = [
    {
      name: "Politik",
      slug: "politik",
      description:
        "Aktuelle politische Nachrichten aus Berlin, Deutschland und der Welt.",
      color: "#2563eb",
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
      color: "#dc2626",
    },
    {
      name: "Kultur",
      slug: "kultur",
      description:
        "Kunst, Musik, Theater, Film und Ausstellungen in Berlin.",
      color: "#9333ea",
    },
    {
      name: "Sport",
      slug: "sport",
      description:
        "Sportnachrichten aus Berlin — Hertha BSC, Union Berlin, Alba und mehr.",
      color: "#0891b2",
    },
    {
      name: "Meinung",
      slug: "meinung",
      description:
        "Kommentare, Analysen und Gastbeiträge zu aktuellen Themen.",
      color: "#ea580c",
    },
  ];

  for (const cat of cats) {
    const id = await createAndPublish("Category", cat);
    ids[cat.slug] = id;
    console.log(`    ${cat.name} → ${id}`);
    await sleep(300);
  }
  return ids;
}

async function seedAuthors() {
  console.log("\n  --- Seeding Authors ---");
  await deleteExisting("authors");
  const ids = {};

  const authors = [
    {
      name: "Anna Schmidt",
      slug: "anna-schmidt",
      bio: "Chefredakteurin der Berliner Rundschau. Schwerpunkte: Landespolitik, Infrastruktur und Stadtentwicklung.",
      role: "Chefredakteurin",
      avatar: {
        url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
      },
    },
    {
      name: "Markus Weber",
      slug: "markus-weber",
      bio: "Wirtschaftsredakteur mit Fokus auf Start-ups, Immobilien und Berliner Wirtschaftspolitik.",
      role: "Wirtschaftsredakteur",
      avatar: {
        url: "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
      },
    },
    {
      name: "Lisa Müller",
      slug: "lisa-mueller",
      bio: "Kulturredakteurin der Berliner Rundschau. Berichtet über Ausstellungen, Theater und die Berliner Kunstszene.",
      role: "Kulturredakteurin",
      avatar: {
        url: "https://images.unsplash.com/photo-1573496527892-904f897eb744?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
      },
    },
    {
      name: "Thomas Becker",
      slug: "thomas-becker",
      bio: "Sportredakteur mit Leidenschaft für Berliner Fußball. Begleitet Hertha BSC und Union Berlin seit über zehn Jahren.",
      role: "Sportredakteur",
      avatar: {
        url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80&crop=faces",
      },
    },
  ];

  for (const a of authors) {
    const id = await createAndPublish("Author", a);
    ids[a.slug] = id;
    console.log(`    ${a.name} → ${id}`);
    await sleep(300);
  }
  return ids;
}

async function seedArticles(categoryIds, authorIds) {
  console.log("\n  --- Seeding Articles ---");
  await deleteExisting("articles");

  const articles = [
    {
      headline: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
      slug: "berlins-neue-verkehrsstrategie",
      teaser:
        "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
      body: '<p>Berlin steht vor einem <strong>grundlegenden Wandel</strong> im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen.</p>',
      image: {
        url: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "Straßenbahn fährt durch Berlin-Mitte",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["politik"] } },
      author: { connect: { id: authorIds["anna-schmidt"] } },
      tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"],
      readingTimeMinutes: 5,
      isPremium: false,
      paywall: "free",
      isLive: false,
      isOpinion: false,
      isFeatured: true,
      isBreaking: false,
      aiSummary:
        "Berlin plant drei neue Tramlinien im Osten der Stadt. Die 2,3 Milliarden Euro teure Investition soll Marzahn-Hellersdorf und Lichtenberg besser anbinden.",
      region: "berlin",
    },
    {
      headline:
        "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
      slug: "startup-boom-berlin-mitte",
      teaser:
        "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
      body: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte <strong>über 200 neue Unternehmen</strong> gegründet.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen.</p>',
      image: {
        url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "Modernes Büro eines Berliner Start-ups",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["wirtschaft"] } },
      author: { connect: { id: authorIds["markus-weber"] } },
      tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"],
      readingTimeMinutes: 4,
      isPremium: true,
      paywall: "paid",
      isLive: false,
      isOpinion: false,
      isFeatured: false,
      isBreaking: false,
      aiSummary:
        "Über 200 Start-ups wurden im Q1 2026 in Berlin-Mitte gegründet (+34%). KI-Anwendungen treiben das Wachstum.",
      region: "berlin",
    },
    {
      headline:
        "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
      slug: "kulturhauptstadt-berlin-sommer",
      teaser:
        "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
      body: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein <strong>außergewöhnlich vielfältiges Programm</strong>.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins. Über 150 Werke zeitgenössischer Künstler zeigen Visionen für die Stadt von morgen.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen.</p>',
      image: {
        url: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "Berlinische Galerie Ausstellungsraum",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["kultur"] } },
      author: { connect: { id: authorIds["lisa-mueller"] } },
      tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"],
      readingTimeMinutes: 6,
      isPremium: false,
      paywall: "free",
      isLive: false,
      isOpinion: false,
      isFeatured: false,
      isBreaking: false,
      aiSummary:
        'Die wichtigsten Sommerausstellungen in Berlin: Berlinische Galerie zeigt "Zukunft Metropole", Humboldt Forum präsentiert "Seidenstraße Digital".',
      region: "berlin",
    },
    {
      headline:
        "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
      slug: "hertha-bsc-nachwuchs-talente",
      teaser:
        "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
      body: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben <strong>Profiverträge</strong> erhalten.</p><h2>Die drei Neuzugänge</h2><ul><li><strong>Emre Yilmaz</strong> (18) — zentrales Mittelfeld</li><li><strong>Jonas Hartmann</strong> (19) — Innenverteidiger</li><li><strong>Karim Benali</strong> (18) — Linksaußen</li></ul>',
      image: {
        url: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "Olympiastadion Berlin — Heimat von Hertha BSC",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["sport"] } },
      author: { connect: { id: authorIds["thomas-becker"] } },
      tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"],
      readingTimeMinutes: 3,
      isPremium: false,
      paywall: "free",
      isLive: false,
      isOpinion: false,
      isFeatured: false,
      isBreaking: false,
      aiSummary:
        "Hertha BSC gibt drei U19-Spielern Profiverträge. Die Jugendakademie zeigt damit erneut ihre Stärke.",
      region: "berlin",
    },
    {
      headline:
        "Wohnungsmarkt Berlin: Mietpreise steigen weiter — was Mieter wissen müssen",
      slug: "wohnungsmarkt-berlin-mietpreise",
      teaser:
        "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten.",
      body: "<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die <strong>durchschnittliche Kaltmiete</strong> für Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter überschritten.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m².</p>",
      image: {
        url: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "Wohnhäuser in Berlin-Kreuzberg",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["berlin"] } },
      author: { connect: { id: authorIds["markus-weber"] } },
      tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
      readingTimeMinutes: 7,
      isPremium: true,
      paywall: "paid",
      isLive: false,
      isOpinion: false,
      isFeatured: false,
      isBreaking: false,
      aiSummary:
        "Berliner Kaltmieten überschreiten erstmals 15 Euro/m². Berlin-Mitte führt mit 19,50 Euro.",
      region: "berlin",
    },
    {
      headline:
        "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
      slug: "kommentar-digitalisierung-verwaltung",
      teaser:
        "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig.",
      body: "<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Während Estland längst eine volldigitale Verwaltung betreibt, kämpfen Berliner Bürgerämter noch mit <strong>Faxgeräten und Papierformularen</strong>.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. Zweitens scheitern Großprojekte an mangelhafter Projektsteuerung. Drittens blockieren föderale Zuständigkeiten einheitliche Lösungen.</p>",
      image: {
        url: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "Warteschlange vor einem Berliner Bürgeramt",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["meinung"] } },
      author: { connect: { id: authorIds["anna-schmidt"] } },
      tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"],
      readingTimeMinutes: 5,
      isPremium: false,
      paywall: "free",
      isLive: false,
      isOpinion: true,
      isFeatured: false,
      isBreaking: false,
      aiSummary:
        "Die Digitalisierung der Berliner Verwaltung scheitert an fehlendem Willen und schlechter Projektsteuerung.",
      region: "berlin",
    },
    {
      headline:
        "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
      slug: "bvg-ubahn-netz-ausbau",
      teaser:
        "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes.",
      body: "<p>Die Berliner Verkehrsbetriebe (BVG) haben ihren <strong>Modernisierungsplan</strong> für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden.</p>",
      image: {
        url: "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "U-Bahn-Station in Berlin",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["berlin"] } },
      author: { connect: { id: authorIds["anna-schmidt"] } },
      tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
      readingTimeMinutes: 4,
      isPremium: false,
      paywall: "free",
      isLive: false,
      isOpinion: false,
      isFeatured: false,
      isBreaking: false,
      aiSummary:
        "BVG investiert 4,1 Milliarden Euro in U-Bahn-Modernisierung. U5 wird nach Westen verlängert.",
      region: "berlin",
    },
    {
      headline:
        "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
      slug: "klimaschutz-berlin-klimaneutral",
      teaser:
        "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
      body: "<p>Der Berliner Senat hat ein <strong>umfassendes Klimaschutzpaket</strong> beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb</li></ul>",
      image: {
        url: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
        altText: "Solaranlage auf einem Berliner Dach",
        width: 1200,
        height: 675,
      },
      category: { connect: { id: categoryIds["politik"] } },
      author: { connect: { id: authorIds["anna-schmidt"] } },
      tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
      readingTimeMinutes: 6,
      isPremium: false,
      paywall: "free",
      isLive: false,
      isOpinion: false,
      isFeatured: false,
      isBreaking: true,
      aiSummary:
        "Berlin will bis 2045 klimaneutral werden. Das Maßnahmenpaket umfasst Solar-Ausbau, Radwege-Verdopplung und E-Bus-Umstellung.",
      region: "berlin",
    },
  ];

  for (const art of articles) {
    const id = await createAndPublish("Article", art);
    console.log(`    "${art.headline.slice(0, 50)}..." → ${id}`);
    await sleep(500);
  }
}

async function seedNewsticker() {
  console.log("\n  --- Seeding Newsticker ---");
  await deleteExisting("newstickers");

  const items = [
    {
      type: "TimelineTeaser",
      topic: "Politik",
      headline: "Bundestag beschließt neues Digitalgesetz",
      slug: "bundestag-digitalgesetz",
      isPremium: false,
    },
    {
      type: "TimelineTeaser",
      topic: "Berlin",
      headline: "S-Bahn-Störung auf der Ringbahn behoben",
      slug: "sbahn-ringbahn-stoerung",
      isPremium: false,
    },
    {
      type: "TimelineTeaser",
      topic: "Wirtschaft",
      headline: "DAX schließt mit Rekordhoch bei 24.987 Punkten",
      slug: "dax-rekordhoch",
      isPremium: true,
    },
    {
      type: "TimelineTeaser",
      topic: "Sport",
      headline: "Union Berlin verpflichtet schwedischen Stürmer",
      slug: "union-berlin-transfer",
      isPremium: false,
    },
    {
      type: "TimelineTeaser",
      topic: "Kultur",
      headline: "Berlinale kündigt Jury-Präsidentin für 2027 an",
      slug: "berlinale-jury",
      isPremium: false,
    },
    {
      type: "TimelineTeaser",
      topic: "Berlin",
      headline: "Neue Fahrradstraße in Friedrichshain eröffnet",
      slug: "fahrradstrasse-friedrichshain",
      isPremium: false,
    },
  ];

  for (const nt of items) {
    const id = await createAndPublish("Newsticker", nt);
    console.log(`    "${nt.headline.slice(0, 50)}" → ${id}`);
    await sleep(300);
  }
}

async function seedVideos() {
  console.log("\n  --- Seeding Videos ---");
  await deleteExisting("videos");

  const videos = [
    {
      title: "Berlins neue Tramlinien: So sieht der Plan aus",
      videoUrl: "/videos/tram-plan.mp4",
      poster:
        "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1280&h=720&q=80",
      durationSeconds: 384,
      caption:
        "Verkehrssenatorin Maria Hoffmann stellt den neuen Nahverkehrsplan vor.",
      category: "/politik/",
    },
    {
      title: "Start-up-Szene Berlin: Ein Tag im Co-Working-Space",
      videoUrl: "/videos/startup-coworking.mp4",
      poster:
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1280&h=720&q=80",
      durationSeconds: 542,
      caption:
        "Einblick in den Alltag junger Gründerinnen und Gründer in Berlin-Mitte.",
      category: "/wirtschaft/",
    },
    {
      title: "Sommer in Berlin: Die schönsten Badestellen",
      videoUrl: "/videos/badestellen.mp4",
      poster:
        "https://images.unsplash.com/photo-1758912299313-36430bb41c44?auto=format&fit=crop&w=1280&h=720&q=80",
      durationSeconds: 267,
      caption: "Die besten Seen und Freibäder für den Berliner Sommer.",
      category: "/berlin/",
    },
  ];

  for (const v of videos) {
    const id = await createAndPublish("Video", v);
    console.log(`    "${v.title}" → ${id}`);
    await sleep(300);
  }
}

async function seedSingletons() {
  console.log("\n  --- Seeding Singletons ---");

  // Navigation
  await deleteExisting("navigations");
  const navId = await createAndPublish("Navigation", {
    slug: "singleton",
    primaryMenuJson: [
      { reference: { type: "SECTION", href: "/", label: "Start", isActive: true }, commercial: false },
      { reference: { type: "SECTION", href: "/kategorie/politik", label: "Politik" }, commercial: false },
      { reference: { type: "SECTION", href: "/kategorie/wirtschaft", label: "Wirtschaft" }, commercial: false },
      { reference: { type: "SECTION", href: "/kategorie/berlin", label: "Berlin" }, commercial: false },
      { reference: { type: "SECTION", href: "/kategorie/kultur", label: "Kultur" }, commercial: false },
      { reference: { type: "SECTION", href: "/kategorie/sport", label: "Sport" }, commercial: false },
      { reference: { type: "SECTION", href: "/kategorie/meinung", label: "Meinung" }, commercial: false },
    ],
    footerMenuJson: [
      { reference: { type: "SECTION", href: "/impressum", label: "Impressum" }, commercial: false },
      { reference: { type: "SECTION", href: "/datenschutz", label: "Datenschutz" }, commercial: false },
      { reference: { type: "SECTION", href: "/kontakt", label: "Kontakt" }, commercial: false },
      { reference: { type: "SECTION", href: "/mediadaten", label: "Mediadaten" }, commercial: true },
    ],
    socialLinksJson: [
      { platform: "twitter", url: "https://twitter.com/berliner_rundschau", label: "Berliner Rundschau auf X" },
      { platform: "facebook", url: "https://facebook.com/berlinerrundschau", label: "Berliner Rundschau auf Facebook" },
      { platform: "instagram", url: "https://instagram.com/berlinerrundschau", label: "Berliner Rundschau auf Instagram" },
    ],
  });
  console.log(`    Navigation → ${navId}`);
  await sleep(300);

  // SiteConfig
  await deleteExisting("siteConfigs");
  const scId = await createAndPublish("SiteConfig", {
    slug: "singleton",
    title: "Berliner Rundschau",
    description:
      "Nachrichten aus Berlin und der Welt — Politik, Wirtschaft, Kultur, Sport und Meinung.",
    url: "https://berliner-rundschau.de",
    language: "de-DE",
    tags: ["Berlin", "Nachrichten", "Politik", "Wirtschaft", "Kultur"],
    socialLinksJson: [
      { platform: "twitter", url: "https://twitter.com/berliner_rundschau" },
      { platform: "facebook", url: "https://facebook.com/berlinerrundschau" },
    ],
    analyticsGtmId: "GTM-XXXXXX",
  });
  console.log(`    SiteConfig → ${scId}`);
  await sleep(300);

  // BreakingNews
  await deleteExisting("breakingNewses");
  for (const bn of [
    {
      headline: "Eilmeldung: Berliner Senat beschließt Klimaschutzpaket",
      href: "/artikel/klimaschutz-berlin-klimaneutral",
      severity: "breaking",
      expiresAt: "2026-06-28T20:00:00Z",
    },
    {
      headline: "BVG: Signalstörung auf der U2 — Verspätungen erwartet",
      href: "/artikel/bvg-ubahn-netz-ausbau",
      severity: "alert",
    },
  ]) {
    const id = await createAndPublish("BreakingNews", bn);
    console.log(`    BreakingNews "${bn.headline.slice(0, 40)}..." → ${id}`);
    await sleep(300);
  }

  // Quiz
  await deleteExisting("quizzes");
  const qId = await createAndPublish("Quiz", {
    slug: "singleton",
    date: "2026-06-28",
    title: "Wie gut kennen Sie Berlin?",
    questionsJson: [
      {
        id: 1,
        question: "Wie viele Bezirke hat Berlin?",
        options: ["10", "12", "14", "16"],
        correctIndex: 1,
        explanation:
          "Berlin hat 12 Bezirke, die seit der Bezirksreform 2001 bestehen.",
      },
      {
        id: 2,
        question: "Wann fiel die Berliner Mauer?",
        options: [
          "3. Oktober 1989",
          "9. November 1989",
          "1. Januar 1990",
          "3. Oktober 1990",
        ],
        correctIndex: 1,
        explanation:
          "Die Berliner Mauer fiel am 9. November 1989.",
      },
      {
        id: 3,
        question: "Wie heißt Berlins größter See?",
        options: ["Wannsee", "Müggelsee", "Tegeler See", "Schlachtensee"],
        correctIndex: 1,
        explanation:
          "Der Müggelsee in Treptow-Köpenick ist mit 7,4 km² der größte See Berlins.",
      },
    ],
    streakRewardsJson: [
      { days: 3, badge: "Berlin-Kenner", emoji: "🏅" },
      { days: 7, badge: "Hauptstadt-Experte", emoji: "🎓" },
      { days: 14, badge: "Berlin-Meister", emoji: "🏆" },
    ],
  });
  console.log(`    Quiz → ${qId}`);
  await sleep(300);

  // StockData
  await deleteExisting("stockDatas");
  const sdId = await createAndPublish("StockData", {
    slug: "singleton",
    indicesJson: [
      { id: "dax", name: "DAX", value: 24987.45, change: 148.72, changePercent: 0.60, currency: "EUR", sparkline: [21200, 21280, 21350, 21400, 24987] },
      { id: "mdax", name: "MDAX", value: 30743.1, change: -45.2, changePercent: -0.16, currency: "EUR", sparkline: [29000, 28980, 28950, 28940, 30743] },
      { id: "dow", name: "Dow Jones", value: 52387.42, change: 234.56, changePercent: 0.55, currency: "USD", sparkline: [42300, 42400, 42450, 42500, 42568] },
      { id: "eurusd", name: "EUR/USD", value: 1.1392, change: 0.0023, changePercent: 0.21, currency: "", sparkline: [1.086, 1.087, 1.088, 1.089, 1.089] },
    ],
    watchlistJson: [
      { id: "sap", symbol: "SAP.DE", name: "SAP SE", price: 142.85, change: 2.15, changePercent: 1.53, marketCap: "165.8B", pe: 32.4, sector: "Technologie" },
      { id: "sie", symbol: "SIE.DE", name: "Siemens AG", price: 268.45, change: 3.8, changePercent: 1.44, marketCap: "214.5B", pe: 20.8, sector: "Industrie" },
      { id: "bayn", symbol: "BAYN.DE", name: "Bayer AG", price: 48.92, change: -0.73, changePercent: -1.47, marketCap: "48.2B", pe: null, sector: "Pharma" },
    ],
    chartDataJson: {},
  });
  console.log(`    StockData → ${sdId}`);
}

/* ============================================================
   MAIN
   ============================================================ */

async function main() {
  console.log("Berliner Rundschau — Hygraph Seed Script\n");
  console.log(`Content API: ${CONTENT_API}`);
  console.log(`Management API: ${MGMT_API}\n`);

  console.log("[1/4] Getting environment ID...");
  const envId = await getEnvironmentId();
  console.log(`  Environment ID: ${envId}\n`);

  console.log("[2/4] Creating models...");
  const modelIds = await createModels(envId);
  console.log(`  ${Object.keys(modelIds).length} models ready\n`);

  console.log("[3/4] Creating fields...");
  await createAllFields(envId, modelIds);
  console.log("\n  All fields ready\n");

  // Wait for schema to propagate to Content API
  console.log("  Waiting for schema propagation (5s)...");
  await sleep(5000);

  console.log("[4/4] Seeding content...");
  const categoryIds = await seedCategories();
  const authorIds = await seedAuthors();
  await seedArticles(categoryIds, authorIds);
  await seedNewsticker();
  await seedVideos();
  await seedSingletons();

  console.log("\n✅ Seed complete! Update .env.local:");
  console.log(`  CMS_ADAPTER=hygraph`);
  console.log(`  HYGRAPH_ENDPOINT=${CONTENT_API}`);
  console.log(`  HYGRAPH_ACCESS_TOKEN=<your-token>`);
  console.log(`  HYGRAPH_STAGE=PUBLISHED`);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
