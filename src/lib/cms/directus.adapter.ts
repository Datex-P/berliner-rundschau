import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import { safeFetch, sanitizeError } from "./http";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";

/* ---------- config ---------- */

const baseUrl = process.env.DIRECTUS_URL!.replace(/\/$/, "");
const collection = process.env.DIRECTUS_ARTICLE_COLLECTION ?? "articles";
const fieldMap = parseFieldMap(process.env.DIRECTUS_FIELD_MAP);

/** Shorthand for mapField with the module-level fieldMap. */
function mf(name: string): string {
  return mapField(fieldMap, name);
}

/* ---------- fetch helpers ---------- */

/** Build auth + accept headers for every Directus request. */
function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

/** Relation fields to expand on article queries. */
const ARTICLE_FIELDS = `fields=*,${mf("category")}.*,${mf("author")}.*,${mf("image")}.*`;

/** Fetch a single Directus REST endpoint and return `data`. */
async function directusFetch<T>(path: string): Promise<T> {
  const res = await safeFetch(`${baseUrl}${path}`, { headers: headers() });
  const json = (await res.json()) as { data: T };
  return json.data;
}

/** Paginate through all items of a collection. */
async function fetchAllItems(
  col: string,
  extraParams = "",
) {
  const items: unknown[] = [];
  let offset = 0;
  const limit = 100;
  let total = Infinity;

  while (offset < total) {
    const sep = extraParams ? `&${extraParams}` : "";
    const url = `${baseUrl}/items/${col}?limit=${limit}&offset=${offset}&meta=total_count${sep}`;
    const res = await safeFetch(url, { headers: headers() });
    const json = (await res.json()) as {
      data: unknown[];
      meta: { total_count: number };
    };
    items.push(...json.data);
    total = json.meta.total_count;
    offset += limit;
  }

  return items;
}

/** Safely fetch all items; returns [] on error. */
async function safeFetchAll(
  col: string,
  extraParams = "",
) {
  try {
    return await fetchAllItems(col, extraParams);
  } catch (err: unknown) {
    console.warn(`[directus] safeFetchAll(${col}) failed: ${sanitizeError(err)}`);
    return [];
  }
}

/** Safely fetch a single item by filter; returns null on error or not found. */
async function safeFetchFirst(
  col: string,
  extraParams = "",
) {
  try {
    const sep = extraParams ? `&${extraParams}` : "";
    const url = `${baseUrl}/items/${col}?limit=1${sep}`;
    const res = await safeFetch(url, { headers: headers() });
    const json = (await res.json()) as { data: unknown[] };
    return json.data[0] ?? null;
  } catch (err: unknown) {
    console.warn(`[directus] safeFetchFirst(${col}) failed: ${sanitizeError(err)}`);
    return null;
  }
}

/* ---------- item mappers ---------- */

/** Map a raw Directus article item to the normalized article shape. */
function mapItem(item: Record<string, unknown>): unknown {
  const bodyField = item[mf("body")];
  const bodyHtml =
    typeof bodyField === "string" ? sanitizeRichText(bodyField) : "";

  // Image — expanded relation object with id, title, width, height
  const imgField = item[mf("image")] as Record<string, unknown> | null;
  const imgId = imgField ? String(imgField.id ?? "") : null;
  const imgUrl = imgId ? `${baseUrl}/assets/${imgId}` : null;

  // Category — expanded relation
  const cat = item[mf("category")] as Record<string, unknown> | null;

  // Author — expanded relation
  const auth = item[mf("author")] as Record<string, unknown> | null;
  const authAvatar = auth
    ? (auth.avatar as Record<string, unknown> | string | null)
    : null;
  const avatarUrl =
    typeof authAvatar === "string"
      ? `${baseUrl}/assets/${authAvatar}`
      : authAvatar && typeof authAvatar === "object"
        ? `${baseUrl}/assets/${String((authAvatar as Record<string, unknown>).id ?? "")}`
        : "";

  // Tags — may be string[] or object[] with .name
  const rawTags = item[mf("tags")];
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t: unknown) =>
        typeof t === "string"
          ? t
          : String((t as Record<string, unknown>).name ?? ""),
      )
    : [];

  return {
    id: String(item.id ?? ""),
    headline: String(item[mf("headline")] ?? ""),
    slug: String(item[mf("slug")] ?? ""),
    teaser: String(item[mf("teaser")] ?? ""),
    body: bodyHtml,
    publicationDate: String(item.date_created ?? ""),
    updatedAt: String(item.date_updated ?? ""),
    image: normalizeImage(
      imgUrl,
      imgField ? String(imgField.title ?? "") : undefined,
      imgField ? Number(imgField.width ?? 0) : undefined,
      imgField ? Number(imgField.height ?? 0) : undefined,
    ),
    category: cat
      ? {
          id: String(cat.id ?? ""),
          name: String(cat.name ?? ""),
          slug: String(cat.slug ?? ""),
        }
      : { id: "", name: "", slug: "" },
    author: auth
      ? {
          id: String(auth.id ?? ""),
          name: String(
            auth[mf("name")] ?? auth.first_name ?? "",
          ),
          slug: String(auth.slug ?? ""),
          avatar: avatarUrl,
        }
      : { id: "", name: "", slug: "", avatar: "" },
    tags,
    readingTimeMinutes: Number(item[mf("readingTimeMinutes")] ?? 0),
    commentCount: 0,
    isPremium: item[mf("isPremium")] === true,
    paywall: String(item[mf("paywall")] ?? "free"),
    isLive: item[mf("isLive")] === true,
    isOpinion: item[mf("isOpinion")] === true,
    isFeatured: item[mf("isFeatured")] === true,
    isBreaking: item[mf("isBreaking")] === true,
    aiSummary: String(item[mf("aiSummary")] ?? ""),
    region: String(item[mf("region")] ?? ""),
    comments: [],
  };
}

/** Map a raw Directus category item. */
function mapCategory(item: Record<string, unknown>): unknown {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    slug: String(item.slug ?? ""),
    description: String(item.description ?? ""),
    color: String(item.color ?? ""),
  };
}

/** Map a raw Directus author item. */
function mapAuthor(item: Record<string, unknown>): unknown {
  const avatarField = item.avatar as
    | Record<string, unknown>
    | string
    | null;
  const avatarUrl =
    typeof avatarField === "string"
      ? `${baseUrl}/assets/${avatarField}`
      : avatarField && typeof avatarField === "object"
        ? `${baseUrl}/assets/${String((avatarField as Record<string, unknown>).id ?? "")}`
        : "";

  return {
    id: String(item.id ?? ""),
    name: String(item[mf("name")] ?? item.first_name ?? ""),
    slug: String(item.slug ?? ""),
    bio: String(item.bio ?? ""),
    avatar: avatarUrl,
    role: String(item.role ?? ""),
  };
}

/* ---------- adapter ---------- */

const directusAdapter = {
  name: "directus",

  async fetchAllArticles() {
    const items = await fetchAllItems(
      collection,
      `sort=-date_created&${ARTICLE_FIELDS}`,
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    try {
      const items = await directusFetch<unknown[]>(
        `/items/${collection}?filter[${mf("slug")}][_eq]=${encodeURIComponent(slug)}&${ARTICLE_FIELDS}&limit=1`,
      );
      if (!items || items.length === 0) return null;
      return mapItem(items[0] as Record<string, unknown>) as unknown as Article;
    } catch (err: unknown) {
      console.warn(`[directus] fetchArticleBySlug failed: ${sanitizeError(err)}`);
      return null;
    }
  },

  async fetchArticlesByCategory(categorySlug: string) {
    const items = await safeFetchAll(
      collection,
      `filter[${mf("category")}][slug][_eq]=${encodeURIComponent(categorySlug)}&${ARTICLE_FIELDS}&sort=-date_created`,
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async searchArticlesByQuery(query: string) {
    const items = await safeFetchAll(
      collection,
      `search=${encodeURIComponent(query)}&${ARTICLE_FIELDS}&sort=-date_created`,
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchArticleSlugs() {
    const items = await fetchAllItems(
      collection,
      `fields=${mf("slug")},date_updated`,
    );
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        slug: String(item[mf("slug")] ?? ""),
        updatedAt: String(item.date_updated ?? ""),
      };
    }) as unknown as Array<{ slug: string; modified?: string }>;
  },

  async fetchAllCategories() {
    const items = await safeFetchAll("categories", "sort=name");
    return items.map((i) => mapCategory(i as Record<string, unknown>)) as unknown as Category[];
  },

  async fetchCategoryBySlug(slug: string) {
    const item = await safeFetchFirst(
      "categories",
      `filter[slug][_eq]=${encodeURIComponent(slug)}`,
    );
    if (!item) return null;
    return mapCategory(item as Record<string, unknown>) as unknown as Category;
  },

  async fetchAllAuthors() {
    const items = await safeFetchAll("authors", "sort=name&fields=*,avatar.*");
    return items.map((i) => mapAuthor(i as Record<string, unknown>)) as unknown as Author[];
  },

  async fetchAuthorBySlug(slug: string) {
    const item = await safeFetchFirst(
      "authors",
      `filter[slug][_eq]=${encodeURIComponent(slug)}&fields=*,avatar.*`,
    );
    if (!item) return null;
    return mapAuthor(item as Record<string, unknown>) as unknown as Author;
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const items = await safeFetchAll(
      collection,
      `filter[${mf("author")}][slug][_eq]=${encodeURIComponent(authorSlug)}&${ARTICLE_FIELDS}&sort=-date_created`,
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchNewsticker() {
    const items = await safeFetchAll(
      "newsticker",
      "sort=-date_created&limit=20",
    );
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        headline: String(item.headline ?? ""),
        text: String(item.text ?? ""),
        timestamp: String(item.date_created ?? ""),
        url: String(item.url ?? ""),
      };
    }) as unknown as NewstickerItem[];
  },

  async fetchVideos() {
    const items = await safeFetchAll("videos", "sort=-date_created");
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        url: String(item.url ?? ""),
        thumbnail: String(item.thumbnail ?? ""),
        duration: Number(item.duration ?? 0),
        publishedAt: String(item.date_created ?? ""),
      };
    }) as unknown as Video[];
  },

  async fetchNavigation() {
    const item = await safeFetchFirst("navigation");
    if (!item) return { items: [] } as unknown as Navigation;
    const nav = item as Record<string, unknown>;
    return {
      items: Array.isArray(nav.items) ? nav.items : [],
    } as unknown as Navigation;
  },

  async fetchSiteConfig() {
    const item = await safeFetchFirst("site_config");
    if (!item) return {} as unknown as SiteConfig;
    return item as unknown as SiteConfig;
  },

  async fetchBreakingNews() {
    const items = await safeFetchAll(
      "breaking_news",
      "sort=-date_created&limit=5",
    );
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        headline: String(item.headline ?? ""),
        text: String(item.text ?? ""),
        url: String(item.url ?? ""),
        severity: String(item.severity ?? "normal"),
        timestamp: String(item.date_created ?? ""),
      };
    }) as unknown as BreakingNews[];
  },

  async fetchQuiz() {
    const item = await safeFetchFirst("quiz", "sort=-date_created");
    if (!item) return null;
    const quiz = item as Record<string, unknown>;
    return {
      id: String(quiz.id ?? ""),
      title: String(quiz.title ?? ""),
      questions: Array.isArray(quiz.questions) ? quiz.questions : [],
    } as unknown as Quiz;
  },

  async fetchStockData() {
    const item = await safeFetchFirst("stock_data", "sort=-date_updated");
    if (!item) return null;
    const stock = item as Record<string, unknown>;
    return {
      stocks: Array.isArray(stock.stocks) ? stock.stocks : [],
      updatedAt: String(stock.date_updated ?? ""),
    } as unknown as StockData;
  },
};

export default directusAdapter as unknown as CmsAdapter;
