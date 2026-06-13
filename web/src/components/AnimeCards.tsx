import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function openAnime() {
    if (loading) return;
    setLoading(true);
    try {
      const { animes } = await api.streamSearch(title);
      const match = animes[0];
      if (match?.id) {
        const params = new URLSearchParams();
        if (malId) params.set("mal", String(malId));
        if (match.provider) params.set("provider", match.provider);
        const qs = params.toString();
        navigate(`/anime/${match.id}${qs ? `?${qs}` : ""}`);
        return;
      }
    } catch {
      /* fall through */
    }
    setLoading(false);
    navigate(`/search?q=${encodeURIComponent(title)}`);
  }

  return (
    <button
      type="button"
      className="anime-card group text-left w-full"
      onClick={openAnime}
      disabled={loading}
    >
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
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ivory/70 backdrop-blur-sm">
            <span className="spinner spinner--dark" />
          </div>
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
    </button>
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
    </Link>
  );
}
