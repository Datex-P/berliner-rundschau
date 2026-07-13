import { executeQuery } from "@datocms/cda-client";
import { render } from "datocms-structured-text-to-html-string";
import type { CmsAdapter } from "./types";
import { sanitizeRichText } from "./sanitize";
import { normalizeImage } from "./image-utils";
import { parseFieldMap, mapField } from "./field-map";
import type { Article, Category, Author, NewstickerItem, Video, Navigation, SiteConfig, BreakingNews, Quiz, StockData } from "@/types";

// --- Config ---

const token = process.env.DATOCMS_API_TOKEN ?? "";
const environment = process.env.DATOCMS_ENVIRONMENT ?? "main";
const articleModel = process.env.DATOCMS_ARTICLE_MODEL ?? "article";
const fieldMap = parseFieldMap(process.env.DATOCMS_FIELD_MAP);

// --- Query helper ---

async function query<T>(
  q: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return executeQuery(q, { token, environment, variables });
}

// --- Structured Text rendering ---

function renderStructuredText(field: unknown): string {
  if (!field || typeof field !== "object") return "";
  const obj = field as Record<string, unknown>;
  if (!("value" in obj)) return "";
  try {
    const html = render(obj.value as Parameters<typeof render>[0]);
    return sanitizeRichText(html ?? "");
  } catch (error) {
    console.error('[DatoCMS] Structured-Text-Rendering fehlgeschlagen:', error instanceof Error ? error.message : error)
    return "";
  }
}

// --- Record mappers ---

function mapArticleRecord(record: Record<string, unknown>): unknown {
  const fm = fieldMap;
  const bodyField = record[mapField(fm, "body")];
  const bodyHtml = renderStructuredText(bodyField);

  const img = record[mapField(fm, "image")] as Record<string, unknown> | null;
  const cat = record[mapField(fm, "category")] as Record<
    string,
    unknown
  > | null;
  const auth = record[mapField(fm, "author")] as Record<string, unknown> | null;
  const avatar = auth ? (auth.avatar as Record<string, unknown> | null) : null;

  return {
    id: String(record.id ?? ""),
    headline: String(
      record[mapField(fm, "headline")] ?? record[mapField(fm, "title")] ?? "",
    ),
    slug: String(record[mapField(fm, "slug")] ?? ""),
    teaser: String(record[mapField(fm, "teaser")] ?? ""),
    body: bodyHtml,
    publicationDate: String(record._createdAt ?? ""),
    updatedAt: String(record._updatedAt ?? ""),
    image: normalizeImage(
      img ? String(img.url ?? "") : null,
      img ? String(img.alt ?? "") : undefined,
      img ? Number(img.width ?? 0) : undefined,
      img ? Number(img.height ?? 0) : undefined,
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
          avatar: avatar
            ? String((avatar as Record<string, unknown>).url ?? "")
            : "",
        }
      : { id: "", name: "", slug: "", avatar: "" },
    tags: (() => {
      const t = record[mapField(fm, "tags")];
      if (Array.isArray(t)) return t.filter((v): v is string => typeof v === 'string');
      if (
        t &&
        typeof t === "object" &&
        Array.isArray((t as Record<string, unknown>).list)
      ) {
        const list = (t as Record<string, unknown>).list;
        return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [];
      }
      return [];
    })(),
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

function mapCategoryRecord(record: Record<string, unknown>): unknown {
  return {
    id: String(record.id ?? ""),
    name: String(record.name ?? ""),
    slug: String(record.slug ?? ""),
    path: `/${String(record.slug ?? "")}`,
    description: String(record.description ?? ""),
    color: String(record.color ?? ""),
    children: [],
    articleCount: 0,
  };
}

function mapAuthorRecord(record: Record<string, unknown>): unknown {
  const avatar = record.avatar as Record<string, unknown> | null;
  return {
    id: String(record.id ?? ""),
    name: String(record.name ?? ""),
    slug: String(record.slug ?? ""),
    avatar: avatar ? String((avatar as Record<string, unknown>).url ?? "") : "",
    bio: String(record.bio ?? ""),
    role: String(record.role ?? ""),
    socialLinks: {},
  };
}

// --- GraphQL query fragments ---

const ARTICLE_FIELDS = `
  id
  ${mapField(fieldMap, "title")}
  slug
  ${mapField(fieldMap, "teaser")}
  ${mapField(fieldMap, "body")} { value }
  _createdAt
  _updatedAt
  ${mapField(fieldMap, "image")} { url alt width height }
  ${mapField(fieldMap, "category")} { id name slug }
  ${mapField(fieldMap, "author")} { id name slug avatar { url } }
  ${mapField(fieldMap, "tags")}
  ${mapField(fieldMap, "readingTimeMinutes")}
  ${mapField(fieldMap, "isPremium")}
  ${mapField(fieldMap, "paywall")}
  ${mapField(fieldMap, "isLive")}
  ${mapField(fieldMap, "isOpinion")}
  ${mapField(fieldMap, "isFeatured")}
  ${mapField(fieldMap, "isBreaking")}
  ${mapField(fieldMap, "aiSummary")}
  ${mapField(fieldMap, "region")}
`;

// Capitalize first letter for DatoCMS model naming convention
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Build the "all<Model>s" query name from model name (e.g. "article" -> "allArticles")
function allModelQuery(model: string): string {
  return `all${capitalize(model)}s`;
}

function allModelMeta(model: string): string {
  return `_all${capitalize(model)}sMeta`;
}

// --- Adapter implementation ---

const adapter = {
  name: "datocms",

  async fetchAllArticles() {
    const allQuery = allModelQuery(articleModel);
    const metaQuery = allModelMeta(articleModel);
    const items: unknown[] = [];
    let skip = 0;
    const first = 100;
    const q = `
      query AllArticles($first: IntType!, $skip: IntType!) {
        ${allQuery}(first: $first, skip: $skip, orderBy: _createdAt_DESC) {
          ${ARTICLE_FIELDS}
        }
        ${metaQuery} { count }
      }
    `;

    for (;;) {
      const result = await query<Record<string, unknown>>(q, { first, skip });
      const batch = result[allQuery];
      if (!Array.isArray(batch) || batch.length === 0) break;
      items.push(
        ...batch.map((r) => mapArticleRecord(r as Record<string, unknown>)),
      );
      const meta = result[metaQuery] as Record<string, unknown> | undefined;
      const total = meta ? Number(meta.count ?? 0) : 0;
      skip += first;
      if (skip >= total) break;
    }

    return items as unknown as Article[];
  },

  async fetchArticleBySlug(slug: string) {
    const q = `
      query ArticleBySlug($slug: String!) {
        ${articleModel}(filter: { slug: { eq: $slug } }) {
          ${ARTICLE_FIELDS}
        }
      }
    `;
    const result = await query<Record<string, unknown>>(q, { slug });
    const record = result[articleModel] as Record<string, unknown> | null;
    return (record ? mapArticleRecord(record) : null) as unknown as Article | null;
  },

  async fetchArticlesByCategory(categorySlug: string) {
    // DatoCMS filters on linked records require the record ID, not slug.
    // Fetch all articles and filter client-side by category slug.
    const all = await this.fetchAllArticles();
    return (all as unknown as Record<string, unknown>[]).filter((a) => {
      const cat = a.category as Record<string, unknown> | undefined;
      return cat?.slug === categorySlug;
    }) as unknown as Article[];
  },

  async searchArticlesByQuery(searchQuery: string) {
    const allQuery = allModelQuery(articleModel);
    const q = `
      query SearchArticles($searchQuery: String!, $first: IntType!) {
        ${allQuery}(
          first: 20,
          orderBy: _createdAt_DESC,
          filter: { ${mapField(fieldMap, "title")}: { matches: { pattern: $searchQuery } } }
        ) {
          ${ARTICLE_FIELDS}
        }
      }
    `;
    try {
      const result = await query<Record<string, unknown>>(q, {
        searchQuery,
        first: 20,
      });
      const batch = result[allQuery];
      if (!Array.isArray(batch)) return [];
      return batch.map((r) => mapArticleRecord(r as Record<string, unknown>)) as unknown as Article[];
    } catch (error) {
      console.error('[DatoCMS] Artikel-Suche fehlgeschlagen, Fallback auf Client-Filter:', error instanceof Error ? error.message : error)
      const all = await this.fetchAllArticles();
      const lower = searchQuery.toLowerCase();
      return (all as unknown as Record<string, unknown>[]).filter((a) => {
        const headline = String(a.headline ?? "").toLowerCase();
        const teaser = String(a.teaser ?? "").toLowerCase();
        return headline.includes(lower) || teaser.includes(lower);
      }) as unknown as Article[];
    }
  },

  async fetchArticleSlugs() {
    const allQuery = allModelQuery(articleModel);
    const metaQuery = allModelMeta(articleModel);
    const slugs: unknown[] = [];
    let skip = 0;
    const first = 100;
    const q = `
      query ArticleSlugs($first: IntType!, $skip: IntType!) {
        ${allQuery}(first: $first, skip: $skip) {
          slug
        }
        ${metaQuery} { count }
      }
    `;

    for (;;) {
      const result = await query<Record<string, unknown>>(q, { first, skip });
      const batch = result[allQuery];
      if (!Array.isArray(batch) || batch.length === 0) break;
      slugs.push(
        ...batch.map((r) => ({
          slug: String((r as Record<string, unknown>).slug ?? ""),
        })),
      );
      const meta = result[metaQuery] as Record<string, unknown> | undefined;
      const total = meta ? Number(meta.count ?? 0) : 0;
      skip += first;
      if (skip >= total) break;
    }

    return slugs as unknown as Array<{ slug: string; modified?: string }>;
  },

  async fetchAllCategories() {
    try {
      const q = `
        query AllCategories {
          allCategories(first: 100) {
            id name slug description color
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const batch = result.allCategories;
      if (!Array.isArray(batch)) return [];
      return batch.map((r) => mapCategoryRecord(r as Record<string, unknown>)) as unknown as Category[];
    } catch (error) {
      console.error('[DatoCMS] Kategorien-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return [];
    }
  },

  async fetchCategoryBySlug(slug: string) {
    try {
      const q = `
        query CategoryBySlug($slug: String!) {
          category(filter: { slug: { eq: $slug } }) {
            id name slug description color
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q, { slug });
      const record = result.category as Record<string, unknown> | null;
      return (record ? mapCategoryRecord(record) : null) as unknown as Category | null;
    } catch (error) {
      console.error(`[DatoCMS] Kategorie-Fetch "${slug}" fehlgeschlagen:`, error instanceof Error ? error.message : error)
      return null;
    }
  },

  async fetchAllAuthors() {
    try {
      const q = `
        query AllAuthors {
          allAuthors(first: 100) {
            id name slug bio role avatar { url }
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const batch = result.allAuthors;
      if (!Array.isArray(batch)) return [];
      return batch.map((r) => mapAuthorRecord(r as Record<string, unknown>)) as unknown as Author[];
    } catch (error) {
      console.error('[DatoCMS] Autoren-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return [];
    }
  },

  async fetchAuthorBySlug(slug: string) {
    try {
      const q = `
        query AuthorBySlug($slug: String!) {
          author(filter: { slug: { eq: $slug } }) {
            id name slug bio role avatar { url }
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q, { slug });
      const record = result.author as Record<string, unknown> | null;
      return (record ? mapAuthorRecord(record) : null) as unknown as Author | null;
    } catch (error) {
      console.error(`[DatoCMS] Autor-Fetch "${slug}" fehlgeschlagen:`, error instanceof Error ? error.message : error)
      return null;
    }
  },

  async fetchArticlesByAuthor(authorSlug: string) {
    const all = await this.fetchAllArticles();
    return (all as unknown as Record<string, unknown>[]).filter((a) => {
      const auth = a.author as Record<string, unknown> | undefined;
      return auth?.slug === authorSlug;
    }) as unknown as Article[];
  },

  async fetchNewsticker() {
    try {
      const q = `
        query AllNewstickers {
          allNewstickers(first: 20, orderBy: _createdAt_DESC) {
            id tickerType topic headline slug _createdAt isPremium
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const batch = result.allNewstickers;
      if (!Array.isArray(batch)) return [];
      return batch.map((r) => {
        const rec = r as Record<string, unknown>;
        return {
          id: String(rec.id ?? ""),
          type: String(rec.tickerType ?? ""),
          topic: String(rec.topic ?? ""),
          headline: {
            label: String(rec.headline ?? ""),
            href: `/${String(rec.slug ?? "")}`,
          },
          publicationDate: String(rec._createdAt ?? ""),
          isPremium: rec.isPremium === true,
        };
      }) as unknown as NewstickerItem[];
    } catch (error) {
      console.error('[DatoCMS] Newsticker-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return [];
    }
  },

  async fetchVideos() {
    try {
      const q = `
        query AllVideos {
          allVideos(first: 20, orderBy: _createdAt_DESC) {
            id title videoUrl poster durationSeconds caption category _createdAt
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const batch = result.allVideos;
      if (!Array.isArray(batch)) return [];
      return batch.map((r) => {
        const rec = r as Record<string, unknown>;
        const videoUrl = String(rec.videoUrl ?? "");
        return {
          id: String(rec.id ?? ""),
          title: String(rec.title ?? ""),
          sources: videoUrl
            ? [
                {
                  src: videoUrl,
                  extension: videoUrl.endsWith(".m3u8") ? "m3u8" : "mp4",
                },
              ]
            : [],
          poster: String(rec.poster ?? ""),
          durationSeconds: Number(rec.durationSeconds ?? 0),
          caption: String(rec.caption ?? ""),
          category: String(rec.category ?? ""),
          publishedAt: String(rec._createdAt ?? ""),
        };
      }) as unknown as Video[];
    } catch (error) {
      console.error('[DatoCMS] Video-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return [];
    }
  },

  async fetchNavigation() {
    try {
      const q = `
        query Navigation {
          navigation {
            primaryMenuJson
            footerMenuJson
            socialLinksJson
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const nav = result.navigation as Record<string, unknown> | null;
      if (!nav) return { primaryMenu: [], footerMenu: [], socialLinks: [] } as unknown as Navigation;
      const wrapMenuItems = (items: unknown[]): unknown[] =>
        items.map((item) => {
          const i = item as Record<string, unknown>;
          // Already wrapped (e.g. from another CMS)
          if (i.reference) return i;
          return {
            reference: {
              type: "SECTION",
              href: String(i.href ?? ""),
              label: String(i.label ?? ""),
            },
          };
        });
      return {
        primaryMenu: nav.primaryMenuJson
          ? wrapMenuItems(JSON.parse(String(nav.primaryMenuJson)))
          : [],
        footerMenu: nav.footerMenuJson
          ? wrapMenuItems(JSON.parse(String(nav.footerMenuJson)))
          : [],
        socialLinks: nav.socialLinksJson
          ? JSON.parse(String(nav.socialLinksJson))
          : [],
      } as unknown as Navigation;
    } catch (error) {
      console.error('[DatoCMS] Navigation-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return { primaryMenu: [], footerMenu: [], socialLinks: [] } as unknown as Navigation;
    }
  },

  async fetchSiteConfig() {
    try {
      const q = `
        query SiteConfig {
          siteConfig {
            title description url language tags
            socialLinksJson
            analyticsGtmId
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const cfg = result.siteConfig as Record<string, unknown> | null;
      if (!cfg) {
        return {
          title: "",
          description: "",
          url: "",
          language: "de",
          tags: [],
          socialLinks: [],
          analytics: { gtmId: "" },
        } as unknown as SiteConfig;
      }
      return {
        title: String(cfg.title ?? ""),
        description: String(cfg.description ?? ""),
        url: String(cfg.url ?? ""),
        language: String(cfg.language ?? "de"),
        tags: (() => {
          const t = cfg.tags;
          if (Array.isArray(t)) return t.filter((v): v is string => typeof v === 'string');
          if (
            t &&
            typeof t === "object" &&
            Array.isArray((t as Record<string, unknown>).list)
          ) {
            const list = (t as Record<string, unknown>).list;
            return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [];
          }
          return [];
        })(),
        socialLinks: cfg.socialLinksJson
          ? JSON.parse(String(cfg.socialLinksJson))
          : [],
        analytics: { gtmId: String(cfg.analyticsGtmId ?? "") },
      } as unknown as SiteConfig;
    } catch (error) {
      console.error('[DatoCMS] SiteConfig-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return {
        title: "",
        description: "",
        url: "",
        language: "de",
        tags: [],
        socialLinks: [],
        analytics: { gtmId: "" },
      } as unknown as SiteConfig;
    }
  },

  async fetchBreakingNews() {
    try {
      const q = `
        query AllBreakingNews {
          allBreakingNews(first: 10, orderBy: _createdAt_DESC) {
            id headline href severity _createdAt expiresAt
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const batch = result.allBreakingNews;
      if (!Array.isArray(batch)) return [];
      return batch.map((r) => {
        const rec = r as Record<string, unknown>;
        return {
          id: String(rec.id ?? ""),
          headline: String(rec.headline ?? ""),
          href: String(rec.href ?? ""),
          severity: String(rec.severity ?? "alert"),
          publishedAt: String(rec._createdAt ?? ""),
          expiresAt: rec.expiresAt ? String(rec.expiresAt) : undefined,
        };
      }) as unknown as BreakingNews[];
    } catch (error) {
      console.error('[DatoCMS] BreakingNews-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return [];
    }
  },

  async fetchQuiz() {
    try {
      const q = `
        query Quiz {
          quiz {
            date title questionsJson streakRewardsJson
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const quiz = result.quiz as Record<string, unknown> | null;
      if (!quiz)
        return {
          dailyQuiz: { date: "", title: "", questions: [] },
          streakRewards: [],
        } as unknown as Quiz;
      return {
        dailyQuiz: {
          date: String(quiz.date ?? ""),
          title: String(quiz.title ?? ""),
          questions: quiz.questionsJson
            ? JSON.parse(String(quiz.questionsJson))
            : [],
        },
        streakRewards: quiz.streakRewardsJson
          ? JSON.parse(String(quiz.streakRewardsJson))
          : [],
      } as unknown as Quiz;
    } catch (error) {
      console.error('[DatoCMS] Quiz-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return {
        dailyQuiz: { date: "", title: "", questions: [] },
        streakRewards: [],
      } as unknown as Quiz;
    }
  },

  async fetchStockData() {
    try {
      const q = `
        query StockData {
          stock {
            indicesJson watchlistJson chartDataJson
          }
        }
      `;
      const result = await query<Record<string, unknown>>(q);
      const stock = result.stock as Record<string, unknown> | null;
      if (!stock) return { indices: [], watchlist: [], chartData: {} } as unknown as StockData;
      return {
        indices: stock.indicesJson ? JSON.parse(String(stock.indicesJson)) : [],
        watchlist: stock.watchlistJson
          ? JSON.parse(String(stock.watchlistJson))
          : [],
        chartData: stock.chartDataJson
          ? JSON.parse(String(stock.chartDataJson))
          : {},
      } as unknown as StockData;
    } catch (error) {
      console.error('[DatoCMS] StockData-Fetch fehlgeschlagen:', error instanceof Error ? error.message : error)
      return { indices: [], watchlist: [], chartData: {} } as unknown as StockData;
    }
  },
};

export default adapter as unknown as CmsAdapter;
