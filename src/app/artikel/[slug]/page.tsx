import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import SanitizedHtml from "@/components/ui/SanitizedHtml";
import BadgeGroup from "@/components/ui/BadgeGroup";
import ArticleMeta from "@/components/ui/ArticleMeta";
import TagList from "@/components/ui/TagList";
import { getArticleBySlug, getArticles } from "@/lib/data";
import { SITE_CONFIG, IMAGE_DIMENSIONS } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { articleJsonLd } from "@/lib/json-ld";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const articles = await getArticles();
  const params = articles.map((a) => ({ slug: a.slug }));
  return params.length > 0 ? params : [{ slug: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return { title: "Artikel nicht gefunden" };
  }

  const title = article.seoTitle ?? article.headline;
  const description = article.seoDescription ?? article.teaser;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article.publicationDate,
      modifiedTime: article.updatedAt,
      authors: [article.author.name],
      images: [
        {
          url: article.image.fallbackSrc,
          width: IMAGE_DIMENSIONS.article.width,
          height: IMAGE_DIMENSIONS.article.height,
          alt: article.image.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [article.image.fallbackSrc],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleJsonLd({
              headline: article.headline,
              description: article.teaser,
              image: article.image.fallbackSrc,
              datePublished: article.publicationDate,
              dateModified: article.updatedAt ?? article.publicationDate,
              author: article.author.name,
              publisher: SITE_CONFIG.name,
            }),
          ),
        }}
      />

      <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header>
          <BadgeGroup
            category={article.category}
            isPremium={article.isPremium}
            isBreaking={article.isBreaking}
            isOpinion={article.isOpinion}
          />
          <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-(--color-text) leading-tight">
            {article.headline}
          </h1>
          <p className="mt-4 text-lg text-(--color-text-secondary) leading-relaxed">
            {article.teaser}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ArticleMeta
              author={article.author}
              publicationDate={article.publicationDate}
              readingTimeMinutes={article.readingTimeMinutes}
            />
            {article.updatedAt && (
              <span className="text-sm text-(--color-text-tertiary)">
                Aktualisiert:{" "}
                <time dateTime={article.updatedAt}>
                  {formatDate(article.updatedAt)}
                </time>
              </span>
            )}
          </div>
        </header>

        {/* Hero Image */}
        <figure className="mt-8">
          <div className="relative aspect-video rounded-xl overflow-hidden">
            <SafeImage
              src={article.image.fallbackSrc}
              alt={article.image.alt}
              width={IMAGE_DIMENSIONS.article.width}
              height={IMAGE_DIMENSIONS.article.height}
              priority
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover w-full h-full"
              unavailableLabel="Bild nicht verfügbar"
            />
          </div>
          {(article.image.caption || article.image.credit) && (
            <figcaption className="mt-2 text-sm text-(--color-text-tertiary)">
              {article.image.caption}
              {article.image.caption && article.image.credit && " — "}
              {article.image.credit && (
                <span className="italic">{article.image.credit}</span>
              )}
            </figcaption>
          )}
        </figure>

        {/* AI Summary */}
        {article.aiSummary && (
          <details className="mt-8 rounded-lg bg-(--color-primary-light) border border-(--color-primary)/20 overflow-hidden">
            <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-(--color-primary) hover:bg-(--color-primary)/5 transition-colors">
              KI-Zusammenfassung anzeigen
            </summary>
            <p className="px-5 pb-4 text-sm text-(--color-text-secondary) leading-relaxed">
              {article.aiSummary}
            </p>
          </details>
        )}

        {/* Paywall overlay for premium articles */}
        {article.isPremium && article.paywall === "paid" && (
          <div className="mt-8 p-6 rounded-xl bg-(--color-warning-light) border border-(--color-warning)/30 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mx-auto text-(--color-warning-text)"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 className="mt-3 text-lg font-bold text-(--color-warning-text)">
              Premium-Artikel
            </h2>
            <p className="mt-2 text-sm text-(--color-warning-text)/80">
              Dieser Artikel ist nur für Abonnenten verfügbar. Schließen Sie ein
              Abo ab, um alle Inhalte freizuschalten.
            </p>
            <button
              type="button"
              className="mt-4 px-6 py-2 bg-(--color-primary) text-(--color-on-primary) rounded-lg font-medium hover:bg-(--color-primary-hover) transition-colors"
            >
              Jetzt Abo abschließen
            </button>
          </div>
        )}

        {/* Article Body */}
        {!(article.isPremium && article.paywall === "paid") && (
          <div className="mt-8">
            <SanitizedHtml
              html={article.body}
              className="prose prose-lg max-w-none text-(--color-text) prose-headings:font-heading prose-headings:text-(--color-text) prose-a:text-(--color-link) hover:prose-a:text-(--color-link-hover) prose-blockquote:border-l-(--color-primary) prose-blockquote:text-(--color-text-secondary)"
              as="div"
            />
          </div>
        )}

        {/* Tags */}
        <TagList
          tags={article.tags}
          className="mt-8 pt-6 border-t border-(--color-divider)"
        />

        {/* Source */}
        {article.source && (
          <p className="mt-4 text-sm text-(--color-text-tertiary)">
            Quelle: {article.source}
          </p>
        )}

        {/* Comments preview */}
        {article.comments.length > 0 && (
          <section
            className="mt-10 pt-8 border-t border-(--color-divider)"
            aria-labelledby="comments-heading"
          >
            <h2
              id="comments-heading"
              className="text-xl font-bold font-heading text-(--color-text) mb-6"
            >
              Kommentare ({article.commentCount})
            </h2>
            <div className="space-y-6">
              {article.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-4 rounded-lg bg-(--color-surface) border border-(--color-border)"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-(--color-text)">
                      {comment.author}
                    </span>
                    <time
                      dateTime={comment.date}
                      className="text-xs text-(--color-text-tertiary)"
                    >
                      {formatDate(comment.date)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm text-(--color-text-secondary)">
                    {comment.text}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-(--color-text-tertiary)">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span>{comment.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Back link */}
        <div className="mt-10 pt-6 border-t border-(--color-divider)">
          <Link
            href="/"
            className="text-sm font-medium text-(--color-link) hover:text-(--color-link-hover) transition-colors"
          >
            &larr; Zurück zur Startseite
          </Link>
        </div>
      </article>
    </>
  );
}
