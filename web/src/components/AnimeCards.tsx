import { Link } from "react-router-dom";

export function ResolvableAnimeCard({
  title,
  image,
  score,
  malId,
  badge,
}: {
  title: string;
  image: string;
  score?: number | null;
  malId?: number;
  badge?: string;
}) {
  if (!malId) {
    return (
      <Link to={`/search?q=${encodeURIComponent(title)}`} className="anime-card group">
        <AnimeCardBody title={title} image={image} score={score} badge={badge} />
      </Link>
    );
  }

  const params = new URLSearchParams({ mal: String(malId) });
  return (
    <Link to={`/anime/${malId}?${params}`} className="anime-card group">
      <AnimeCardBody title={title} image={image} score={score} badge={badge} />
    </Link>
  );
}

export function StreamAnimeCard({
  id,
  title,
  image,
  malId,
  provider,
  badge,
  score,
}: {
  id: string;
  title: string;
  image: string;
  malId?: number;
  provider?: string;
  badge?: string;
  score?: number | null;
}) {
  const params = new URLSearchParams();
  if (malId) params.set("mal", String(malId));
  if (provider) params.set("provider", provider);
  const qs = params.toString();
  return (
    <Link to={`/anime/${id}${qs ? `?${qs}` : ""}`} className="anime-card group">
      <AnimeCardBody title={title} image={image} score={score} badge={badge} />
    </Link>
  );
}

function AnimeCardBody({
  title,
  image,
  score,
  badge,
}: {
  title: string;
  image: string;
  score?: number | null;
  badge?: string;
}) {
  return (
    <>
      <div className="aspect-[2/3] overflow-hidden relative">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {badge && (
          <span className="absolute top-2 right-2">
            <span className="badge-pill badge-pill--live">{badge}</span>
          </span>
        )}
      </div>
      <div className="p-3 border-t border-[var(--border-color)]">
        <h3 className="anime-card__title line-clamp-2 m-0">{title}</h3>
        {score != null && (
          <p className="mt-1.5 text-xs font-sans font-medium tracking-wide theme-accent-text">
            ★ {score.toFixed(1)}
          </p>
        )}
      </div>
    </>
  );
}
