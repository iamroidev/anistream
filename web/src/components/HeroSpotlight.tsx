import { Link } from "react-router-dom";
import type { CatalogAnime } from "../api";
import { catalogAnimePath, catalogTitle, stripHtml } from "../lib/catalog";
import { LuxuryButton } from "./ui/LuxuryButton";

export function HeroSpotlight({ featured }: { featured: CatalogAnime | null }) {
  if (!featured) return null;

  const title = catalogTitle(featured);
  const banner = featured.banner_image ?? featured.images.jpg.large_image_url;
  const synopsis = stripHtml(featured.synopsis).slice(0, 220);
  const genres = featured.genres?.slice(0, 4).map((g) => g.name) ?? [];

  return (
    <section className="hero-spotlight">
      <img src={banner} alt="" className="hero-spotlight__bg" loading="eager" />
      <div className="hero-spotlight__shade" aria-hidden />
      <div className="hero-spotlight__content">
        <p className="hero-spotlight__eyebrow">Featured · Spotlight</p>
        <h1 className="hero-spotlight__title">{title}</h1>
        <div className="hero-spotlight__meta">
          {featured.score != null && <span>★ {featured.score.toFixed(1)}</span>}
          {featured.status && <span>{featured.status.replace(/_/g, " ")}</span>}
          {featured.episodes != null && featured.episodes > 0 && (
            <span>{featured.episodes} eps</span>
          )}
        </div>
        {genres.length > 0 && (
          <div className="hero-spotlight__genres">
            {genres.map((g) => (
              <Link
                key={g}
                to={`/browse/genre?genre=${encodeURIComponent(g)}`}
                className="badge-pill no-underline"
              >
                {g}
              </Link>
            ))}
          </div>
        )}
        {synopsis && <p className="hero-spotlight__synopsis">{synopsis}…</p>}
        <Link to={catalogAnimePath(featured)} className="inline-flex mt-6 no-underline">
          <LuxuryButton>Watch Now</LuxuryButton>
        </Link>
      </div>
    </section>
  );
}
