import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap } from "./field-map";
import { safeFetch, sanitizeError } from "./http";

/* ---------- config ---------- */

const baseUrl = process.env.WORDPRESS_URL!.replace(/\/$/, "");
const postType = process.env.WORDPRESS_POST_TYPE ?? "posts";
const fieldMap = parseFieldMap(process.env.WORDPRESS_FIELD_MAP);

/**
 * WordPress.com sites don't expose /wp-json/wp/v2/ — they use
 * public-api.wordpress.com/wp/v2/sites/{host}/ instead.
 * Set WORDPRESS_API_BASE to override the default self-hosted path.
 */
const apiBase = (
  process.env.WORDPRESS_API_BASE ?? `${baseUrl}/wp-json/wp/v2`
).replace(/\/$/, "");

/* ---------- auth ---------- */

function authHeaders(): Record<string, string> {
  const bearer = process.env.WORDPRESS_BEARER_TOKEN;
  if (bearer) {
    return { Authorization: `Bearer ${bearer}` };
  }
  const user = process.env.WORDPRESS_USERNAME;
  const pass = process.env.WORDPRESS_APP_PASSWORD;
  if (user && pass) {
    return {
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
    };
  }
  return {};
}

/* ---------- fetch helpers ---------- */

async function wpFetch<T>(path: string): Promise<T> {
  const res = await safeFetch(`${apiBase}${path}`, {
    headers: { ...authHeaders(), Accept: "application/json" },
  });
  return res.json() as Promise<T>;
}

/**
 * Paginate through all items of a WP REST endpoint.
 * Uses `X-WP-TotalPages` header for page count.
 */
async function fetchAllPaginated(
  endpoint: string,
  extraParams = "",
): Promise<unknown[]> {
  const items: unknown[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${apiBase}/${endpoint}?per_page=100&page=${page}&_embed${extraParams}`;
    const res = await safeFetch(url, {
      headers: { ...authHeaders(), Accept: "application/json" },
    });
    totalPages = Number(res.headers.get("X-WP-TotalPages") ?? 1);
    const data: unknown = await res.json();
    if (Array.isArray(data)) items.push(...data);
    page++;
  }

  return items;
}

/* ---------- mappers ---------- */

function mapPost(post: Record<string, unknown>): unknown {
  const title = (post.title as Record<string, unknown>)?.rendered ?? "";
  const excerpt = (post.excerpt as Record<string, unknown>)?.rendered ?? "";
  const content = (post.content as Record<string, unknown>)?.rendered ?? "";

  const embedded = (post._embedded ?? {}) as Record<string, unknown>;

  /* Featured image */
  const mediaArr = embedded["wp:featuredmedia"] as unknown[] | undefined;
  const media = mediaArr?.[0] as Record<string, unknown> | undefined;
  const mediaDetails = media?.media_details as
    Record<string, unknown> | undefined;
  const sizes = mediaDetails?.sizes as Record<string, unknown> | undefined;
  const fullSize = sizes?.full as Record<string, unknown> | undefined;

  /* Taxonomy terms: [[categories], [tags]] */
  const termGroups = embedded["wp:term"] as unknown[][] | undefined;
  const categories = termGroups?.[0] as Record<string, unknown>[] | undefined;
  const tags = termGroups?.[1] as Record<string, unknown>[] | undefined;
  const firstCat = categories?.[0];

  /* Author */
  const authors = embedded.author as Record<string, unknown>[] | undefined;
  const firstAuthor = authors?.[0];

  /* Field-map overrides: allow mapping internal field names to WP custom fields */
  const fm = fieldMap;
  const customFields = (post.acf ?? post.meta ?? {}) as Record<string, unknown>;

  return {
    id: String(post.id ?? ""),
    headline: sanitizeRichText(String(title)),
    slug: String(post.slug ?? ""),
    teaser: sanitizeRichText(String(excerpt)),
    body: sanitizeRichText(String(content)),
    publicationDate: String(post.date ?? ""),
    updatedAt: String(post.modified ?? ""),
    image: normalizeImage(
      media ? String(media.source_url ?? "") : null,
      media ? String(media.alt_text ?? "") : undefined,
      fullSize ? Number(fullSize.width ?? 0) : undefined,
      fullSize ? Number(fullSize.height ?? 0) : undefined,
    ),
    category: firstCat
      ? {
          id: String(firstCat.id ?? ""),
          name: String(firstCat.name ?? ""),
          slug: String(firstCat.slug ?? ""),
        }
      : { id: "", name: "", slug: "" },
    author: firstAuthor
      ? {
          id: String(firstAuthor.id ?? ""),
          name: String(firstAuthor.name ?? ""),
          slug: String(firstAuthor.slug ?? ""),
          avatar: String(
            (firstAuthor.avatar_urls as Record<string, unknown>)?.["96"] ?? "",
          ),
        }
      : { id: "", name: "", slug: "", avatar: "" },
    tags: tags ? tags.map((t) => String(t.name ?? "")) : [],
    readingTimeMinutes: Number(customFields[fm.readingTimeMinutes ?? ""] ?? 0),
    commentCount: Number(post.comment_count ?? 0),
    isPremium: customFields[fm.isPremium ?? ""] === true,
    paywall: String(customFields[fm.paywall ?? ""] ?? "free"),
    isLive: customFields[fm.isLive ?? ""] === true,
    isOpinion: customFields[fm.isOpinion ?? ""] === true,
    isFeatured: post.sticky === true,
    isBreaking: customFields[fm.isBreaking ?? ""] === true,
    aiSummary: String(customFields[fm.aiSummary ?? ""] ?? ""),
    region: String(customFields[fm.region ?? ""] ?? ""),
    comments: [],
  };
}

function mapCategory(cat: Record<string, unknown>): unknown {
  return {
    id: String(cat.id ?? ""),
    name: String(cat.name ?? ""),
    slug: String(cat.slug ?? ""),
    description: String(cat.description ?? ""),
    count: Number(cat.count ?? 0),
  };
}

function mapAuthor(user: Record<string, unknown>): unknown {
  const avatarUrls = (user.avatar_urls ?? {}) as Record<string, unknown>;
  return {
    id: String(user.id ?? ""),
    name: String(user.name ?? ""),
    slug: String(user.slug ?? ""),
    bio: String(user.description ?? ""),
    avatar: String(avatarUrls["96"] ?? ""),
    role: "",
  };
}

/* ---------- adapter ---------- */

const wordpressAdapter: CmsAdapter = {
  name: "wordpress",

  async fetchAllArticles(): Promise<unknown[]> {
    const items = await fetchAllPaginated(postType);
    return (items as Record<string, unknown>[]).map(mapPost);
  },

  async fetchArticleBySlug(slug: string): Promise<unknown | null> {
    const items = await wpFetch<Record<string, unknown>[]>(
      `/${postType}?slug=${encodeURIComponent(slug)}&_embed`,
    );
    if (!Array.isArray(items) || items.length === 0) return null;
    return mapPost(items[0]);
  },

  async fetchArticlesByCategory(categorySlug: string): Promise<unknown[]> {
    /* Resolve category ID by slug first */
    const cats = await wpFetch<Record<string, unknown>[]>(
      `/categories?slug=${encodeURIComponent(categorySlug)}`,
    );
    if (!Array.isArray(cats) || cats.length === 0) return [];
    const catId = String(cats[0].id ?? "");
    if (!catId) return [];

    const items = await fetchAllPaginated(
      postType,
      `&categories=${encodeURIComponent(catId)}`,
    );
    return (items as Record<string, unknown>[]).map(mapPost);
  },

  async searchArticlesByQuery(query: string): Promise<unknown[]> {
    const items = await wpFetch<Record<string, unknown>[]>(
      `/${postType}?search=${encodeURIComponent(query)}&_embed`,
    );
    if (!Array.isArray(items)) return [];
    return items.map(mapPost);
  },

  async fetchArticleSlugs(): Promise<unknown[]> {
    /* Lightweight fetch: only slug + modified, no _embed */
    const items: unknown[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const url = `${apiBase}/${postType}?per_page=100&page=${page}&_fields=slug,modified`;
      const res = await safeFetch(url, {
        headers: { ...authHeaders(), Accept: "application/json" },
      });
      totalPages = Number(res.headers.get("X-WP-TotalPages") ?? 1);
      const data: unknown = await res.json();
      if (Array.isArray(data)) {
        for (const item of data as Record<string, unknown>[]) {
          items.push({
            slug: String(item.slug ?? ""),
            updatedAt: String(item.modified ?? ""),
          });
        }
      }
      page++;
    }

    return items;
  },

  async fetchAllCategories(): Promise<unknown[]> {
    try {
      const items = await fetchAllPaginated("categories", "&hide_empty=true");
      return (items as Record<string, unknown>[]).map(mapCategory);
    } catch (err: unknown) {
      console.error(
        "[wordpress] fetchAllCategories failed:",
        sanitizeError(err),
      );
      return [];
    }
  },

  async fetchCategoryBySlug(slug: string): Promise<unknown | null> {
    try {
      const items = await wpFetch<Record<string, unknown>[]>(
        `/categories?slug=${encodeURIComponent(slug)}`,
      );
      if (!Array.isArray(items) || items.length === 0) return null;
      return mapCategory(items[0]);
    } catch (err: unknown) {
      console.error(
        "[wordpress] fetchCategoryBySlug failed:",
        sanitizeError(err),
      );
      return null;
    }
  },

  async fetchAllAuthors(): Promise<unknown[]> {
    try {
      const items = await fetchAllPaginated("users");
      return (items as Record<string, unknown>[]).map(mapAuthor);
    } catch (err: unknown) {
      console.error("[wordpress] fetchAllAuthors failed:", sanitizeError(err));
      return [];
    }
  },

  async fetchAuthorBySlug(slug: string): Promise<unknown | null> {
    try {
      const items = await wpFetch<Record<string, unknown>[]>(
        `/users?slug=${encodeURIComponent(slug)}`,
      );
      if (!Array.isArray(items) || items.length === 0) return null;
      return mapAuthor(items[0]);
    } catch (err: unknown) {
      console.error(
        "[wordpress] fetchAuthorBySlug failed:",
        sanitizeError(err),
      );
      return null;
    }
  },

  async fetchArticlesByAuthor(authorSlug: string): Promise<unknown[]> {
    /* Resolve author ID by slug first */
    const users = await wpFetch<Record<string, unknown>[]>(
      `/users?slug=${encodeURIComponent(authorSlug)}`,
    );
    if (!Array.isArray(users) || users.length === 0) return [];
    const authorId = String(users[0].id ?? "");
    if (!authorId) return [];

    const items = await fetchAllPaginated(
      postType,
      `&author=${encodeURIComponent(authorId)}`,
    );
    return (items as Record<string, unknown>[]).map(mapPost);
  },

  /* WordPress has no built-in newsticker endpoint */
  async fetchNewsticker(): Promise<unknown[]> {
    return [];
  },

  /* WordPress has no built-in video endpoint */
  async fetchVideos(): Promise<unknown[]> {
    return [];
  },

  /* WordPress menus via the REST API v2 (requires WP 5.9+ block themes or nav menu plugin) */
  async fetchNavigation(): Promise<unknown> {
    try {
      const menus = await wpFetch<Record<string, unknown>[]>(
        "/menu-items?menus=primary&per_page=100",
      );
      if (!Array.isArray(menus)) return { items: [] };
      return {
        items: menus.map((item) => ({
          id: String(item.id ?? ""),
          title: String(
            (item.title as Record<string, unknown>)?.rendered ?? "",
          ),
          url: String(item.url ?? ""),
          parent: item.parent ? String(item.parent) : null,
          order: Number(item.menu_order ?? 0),
        })),
      };
    } catch {
      return { items: [] };
    }
  },

  /* Use WP Site Settings from the index endpoint */
  async fetchSiteConfig(): Promise<unknown> {
    try {
      const res = await safeFetch(`${baseUrl}/wp-json`, {
        headers: { ...authHeaders(), Accept: "application/json" },
      });
      const data = (await res.json()) as Record<string, unknown>;
      return {
        name: String(data.name ?? ""),
        description: String(data.description ?? ""),
        url: String(data.url ?? ""),
        timezone: String(data.timezone_string ?? ""),
      };
    } catch {
      return {};
    }
  },

  /* WordPress has no built-in breaking news endpoint */
  async fetchBreakingNews(): Promise<unknown[]> {
    return [];
  },

  /* WordPress has no built-in quiz endpoint */
  async fetchQuiz(): Promise<unknown> {
    return null;
  },

  /* WordPress has no built-in stock data endpoint */
  async fetchStockData(): Promise<unknown> {
    return null;
  },
};

export default wordpressAdapter;
