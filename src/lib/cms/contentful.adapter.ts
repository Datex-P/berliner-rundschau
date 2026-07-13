import { createClient } from "contentful";
import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";

/* ---------- client setup ---------- */

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
  environment: process.env.CONTENTFUL_ENVIRONMENT ?? "master",
});

const fieldMap = parseFieldMap(process.env.CONTENTFUL_FIELD_MAP);
const articleType = process.env.CONTENTFUL_ARTICLE_TYPE ?? "article";

/* ---------- helpers ---------- */

/** Paginate through all entries of a content type. */
async function fetchAll(
  contentType: string,
  query?: Record<string, unknown>,
) {
  const items: unknown[] = [];
  let skip = 0;
  const limit = 100;
  let total = Infinity;

  while (skip < total) {
    const res = await client.getEntries({
      content_type: contentType,
      limit,
      skip,
      ...query,
    });
    items.push(...res.items);
    total = res.total;
    skip += limit;
  }

  return items;
}

/** Safely fetch entries; returns [] when the content type does not exist. */
async function safeFetchAll(
  contentType: string,
  query?: Record<string, unknown>,
) {
  try {
    return await fetchAll(contentType, query);
  } catch {
    return [];
  }
}

/** Safely fetch a single entry list and return the first item or null. */
async function safeFetchFirst(
  contentType: string,
  query?: Record<string, unknown>,
) {
  const items = await safeFetchAll(contentType, { ...query, limit: 1 });
  return items[0] ?? null;
}

/* ---------- field access helpers ---------- */

function fields(entry: unknown): Record<string, unknown> {
  return (entry as { fields: Record<string, unknown> })?.fields ?? {};
}

function sys(entry: unknown): Record<string, unknown> {
  return (entry as { sys: Record<string, unknown> })?.sys ?? {};
}

function mf(fm: Record<string, string>, name: string): string {
  return mapField(fm, name);
}

/* ---------- entry mappers ---------- */

function mapEntry(entry: unknown): unknown {
  const f = fields(entry);
  const s = sys(entry);
  const fm = fieldMap;

  const imgRef = f[mf(fm, "image")] as Record<string, unknown> | undefined;
  const catRef = f[mf(fm, "category")] as Record<string, unknown> | undefined;
  const authRef = f[mf(fm, "author")] as Record<string, unknown> | undefined;

  const imgFields = imgRef ? fields(imgRef) : undefined;
  const catFields = catRef ? fields(catRef) : undefined;
  const authFields = authRef ? fields(authRef) : undefined;

  const rawBody = f[mf(fm, "body")];
  const bodyHtml = rawBody
    ? sanitizeRichText(
        documentToHtmlString(
          rawBody as Parameters<typeof documentToHtmlString>[0],
        ),
      )
    : "";

  const fileObj = imgFields?.file as Record<string, unknown> | undefined;
  const fileUrl = fileObj?.url != null ? String(fileObj.url) : undefined;

  const avatarRef = authFields?.avatar as Record<string, unknown> | undefined;
  const avatarFields = avatarRef ? fields(avatarRef) : undefined;
  const avatarFile = avatarFields?.file as Record<string, unknown> | undefined;
  const avatarUrl = avatarFile?.url != null ? String(avatarFile.url) : undefined;

  return {
    id: String(s.id ?? ""),
    headline: String(f[mf(fm, "headline")] ?? ""),
    slug: String(f[mf(fm, "slug")] ?? ""),
    teaser: String(f[mf(fm, "teaser")] ?? ""),
    body: bodyHtml,
    publicationDate: String(s.createdAt ?? ""),
    updatedAt: String(s.updatedAt ?? ""),
    image: imgFields
      ? normalizeImage(
          fileUrl ? `https:${fileUrl}` : null,
          imgFields.title != null ? String(imgFields.title) : undefined,
        )
      : normalizeImage(null),
    category: catFields
      ? {
          id: String(sys(catRef!).id ?? ""),
          name: String(catFields.name ?? ""),
          slug: String(catFields.slug ?? ""),
        }
      : { id: "", name: "", slug: "" },
    author: authFields
      ? {
          id: String(sys(authRef!).id ?? ""),
          name: String(authFields.name ?? ""),
          slug: String(authFields.slug ?? ""),
          avatar: avatarUrl ? `https:${avatarUrl}` : null,
        }
      : { id: "", name: "", slug: "", avatar: null },
    tags: Array.isArray(f[mf(fm, "tags")]) ? f[mf(fm, "tags")] : [],
    readingTimeMinutes: Number(f[mf(fm, "readingTimeMinutes")] ?? 0),
    commentCount: 0,
    isPremium: f[mf(fm, "isPremium")] === true,
    paywall: String(f[mf(fm, "paywall")] ?? "free"),
    isLive: f[mf(fm, "isLive")] === true,
    isOpinion: f[mf(fm, "isOpinion")] === true,
    isFeatured: f[mf(fm, "isFeatured")] === true,
    isBreaking: f[mf(fm, "isBreaking")] === true,
    aiSummary: String(f[mf(fm, "aiSummary")] ?? ""),
    region: String(f[mf(fm, "region")] ?? ""),
    comments: [],
  };
}

function mapCategory(entry: unknown): unknown {
  const f = fields(entry);
  const s = sys(entry);
  return {
    id: String(s.id ?? ""),
    name: String(f.name ?? ""),
    slug: String(f.slug ?? ""),
    description: String(f.description ?? ""),
    color: String(f.color ?? ""),
  };
}

function mapAuthor(entry: unknown): unknown {
  const f = fields(entry);
  const s = sys(entry);
  const avatarRef = f.avatar as Record<string, unknown> | undefined;
  const avatarFields = avatarRef ? fields(avatarRef) : undefined;
  const avatarFile = avatarFields?.file as Record<string, unknown> | undefined;
  const avatarUrl = avatarFile?.url != null ? String(avatarFile.url) : undefined;

  return {
    id: String(s.id ?? ""),
    name: String(f.name ?? ""),
    slug: String(f.slug ?? ""),
    bio: String(f.bio ?? ""),
    avatar: avatarUrl ? `https:${avatarUrl}` : "",
    role: String(f.role ?? ""),
  };
}

/* ---------- adapter ---------- */

const contentfulAdapter = {
  name: "contentful",

  async fetchAllArticles() {
    const items = await fetchAll(articleType);
    return items.map(mapEntry) as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    const items = await fetchAll(articleType, {
      [`fields.${mf(fieldMap, "slug")}`]: slug,
      limit: 1,
    });
    return (items.length > 0 ? mapEntry(items[0]) : null) as unknown as Article | null;
  },

  async fetchArticlesByCategory(categorySlug: string) {
    /* Resolve category entry first, then filter articles by linked ref */
    const cats = await safeFetchAll("category", {
      "fields.slug": categorySlug,
      limit: 1,
    });
    if (cats.length === 0) return [];
    const catId = String(sys(cats[0]).id ?? "");
    if (!catId) return [];

    const items = await fetchAll(articleType, {
      [`fields.${mf(fieldMap, "category")}.sys.id`]: catId,
    });
    return items.map(mapEntry) as unknown as Article[];
  },

  async searchArticlesByQuery(query: string) {
    const items = await fetchAll(articleType, { query });
    return items.map(mapEntry) as unknown as Article[];
  },

  async fetchArticleSlugs() {
    const items = await fetchAll(articleType, {
      select: ["fields." + mf(fieldMap, "slug"), "sys.updatedAt"],
    });
    return items.map((entry) => ({
      slug: String(fields(entry)[mf(fieldMap, "slug")] ?? ""),
      updatedAt: String(sys(entry).updatedAt ?? ""),
    })) as unknown as Array<{ slug: string; modified?: string }>;
  },

  async fetchAllCategories() {
    const items = await safeFetchAll("category");
    return items.map(mapCategory) as unknown as Category[];
  },

  async fetchCategoryBySlug(slug: string) {
    const items = await safeFetchAll("category", {
      "fields.slug": slug,
      limit: 1,
    });
    return (items.length > 0 ? mapCategory(items[0]) : null) as unknown as Category | null;
  },

  async fetchAllAuthors() {
    const items = await safeFetchAll("author");
    return items.map(mapAuthor) as unknown as Author[];
  },

  async fetchAuthorBySlug(slug: string) {
    const items = await safeFetchAll("author", {
      "fields.slug": slug,
      limit: 1,
    });
    return (items.length > 0 ? mapAuthor(items[0]) : null) as unknown as Author | null;
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const authors = await safeFetchAll("author", {
      "fields.slug": authorSlug,
      limit: 1,
    });
    if (authors.length === 0) return [];
    const authorId = String(sys(authors[0]).id ?? "");
    if (!authorId) return [];

    const items = await fetchAll(articleType, {
      [`fields.${mf(fieldMap, "author")}.sys.id`]: authorId,
    });
    return items.map(mapEntry) as unknown as Article[];
  },

  async fetchNewsticker() {
    const items = await safeFetchAll("newsticker", {
      order: ["-sys.createdAt"],
      limit: 20,
    });
    return items.map((entry) => {
      const f = fields(entry);
      const s = sys(entry);
      return {
        id: String(s.id ?? ""),
        headline: String(f.headline ?? ""),
        text: String(f.text ?? ""),
        timestamp: String(s.createdAt ?? ""),
        url: String(f.url ?? ""),
      };
    }) as unknown as NewstickerItem[];
  },

  async fetchVideos() {
    const items = await safeFetchAll("video", {
      order: ["-sys.createdAt"],
    });
    return items.map((entry) => {
      const f = fields(entry);
      const s = sys(entry);
      return {
        id: String(s.id ?? ""),
        title: String(f.title ?? ""),
        url: String(f.url ?? ""),
        thumbnail: String(f.thumbnail ?? ""),
        duration: Number(f.duration ?? 0),
        publishedAt: String(s.createdAt ?? ""),
      };
    }) as unknown as Video[];
  },

  async fetchNavigation() {
    const entry = await safeFetchFirst("navigation");
    if (!entry) return { items: [] };
    const f = fields(entry);
    return {
      items: Array.isArray(f.items) ? f.items : [],
    } as unknown as Navigation;
  },

  async fetchSiteConfig() {
    const entry = await safeFetchFirst("siteConfig");
    if (!entry) return {};
    return fields(entry) as unknown as SiteConfig;
  },

  async fetchBreakingNews() {
    const items = await safeFetchAll("breakingNews", {
      order: ["-sys.createdAt"],
      limit: 5,
    });
    return items.map((entry) => {
      const f = fields(entry);
      const s = sys(entry);
      return {
        id: String(s.id ?? ""),
        headline: String(f.headline ?? ""),
        text: String(f.text ?? ""),
        url: String(f.url ?? ""),
        severity: String(f.severity ?? "normal"),
        timestamp: String(s.createdAt ?? ""),
      };
    }) as unknown as BreakingNews[];
  },

  async fetchQuiz() {
    const entry = await safeFetchFirst("quiz");
    if (!entry) return null;
    const f = fields(entry);
    const s = sys(entry);
    return {
      id: String(s.id ?? ""),
      title: String(f.title ?? ""),
      questions: Array.isArray(f.questions) ? f.questions : [],
    } as unknown as Quiz;
  },

  async fetchStockData() {
    const entry = await safeFetchFirst("stockData");
    if (!entry) return null;
    const f = fields(entry);
    return {
      stocks: Array.isArray(f.stocks) ? f.stocks : [],
      updatedAt: String(sys(entry).updatedAt ?? ""),
    } as unknown as StockData;
  },
};

export default contentfulAdapter as unknown as CmsAdapter;
