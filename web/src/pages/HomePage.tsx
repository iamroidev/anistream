import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell, SearchBar } from "../components/Layout";
import { ResolvableAnimeCard } from "../components/AnimeCards";
import { EditorialCard } from "../components/ui/EditorialCard";
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
      <EditorialCard title="Curated Anime Collection" className="mb-10">
        <p className="font-sans text-sm text-taupe leading-relaxed max-w-2xl mb-8">
          Stream in-browser or save for offline — click any title for episodes.
        </p>
        <SearchBar onSearch={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)} />
      </EditorialCard>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="spinner spinner--dark" />
        </div>
      ) : (
        <>
          <CatalogSection title="This Season" items={season} />
          <CatalogSection title="Top Rated" items={top} className="mt-12" />
        </>
      )}
    </Shell>
  );
}

function CatalogSection({
  title,
  items,
  className = "",
}: {
  title: string;
  items: JikanAnime[];
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="editorial-heading text-xl font-semibold m-0 card-divider pb-4 mb-6">{title}</h2>
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
