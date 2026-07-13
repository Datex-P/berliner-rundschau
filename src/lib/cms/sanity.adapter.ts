import { createClient } from "@sanity/client";
import { toHTML } from "@portabletext/to-html";
import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";

/* ---------- client setup ---------- */

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET ?? "production",
  token: process.env.SANITY_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: !process.env.SANITY_TOKEN,
});

const fieldMap = parseFieldMap(process.env.SANITY_FIELD_MAP);
const articleType = process.env.SANITY_ARTICLE_TYPE ?? "article";

/* ---------- GROQ fragments ---------- */

const ARTICLE_PROJECTION = `{
  _id,
  headline,
  slug,
  teaser,
  body,
  _createdAt,
  _updatedAt,
  image { asset-> { url, metadata { dimensions } }, alt },
  category-> { _id, name, slug },
  author-> { _id, name, slug, avatar { asset-> { url } } },
  tags,
  readingTimeMinutes,
  isPremium,
  paywall,
  isLive,
  isOpinion,
  isFeatured,
  isBreaking,
  aiSummary,
  region
}`;

/* ---------- helpers ---------- */

function resolveSlug(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return String((value as Record<string, unknown>).current ?? "");
  }
  return "";
}

/** Safely run a GROQ query; return fallback on error. */
async function safeQuery<T>(
  groq: string,
  params: Record<string, unknown>,
  fallback: T,
): Promise<T> {
  try {
    return await client.fetch<T>(groq, params);
  } catch {
    return fallback;
  }
}

/* ---------- record mapper ---------- */

function mapRecord(record: Record<string, unknown>): unknown {
  const fm = fieldMap;

  const rawBody = record[mapField(fm, "body")];
  const bodyHtml = rawBody
    ? sanitizeRichText(toHTML(rawBody as Parameters<typeof toHTML>[0]))
    : "";

  const img = record[mapField(fm, "image")] as Record<string, unknown> | null;
  const asset = img?.asset as Record<string, unknown> | null;
  const dims = (asset?.metadata as Record<string, unknown>)
    ?.dimensions as Record<string, unknown> | null;

  const cat = record[mapField(fm, "category")] as Record<
    string,
    unknown
  > | null;
  const auth = record[mapField(fm, "author")] as Record<string, unknown> | null;
  const authAvatar = auth
    ? (auth.avatar as Record<string, unknown> | null)
    : null;
  const authAvatarAsset = authAvatar
    ? (authAvatar.asset as Record<string, unknown> | null)
    : null;

  return {
    id: String(record._id ?? ""),
    headline: String(record[mapField(fm, "headline")] ?? ""),
    slug: resolveSlug(record[mapField(fm, "slug")]),
    teaser: String(record[mapField(fm, "teaser")] ?? ""),
    body: bodyHtml,
    publicationDate: String(record._createdAt ?? ""),
    updatedAt: String(record._updatedAt ?? ""),
    image: normalizeImage(
      asset ? String(asset.url ?? "") : null,
      img ? String(img.alt ?? "") : undefined,
      dims ? Number(dims.width ?? 0) : undefined,
      dims ? Number(dims.height ?? 0) : undefined,
    ),
    category: cat
      ? {
          id: String(cat._id ?? ""),
          name: String(cat.name ?? ""),
          slug: resolveSlug(cat.slug),
        }
      : { id: "", name: "", slug: "" },
    author: auth
      ? {
          id: String(auth._id ?? ""),
          name: String(auth.name ?? ""),
          slug: resolveSlug(auth.slug),
          avatar: authAvatarAsset ? String(authAvatarAsset.url ?? "") : "",
        }
      : { id: "", name: "", slug: "", avatar: "" },
    tags: Array.isArray(record[mapField(fm, "tags")])
      ? record[mapField(fm, "tags")]
      : [],
    readingTimeMinutes: Number(record[mapField(fm, "readingTimeMinutes")] ?? 0),
    commentCount: 0,
    isPremium: record[mapField(fm, "isPremium")] === true,
    paywall: String(record[mapField(fm, "paywall")] ?? "free"),
    isLive: record[mapField(fm, "isLive")] === true,
    isOpinion: record[mapField(fm, "isOpinion")] === true,
    isFeatured: record[mapField(fm, "isFeatured")] === true,
    isBreaking: record[mapField(fm, "isBreaking")] === true,
    aiSummary: String(record[mapField(fm, "aiSummary")] ?? ""),
    region: String(record[mapField(fm, "region")] ?? ""),
    comments: [],
  };
}

function mapCategory(record: Record<string, unknown>): unknown {
  return {
    id: String(record._id ?? ""),
    name: String(record.name ?? ""),
    slug: resolveSlug(record.slug),
    description: String(record.description ?? ""),
    color: String(record.color ?? ""),
  };
}

function mapAuthor(record: Record<string, unknown>): unknown {
  const avatar = record.avatar as Record<string, unknown> | null;
  const avatarAsset = avatar
    ? (avatar.asset as Record<string, unknown> | null)
    : null;

  return {
    id: String(record._id ?? ""),
    name: String(record.name ?? ""),
    slug: resolveSlug(record.slug),
    bio: String(record.bio ?? ""),
    avatar: avatarAsset ? String(avatarAsset.url ?? "") : "",
    role: String(record.role ?? ""),
  };
}

/* ---------- adapter ---------- */

const sanityAdapter = {
  name: "sanity",

  async fetchAllArticles() {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == $type] | order(_createdAt desc) ${ARTICLE_PROJECTION}`,
      { type: articleType },
      [],
    );
    return results.map(mapRecord) as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    const result = await safeQuery<Record<string, unknown> | null>(
      `*[_type == $type && slug.current == $slug][0] ${ARTICLE_PROJECTION}`,
      { type: articleType, slug },
      null,
    );
    return (result ? mapRecord(result) : null) as unknown as Article | null;
  },

  async fetchArticlesByCategory(categorySlug: string) {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == $type && category->slug.current == $slug] | order(_createdAt desc) ${ARTICLE_PROJECTION}`,
      { type: articleType, slug: categorySlug },
      [],
    );
    return results.map(mapRecord) as unknown as Article[];
  },

  async searchArticlesByQuery(query: string) {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == $type && [headline, teaser] match $query] | order(_createdAt desc) ${ARTICLE_PROJECTION}`,
      { type: articleType, query: `${query}*` },
      [],
    );
    return results.map(mapRecord) as unknown as Article[];
  },

  async fetchArticleSlugs() {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == $type] { "slug": slug.current, "updatedAt": _updatedAt }`,
      { type: articleType },
      [],
    );
    return results.map((r) => ({
      slug: String(r.slug ?? ""),
      updatedAt: String(r.updatedAt ?? ""),
    })) as unknown as Array<{ slug: string; modified?: string }>;
  },

  async fetchAllCategories() {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == "category"] | order(name asc) { _id, name, slug, description, color }`,
      {},
      [],
    );
    return results.map(mapCategory) as unknown as Category[];
  },

  async fetchCategoryBySlug(slug: string) {
    const result = await safeQuery<Record<string, unknown> | null>(
      `*[_type == "category" && slug.current == $slug][0] { _id, name, slug, description, color }`,
      { slug },
      null,
    );
    return (result ? mapCategory(result) : null) as unknown as Category | null;
  },

  async fetchAllAuthors() {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == "author"] | order(name asc) { _id, name, slug, bio, role, avatar { asset-> { url } } }`,
      {},
      [],
    );
    return results.map(mapAuthor) as unknown as Author[];
  },

  async fetchAuthorBySlug(slug: string) {
    const result = await safeQuery<Record<string, unknown> | null>(
      `*[_type == "author" && slug.current == $slug][0] { _id, name, slug, bio, role, avatar { asset-> { url } } }`,
      { slug },
      null,
    );
    return (result ? mapAuthor(result) : null) as unknown as Author | null;
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == $type && author->slug.current == $slug] | order(_createdAt desc) ${ARTICLE_PROJECTION}`,
      { type: articleType, slug: authorSlug },
      [],
    );
    return results.map(mapRecord) as unknown as Article[];
  },

  async fetchNewsticker() {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == "newsticker"] | order(_createdAt desc) [0...20] { _id, headline, href, topic, isPremium, _createdAt }`,
      {},
      [],
    );
    return results.map((r) => ({
      id: String(r._id ?? ""),
      type: "TimelineTeaser",
      topic: String(r.topic ?? ""),
      headline: {
        label: String(r.headline ?? ""),
        href: String(r.href ?? ""),
      },
      publicationDate: String(r._createdAt ?? ""),
      isPremium: r.isPremium === true,
    })) as unknown as NewstickerItem[];
  },

  async fetchVideos() {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == "video"] | order(_createdAt desc) { _id, title, url, thumbnail, duration, _createdAt }`,
      {},
      [],
    );
    return results.map((r) => ({
      id: String(r._id ?? ""),
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      thumbnail: String(r.thumbnail ?? ""),
      duration: Number(r.duration ?? 0),
      publishedAt: String(r._createdAt ?? ""),
    })) as unknown as Video[];
  },

  async fetchNavigation() {
    const result = await safeQuery<Record<string, unknown> | null>(
      `*[_type == "navigation"][0]`,
      {},
      null,
    );
    if (!result) return { items: [] } as unknown as Navigation;
    return {
      items: Array.isArray(result.items) ? result.items : [],
    } as unknown as Navigation;
  },

  async fetchSiteConfig() {
    const result = await safeQuery<Record<string, unknown> | null>(
      `*[_type == "siteConfig"][0]`,
      {},
      null,
    );
    return (result ?? {}) as unknown as SiteConfig;
  },

  async fetchBreakingNews() {
    const results = await safeQuery<Record<string, unknown>[]>(
      `*[_type == "breakingNews"] | order(_createdAt desc) [0...5] { _id, headline, text, url, severity, _createdAt }`,
      {},
      [],
    );
    return results.map((r) => ({
      id: String(r._id ?? ""),
      headline: String(r.headline ?? ""),
      text: String(r.text ?? ""),
      url: String(r.url ?? ""),
      severity: String(r.severity ?? "normal"),
      timestamp: String(r._createdAt ?? ""),
    })) as unknown as BreakingNews[];
  },

  async fetchQuiz() {
    const result = await safeQuery<Record<string, unknown> | null>(
      `*[_type == "quiz"][0] { _id, json }`,
      {},
      null,
    );
    if (!result) return null;
    const jsonStr = String(result.json ?? "{}");
    try {
      return JSON.parse(jsonStr) as unknown as Quiz;
    } catch {
      return null;
    }
  },

  async fetchStockData() {
    const result = await safeQuery<Record<string, unknown> | null>(
      `*[_type == "stockData"][0] { _id, json }`,
      {},
      null,
    );
    if (!result) return null;
    const jsonStr = String(result.json ?? "{}");
    try {
      return JSON.parse(jsonStr) as unknown as StockData;
    } catch {
      return null;
    }
  },
};

export default sanityAdapter as unknown as CmsAdapter;
