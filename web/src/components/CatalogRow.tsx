import { Link } from "react-router-dom";
import type { CatalogAnime } from "../api";
import { CatalogCard } from "./CatalogCard";

export function CatalogRow({
  title,
  subtitle,
  items,
  section,
  badgeFor,
  className = "",
}: {
  title: string;
  subtitle?: string;
  items: CatalogAnime[];
  section?: string;
  badgeFor?: (anime: CatalogAnime) => string | undefined;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={`catalog-row ${className}`}>
      <div className="catalog-row__header">
        <div>
          <h2 className="catalog-row__title">{title}</h2>
          {subtitle && <p className="catalog-row__subtitle">{subtitle}</p>}
        </div>
        {section && (
          <Link to={`/browse/${section}`} className="catalog-row__more">
            See all →
          </Link>
        )}
      </div>
      <div className="catalog-row__track" tabIndex={0}>
        {items.map((anime) => (
          <CatalogCard
            key={`${section ?? title}-${anime.anilist_id || anime.mal_id}`}
            anime={anime}
            badge={badgeFor?.(anime)}
          />
        ))}
      </div>
    </section>
  );
}
