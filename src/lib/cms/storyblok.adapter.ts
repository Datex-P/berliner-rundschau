import StoryblokClient from "storyblok-js-client";
import { renderRichText } from "@storyblok/richtext";
import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";

/* ---------- client setup ---------- */

const client = new StoryblokClient({
  accessToken: process.env.STORYBLOK_ACCESS_TOKEN!,
  region: "eu",
});

const version = (process.env.STORYBLOK_VERSION ?? "published") as
  "published" | "draft";
const articleType = process.env.STORYBLOK_ARTICLE_TYPE ?? "article";
const fieldMap = parseFieldMap(process.env.STORYBLOK_FIELD_MAP);

const articleRelations = [
  `${articleType}.${mapField(fieldMap, "category")}`,
  `${articleType}.${mapField(fieldMap, "author")}`,
].join(",");

/* ---------- helpers ---------- */

/** Shorthand for mapField with the module-level fieldMap. */
function mf(name: string): string {
  return mapField(fieldMap, name);
}

/** Paginate through all stories of a content type, resolving relations. */
async function fetchAllStories(
  contentType: string,
  extraParams?: Record<string, unknown>,
) {
  const items: unknown[] = [];
  const allRels: unknown[] = [];
  let page = 1;
  const perPage = 100;
  let total = Infinity;

  while (items.length < total) {
    const res = await client.get("cdn/stories", {
      content_type: contentType,
      version,
      per_page: perPage,
      page,
      ...extraParams,
    });
    items.push(...res.data.stories);
    if (Array.isArray(res.data.rels)) allRels.push(...res.data.rels);
    total = res.total;
    page++;
  }

  resolveRelations(items, allRels);
  return items;
}

/** Safely fetch all stories; returns [] when the content type does not exist. */
async function safeFetchAll(
  contentType: string,
  extraParams?: Record<string, unknown>,
) {
  try {
    return await fetchAllStories(contentType, extraParams);
  } catch (error) {
    console.error(`[Storyblok] Fetch aller "${contentType}"-Stories fehlgeschlagen:`, error instanceof Error ? error.message : error)
    return [];
  }
}

/** Safely fetch a single story by slug (full path). Returns null if not found. */
async function safeFetchStory(
  slug: string,
  extraParams?: Record<string, unknown>,
) {
  try {
    const res = await client.get(`cdn/stories/${slug}`, {
      version,
      ...extraParams,
    });
    const story = res.data.story ?? null;
    if (story && Array.isArray(res.data.rels)) {
      resolveRelations([story], res.data.rels);
    }
    return story;
  } catch (error) {
    console.error(`[Storyblok] Fetch Story "${slug}" fehlgeschlagen:`, error instanceof Error ? error.message : error)
    return null;
  }
}

/** Safely fetch stories and return the first one, or null. */
async function safeFetchFirst(
  contentType: string,
  extraParams?: Record<string, unknown>,
) {
  const items = await safeFetchAll(contentType, {
    ...extraParams,
    per_page: 1,
  });
  return items[0] ?? null;
}

/* ---------- field access helpers ---------- */

function content(story: unknown): Record<string, unknown> {
  return (
    ((story as Record<string, unknown>)?.content as Record<string, unknown>) ??
    {}
  );
}

function storyField(story: unknown, key: string): unknown {
  return (story as Record<string, unknown>)?.[key];
}

/** Check if a value is a resolved Storyblok story (not a UUID string). */
function isResolvedStory(val: unknown): val is Record<string, unknown> {
  return (
    val != null &&
    typeof val === "object" &&
    "uuid" in (val as Record<string, unknown>)
  );
}

/** Build a UUID → story map from a rels array. */
function buildRelsMap(rels: unknown[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const rel of rels) {
    const r = rel as Record<string, unknown>;
    if (typeof r.uuid === "string") map.set(r.uuid, rel);
  }
  return map;
}

/**
 * Replace UUID strings in story content with resolved story objects.
 * storyblok-js-client does NOT auto-merge rels into content fields —
 * relation fields remain as UUID strings while resolved data sits in
 * a separate `rels` array. This function does the merge manually.
 */
function resolveRelations(stories: unknown[], rels: unknown[]): void {
  const map = buildRelsMap(rels);
  if (map.size === 0) return;
  for (const story of stories) {
    const c = (story as Record<string, unknown>).content as
      Record<string, unknown> | undefined;
    if (!c) continue;
    for (const [key, value] of Object.entries(c)) {
      if (typeof value === "string" && map.has(value)) {
        c[key] = map.get(value);
      }
    }
  }
}

/* ---------- entry mappers ---------- */

function mapStory(story: unknown): unknown {
  const s = story as Record<string, unknown>;
  const c = content(story);

  const bodyField = c[mf("body")];
  // renderRichText expects the Storyblok richtext JSON object
  const bodyHtml = bodyField
    ? sanitizeRichText(
        renderRichText(bodyField as Parameters<typeof renderRichText>[0]),
      )
    : "";

  const imgField = c[mf("image")] as Record<string, unknown> | null;
  const catField = c[mf("category")];
  const authField = c[mf("author")];

  const categoryData = isResolvedStory(catField)
    ? {
        id: String(catField.uuid ?? ""),
        name: String(content(catField).name ?? catField.name ?? ""),
        slug: String(catField.slug ?? ""),
      }
    : { id: "", name: "", slug: "" };

  let authorData: {
    id: string;
    name: string;
    slug: string;
    avatar: string | null;
  } = { id: "", name: "", slug: "", avatar: null };
  if (isResolvedStory(authField)) {
    const ac = content(authField);
    const av = ac.avatar as Record<string, unknown> | null;
    const avatarUrl =
      av && typeof av === "object" && "filename" in av
        ? String(av.filename ?? "")
        : null;
    authorData = {
      id: String(authField.uuid ?? ""),
      name: String(ac.name ?? authField.name ?? ""),
      slug: String(authField.slug ?? ""),
      avatar: avatarUrl || null,
    };
  }

  return {
    id: String(s.uuid ?? ""),
    headline: String(c[mf("headline")] ?? ""),
    slug: String(s.slug ?? ""),
    teaser: String(c[mf("teaser")] ?? ""),
    body: bodyHtml,
    publicationDate: String(s.published_at ?? s.created_at ?? ""),
    updatedAt: String(s.updated_at ?? ""),
    image:
      imgField && typeof imgField === "object" && "filename" in imgField
        ? normalizeImage(
            String((imgField as Record<string, unknown>).filename ?? ""),
            String((imgField as Record<string, unknown>).alt ?? ""),
          )
        : normalizeImage(typeof imgField === "string" ? imgField : null),
    category: categoryData,
    author: authorData,
    tags: Array.isArray(s.tag_list) ? s.tag_list : [],
    readingTimeMinutes: Number(c[mf("readingTimeMinutes")] ?? 0),
    commentCount: 0,
    isPremium: c[mf("isPremium")] === true,
    paywall: String(c[mf("paywall")] ?? "free"),
    isLive: c[mf("isLive")] === true,
    isOpinion: c[mf("isOpinion")] === true,
    isFeatured: c[mf("isFeatured")] === true,
    isBreaking: c[mf("isBreaking")] === true,
    aiSummary: String(c[mf("aiSummary")] ?? ""),
    region: String(c[mf("region")] ?? ""),
    comments: [],
  };
}

function mapCategory(story: unknown): unknown {
  const s = story as Record<string, unknown>;
  const c = content(story);
  return {
    id: String(s.uuid ?? ""),
    name: String(c.name ?? s.name ?? ""),
    slug: String(s.slug ?? ""),
    description: String(c.description ?? ""),
    color: String(c.color ?? ""),
  };
}

function mapAuthor(story: unknown): unknown {
  const s = story as Record<string, unknown>;
  const c = content(story);
  const avatarField = c.avatar as Record<string, unknown> | null;
  const avatarUrl =
    avatarField && typeof avatarField === "object" && "filename" in avatarField
      ? String((avatarField as Record<string, unknown>).filename ?? "")
      : null;

  return {
    id: String(s.uuid ?? ""),
    name: String(c.name ?? s.name ?? ""),
    slug: String(s.slug ?? ""),
    bio: String(c.bio ?? ""),
    avatar: avatarUrl || null,
    role: String(c.role ?? ""),
  };
}

/* ---------- adapter ---------- */

const storyblokAdapter = {
  name: "storyblok",

  async fetchAllArticles() {
    const stories = await fetchAllStories(articleType, {
      resolve_relations: articleRelations,
    });
    return stories.map(mapStory) as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    /* Try direct slug fetch first, fall back to content_type filter */
    const story = await safeFetchStory(slug, {
      resolve_relations: articleRelations,
    });
    if (story) return mapStory(story) as unknown as Article;

    const items = await safeFetchAll(articleType, {
      "filter_query[slug][is]": slug,
      per_page: 1,
      resolve_relations: articleRelations,
    });
    return (items.length > 0 ? mapStory(items[0]) : null) as unknown as Article | null;
  },

  async fetchArticlesByCategory(categorySlug: string) {
    const allCats = await safeFetchAll("category");
    const cat = allCats.find(
      (c) => (c as Record<string, unknown>).slug === categorySlug,
    );
    if (!cat) return [];
    const catUuid = String((cat as Record<string, unknown>).uuid ?? "");

    const items = await safeFetchAll(articleType, {
      "filter_query[category][in]": catUuid,
      resolve_relations: articleRelations,
    });
    return items.map(mapStory) as unknown as Article[];
  },

  async searchArticlesByQuery(query: string) {
    const items = await safeFetchAll(articleType, {
      search_term: query,
      resolve_relations: articleRelations,
    });
    return items.map(mapStory) as unknown as Article[];
  },

  async fetchArticleSlugs() {
    const stories = await fetchAllStories(articleType);
    return stories.map((story) => ({
      slug: String(storyField(story, "slug") ?? ""),
      updatedAt: String(storyField(story, "updated_at") ?? ""),
    })) as unknown as Array<{ slug: string; modified?: string }>;
  },

  async fetchAllCategories() {
    const items = await safeFetchAll("category");
    return items.map(mapCategory) as unknown as Category[];
  },

  async fetchCategoryBySlug(slug: string) {
    const story = await safeFetchStory(slug);
    if (story) return mapCategory(story) as unknown as Category;

    const items = await safeFetchAll("category", {
      "filter_query[slug][is]": slug,
      per_page: 1,
    });
    return (items.length > 0 ? mapCategory(items[0]) : null) as unknown as Category | null;
  },

  async fetchAllAuthors() {
    const items = await safeFetchAll("author");
    return items.map(mapAuthor) as unknown as Author[];
  },

  async fetchAuthorBySlug(slug: string) {
    const story = await safeFetchStory(slug);
    if (story) return mapAuthor(story) as unknown as Author;

    const items = await safeFetchAll("author", {
      "filter_query[slug][is]": slug,
      per_page: 1,
    });
    return (items.length > 0 ? mapAuthor(items[0]) : null) as unknown as Author | null;
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const allAuthors = await safeFetchAll("author");
    const author = allAuthors.find(
      (a) => (a as Record<string, unknown>).slug === authorSlug,
    );
    if (!author) return [];
    const authorUuid = String((author as Record<string, unknown>).uuid ?? "");

    const items = await safeFetchAll(articleType, {
      "filter_query[author][in]": authorUuid,
      resolve_relations: articleRelations,
    });
    return items.map(mapStory) as unknown as Article[];
  },

  async fetchNewsticker() {
    const items = await safeFetchAll("newsticker", {
      sort_by: "created_at:desc",
      per_page: 20,
    });
    return items.map((story) => {
      const c = content(story);
      return {
        id: String(storyField(story, "uuid") ?? ""),
        headline: String(c.headline ?? ""),
        text: String(c.text ?? ""),
        timestamp: String(storyField(story, "created_at") ?? ""),
        url: String(c.url ?? ""),
      };
    }) as unknown as NewstickerItem[];
  },

  async fetchVideos() {
    const items = await safeFetchAll("video", {
      sort_by: "created_at:desc",
    });
    return items.map((story) => {
      const c = content(story);
      return {
        id: String(storyField(story, "uuid") ?? ""),
        title: String(c.title ?? ""),
        url: String(c.url ?? ""),
        thumbnail: String(c.thumbnail ?? ""),
        duration: Number(c.duration ?? 0),
        publishedAt: String(storyField(story, "created_at") ?? ""),
      };
    }) as unknown as Video[];
  },

  async fetchNavigation() {
    const story = await safeFetchFirst("navigation");
    if (!story) return { items: [] } as unknown as Navigation;
    const c = content(story);
    return {
      items: Array.isArray(c.items) ? c.items : [],
    } as unknown as Navigation;
  },

  async fetchSiteConfig() {
    const story = await safeFetchFirst("siteConfig");
    if (!story) return {} as unknown as SiteConfig;
    return content(story) as unknown as SiteConfig;
  },

  async fetchBreakingNews() {
    const items = await safeFetchAll("breakingNews", {
      sort_by: "created_at:desc",
      per_page: 5,
    });
    return items.map((story) => {
      const c = content(story);
      return {
        id: String(storyField(story, "uuid") ?? ""),
        headline: String(c.headline ?? ""),
        text: String(c.text ?? ""),
        url: String(c.url ?? ""),
        severity: String(c.severity ?? "normal"),
        timestamp: String(storyField(story, "created_at") ?? ""),
      };
    }) as unknown as BreakingNews[];
  },

  async fetchQuiz() {
    const story = await safeFetchFirst("quiz");
    if (!story) return null;
    const c = content(story);
    return {
      id: String(storyField(story, "uuid") ?? ""),
      title: String(c.title ?? ""),
      questions: Array.isArray(c.questions) ? c.questions : [],
    } as unknown as Quiz;
  },

  async fetchStockData() {
    const story = await safeFetchFirst("stockData");
    if (!story) return null;
    const c = content(story);
    return {
      stocks: Array.isArray(c.stocks) ? c.stocks : [],
      updatedAt: String(storyField(story, "updated_at") ?? ""),
    } as unknown as StockData;
  },
};

export default storyblokAdapter as unknown as CmsAdapter;
