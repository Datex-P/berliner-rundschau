import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import { safeFetch, sanitizeError } from "./http";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";

/* ---------- config ---------- */

const baseUrl = process.env.PAYLOAD_URL!.replace(/\/$/, "");
const collection = process.env.PAYLOAD_ARTICLE_COLLECTION ?? "articles";
const fieldMap = parseFieldMap(process.env.PAYLOAD_FIELD_MAP);

/** Shorthand for mapField with the module-level fieldMap. */
function mf(name: string): string {
  return mapField(fieldMap, name);
}

/* ---------- fetch helpers ---------- */

/** Build auth + accept headers for every Payload request. */
function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const key = process.env.PAYLOAD_API_KEY;
  if (key) h["Authorization"] = `users API-Key ${key}`;
  return h;
}

/** Fetch a single Payload REST endpoint and parse JSON. */
async function payloadFetch<T>(path: string): Promise<T> {
  const res = await safeFetch(`${baseUrl}/api${path}`, { headers: headers() });
  return res.json() as Promise<T>;
}

/** Paginate through all documents of a Payload collection. */
async function fetchAllDocs(col: string, extraParams = "") {
  const items: unknown[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const sep = extraParams ? `&${extraParams}` : "";
    const res = await payloadFetch<{ docs: unknown[]; totalPages: number }>(
      `/${col}?limit=100&page=${page}&depth=2${sep}`,
    );
    if (Array.isArray(res.docs)) items.push(...res.docs);
    totalPages = res.totalPages;
    page++;
  }

  return items;
}

/** Safely fetch all documents; returns [] on error. */
async function safeFetchAllDocs(
  col: string,
  extraParams = "",
) {
  try {
    return await fetchAllDocs(col, extraParams);
  } catch (err: unknown) {
    console.warn(
      `[payload] safeFetchAllDocs(${col}) failed: ${sanitizeError(err)}`,
    );
    return [];
  }
}

/** Safely fetch a single document by query; returns null on error or not found. */
async function safeFetchFirstDoc(
  col: string,
  extraParams = "",
) {
  try {
    const sep = extraParams ? `&${extraParams}` : "";
    const res = await payloadFetch<{ docs: unknown[] }>(
      `/${col}?limit=1&depth=2${sep}`,
    );
    return Array.isArray(res.docs) && res.docs.length > 0 ? res.docs[0] : null;
  } catch (err: unknown) {
    console.warn(
      `[payload] safeFetchFirstDoc(${col}) failed: ${sanitizeError(err)}`,
    );
    return null;
  }
}

/* ---------- Lexical rich text → HTML ---------- */

/** Convert a Lexical JSON node tree to an HTML string. */
function nodesToHtml(nodes: unknown[]): string {
  return nodes.map(nodeToHtml).join("");
}

/** Convert a single Lexical node to HTML. */
function nodeToHtml(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  const type = String(n.type ?? "");
  const children = Array.isArray(n.children) ? n.children : [];

  switch (type) {
    case "paragraph":
      return `<p>${nodesToHtml(children)}</p>`;
    case "heading": {
      const tag = String(n.tag ?? "h2");
      return `<${tag}>${nodesToHtml(children)}</${tag}>`;
    }
    case "text": {
      let text = String(n.text ?? "");
      const format = Number(n.format ?? 0);
      if (format & 1) text = `<strong>${text}</strong>`;
      if (format & 2) text = `<em>${text}</em>`;
      if (format & 4) text = `<s>${text}</s>`;
      if (format & 8) text = `<u>${text}</u>`;
      if (format & 16) text = `<code>${text}</code>`;
      return text;
    }
    case "list": {
      const tag = n.listType === "number" ? "ol" : "ul";
      return `<${tag}>${nodesToHtml(children)}</${tag}>`;
    }
    case "listitem":
      return `<li>${nodesToHtml(children)}</li>`;
    case "quote":
      return `<blockquote>${nodesToHtml(children)}</blockquote>`;
    case "link": {
      const url =
        typeof n.fields === "object" && n.fields
          ? String((n.fields as Record<string, unknown>).url ?? "")
          : String(n.url ?? "");
      return `<a href="${url}">${nodesToHtml(children)}</a>`;
    }
    case "upload": {
      const value = n.value as Record<string, unknown> | undefined;
      if (value) {
        const url = String(value.url ?? "");
        const alt = String(value.alt ?? "");
        return url ? `<img src="${url}" alt="${alt}">` : "";
      }
      return "";
    }
    case "horizontalrule":
      return "<hr>";
    case "linebreak":
      return "<br>";
    default:
      return nodesToHtml(children);
  }
}

/**
 * Convert Payload Lexical rich-text JSON to an HTML string.
 * Accepts a string (pass-through), a Lexical root object, or null/undefined.
 */
function lexicalToHtml(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";

  const root = (content as Record<string, unknown>).root;
  if (!root || typeof root !== "object") return "";

  const children = (root as Record<string, unknown>).children;
  if (!Array.isArray(children)) return "";

  return nodesToHtml(children);
}

/* ---------- URL helpers ---------- */

/** Prefix relative URLs with the Payload base URL. */
function resolveUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${baseUrl}${url}`;
}

/* ---------- item mappers ---------- */

/** Map a raw Payload document to the normalized article shape. */
function mapDoc(doc: Record<string, unknown>): unknown {
  const bodyField = doc[mf("body")];
  const bodyHtml = sanitizeRichText(lexicalToHtml(bodyField));

  // Image — resolved upload relation, or fallback to imageUrl text field
  const imgField = doc[mf("image")] as Record<string, unknown> | null;
  const imgUrl = imgField?.url
    ? resolveUrl(String(imgField.url))
    : doc.imageUrl
      ? String(doc.imageUrl)
      : null;

  // Category — resolved relation
  const cat = doc[mf("category")] as Record<string, unknown> | null;

  // Author — resolved relation
  const auth = doc[mf("author")] as Record<string, unknown> | null;
  const authAvatar = auth?.avatar as Record<string, unknown> | null;
  const avatarUrl = authAvatar?.url
    ? resolveUrl(String(authAvatar.url))
    : auth?.avatarUrl
      ? String(auth.avatarUrl)
      : "";

  // Tags — may be string[] or object[] with .name / .tag
  const rawTags = doc[mf("tags")];
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t: unknown) =>
        typeof t === "string"
          ? t
          : String(
              (t as Record<string, unknown>).name ??
                (t as Record<string, unknown>).tag ??
                "",
            ),
      )
    : [];

  return {
    id: String(doc.id ?? ""),
    headline: String(doc[mf("headline")] ?? doc[mf("title")] ?? ""),
    slug: String(doc[mf("slug")] ?? ""),
    teaser: String(doc[mf("teaser")] ?? ""),
    body: bodyHtml,
    publicationDate: String(doc.publishedAt ?? doc.createdAt ?? ""),
    updatedAt: String(doc.updatedAt ?? ""),
    image: normalizeImage(
      imgUrl,
      imgField ? String(imgField.alt ?? "") : undefined,
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
          name: String(auth.name ?? ""),
          slug: String(auth.slug ?? ""),
          avatar: avatarUrl,
        }
      : { id: "", name: "", slug: "", avatar: "" },
    tags,
    readingTimeMinutes: Number(doc[mf("readingTimeMinutes")] ?? 0),
    commentCount: 0,
    isPremium: doc[mf("isPremium")] === true,
    paywall: String(doc[mf("paywall")] ?? "free"),
    isLive: doc[mf("isLive")] === true,
    isOpinion: doc[mf("isOpinion")] === true,
    isFeatured: doc[mf("isFeatured")] === true,
    isBreaking: doc[mf("isBreaking")] === true,
    aiSummary: String(doc[mf("aiSummary")] ?? ""),
    region: String(doc[mf("region")] ?? ""),
    comments: [],
  };
}

/** Map a raw Payload category document. */
function mapCategory(doc: Record<string, unknown>): unknown {
  return {
    id: String(doc.id ?? ""),
    name: String(doc.name ?? ""),
    slug: String(doc.slug ?? ""),
    description: String(doc.description ?? ""),
    color: String(doc.color ?? ""),
  };
}

/** Map a raw Payload author document. */
function mapAuthor(doc: Record<string, unknown>): unknown {
  const avatarField = doc.avatar as Record<string, unknown> | null;
  const avatarUrl = avatarField?.url
    ? resolveUrl(String(avatarField.url))
    : doc.avatarUrl
      ? String(doc.avatarUrl)
      : "";

  return {
    id: String(doc.id ?? ""),
    name: String(doc.name ?? ""),
    slug: String(doc.slug ?? ""),
    bio: String(doc.bio ?? ""),
    avatar: avatarUrl,
    role: String(doc.role ?? ""),
  };
}

/* ---------- adapter ---------- */

const payloadAdapter = {
  name: "payload",

  async fetchAllArticles() {
    const docs = await fetchAllDocs(collection, "sort=-createdAt");
    return docs.map((d) => mapDoc(d as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    const doc = await safeFetchFirstDoc(
      collection,
      `where[${mf("slug")}][equals]=${encodeURIComponent(slug)}`,
    );
    if (!doc) return null;
    return mapDoc(doc as Record<string, unknown>) as unknown as Article;
  },

  async fetchArticlesByCategory(categorySlug: string) {
    const docs = await safeFetchAllDocs(
      collection,
      `where[${mf("category")}.slug][equals]=${encodeURIComponent(categorySlug)}&sort=-createdAt`,
    );
    return docs.map((d) => mapDoc(d as Record<string, unknown>)) as unknown as Article[];
  },

  async searchArticlesByQuery(query: string) {
    const encoded = encodeURIComponent(query);
    const docs = await safeFetchAllDocs(
      collection,
      `where[or][0][${mf("headline")}][like]=${encoded}&where[or][1][${mf("teaser")}][like]=${encoded}&sort=-createdAt`,
    );
    return docs.map((d) => mapDoc(d as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchArticleSlugs() {
    const docs = await fetchAllDocs(collection, "sort=-createdAt");
    return docs.map((d) => {
      const doc = d as Record<string, unknown>;
      return {
        slug: String(doc[mf("slug")] ?? ""),
        updatedAt: String(doc.updatedAt ?? ""),
      };
    });
  },

  async fetchAllCategories() {
    const docs = await safeFetchAllDocs("categories", "sort=name");
    return docs.map((d) => mapCategory(d as Record<string, unknown>)) as unknown as Category[];
  },

  async fetchCategoryBySlug(slug: string) {
    const doc = await safeFetchFirstDoc(
      "categories",
      `where[slug][equals]=${encodeURIComponent(slug)}`,
    );
    if (!doc) return null;
    return mapCategory(doc as Record<string, unknown>) as unknown as Category;
  },

  async fetchAllAuthors() {
    const docs = await safeFetchAllDocs("authors", "sort=name");
    return docs.map((d) => mapAuthor(d as Record<string, unknown>)) as unknown as Author[];
  },

  async fetchAuthorBySlug(slug: string) {
    const doc = await safeFetchFirstDoc(
      "authors",
      `where[slug][equals]=${encodeURIComponent(slug)}`,
    );
    if (!doc) return null;
    return mapAuthor(doc as Record<string, unknown>) as unknown as Author;
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const docs = await safeFetchAllDocs(
      collection,
      `where[${mf("author")}.slug][equals]=${encodeURIComponent(authorSlug)}&sort=-createdAt`,
    );
    return docs.map((d) => mapDoc(d as Record<string, unknown>)) as unknown as Article[];
  },

  async fetchNewsticker() {
    const docs = await safeFetchAllDocs(
      "newsticker",
      "sort=-createdAt&limit=20",
    );
    return docs.map((d) => {
      const doc = d as Record<string, unknown>;
      const headlineText = String(doc.headline ?? "");
      const slug = headlineText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return {
        id: String(doc.id ?? ""),
        type: "TimelineTeaser",
        topic: String(doc.topic ?? ""),
        headline: {
          label: headlineText,
          href: `/artikel/${slug}`,
        },
        publicationDate: String(doc.createdAt ?? ""),
        isPremium: doc.isPremium === true,
      };
    }) as unknown as NewstickerItem[];
  },

  async fetchVideos() {
    const docs = await safeFetchAllDocs("videos", "sort=-createdAt");
    return docs.map((d) => {
      const doc = d as Record<string, unknown>;
      return {
        id: String(doc.id ?? ""),
        title: String(doc.title ?? ""),
        sources: [
          {
            src: String(doc.url ?? ""),
            extension: "mp4",
          },
        ],
        poster: String(doc.thumbnail ?? ""),
        durationSeconds: Number(doc.duration ?? 0),
        caption: String(doc.caption ?? ""),
        category: String(doc.category ?? ""),
        publishedAt: String(doc.createdAt ?? ""),
      };
    }) as unknown as Video[];
  },

  async fetchNavigation() {
    const doc = await safeFetchFirstDoc("navigation");
    if (!doc) return { primaryMenu: [], footerMenu: [], socialLinks: [] } as unknown as Navigation;
    const nav = doc as Record<string, unknown>;
    const items = Array.isArray(nav.items) ? nav.items : [];
    return {
      primaryMenu: items.map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
          reference: {
            type: "SECTION",
            href: String(i.href ?? "/"),
            label: String(i.label ?? ""),
            isActive: i.isActive === true,
          },
          commercial: false,
        };
      }),
      footerMenu: Array.isArray(nav.footerMenu) ? nav.footerMenu : [],
      socialLinks: Array.isArray(nav.socialLinks) ? nav.socialLinks : [],
    } as unknown as Navigation;
  },

  async fetchSiteConfig() {
    const doc = await safeFetchFirstDoc("site-config");
    if (!doc) return {} as unknown as SiteConfig;
    const cfg = doc as Record<string, unknown>;
    return {
      title: String(cfg.siteName ?? ""),
      description: String(cfg.siteDescription ?? ""),
      socialLinks: Array.isArray(cfg.socialLinks) ? cfg.socialLinks : [],
    } as unknown as SiteConfig;
  },

  async fetchBreakingNews() {
    const docs = await safeFetchAllDocs(
      "breaking-news",
      "sort=-createdAt&limit=5",
    );
    return docs.map((d) => {
      const doc = d as Record<string, unknown>;
      return {
        id: String(doc.id ?? ""),
        headline: String(doc.headline ?? ""),
        href: String(doc.url ?? ""),
        severity: String(doc.severity ?? "normal"),
        publishedAt: String(doc.createdAt ?? ""),
      };
    }) as unknown as BreakingNews[];
  },

  async fetchQuiz() {
    const doc = await safeFetchFirstDoc("quiz", "sort=-createdAt");
    if (!doc) return null;
    const quiz = doc as Record<string, unknown>;
    return {
      id: String(quiz.id ?? ""),
      date: String(quiz.date ?? new Date().toISOString().slice(0, 10)),
      title: String(quiz.title ?? ""),
      questions: Array.isArray(quiz.questions) ? quiz.questions : [],
      streakRewards: Array.isArray(quiz.streakRewards)
        ? quiz.streakRewards
        : [],
    } as unknown as Quiz;
  },

  async fetchStockData() {
    const doc = await safeFetchFirstDoc("stock-data", "sort=-updatedAt");
    if (!doc) return null;
    const stock = doc as Record<string, unknown>;
    return {
      indices: Array.isArray(stock.indices) ? stock.indices : [],
      watchlist: Array.isArray(stock.watchlist) ? stock.watchlist : [],
      chartData: stock.chartData ?? {},
      updatedAt: String(stock.updatedAt ?? ""),
    } as unknown as StockData;
  },
};

export default payloadAdapter as unknown as CmsAdapter;
