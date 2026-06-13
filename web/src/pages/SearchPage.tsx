import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shell, SearchBar } from "../components/Layout";
import { ResolvableAnimeCard, StreamAnimeCard } from "../components/AnimeCards";
import { EditorialCard } from "../components/ui/EditorialCard";
import { api, JikanAnime, StreamAnime } from "../api";

export default function SearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [metadata, setMetadata] = useState<JikanAnime[]>([]);
  const [streams, setStreams] = useState<StreamAnime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.metadataSearch(q).catch(() => ({ data: [] as JikanAnime[] })),
      api.streamSearch(q).catch(() => ({ animes: [] as StreamAnime[] })),
    ])
      .then(([m, s]) => {
        setMetadata(m.data);
        setStreams(s.animes);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <Shell>
      <EditorialCard
        tagline="Discover"
        title={q ? `Results for “${q}”` : "Search the Catalog"}
        className="mb-10"
      >
        <SearchBar
          defaultValue={q}
          loading={loading}
          onSearch={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
        />
      </EditorialCard>

      {loading && (
        <div className="flex justify-center py-12">
          <span className="spinner spinner--dark" />
        </div>
      )}
      {error && (
        <EditorialCard title="Something went wrong">
          <p className="font-sans text-sm text-taupe">{error}</p>
        </EditorialCard>
      )}

      {!loading && streams.length > 0 && (
        <section className="mb-12">
          <div className="card-divider pb-4 mb-6">
            <p className="editorial-tagline mb-1">Available to Stream</p>
            <h2 className="editorial-heading text-xl font-semibold m-0">Watch Now</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {streams.map((a) => (
              <StreamAnimeCard
                key={a.id}
                id={a.id}
                title={a.name}
                image={a.poster}
                provider={a.provider}
                badge="Stream"
              />
            ))}
          </div>
        </section>
      )}

      {!loading && metadata.length > 0 && (
        <section>
          <div className="card-divider pb-4 mb-6">
            <p className="editorial-tagline mb-1">MyAnimeList</p>
            <h2 className="editorial-heading text-xl font-semibold m-0">Browse Catalog</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {metadata.map((a) => (
              <ResolvableAnimeCard
                key={a.mal_id}
                malId={a.mal_id}
                title={a.title_english || a.title}
                image={a.images.jpg.large_image_url}
                score={a.score}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && q && streams.length === 0 && metadata.length === 0 && (
        <EditorialCard tagline="No Matches" title="Try another search">
          <p className="font-sans text-sm text-taupe">
            No results found for &ldquo;{q}&rdquo;. Check spelling or try the Japanese title.
          </p>
        </EditorialCard>
      )}
    </Shell>
  );
}
