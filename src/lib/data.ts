import "server-only";
import { cacheLife } from "next/cache";
import { cacheTag } from "next/cache";
import type {
  Article,
  BreakingNews,
  Category,
  Author,
  NewstickerItem,
  Quiz,
  StockData,
  Video,
  Navigation,
  SiteConfig,
} from "@/types";
import { resolveAdapter } from "./cms";
import {
  isRecord,
  parseArticlesResponse,
  parseArticle,
  parseCategoriesResponse,
  parseCategory,
  parseAuthorsResponse,
  parseAuthor,
  parseSlugEntriesResponse,
  parseBreakingNewsResponse,
  parseNewstickerResponse,
  parseVideosResponse,
  parseNavigation,
  parseSiteConfig,
  parseQuiz,
  parseStockData,
} from "./parseResponse";
import { sanitizeError } from "./cms/http";
import {
  defaultNavigation,
  defaultSiteConfig,
  defaultQuiz,
  defaultStockData,
} from "./cms/defaults";

const adapterTag = () => `cms:${process.env.CMS_ADAPTER ?? "auto"}`;

// --- Essentiell (Fehler propagieren) ---

export async function getArticles(): Promise<Article[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(adapterTag(), "articles");
  const adapter = await resolveAdapter();
  return parseArticlesResponse(await adapter.fetchAllArticles());
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(adapterTag(), "articles", `article-${slug.slice(0, 128)}`);
  const adapter = await resolveAdapter();
  const raw = await adapter.fetchArticleBySlug(slug);
  if (!raw || !isRecord(raw)) return null;
  return parseArticle(raw);
}

export async function getArticlesByCategory(
  categorySlug: string,
): Promise<Article[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(
    adapterTag(),
    "articles",
    `category-articles-${categorySlug.slice(0, 128)}`,
  );
  const adapter = await resolveAdapter();
  return parseArticlesResponse(
    await adapter.fetchArticlesByCategory(categorySlug),
  );
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("days");
  cacheTag(adapterTag(), "categories");
  const adapter = await resolveAdapter();
  return parseCategoriesResponse(await adapter.fetchAllCategories());
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  "use cache";
  cacheLife("days");
  cacheTag(adapterTag(), "categories", `category-${slug.slice(0, 128)}`);
  const adapter = await resolveAdapter();
  const raw = await adapter.fetchCategoryBySlug(slug);
  if (!raw || !isRecord(raw)) return null;
  return parseCategory(raw);
}

export async function getAuthors(): Promise<Author[]> {
  "use cache";
  cacheLife("days");
  cacheTag(adapterTag(), "authors");
  const adapter = await resolveAdapter();
  return parseAuthorsResponse(await adapter.fetchAllAuthors());
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  "use cache";
  cacheLife("days");
  cacheTag(adapterTag(), "authors", `author-${slug.slice(0, 128)}`);
  const adapter = await resolveAdapter();
  const raw = await adapter.fetchAuthorBySlug(slug);
  if (!raw || !isRecord(raw)) return null;
  return parseAuthor(raw);
}

export async function getArticlesByAuthorSlug(
  authorSlug: string,
): Promise<Article[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(
    adapterTag(),
    "articles",
    `author-articles-${authorSlug.slice(0, 128)}`,
  );
  const adapter = await resolveAdapter();
  return parseArticlesResponse(await adapter.fetchArticlesByAuthor(authorSlug));
}

export async function searchArticles(query: string): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  const safeQuery = query.slice(0, 100).toLowerCase().trim();
  cacheTag(adapterTag(), "search");
  const adapter = await resolveAdapter();
  return parseArticlesResponse(await adapter.searchArticlesByQuery(safeQuery));
}

export async function getArticleSlugs(): Promise<
  Array<{ slug: string; modified: string }>
> {
  "use cache";
  cacheLife("hours");
  cacheTag(adapterTag(), "articles", "slugs");
  const adapter = await resolveAdapter();
  return parseSlugEntriesResponse(await adapter.fetchArticleSlugs());
}

// --- Nicht-essentiell (try/catch + Fallback) ---

export async function getNewstickerItems(): Promise<NewstickerItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(adapterTag(), "newsticker");
  try {
    const adapter = await resolveAdapter();
    return parseNewstickerResponse(await adapter.fetchNewsticker());
  } catch (err) {
    console.error(
      "[cms] Newsticker fetch failed, returning empty:",
      sanitizeError(err),
    );
    return [];
  }
}

export async function getVideos(): Promise<Video[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(adapterTag(), "videos");
  try {
    const adapter = await resolveAdapter();
    return parseVideosResponse(await adapter.fetchVideos());
  } catch (err) {
    console.error(
      "[cms] Videos fetch failed, returning empty:",
      sanitizeError(err),
    );
    return [];
  }
}

export async function getNavigation(): Promise<Navigation> {
  "use cache";
  cacheLife("days");
  cacheTag(adapterTag(), "navigation");
  try {
    const adapter = await resolveAdapter();
    const raw = await adapter.fetchNavigation();
    if (!isRecord(raw)) return defaultNavigation;
    const parsed = parseNavigation(raw);
    if (!parsed.primaryMenu.length) return defaultNavigation;
    return parsed;
  } catch (err) {
    console.error(
      "[cms] Navigation fetch failed, using default:",
      sanitizeError(err),
    );
    return defaultNavigation;
  }
}

export async function getSiteConfig(): Promise<SiteConfig> {
  "use cache";
  cacheLife("days");
  cacheTag(adapterTag(), "site-config");
  try {
    const adapter = await resolveAdapter();
    const raw = await adapter.fetchSiteConfig();
    if (!isRecord(raw)) return defaultSiteConfig;
    return parseSiteConfig(raw);
  } catch (err) {
    console.error(
      "[cms] SiteConfig fetch failed, using default:",
      sanitizeError(err),
    );
    return defaultSiteConfig;
  }
}

export async function getBreakingNewsItems(): Promise<BreakingNews[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(adapterTag(), "breaking-news");
  try {
    const adapter = await resolveAdapter();
    return parseBreakingNewsResponse(await adapter.fetchBreakingNews());
  } catch (err) {
    console.error(
      "[cms] BreakingNews fetch failed, returning empty:",
      sanitizeError(err),
    );
    return [];
  }
}

export async function getQuizData(): Promise<Quiz> {
  "use cache";
  cacheLife("hours");
  cacheTag(adapterTag(), "quiz");
  try {
    const adapter = await resolveAdapter();
    const raw = await adapter.fetchQuiz();
    if (!isRecord(raw)) return defaultQuiz;
    return parseQuiz(raw);
  } catch (err) {
    console.error(
      "[cms] Quiz fetch failed, using default:",
      sanitizeError(err),
    );
    return defaultQuiz;
  }
}

export async function getStockData(): Promise<StockData> {
  "use cache";
  cacheLife("minutes");
  cacheTag(adapterTag(), "stocks");
  try {
    const adapter = await resolveAdapter();
    const raw = await adapter.fetchStockData();
    if (!isRecord(raw)) return defaultStockData;
    return parseStockData(raw);
  } catch (err) {
    console.error(
      "[cms] StockData fetch failed, using default:",
      sanitizeError(err),
    );
    return defaultStockData;
  }
}
