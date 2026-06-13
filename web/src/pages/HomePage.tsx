import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell, SearchBar } from "../components/Layout";
import { ResolvableAnimeCard } from "../components/AnimeCards";
import { EditorialCard } from "../components/ui/EditorialCard";
import { MetricCard } from "../components/ui/MetricCard";
import { BadgePill } from "../components/ui/BadgePill";
import { api, JikanAnime } from "../api";

export default function HomePage() {
  const navigate = useNavigate();
  const [season, setSeason] = useState<JikanAnime[]>([]);
  const [top, setTop] = useState<JikanAnime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.seasonNow(), api.topAnime()])
      .then(([s, t]) => {
        setSeason(s.data);
        setTop(t.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <EditorialCard tagline="Personal Cinema" title="Curated Anime Collection" className="mb-10">
        <p className="font-sans text-sm text-taupe leading-relaxed max-w-2xl mb-8">
          Click any title to open its detail page — stream episodes in-browser or save for offline.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <BadgePill variant="live">Streaming</BadgePill>
          <BadgePill>Downloads</BadgePill>
          <BadgePill>Self-Hosted</BadgePill>
        </div>
        <SearchBar onSearch={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)} />
      </EditorialCard>

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <MetricCard label="This Season" value={season.length} />
          <MetricCard label="Top Rated" value={top.length} />
          <MetricCard label="Sources" value="3" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="spinner spinner--dark" />
        </div>
      ) : (
        <>
          <CatalogSection tagline="Now Airing" title="This Season" items={season} />
          <CatalogSection tagline="Editor's Picks" title="Top Rated" items={top} className="mt-12" />
        </>
      )}
    </Shell>
  );
}

function CatalogSection({
  tagline,
  title,
  items,
  className = "",
}: {
  tagline: string;
  title: string;
  items: JikanAnime[];
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="card-divider pb-4 mb-6">
        <p className="editorial-tagline mb-1">{tagline}</p>
        <h2 className="editorial-heading text-xl font-semibold m-0">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((a) => (
          <ResolvableAnimeCard
            key={a.mal_id}
            malId={a.mal_id}
            title={a.title_english || a.title}
            image={a.images.jpg.large_image_url}
            score={a.score}
            badge={a.score && a.score >= 8 ? "Top" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
