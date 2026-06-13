import { Link } from "react-router-dom";
import type { CatalogAnime } from "../api";
import { catalogAnimePath, catalogTitle } from "../lib/catalog";

export function CatalogCard({
  anime,
  badge,
  compact = false,
}: {
  anime: CatalogAnime;
  badge?: string;
  compact?: boolean;
}) {
  const title = catalogTitle(anime);
  const poster = anime.images.jpg.large_image_url;

  return (
    <Link
      to={catalogAnimePath(anime)}
      className={`catalog-card group ${compact ? "catalog-card--compact" : ""}`}
    >
      <div className="catalog-card__poster">
        <img src={poster} alt={title} loading="lazy" />
        {badge && <span className="catalog-card__badge">{badge}</span>}
        {anime.score != null && (
          <span className="catalog-card__score">★ {anime.score.toFixed(1)}</span>
        )}
      </div>
      {!compact && (
        <p className="catalog-card__title">{title}</p>
      )}
    </Link>
  );
}
