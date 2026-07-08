import { createClient } from "contentful";
import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";

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
): Promise<unknown[]> {
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
): Promise<unknown[]> {
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
): Promise<unknown | null> {
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
  const fileUrl = fileObj?.url as string | undefined;

  const avatarRef = authFields?.avatar as Record<string, unknown> | undefined;
  const avatarFields = avatarRef ? fields(avatarRef) : undefined;
  const avatarFile = avatarFields?.file as Record<string, unknown> | undefined;
  const avatarUrl = avatarFile?.url as string | undefined;

  return {
    id: s.id ?? "",
    headline: f[mf(fm, "headline")] ?? "",
    slug: f[mf(fm, "slug")] ?? "",
    teaser: f[mf(fm, "teaser")] ?? "",
    body: bodyHtml,
    publicationDate: s.createdAt ?? "",
    updatedAt: s.updatedAt ?? "",
    image: imgFields
      ? normalizeImage(
          fileUrl ? `https:${fileUrl}` : null,
          imgFields.title as string | undefined,
        )
      : normalizeImage(null),
    category: catFields
      ? {
          id: (sys(catRef!).id as string) ?? "",
          name: (catFields.name as string) ?? "",
          slug: (catFields.slug as string) ?? "",
        }
      : { id: "", name: "", slug: "" },
    author: authFields
      ? {
          id: (sys(authRef!).id as string) ?? "",
          name: (authFields.name as string) ?? "",
          slug: (authFields.slug as string) ?? "",
          avatar: avatarUrl ? `https:${avatarUrl}` : null,
        }
      : { id: "", name: "", slug: "", avatar: null },
    tags: Array.isArray(f[mf(fm, "tags")]) ? f[mf(fm, "tags")] : [],
    readingTimeMinutes: Number(f[mf(fm, "readingTimeMinutes")] ?? 0),
    commentCount: 0,
    isPremium: f[mf(fm, "isPremium")] === true,
    paywall: (f[mf(fm, "paywall")] as string) ?? "free",
    isLive: f[mf(fm, "isLive")] === true,
    isOpinion: f[mf(fm, "isOpinion")] === true,
    isFeatured: f[mf(fm, "isFeatured")] === true,
    isBreaking: f[mf(fm, "isBreaking")] === true,
    aiSummary: (f[mf(fm, "aiSummary")] as string) ?? "",
    region: (f[mf(fm, "region")] as string) ?? "",
    comments: [],
  };
}

function mapCategory(entry: unknown): unknown {
  const f = fields(entry);
  const s = sys(entry);
  return {
    id: s.id ?? "",
    name: (f.name as string) ?? "",
    slug: (f.slug as string) ?? "",
    description: (f.description as string) ?? "",
    color: (f.color as string) ?? "",
  };
}

function mapAuthor(entry: unknown): unknown {
  const f = fields(entry);
  const s = sys(entry);
  const avatarRef = f.avatar as Record<string, unknown> | undefined;
  const avatarFields = avatarRef ? fields(avatarRef) : undefined;
  const avatarFile = avatarFields?.file as Record<string, unknown> | undefined;
  const avatarUrl = avatarFile?.url as string | undefined;

  return {
    id: s.id ?? "",
    name: (f.name as string) ?? "",
    slug: (f.slug as string) ?? "",
    bio: (f.bio as string) ?? "",
    avatar: avatarUrl ? `https:${avatarUrl}` : "",
    role: (f.role as string) ?? "",
  };
}

/* ---------- adapter ---------- */

const contentfulAdapter: CmsAdapter = {
  name: "contentful",

  async fetchAllArticles(): Promise<unknown[]> {
    const items = await fetchAll(articleType);
    return items.map(mapEntry);
  },

  async fetchArticleBySlug(slug: string): Promise<unknown | null> {
    const items = await fetchAll(articleType, {
      [`fields.${mf(fieldMap, "slug")}`]: slug,
      limit: 1,
    });
    return items.length > 0 ? mapEntry(items[0]) : null;
  },

  async fetchArticlesByCategory(categorySlug: string): Promise<unknown[]> {
    /* Resolve category entry first, then filter articles by linked ref */
    const cats = await safeFetchAll("category", {
      "fields.slug": categorySlug,
      limit: 1,
    });
    if (cats.length === 0) return [];
    const catId = (sys(cats[0]).id as string) ?? "";
    if (!catId) return [];

    const items = await fetchAll(articleType, {
      [`fields.${mf(fieldMap, "category")}.sys.id`]: catId,
    });
    return items.map(mapEntry);
  },

  async searchArticlesByQuery(query: string): Promise<unknown[]> {
    const items = await fetchAll(articleType, { query });
    return items.map(mapEntry);
  },

  async fetchArticleSlugs(): Promise<unknown[]> {
    const items = await fetchAll(articleType, {
      select: ["fields." + mf(fieldMap, "slug"), "sys.updatedAt"],
    });
    return items.map((entry) => ({
      slug: (fields(entry)[mf(fieldMap, "slug")] as string) ?? "",
      updatedAt: (sys(entry).updatedAt as string) ?? "",
    }));
  },

  async fetchAllCategories(): Promise<unknown[]> {
    const items = await safeFetchAll("category");
    return items.map(mapCategory);
  },

  async fetchCategoryBySlug(slug: string): Promise<unknown | null> {
    const items = await safeFetchAll("category", {
      "fields.slug": slug,
      limit: 1,
    });
    return items.length > 0 ? mapCategory(items[0]) : null;
  },

  async fetchAllAuthors(): Promise<unknown[]> {
    const items = await safeFetchAll("author");
    return items.map(mapAuthor);
  },

  async fetchAuthorBySlug(slug: string): Promise<unknown | null> {
    const items = await safeFetchAll("author", {
      "fields.slug": slug,
      limit: 1,
    });
    return items.length > 0 ? mapAuthor(items[0]) : null;
  },

  async fetchArticlesByAuthor(authorSlug: string): Promise<unknown[]> {
    const authors = await safeFetchAll("author", {
      "fields.slug": authorSlug,
      limit: 1,
    });
    if (authors.length === 0) return [];
    const authorId = (sys(authors[0]).id as string) ?? "";
    if (!authorId) return [];

    const items = await fetchAll(articleType, {
      [`fields.${mf(fieldMap, "author")}.sys.id`]: authorId,
    });
    return items.map(mapEntry);
  },

  async fetchNewsticker(): Promise<unknown[]> {
    const items = await safeFetchAll("newsticker", {
      order: ["-sys.createdAt"],
      limit: 20,
    });
    return items.map((entry) => {
      const f = fields(entry);
      const s = sys(entry);
      return {
        id: s.id ?? "",
        headline: (f.headline as string) ?? "",
        text: (f.text as string) ?? "",
        timestamp: (s.createdAt as string) ?? "",
        url: (f.url as string) ?? "",
      };
    });
  },

  async fetchVideos(): Promise<unknown[]> {
    const items = await safeFetchAll("video", {
      order: ["-sys.createdAt"],
    });
    return items.map((entry) => {
      const f = fields(entry);
      const s = sys(entry);
      return {
        id: s.id ?? "",
        title: (f.title as string) ?? "",
        url: (f.url as string) ?? "",
        thumbnail: (f.thumbnail as string) ?? "",
        duration: (f.duration as number) ?? 0,
        publishedAt: (s.createdAt as string) ?? "",
      };
    });
  },

  async fetchNavigation(): Promise<unknown> {
    const entry = await safeFetchFirst("navigation");
    if (!entry) return { items: [] };
    const f = fields(entry);
    return {
      items: Array.isArray(f.items) ? f.items : [],
    };
  },

  async fetchSiteConfig(): Promise<unknown> {
    const entry = await safeFetchFirst("siteConfig");
    if (!entry) return {};
    return fields(entry);
  },

  async fetchBreakingNews(): Promise<unknown[]> {
    const items = await safeFetchAll("breakingNews", {
      order: ["-sys.createdAt"],
      limit: 5,
    });
    return items.map((entry) => {
      const f = fields(entry);
      const s = sys(entry);
      return {
        id: s.id ?? "",
        headline: (f.headline as string) ?? "",
        text: (f.text as string) ?? "",
        url: (f.url as string) ?? "",
        severity: (f.severity as string) ?? "normal",
        timestamp: (s.createdAt as string) ?? "",
      };
    });
  },

  async fetchQuiz(): Promise<unknown> {
    const entry = await safeFetchFirst("quiz");
    if (!entry) return null;
    const f = fields(entry);
    const s = sys(entry);
    return {
      id: s.id ?? "",
      title: (f.title as string) ?? "",
      questions: Array.isArray(f.questions) ? f.questions : [],
    };
  },

  async fetchStockData(): Promise<unknown> {
    const entry = await safeFetchFirst("stockData");
    if (!entry) return null;
    const f = fields(entry);
    return {
      stocks: Array.isArray(f.stocks) ? f.stocks : [],
      updatedAt: (sys(entry).updatedAt as string) ?? "",
    };
  },
};

export default contentfulAdapter;
