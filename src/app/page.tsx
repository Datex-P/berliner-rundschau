import type { Metadata } from "next";
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import StockWidget from "@/components/StockWidget";
import QuizWidget from "@/components/QuizWidget";
import {
  getArticles,
  getNewstickerItems,
  getVideos,
  getQuizData,
  getStockData,
} from "@/lib/data";
import { SITE_CONFIG } from "@/lib/config";
import { formatDuration } from "@/lib/format";
import RelativeTime from "@/components/ui/RelativeTime";
import SafeImage from "@/components/ui/SafeImage";

export const metadata: Metadata = {
  title: `Startseite | ${SITE_CONFIG.name}`,
  description: SITE_CONFIG.description,
  openGraph: {
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
  },
};

export default async function HomePage() {
  // G-02: parallel data fetching
  const [articles, newsticker, videos, quizData, stockData] = await Promise.all(
    [
      getArticles(),
      getNewstickerItems(),
      getVideos(),
      getQuizData(),
      getStockData(),
    ],
  );

  const featured = articles.find((a) => a.isFeatured) ?? articles[0];
  const remaining = articles.filter((a) => a.id !== featured?.id);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      {featured && (
        <section aria-labelledby="hero-heading">
          <h2 id="hero-heading" className="sr-only">
            Topthema
          </h2>
          <ArticleCard article={featured} variant="hero" headingLevel="h2" />
        </section>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Article List — Main Column */}
        <section className="lg:col-span-2" aria-labelledby="articles-heading">
          <h2
            id="articles-heading"
            className="text-2xl font-bold font-heading text-(--color-text) mb-6"
          >
            Aktuelle Nachrichten
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {remaining.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                headingLevel="h3"
                priority={index === 0}
              />
            ))}
          </div>
          <div aria-live="polite" className="sr-only">
            {remaining.length} Artikel angezeigt
          </div>
        </section>

        {/* Sidebar */}
        <aside aria-labelledby="sidebar-heading" className="space-y-8">
          <h2 id="sidebar-heading" className="sr-only">
            Seitenleiste
          </h2>

          {/* Newsticker */}
          {newsticker.length > 0 && (
            <section aria-labelledby="newsticker-heading">
              <h3
                id="newsticker-heading"
                className="text-lg font-bold font-heading text-(--color-text) mb-4 pb-2 border-b-2 border-(--color-accent)"
              >
                Newsticker
              </h3>
              <div className="space-y-0">
                {newsticker.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 border-b border-(--color-divider) last:border-b-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-(--color-primary)">
                        {item.topic}
                      </span>
                      <RelativeTime
                        dateTime={item.publicationDate}
                        className="text-xs text-(--color-text-tertiary)"
                      />
                      {item.isPremium && (
                        <span className="text-xs text-(--color-warning-text)">
                          Premium
                        </span>
                      )}
                    </div>
                    <Link
                      href={item.headline.href}
                      className="text-sm font-medium text-(--color-text) hover:text-(--color-primary) transition-colors leading-snug"
                    >
                      {item.headline.label}
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Börse */}
          {stockData.indices.length > 0 && <StockWidget data={stockData} />}

          {/* Tagesquiz */}
          <QuizWidget data={quizData} />

          {/* Compact Articles */}
          <section aria-labelledby="trending-heading">
            <h3
              id="trending-heading"
              className="text-lg font-bold font-heading text-(--color-text) mb-4 pb-2 border-b-2 border-(--color-primary)"
            >
              Meistgelesen
            </h3>
            {remaining
              .toSorted((a, b) => b.commentCount - a.commentCount)
              .slice(0, 3)
              .map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  variant="compact"
                  headingLevel="h4"
                />
              ))}
          </section>
        </aside>
      </div>

      {/* Video Section */}
      {videos.length > 0 && (
        <section className="mt-12" aria-labelledby="video-heading">
          <h2
            id="video-heading"
            className="text-2xl font-bold font-heading text-(--color-text) mb-6"
          >
            Videos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <article
                key={video.id}
                className="rounded-xl overflow-hidden bg-(--color-surface) border border-(--color-border) shadow-sm"
              >
                <div className="relative aspect-video">
                  <SafeImage
                    src={video.poster}
                    alt={video.title}
                    width={640}
                    height={360}
                    fill
                    sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) calc(50vw - 3rem), 350px"
                    className="object-cover"
                    unavailableLabel="Video nicht verfügbar"
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-(--color-overlay)/80 text-(--color-on-overlay) text-xs font-medium rounded">
                    {formatDuration(video.durationSeconds)}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-(--color-overlay)/60 rounded-full flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="var(--color-on-overlay)"
                        aria-hidden="true"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold font-heading text-(--color-text) leading-snug">
                    {video.title}
                  </h3>
                  <p className="mt-1 text-xs text-(--color-text-secondary) line-clamp-2">
                    {video.caption}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
