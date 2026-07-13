import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import { safeFetch, sanitizeError } from "./http";
import { defaultNavigation, defaultSiteConfig } from "./defaults";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";
import {
  fetchNewsticker as mockNewsticker,
  fetchVideos as mockVideos,
  fetchBreakingNews as mockBreakingNews,
  fetchQuiz as mockQuiz,
  fetchStockData as mockStockData,
} from "@/lib/mock";

/* ---------- TYPO3 response types ---------- */

interface T3ImageVariant {
  publicUrl?: string | null;
  dimensions?: { width?: number; height?: number } | null;
}

interface T3MediaItem {
  publicUrl?: string;
  properties?: {
    alternative?: string;
    width?: number;
    height?: number;
  };
  images?: {
    defaultImage?: T3ImageVariant;
    [key: string]: T3ImageVariant | undefined;
  };
}

interface T3Category {
  id?: number;
  uid?: number;
  title?: string;
  pid?: number;
  slug?: string;
}

interface T3Author {
  author?: string;
  authorEmail?: string;
}

interface T3NewsItem {
  uid?: number;
  title?: string;
  pathSegment?: string;
  teaser?: string;
  bodytext?: string;
  datetime?: unknown;
  tstamp?: unknown;
  crdate?: unknown;
  media?: T3MediaItem[];
  falMedia?: T3MediaItem[];
  categories?: T3Category[];
  author?: string | T3Author;
  metaData?: {
    keywords?: string;
    description?: string;
    alternativeTitle?: string;
  };
  keywords?: string;
  isTopNews?: boolean;
  slug?: string;
  [key: string]: unknown;
}

interface T3ContentElement {
  type?: string;
  CType?: string;
  list_type?: string;
  content?: {
    data?: {
      list?: T3NewsItem[];
      items?: T3NewsItem[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  data?: {
    list?: T3NewsItem[];
    items?: T3NewsItem[];
    [key: string]: unknown;
  };
  items?: T3NewsItem[];
  [key: string]: unknown;
}

interface T3NavItem {
  link?: string;
  title?: string;
  active?: number;
  current?: number;
  children?: T3NavItem[];
}

interface T3PageResponse {
  id?: number;
  title?: string;
  slug?: string;
  navigation?: T3NavItem[];
  meta?: { title?: string; description?: string };
  content?: Record<string, T3ContentElement[]>;
  breadcrumbs?: T3NavItem[];
  [key: string]: unknown;
}

/* ---------- config ---------- */

const baseUrl = (process.env.TYPO3_URL ?? "").replace(/\/$/, "");
if (!baseUrl && process.env.CMS_ADAPTER === "typo3") {
  throw new Error("[typo3] TYPO3_URL is required when CMS_ADAPTER=typo3");
}
const apiToken = process.env.TYPO3_API_TOKEN;
const articlePage = process.env.TYPO3_ARTICLE_PAGE ?? "/news";
const langPrefix = process.env.TYPO3_LANG_PREFIX ?? "";
const fieldMap = parseFieldMap(process.env.TYPO3_FIELD_MAP);

function parseContentPages(): string[] {
  const raw = process.env.TYPO3_CONTENT_PAGES;
  if (!raw) return ["/"];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : ["/"];
  } catch {
    console.warn(
      "[typo3] TYPO3_CONTENT_PAGES is not valid JSON, using default",
    );
    return ["/"];
  }
}
const contentPages = parseContentPages();

/* ---------- fetch helpers ---------- */

const MAX_NEWS_ITEMS = 500;

async function t3Fetch<T>(path: string): Promise<T> {
  const slug = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${langPrefix}${slug}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }
  const res = await safeFetch(url, { headers });
  return res.json() as Promise<T>;
}

async function fetchPage(slug: string): Promise<T3PageResponse> {
  return t3Fetch<T3PageResponse>(slug);
}

function isNewsElement(element: T3ContentElement): boolean {
  const t = String(element.type ?? element.CType ?? "");
  if (t.includes("news")) return true;
  if (t === "list") {
    const lt = String(element.list_type ?? "");
    return lt.includes("news");
  }
  return false;
}

function extractNewsFromElement(element: T3ContentElement): T3NewsItem[] {
  const nested =
    element.content?.data?.list ??
    element.content?.data?.items ??
    element.data?.list ??
    element.data?.items ??
    element.items ??
    [];
  return Array.isArray(nested) ? (nested as T3NewsItem[]) : [];
}

function extractNewsItems(page: T3PageResponse): T3NewsItem[] {
  const items: T3NewsItem[] = [];

  const contentObj = page.content ?? page;
  const colKeys = Object.keys(contentObj).filter((k) => k.startsWith("colPos"));

  for (const key of colKeys) {
    const column = (contentObj as Record<string, unknown>)[key];
    if (!Array.isArray(column)) continue;

    for (const element of column as T3ContentElement[]) {
      if (!isNewsElement(element)) continue;
      items.push(...extractNewsFromElement(element));
    }
  }

  if (items.length > MAX_NEWS_ITEMS) {
    console.warn(
      `[typo3] ${items.length} news items found, capping at ${MAX_NEWS_ITEMS}`,
    );
    return items.slice(0, MAX_NEWS_ITEMS);
  }
  return items;
}

/* ---------- value helpers ---------- */

function safeTimestamp(value: unknown): string {
  if (value === null || value === undefined || value === 0) return "";
  if (typeof value === "number") {
    try {
      return new Date(value * 1000).toISOString();
    } catch {
      return "";
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    const asNum = Number(trimmed);
    if (!isNaN(asNum) && asNum > 0) {
      try {
        return new Date(asNum * 1000).toISOString();
      } catch {
        return "";
      }
    }
  }
  return "";
}

const isLocalCms =
  baseUrl.includes(".ddev.site") || baseUrl.includes("localhost");

function absoluteUrl(raw: unknown): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (isLocalCms && trimmed.startsWith(baseUrl)) {
      const path = trimmed.slice(baseUrl.length);
      if (path.startsWith("/fileadmin/")) {
        return `/cms-proxy${path}`;
      }
    }
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (isLocalCms && path.startsWith("/fileadmin/")) {
    return `/cms-proxy${path}`;
  }
  return `${baseUrl}${path}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ---------- mappers ---------- */

function resolveAuthorName(
  item: T3NewsItem,
  fm: Record<string, string>,
): string {
  const authorField = mapField(fm, "author");
  const raw = item[authorField] ?? item.author;
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object" && "author" in raw) {
    return String((raw as T3Author).author ?? "").trim();
  }
  return "";
}

function resolveMediaUrl(img: T3MediaItem): string {
  if (img.publicUrl) return img.publicUrl;
  const defaultImg = img.images?.defaultImage;
  if (defaultImg?.publicUrl) return defaultImg.publicUrl;
  return "";
}

function resolveMediaDimensions(img: T3MediaItem): {
  width?: number;
  height?: number;
} {
  if (img.properties?.width || img.properties?.height) {
    return { width: img.properties.width, height: img.properties.height };
  }
  const dims = img.images?.defaultImage?.dimensions;
  if (dims) return { width: dims.width, height: dims.height };
  return {};
}

function mapNewsToArticle(item: T3NewsItem): unknown {
  const fm = fieldMap;
  const mediaList = item.media ?? item.falMedia ?? [];
  const img =
    Array.isArray(mediaList) && mediaList.length > 0 ? mediaList[0] : null;
  const cat =
    Array.isArray(item.categories) && item.categories.length > 0
      ? item.categories[0]
      : null;
  const authorName = resolveAuthorName(item, fm);

  const rawKeywords =
    item.metaData?.keywords ?? item.keywords ?? item[mapField(fm, "tags")];
  const tags =
    typeof rawKeywords === "string" && rawKeywords.trim()
      ? rawKeywords
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const imgUrl = img ? resolveMediaUrl(img) : "";
  const imgDims = img ? resolveMediaDimensions(img) : {};

  return {
    id: String(item.uid ?? ""),
    headline: String(item[mapField(fm, "headline")] ?? item.title ?? ""),
    slug: String(item.pathSegment ?? ""),
    teaser: sanitizeRichText(
      String(item[mapField(fm, "teaser")] ?? item.teaser ?? ""),
    ),
    body: sanitizeRichText(
      String(item[mapField(fm, "body")] ?? item.bodytext ?? ""),
    ),
    publicationDate: safeTimestamp(item.datetime),
    updatedAt: safeTimestamp(item.tstamp),
    image: imgUrl
      ? normalizeImage(
          absoluteUrl(imgUrl),
          img?.properties?.alternative ?? "",
          imgDims.width,
          imgDims.height,
        )
      : normalizeImage(null),
    category: cat
      ? {
          id: String(cat.id ?? cat.uid ?? ""),
          name: String(cat.title ?? ""),
          slug: slugify(String(cat.title ?? "")),
        }
      : { id: "", name: "", slug: "" },
    author: authorName
      ? {
          id: slugify(authorName),
          name: authorName,
          slug: slugify(authorName),
          avatar: "",
        }
      : { id: "", name: "", slug: "", avatar: "" },
    tags,
    readingTimeMinutes: Number(item[mapField(fm, "readingTimeMinutes")] ?? 0),
    commentCount: 0,
    isPremium: item[mapField(fm, "isPremium")] === true,
    paywall: "free" as const,
    isLive: item[mapField(fm, "isLive")] === true,
    isOpinion: item[mapField(fm, "isOpinion")] === true,
    isFeatured:
      item.isTopNews === true || item[mapField(fm, "isFeatured")] === true,
    isBreaking: item[mapField(fm, "isBreaking")] === true,
    aiSummary: String(item[mapField(fm, "aiSummary")] ?? ""),
    region: String(item[mapField(fm, "region")] ?? ""),
    comments: [],
  };
}

function mapCategory(cat: T3Category, articleCount: number): unknown {
  const s = slugify(String(cat.title ?? ""));
  return {
    id: String(cat.id ?? cat.uid ?? ""),
    name: String(cat.title ?? ""),
    slug: s,
    path: `/${s}`,
    description: "",
    color: "",
    children: [],
    articleCount,
  };
}

function mapAuthor(name: string): unknown {
  const s = slugify(name);
  return {
    id: s,
    name,
    slug: s,
    avatar: "",
    bio: "",
    role: "",
  };
}

/* ---------- cache ---------- */

let _newsPromise: Promise<T3NewsItem[]> | null = null;
let _newsTs = 0;
const CACHE_TTL = 10_000;

async function getAllNewsItems(): Promise<T3NewsItem[]> {
  const now = Date.now();
  if (_newsPromise && now - _newsTs < CACHE_TTL) {
    return _newsPromise;
  }
  _newsTs = now;
  _newsPromise = fetchPage(articlePage)
    .then((page) => extractNewsItems(page))
    .catch((err) => {
      _newsPromise = null;
      throw err;
    });
  return _newsPromise;
}

/* ---------- adapter ---------- */

const typo3Adapter = {
  name: "typo3" as const,

  async fetchAllArticles() {
    const items = await getAllNewsItems();
    return [...items].map(mapNewsToArticle) as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    try {
      const page = await fetchPage(`${articlePage}/${slug}`);
      const items = extractNewsItems(page);
      if (items.length > 0) {
        return mapNewsToArticle(items[0]) as unknown as Article;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("404") && !msg.includes("Not Found")) {
        throw err;
      }
    }
    const all = await getAllNewsItems();
    const match = all.find((item) => item.pathSegment === slug);
    return (match ? mapNewsToArticle(match) : null) as unknown as Article | null;
  },

  async fetchArticlesByCategory(categorySlug: string) {
    const items = await getAllNewsItems();
    return [...items]
      .filter((item) => {
        if (!Array.isArray(item.categories)) return false;
        return item.categories.some(
          (cat) => slugify(String(cat.title ?? "")) === categorySlug,
        );
      })
      .map(mapNewsToArticle) as unknown as Article[];
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const items = await getAllNewsItems();
    const fm = fieldMap;
    return [...items]
      .filter((item) => {
        const name = resolveAuthorName(item, fm);
        return name && slugify(name) === authorSlug;
      })
      .map(mapNewsToArticle) as unknown as Article[];
  },

  async searchArticlesByQuery(query: string) {
    const q = query.toLowerCase();
    const items = await getAllNewsItems();
    return [...items]
      .filter((item) => {
        const headline = String(item.title ?? "").toLowerCase();
        const teaser = String(item.teaser ?? "").toLowerCase();
        return headline.includes(q) || teaser.includes(q);
      })
      .map(mapNewsToArticle) as unknown as Article[];
  },

  async fetchArticleSlugs() {
    const items = await getAllNewsItems();
    return [...items].map((item) => ({
      slug: String(item.pathSegment ?? ""),
      updatedAt: safeTimestamp(item.tstamp),
    }));
  },

  async fetchAllCategories() {
    const items = await getAllNewsItems();
    const catMap = new Map<number, { cat: T3Category; count: number }>();
    for (const item of items) {
      if (!Array.isArray(item.categories)) continue;
      for (const cat of item.categories) {
        const catId = cat.id ?? cat.uid ?? 0;
        const existing = catMap.get(catId);
        if (existing) {
          existing.count++;
        } else {
          catMap.set(catId, { cat, count: 1 });
        }
      }
    }
    return Array.from(catMap.values()).map((entry) =>
      mapCategory(entry.cat, entry.count),
    ) as unknown as Category[];
  },

  async fetchCategoryBySlug(slug: string) {
    const categories = (await this.fetchAllCategories()) as unknown as Array<{
      slug: string;
    }>;
    return (categories.find((c) => c.slug === slug) ?? null) as unknown as Category | null;
  },

  async fetchAllAuthors() {
    const items = await getAllNewsItems();
    const fm = fieldMap;
    const seen = new Set<string>();
    const authors: unknown[] = [];
    for (const item of items) {
      const name = resolveAuthorName(item, fm);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      authors.push(mapAuthor(name));
    }
    return authors as unknown as Author[];
  },

  async fetchAuthorBySlug(slug: string) {
    const authors = (await this.fetchAllAuthors()) as unknown as Array<{ slug: string }>;
    return (authors.find((a) => a.slug === slug) ?? null) as unknown as Author | null;
  },

  async fetchNavigation() {
    try {
      const rootPage = contentPages[0] ?? "/";
      const page = await fetchPage(rootPage);
      const navItems = Array.isArray(page?.navigation) ? page.navigation : [];
      return {
        primaryMenu: navItems.map((item) => ({
          reference: {
            type: "SECTION" as const,
            href: String(item.link ?? "/"),
            label: String(item.title ?? ""),
            isActive: item.active === 1 || item.current === 1,
          },
          commercial: false,
          children: Array.isArray(item.children)
            ? item.children.map((child) => ({
                reference: {
                  type: "SECTION" as const,
                  href: String(child.link ?? ""),
                  label: String(child.title ?? ""),
                },
                commercial: false,
              }))
            : [],
        })),
        footerMenu: [],
        socialLinks: [],
      } as unknown as Navigation;
    } catch (err) {
      console.warn(`[typo3] fetchNavigation failed: ${sanitizeError(err)}`);
      return defaultNavigation as unknown as Navigation;
    }
  },

  async fetchSiteConfig() {
    try {
      const rootPage = contentPages[0] ?? "/";
      const page = await fetchPage(rootPage);
      return {
        title: String(
          page?.meta?.title ??
            page?.title ??
            page?.navigation?.[0]?.title ??
            "",
        ),
        description: String(page?.meta?.description ?? ""),
        url: baseUrl,
        language: langPrefix ? langPrefix.replace("/", "") : "de",
        tags: [],
        socialLinks: [],
        analytics: { gtmId: "" },
      } as unknown as SiteConfig;
    } catch (err) {
      console.warn(`[typo3] fetchSiteConfig failed: ${sanitizeError(err)}`);
      return defaultSiteConfig as unknown as SiteConfig;
    }
  },

  async fetchNewsticker() {
    return mockNewsticker();
  },

  async fetchVideos() {
    return mockVideos();
  },

  async fetchBreakingNews() {
    return mockBreakingNews();
  },

  async fetchQuiz() {
    return mockQuiz();
  },

  async fetchStockData() {
    return mockStockData();
  },
};

export default typo3Adapter as unknown as CmsAdapter;
