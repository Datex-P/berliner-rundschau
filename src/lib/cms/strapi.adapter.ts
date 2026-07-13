import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import { safeFetch, sanitizeError } from "./http";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";

/* ---------- config ---------- */

const baseUrl = process.env.STRAPI_URL!.replace(/\/$/, "");
const apiToken = process.env.STRAPI_API_TOKEN!;
const strapiVersion = process.env.STRAPI_VERSION ?? "v5";
const collection = process.env.STRAPI_ARTICLE_COLLECTION ?? "articles";
const fieldMap = parseFieldMap(process.env.STRAPI_FIELD_MAP);

/** Shorthand for mapField with the module-level fieldMap. */
function mf(name: string): string {
  return mapField(fieldMap, name);
}

/* ---------- fetch helpers ---------- */

/** Authenticated fetch against the Strapi REST API. */
async function strapiFetch<T>(path: string): Promise<T> {
  const res = await safeFetch(`${baseUrl}/api${path}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });
  return res.json() as Promise<T>;
}

/** Unwrap v4 attributes wrapper; v5 items are flat already. */
function unwrapItem(item: Record<string, unknown>): Record<string, unknown> {
  if (
    strapiVersion === "v4" &&
    item.attributes &&
    typeof item.attributes === "object"
  ) {
    return { id: item.id, ...(item.attributes as Record<string, unknown>) };
  }
  return item;
}

/* ---------- rich-text: blocks -> HTML ---------- */

/** Convert inline children (text nodes, nested links) to HTML. */
function childrenToHtml(children: unknown[]): string {
  return children
    .map((child) => {
      if (!child || typeof child !== "object") return "";
      const c = child as Record<string, unknown>;

      if (c.type === "text") {
        let text = String(c.text ?? "");
        if (c.bold) text = `<strong>${text}</strong>`;
        if (c.italic) text = `<em>${text}</em>`;
        if (c.underline) text = `<u>${text}</u>`;
        if (c.strikethrough) text = `<s>${text}</s>`;
        if (c.code) text = `<code>${text}</code>`;
        return text;
      }

      if (c.type === "link") {
        const nested = Array.isArray(c.children) ? c.children : [];
        return `<a href="${String(c.url ?? "")}">${childrenToHtml(nested)}</a>`;
      }

      if (c.type === "list-item") {
        const nested = Array.isArray(c.children) ? c.children : [];
        return `<li>${childrenToHtml(nested)}</li>`;
      }

      // Fallback: recurse into children
      const nested = Array.isArray(c.children) ? c.children : [];
      return childrenToHtml(nested);
    })
    .join("");
}

/** Convert a markdown-like string (subset) to HTML paragraphs. */
function markdownToHtml(md: string): string {
  return md
    .split(/\n{2,}/)
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      const h3 = trimmed.match(/^###\s+(.+)/);
      if (h3) return `<h3>${h3[1]}</h3>`;
      const h2 = trimmed.match(/^##\s+(.+)/);
      if (h2) return `<h2>${h2[1]}</h2>`;
      const h1 = trimmed.match(/^#\s+(.+)/);
      if (h1) return `<h1>${h1[1]}</h1>`;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Handle Strapi Dynamic Zone blocks (shared.rich-text, shared.quote, shared.media). */
function dynamicZoneToHtml(blocks: unknown[]): string {
  return blocks
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const b = block as Record<string, unknown>;
      const comp = String(b.__component ?? "");
      if (comp === "shared.rich-text") {
        const bodyStr = String(b.body ?? "");
        // Bereits HTML: direkt zurückgeben; sonst Markdown konvertieren
        return bodyStr.trimStart().startsWith("<")
          ? bodyStr
          : markdownToHtml(bodyStr);
      }
      if (comp === "shared.quote") {
        const title = b.title ? `<cite>${String(b.title)}</cite>` : "";
        return `<blockquote><p>${String(b.body ?? "")}</p>${title}</blockquote>`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Convert Strapi "blocks" content to sanitized HTML.
 * Handles: Dynamic Zone components (shared.rich-text/quote) and native Strapi Blocks format.
 */
function blocksToHtml(blocks: unknown): string {
  if (typeof blocks === "string") return blocks;
  if (!Array.isArray(blocks)) return "";

  // Dynamic Zone detection: items have __component instead of type
  if (blocks.length > 0 && (blocks[0] as Record<string, unknown>).__component) {
    return sanitizeRichText(dynamicZoneToHtml(blocks));
  }

  return blocks
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const b = block as Record<string, unknown>;
      const type = b.type;
      const children = Array.isArray(b.children) ? b.children : [];

      switch (type) {
        case "paragraph":
          return `<p>${childrenToHtml(children)}</p>`;
        case "heading": {
          const level = Number(b.level ?? 2);
          return `<h${level}>${childrenToHtml(children)}</h${level}>`;
        }
        case "list": {
          const tag = b.format === "ordered" ? "ol" : "ul";
          return `<${tag}>${childrenToHtml(children)}</${tag}>`;
        }
        case "list-item":
          return `<li>${childrenToHtml(children)}</li>`;
        case "quote":
          return `<blockquote>${childrenToHtml(children)}</blockquote>`;
        case "code":
          return `<pre><code>${childrenToHtml(children)}</code></pre>`;
        case "image": {
          const img = b.image as Record<string, unknown> | undefined;
          const src = img?.url ? String(img.url) : "";
          const alt = img?.alternativeText ? String(img.alternativeText) : "";
          return src ? `<img src="${src}" alt="${alt}">` : "";
        }
        case "link": {
          const url = String(b.url ?? "");
          return `<a href="${url}">${childrenToHtml(children)}</a>`;
        }
        default:
          return childrenToHtml(children);
      }
    })
    .join("");
}

/* ---------- pagination ---------- */

interface StrapiListResponse {
  data: unknown[];
  meta: { pagination: { pageCount: number } };
}

/** Paginate through all items of a Strapi collection. */
async function fetchAllPaginated(
  col: string,
  extraParams = "",
  populate = "*",
) {
  const items: unknown[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const extra = extraParams ? `&${extraParams}` : "";
    const res = await strapiFetch<StrapiListResponse>(
      `/${col}?pagination[page]=${page}&pagination[pageSize]=100&populate=${populate}${extra}`,
    );
    if (Array.isArray(res.data)) {
      items.push(
        ...res.data.map((d) => unwrapItem(d as Record<string, unknown>)),
      );
    }
    totalPages = res.meta?.pagination?.pageCount ?? 1;
    page++;
  }

  return items;
}

/** Safely fetch all items; returns [] on error. */
async function safeFetchAll(
  col: string,
  extraParams = "",
  populate = "*",
) {
  try {
    return await fetchAllPaginated(col, extraParams, populate);
  } catch (err: unknown) {
    console.warn(`[strapi] safeFetchAll(${col}) failed: ${sanitizeError(err)}`);
    return [];
  }
}

/** Safely fetch a single item by filter; returns null on error or not found. */
async function safeFetchFirst(
  col: string,
  extraParams = "",
) {
  try {
    const extra = extraParams ? `&${extraParams}` : "";
    const res = await strapiFetch<StrapiListResponse>(
      `/${col}?pagination[pageSize]=1&populate=*${extra}`,
    );
    if (!Array.isArray(res.data) || res.data.length === 0) return null;
    return unwrapItem(res.data[0] as Record<string, unknown>);
  } catch (err: unknown) {
    console.warn(
      `[strapi] safeFetchFirst(${col}) failed: ${sanitizeError(err)}`,
    );
    return null;
  }
}

/* ---------- image URL resolution ---------- */

/**
 * Resolve image URL from a Strapi image field.
 * v4: image may be `{ data: { attributes: { url } } }`
 * v5: image is flat `{ url }`
 */
function resolveImageUrl(
  imgField: Record<string, unknown> | null,
): string | null {
  if (!imgField) return null;

  // v5 flat format or already resolved
  if (imgField.url) return String(imgField.url);

  // v4 nested format: { data: { attributes: { url } } }
  const data = imgField.data as Record<string, unknown> | null;
  if (data?.attributes) {
    const attrs = data.attributes as Record<string, unknown>;
    return attrs.url ? String(attrs.url) : null;
  }

  return null;
}

/** Make relative Strapi URLs absolute. */
function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${baseUrl}${url}`;
}

/* ---------- item mappers ---------- */

/** Map a raw Strapi article item to the normalized article shape. */
function mapItem(item: Record<string, unknown>): unknown {
  const bodyField = item[mf("body")];
  const bodyHtml =
    typeof bodyField === "string"
      ? sanitizeRichText(bodyField)
      : sanitizeRichText(blocksToHtml(bodyField));

  // Image
  const imgField = item[mf("image")] as Record<string, unknown> | null;
  const rawImgUrl = resolveImageUrl(imgField);
  const fullImgUrl = absoluteUrl(rawImgUrl);

  // Image alt text — field name varies
  const imgAlt = imgField
    ? String(imgField.alternativeText ?? imgField.alt ?? "")
    : "";

  // Category — may be nested in v4 { data: { attributes } }
  const catRaw = item[mf("category")] as Record<string, unknown> | null;
  const catData = catRaw?.data
    ? unwrapItem(catRaw.data as Record<string, unknown>)
    : catRaw;

  // Author — may be nested in v4
  const authRaw = item[mf("author")] as Record<string, unknown> | null;
  const authData = authRaw?.data
    ? unwrapItem(authRaw.data as Record<string, unknown>)
    : authRaw;
  const authorAvatarUrl =
    absoluteUrl(
      resolveImageUrl(authData?.avatar as Record<string, unknown> | null),
    ) ?? "";

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
    publicationDate: String(item.publishedAt ?? item.createdAt ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
    image: normalizeImage(
      fullImgUrl,
      imgAlt,
      imgField ? Number(imgField.width ?? 0) : undefined,
      imgField ? Number(imgField.height ?? 0) : undefined,
    ),
    category: catData
      ? {
          id: String(catData.id ?? ""),
          name: String(catData.name ?? ""),
          slug: String(catData.slug ?? ""),
        }
      : { id: "", name: "", slug: "" },
    author: authData
      ? {
          id: String(authData.id ?? ""),
          name: String(authData.name ?? authData.username ?? ""),
          slug: String(authData.slug ?? ""),
          avatar: authorAvatarUrl,
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

/** Map a raw Strapi category item. */
function mapCategory(item: Record<string, unknown>): unknown {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    slug: String(item.slug ?? ""),
    description: String(item.description ?? ""),
    color: String(item.color ?? ""),
  };
}

/** Map a raw Strapi author item. */
function mapAuthor(item: Record<string, unknown>): unknown {
  const avatarField = item.avatar as Record<string, unknown> | null;
  const rawAvatarUrl = resolveImageUrl(avatarField);
  const avatarUrl = absoluteUrl(rawAvatarUrl) ?? "";

  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? item.username ?? ""),
    slug: String(item.slug ?? ""),
    bio: String(item.bio ?? ""),
    avatar: avatarUrl,
    role: String(item.role ?? ""),
  };
}

/* ---------- adapter ---------- */

const strapiAdapter = {
  name: "strapi",

  async fetchAllArticles() {
    const items = await fetchAllPaginated(
      collection,
      "sort=publishedAt:desc",
      "cover,category,author,author.avatar",
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    try {
      const res = await strapiFetch<StrapiListResponse>(
        `/${collection}?filters[${mf("slug")}][$eq]=${encodeURIComponent(slug)}&populate=cover,category,author,author.avatar&pagination[pageSize]=1`,
      );
      if (!Array.isArray(res.data) || res.data.length === 0) return null;
      const item = unwrapItem(res.data[0] as Record<string, unknown>);
      return mapItem(item) as unknown as Article;
    } catch (err: unknown) {
      console.warn(`[strapi] fetchArticleBySlug failed: ${sanitizeError(err)}`);
      return null;
    }
  },

  async fetchArticlesByCategory(categorySlug: string) {
    const items = await safeFetchAll(
      collection,
      `filters[${mf("category")}][slug][$eq]=${encodeURIComponent(categorySlug)}&sort=publishedAt:desc`,
      "cover,category,author,author.avatar",
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async searchArticlesByQuery(query: string) {
    const items = await safeFetchAll(
      collection,
      `filters[${mf("headline")}][$containsi]=${encodeURIComponent(query)}&sort=publishedAt:desc`,
      "cover,category,author,author.avatar",
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchArticleSlugs() {
    const items = await fetchAllPaginated(
      collection,
      `fields[0]=${mf("slug")}&fields[1]=updatedAt`,
    );
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        slug: String(item[mf("slug")] ?? ""),
        updatedAt: String(item.updatedAt ?? ""),
      };
    }) as unknown as Array<{ slug: string; modified?: string }>;
  },

  async fetchAllCategories() {
    const items = await safeFetchAll("categories", "sort=name:asc");
    return items.map((i) => mapCategory(i as Record<string, unknown>)) as unknown as Category[];
  },

  async fetchCategoryBySlug(slug: string) {
    const item = await safeFetchFirst(
      "categories",
      `filters[slug][$eq]=${encodeURIComponent(slug)}`,
    );
    if (!item) return null;
    return mapCategory(item as Record<string, unknown>) as unknown as Category;
  },

  async fetchAllAuthors() {
    const items = await safeFetchAll("authors", "sort=name:asc");
    return items.map((i) => mapAuthor(i as Record<string, unknown>)) as unknown as Author[];
  },

  async fetchAuthorBySlug(slug: string) {
    const item = await safeFetchFirst(
      "authors",
      `filters[slug][$eq]=${encodeURIComponent(slug)}`,
    );
    if (!item) return null;
    return mapAuthor(item as Record<string, unknown>) as unknown as Author;
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const items = await safeFetchAll(
      collection,
      `filters[${mf("author")}][slug][$eq]=${encodeURIComponent(authorSlug)}&sort=publishedAt:desc`,
      "cover,category,author,author.avatar",
    );
    return items.map((i) => mapItem(i as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchNewsticker() {
    const items = await safeFetchAll(
      "newsticker-items",
      "sort=createdAt:desc&pagination[pageSize]=20",
    );
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        headline: String(item.headline ?? ""),
        text: String(item.text ?? ""),
        timestamp: String(item.publishedAt ?? item.createdAt ?? ""),
        url: String(item.url ?? ""),
      };
    }) as unknown as NewstickerItem[];
  },

  async fetchVideos() {
    const items = await safeFetchAll("videos", "sort=createdAt:desc");
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        url: String(item.url ?? ""),
        thumbnail: String(item.thumbnail ?? ""),
        duration: Number(item.duration ?? 0),
        publishedAt: String(item.publishedAt ?? item.createdAt ?? ""),
      };
    }) as unknown as Video[];
  },

  async fetchNavigation() {
    const item = await safeFetchFirst("navigations");
    if (!item) return { items: [] } as unknown as Navigation;
    const nav = item as Record<string, unknown>;
    return {
      items: Array.isArray(nav.items) ? nav.items : [],
    } as unknown as Navigation;
  },

  async fetchSiteConfig() {
    const item = await safeFetchFirst("site-configs");
    if (!item) return {} as unknown as SiteConfig;
    return item as unknown as SiteConfig;
  },

  async fetchBreakingNews() {
    const items = await safeFetchAll(
      "breaking-news",
      "sort=createdAt:desc&pagination[pageSize]=5",
    );
    return items.map((i) => {
      const item = i as Record<string, unknown>;
      return {
        id: String(item.id ?? ""),
        headline: String(item.headline ?? ""),
        text: String(item.text ?? ""),
        url: String(item.url ?? ""),
        severity: String(item.severity ?? "normal"),
        timestamp: String(item.publishedAt ?? item.createdAt ?? ""),
      };
    }) as unknown as BreakingNews[];
  },

  async fetchQuiz() {
    const item = await safeFetchFirst("quizzes", "sort=createdAt:desc");
    if (!item) return null as unknown as Quiz;
    const quiz = item as Record<string, unknown>;
    return {
      id: String(quiz.id ?? ""),
      title: String(quiz.title ?? ""),
      questions: Array.isArray(quiz.questions) ? quiz.questions : [],
    } as unknown as Quiz;
  },

  async fetchStockData() {
    const item = await safeFetchFirst("stock-data", "sort=updatedAt:desc");
    if (!item) return null as unknown as StockData;
    const stock = item as Record<string, unknown>;
    return {
      stocks: Array.isArray(stock.stocks) ? stock.stocks : [],
      updatedAt: String(stock.updatedAt ?? ""),
    } as unknown as StockData;
  },
};

export default strapiAdapter as unknown as CmsAdapter;
