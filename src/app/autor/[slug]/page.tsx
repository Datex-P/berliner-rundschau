import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import ArticleCard from "@/components/ArticleCard";
import ExternalLink from "@/components/ui/ExternalLink";
import {
  getAuthorBySlug,
  getArticlesByAuthorSlug,
  getAuthors,
} from "@/lib/data";
import { SITE_CONFIG } from "@/lib/config";
import { personJsonLd } from "@/lib/json-ld";

interface AuthorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const authors = await getAuthors();
  const params = authors.map((a) => ({ slug: a.slug }));
  return params.length > 0 ? params : [{ slug: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);

  if (!author) {
    return { title: "Autor nicht gefunden" };
  }

  return {
    title: author.name,
    description: author.bio,
    openGraph: {
      title: `${author.name} | ${SITE_CONFIG.name}`,
      description: author.bio,
    },
  };
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params;

  const [author, articles] = await Promise.all([
    getAuthorBySlug(slug),
    getArticlesByAuthorSlug(slug),
  ]);

  if (!author) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            personJsonLd(
              author.name,
              `${SITE_CONFIG.url}/autor/${author.slug}`,
              author.avatar,
            ),
          ),
        }}
      />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Author Profile */}
        <header className="flex flex-col sm:flex-row items-start gap-6">
          <div className="flex-shrink-0">
            <SafeImage
              src={author.avatar}
              alt={`Foto von ${author.name}`}
              width={120}
              height={120}
              sizes="120px"
              className="rounded-full object-cover w-30 h-30"
              unavailableLabel="Avatar nicht verfügbar"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold font-heading text-(--color-text)">
              {author.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-(--color-primary)">
              {author.role}
            </p>
            <p className="mt-3 text-(--color-text-secondary) leading-relaxed">
              {author.bio}
            </p>

            {/* Social Links */}
            {author.socialLinks && (
              <div className="mt-4 flex gap-3">
                {author.socialLinks.twitter && (
                  <ExternalLink
                    href={author.socialLinks.twitter}
                    className="p-2 rounded-lg text-(--color-text-secondary) hover:text-(--color-primary) hover:bg-(--color-surface) transition-colors"
                    aria-label={`${author.name} auf X`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </ExternalLink>
                )}
                {author.socialLinks.linkedin && (
                  <ExternalLink
                    href={author.socialLinks.linkedin}
                    className="p-2 rounded-lg text-(--color-text-secondary) hover:text-(--color-primary) hover:bg-(--color-surface) transition-colors"
                    aria-label={`${author.name} auf LinkedIn`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </ExternalLink>
                )}
                {author.socialLinks.website && (
                  <ExternalLink
                    href={author.socialLinks.website}
                    className="p-2 rounded-lg text-(--color-text-secondary) hover:text-(--color-primary) hover:bg-(--color-surface) transition-colors"
                    aria-label={`Website von ${author.name}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </ExternalLink>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Articles by author */}
        <section className="mt-10" aria-labelledby="author-articles-heading">
          <h2
            id="author-articles-heading"
            className="text-2xl font-bold font-heading text-(--color-text) mb-6 pb-3 border-b-2 border-(--color-primary)"
          >
            Artikel von {author.name}
          </h2>

          {articles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  headingLevel="h3"
                />
              ))}
            </div>
          ) : (
            <p className="text-(--color-text-secondary) py-8 text-center">
              Noch keine Artikel von diesem Autor veröffentlicht.
            </p>
          )}

          <div aria-live="polite" className="sr-only">
            {articles.length} Artikel von {author.name}
          </div>
        </section>

        {/* Back link */}
        <div className="mt-10 pt-6 border-t border-(--color-divider)">
          <Link
            href="/"
            className="text-sm font-medium text-(--color-link) hover:text-(--color-link-hover) transition-colors"
          >
            &larr; Zurück zur Startseite
          </Link>
        </div>
      </div>
    </>
  );
}
