import Link from "next/link";
import SafeImage from "@/components/ui/SafeImage";
import BadgeGroup from "@/components/ui/BadgeGroup";
import ArticleMeta from "@/components/ui/ArticleMeta";
import { routes } from "@/lib/navigation";
import { IMAGE_DIMENSIONS } from "@/lib/config";
import type { Article } from "@/types";

interface ArticleCardProps {
  article: Article;
  headingLevel?: "h2" | "h3" | "h4";
  variant?: "default" | "hero" | "compact";
  priority?: boolean;
}

export default function ArticleCard({
  article,
  headingLevel = "h3",
  variant = "default",
  priority = false,
}: ArticleCardProps) {
  const Heading = headingLevel;
  const href = routes.article(article.slug);

  if (variant === "hero") {
    return (
      <article className="group relative overflow-hidden rounded-xl bg-(--color-surface) shadow-lg">
        <div className="relative aspect-[21/9] overflow-hidden">
          <SafeImage
            src={article.image.fallbackSrc}
            alt={article.image.alt}
            width={IMAGE_DIMENSIONS.hero.width}
            height={IMAGE_DIMENSIONS.hero.height}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            quality={75}
            className="object-cover"
            unavailableLabel="Bild nicht verfügbar"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-overlay)]/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <BadgeGroup
              category={article.category}
              isPremium={article.isPremium}
              isBreaking={article.isBreaking}
              isOpinion={article.isOpinion}
            />
            <Heading className="mt-3 text-2xl md:text-3xl lg:text-4xl font-bold font-heading text-(--color-on-overlay) leading-tight">
              <Link
                href={href}
                className="hover:underline after:absolute after:inset-0"
              >
                {article.headline}
              </Link>
            </Heading>
            <p className="mt-2 text-sm md:text-base text-(--color-on-overlay)/80 line-clamp-2">
              {article.teaser}
            </p>
            <div className="mt-3">
              <ArticleMeta
                author={article.author}
                publicationDate={article.publicationDate}
                readingTimeMinutes={article.readingTimeMinutes}
                variant="light"
              />
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className="flex gap-4 py-4 border-b border-(--color-divider) last:border-b-0">
        <div className="flex-1 min-w-0">
          <BadgeGroup
            category={article.category}
            isPremium={article.isPremium}
          />
          <Heading className="mt-1 text-base font-semibold font-heading text-(--color-text) leading-snug">
            <Link
              href={href}
              className="hover:text-(--color-primary) transition-colors"
            >
              {article.headline}
            </Link>
          </Heading>
          <ArticleMeta
            author={article.author}
            publicationDate={article.publicationDate}
            className="mt-1"
          />
        </div>
        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden">
          <SafeImage
            src={article.image.fallbackSrc}
            alt={article.image.alt}
            width={IMAGE_DIMENSIONS.compact.width}
            height={IMAGE_DIMENSIONS.compact.height}
            sizes="80px"
            quality={50}
            className="object-cover w-full h-full"
            unavailableLabel="Bild nicht verfügbar"
          />
        </div>
      </article>
    );
  }

  return (
    <article className="group relative overflow-hidden rounded-xl bg-(--color-surface) border border-(--color-border) shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-video overflow-hidden">
        <SafeImage
          src={article.image.fallbackSrc}
          alt={article.image.alt}
          width={IMAGE_DIMENSIONS.card.width}
          height={IMAGE_DIMENSIONS.card.height}
          fill
          priority={priority}
          sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) calc(50vw - 3rem), 350px"
          quality={60}
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          unavailableLabel="Bild nicht verfügbar"
        />
      </div>
      <div className="p-5">
        <BadgeGroup
          category={article.category}
          isPremium={article.isPremium}
          isBreaking={article.isBreaking}
          isOpinion={article.isOpinion}
        />
        <Heading className="mt-2 text-lg font-bold font-heading text-(--color-text) leading-snug">
          <Link
            href={href}
            className="hover:text-(--color-primary) transition-colors after:absolute after:inset-0"
          >
            {article.headline}
          </Link>
        </Heading>
        <p className="mt-2 text-sm text-(--color-text-secondary) line-clamp-2">
          {article.teaser}
        </p>
        <ArticleMeta
          author={article.author}
          publicationDate={article.publicationDate}
          readingTimeMinutes={article.readingTimeMinutes}
          className="mt-3"
        />
      </div>
    </article>
  );
}
