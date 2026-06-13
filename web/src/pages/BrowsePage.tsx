import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Shell } from "../components/Layout";
import { CatalogCard } from "../components/CatalogCard";
import { EditorialCard } from "../components/ui/EditorialCard";
import { LuxuryButton } from "../components/ui/LuxuryButton";
import { api, CatalogAnime } from "../api";
import { formatPremiereDate } from "../lib/formatAirDate";

const SECTION_LABELS: Record<string, string> = {
  trending: "Trending Now",
  popular: "Popular",
  recent: "New Episodes",
  upcoming: "Coming Soon",
  season: "This Season",
  top: "Top Rated",
  genre: "Genre",
};

export default function BrowsePage() {
  const { section = "trending" } = useParams<{ section: string }>();
  const [params] = useSearchParams();
  const genre = params.get("genre") ?? undefined;

  const [items, setItems] = useState<CatalogAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title =
    section === "genre" && genre
      ? `${genre} Anime`
      : SECTION_LABELS[section] ?? "Browse";

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .browseSection(section, genre)
      .then((r) => setItems(r.data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [section, genre]);

  return (
    <Shell wide>
      <div className="mb-6">
        <Link
          to="/"
          className="font-sans text-xs uppercase tracking-widest text-taupe no-underline hover:text-gold-dark transition"
        >
          ← Home
        </Link>
      </div>

      <EditorialCard tagline="Browse" title={title} className="mb-8">
        <p className="font-sans text-sm text-taupe m-0">
          {items.length > 0
            ? `${items.length} titles — tap any poster to stream.`
            : "Curated catalog from AniList."}
        </p>
      </EditorialCard>

      {loading && (
        <div className="flex justify-center py-16">
          <span className="spinner spinner--dark" />
        </div>
      )}

      {error && !loading && (
        <EditorialCard title="Could not load">
          <p className="font-sans text-sm text-taupe mb-4">{error}</p>
          <LuxuryButton variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </LuxuryButton>
        </EditorialCard>
      )}

      {!loading && !error && (
        <div className="browse-grid">
          {items.map((anime) => (
            <CatalogCard
              key={`${section}-${anime.anilist_id || anime.mal_id}`}
              anime={anime}
              badge={
                section === "upcoming"
                  ? formatPremiereDate(anime.start_date ?? anime.next_airing_at) ?? undefined
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </Shell>
  );
}
