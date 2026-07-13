import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import {
  getCategoryBySlug,
  getArticlesByCategory,
  getCategories,
} from "@/lib/data";
import { SITE_CONFIG } from "@/lib/config";
import { collectionPageJsonLd } from "@/lib/json-ld";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const categories = await getCategories();
  const params = categories.map((c) => ({ slug: c.slug }));
  return params.length > 0 ? params : [{ slug: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: "Kategorie nicht gefunden" };
  }

  return {
    title: category.name,
    description: category.description || `Alle Artikel in ${category.name}`,
    openGraph: {
      title: `${category.name} | ${SITE_CONFIG.name}`,
      description: category.description || `Alle Artikel in ${category.name}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  // G-02: parallel data fetching
  const [category, articles] = await Promise.all([
    getCategoryBySlug(slug),
    getArticlesByCategory(slug),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            collectionPageJsonLd(
              category.name,
              `${SITE_CONFIG.url}/kategorie/${category.slug}`,
              category.description,
            ),
          ),
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold font-heading text-(--color-text)">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 text-lg text-(--color-text-secondary) max-w-2xl">
              {category.description}
            </p>
          )}
          <div className="mt-2 text-sm text-(--color-text-tertiary)">
            {articles.length} {articles.length === 1 ? "Artikel" : "Artikel"}
          </div>
        </header>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                headingLevel="h2"
              />
            ))}
          </div>
        ) : (
          <p className="text-(--color-text-secondary) py-12 text-center">
            Keine Artikel in dieser Kategorie vorhanden.
          </p>
        )}

        <div aria-live="polite" className="sr-only">
          {articles.length} Artikel in der Kategorie {category.name}
        </div>
      </div>
    </>
  );
}
